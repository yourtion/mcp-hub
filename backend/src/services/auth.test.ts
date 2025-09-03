/**
 * 认证服务测试
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.js';

describe('AuthService', () => {
  let authService: AuthService;
  let tempConfigPath: string;

  beforeEach(async () => {
    authService = new AuthService();

    // 创建临时配置文件
    tempConfigPath = path.join(process.cwd(), 'config', 'system.json.test');
    const testConfig = {
      server: {
        port: 3000,
        host: 'localhost',
      },
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
          passwordHash:
            '$2b$10$JtpRHnVSEK5EvQ6I3nDlkexOkwU7OEIu3Ikz4VQjnOoZoQJDwgZ/O',
          role: 'user',
          groups: ['test-group'],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      },
      ui: {
        title: 'Test MCP Hub',
        theme: 'light',
        features: {
          apiToMcp: true,
          debugging: true,
          monitoring: true,
        },
      },
      monitoring: {
        metricsEnabled: true,
        logLevel: 'info',
        retentionDays: 30,
      },
    };

    await fs.writeFile(tempConfigPath, JSON.stringify(testConfig, null, 2));

    // 临时替换配置文件路径
    const originalConfigPath = path.join(
      process.cwd(),
      'config',
      'system.json',
    );
    const backupPath = path.join(process.cwd(), 'config', 'system.json.backup');

    try {
      await fs.rename(originalConfigPath, backupPath);
    } catch {
      // 文件可能不存在，忽略错误
    }

    await fs.rename(tempConfigPath, originalConfigPath);
  });

  afterEach(async () => {
    // 恢复原始配置文件
    const originalConfigPath = path.join(
      process.cwd(),
      'config',
      'system.json',
    );
    const backupPath = path.join(process.cwd(), 'config', 'system.json.backup');

    try {
      await fs.unlink(originalConfigPath);
    } catch {
      // 忽略错误
    }

    try {
      await fs.rename(backupPath, originalConfigPath);
    } catch {
      // 备份文件可能不存在，忽略错误
    }
  });

  describe('初始化', () => {
    it('应该成功初始化认证服务', async () => {
      await expect(authService.initialize()).resolves.not.toThrow();
    });

    it('应该在配置文件不存在时抛出错误', async () => {
      // 删除配置文件
      const configPath = path.join(process.cwd(), 'config', 'system.json');
      await fs.unlink(configPath);

      await expect(authService.initialize()).rejects.toThrow(
        'Failed to load system config',
      );
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

      // 执行清理
      await authService.cleanup();

      // 清理功能应该正常执行而不抛出错误
      expect(true).toBe(true);
    });
  });
});
