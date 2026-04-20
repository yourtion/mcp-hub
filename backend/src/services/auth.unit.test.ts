/**
 * 认证服务测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.js';

// Mock bcryptjs 以消除哈希计算时间
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$10$mockedhashvalue'),
    compare: vi
      .fn()
      .mockImplementation(async (password: string, _hash: string) => {
        // 简单判断：如果密码匹配测试配置中的密码则返回 true
        return password === 'password' || password === 'admin123';
      }),
  },
}));

// Mock getAllConfig to return in-memory config
// Note: vi.mock factory is hoisted, so config must be inlined (not referenced via top-level variable)
vi.mock('../utils/config.js', () => ({
  getAllConfig: vi.fn().mockResolvedValue({
    mcps: { servers: {} },
    groups: {},
    system: {
      server: { port: 3000, host: 'localhost' },
      auth: {
        jwt: {
          secret: 'test-secret-key',
          expiresIn: '15m',
          refreshExpiresIn: '7d',
          issuer: 'mcp-hub-test',
        },
        security: {
          maxLoginAttempts: 3,
          lockoutDuration: 300000,
          passwordMinLength: 4,
          requireStrongPassword: false,
        },
      },
      users: {
        testuser: {
          id: 'testuser',
          username: 'testuser',
          password: 'password',
          role: 'user',
          groups: ['test-group'],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      },
      ui: {
        title: 'Test MCP Hub',
        theme: 'light',
        features: { apiToMcp: true, debugging: true, monitoring: true },
      },
      monitoring: { metricsEnabled: true, logLevel: 'info', retentionDays: 30 },
    },
    apiToolsConfigPath: undefined,
  }),
  resetConfigInstances: vi.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该成功初始化认证服务', async () => {
      await expect(authService.initialize()).resolves.not.toThrow();
    });

    it('应该在配置文件不存在时使用默认配置初始化', async () => {
      const { getAllConfig } = await import('../utils/config.js');

      // Mock getAllConfig to return empty system config for this test
      // biome-ignore lint/suspicious/noExplicitAny: mock requires flexible return type
      (vi.mocked(getAllConfig) as any).mockImplementationOnce(async () =>
        Promise.resolve({
          mcps: { servers: {} },
          groups: {},
          system: {},
          apiToolsConfigPath: undefined,
        }),
      );

      // JsonStorage 在文件不存在时会创建默认文件，所以初始化应该成功
      await expect(authService.initialize()).resolves.not.toThrow();
    });
  });

  describe('用户登录', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('应该成功登录有效用户', async () => {
      const result = await authService.login('testuser', 'password');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.username).toBe('testuser');
      expect(result.user.role).toBe('user');
    });

    it('应该拒绝无效用户名', async () => {
      await expect(
        authService.login('nonexistent', 'password'),
      ).rejects.toThrow('Invalid username or password');
    });

    it('应该拒绝无效密码', async () => {
      await expect(
        authService.login('testuser', 'wrongpassword'),
      ).rejects.toThrow('Invalid username or password');
    });

    it('应该在多次失败登录后锁定用户', async () => {
      // 尝试3次失败登录
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login('testuser', 'wrongpassword');
        } catch {
          // 忽略预期的错误
        }
      }

      // 第4次尝试应该被锁定
      await expect(
        authService.login('testuser', 'wrongpassword'),
      ).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('Token验证', () => {
    let accessToken: string;

    beforeEach(async () => {
      await authService.initialize();
      const result = await authService.login('testuser', 'password');
      accessToken = result.accessToken;
    });

    it('应该成功验证有效token', async () => {
      const payload = await authService.verifyAccessToken(accessToken);

      expect(payload.sub).toBe('testuser');
      expect(payload.username).toBe('testuser');
      expect(payload.role).toBe('user');
    });

    it('应该拒绝无效token', async () => {
      await expect(
        authService.verifyAccessToken('invalid-token'),
      ).rejects.toThrow('Invalid or expired token');
    });

    it('应该拒绝已撤销的token', async () => {
      await authService.logout(accessToken);

      await expect(authService.verifyAccessToken(accessToken)).rejects.toThrow(
        'Token has been revoked',
      );
    });
  });

  describe('Token刷新', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await authService.initialize();
      const result = await authService.login('testuser', 'password');
      refreshToken = result.refreshToken;
    });

    it('应该成功刷新有效的refresh token', async () => {
      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).not.toBe('');
      expect(result.refreshToken).not.toBe('');
    });

    it('应该拒绝无效的refresh token', async () => {
      await expect(
        authService.refreshAccessToken('invalid-refresh-token'),
      ).rejects.toThrow('Invalid refresh token');
    });

    it('应该拒绝已使用的refresh token', async () => {
      // 使用一次refresh token
      await authService.refreshAccessToken(refreshToken);

      // 再次使用应该失败
      await expect(
        authService.refreshAccessToken(refreshToken),
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('用户管理', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('应该能够根据ID获取用户', () => {
      const user = authService.getUserById('testuser');

      expect(user).not.toBeNull();
      expect(user?.username).toBe('testuser');
      expect(user?.role).toBe('user');
    });

    it('应该在用户不存在时返回null', () => {
      const user = authService.getUserById('nonexistent');
      expect(user).toBeNull();
    });

    it('应该能够获取活跃会话数量', async () => {
      const initialCount = authService.getActiveSessionCount();
      expect(initialCount).toBe(0);

      await authService.login('testuser', 'password');

      const afterLoginCount = authService.getActiveSessionCount();
      expect(afterLoginCount).toBe(1);
    });
  });

  describe('清理功能', () => {
    beforeEach(async () => {
      await authService.initialize();
    });

    it('应该能够清理过期会话和黑名单token', async () => {
      await authService.login('testuser', 'password');

      // 执行清理应不抛出异常
      await expect(authService.cleanup()).resolves.not.toThrow();
    });
  });
});
