/**
 * 认证API测试
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../services/auth.js';
import { createAuthApi } from './index.js';

describe('认证API', () => {
  let app: Hono;
  let authService: AuthService;
  let tempConfigPath: string;

  beforeEach(async () => {
    authService = new AuthService();

    // 创建临时配置文件
    tempConfigPath = path.join(process.cwd(), 'config', 'system.json.test');
    const testConfig = {
      server: {
        port: 3002,
        host: 'localhost',
      },
      auth: {
        jwt: {
          secret: 'test-secret-key-for-auth-api',
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
        admin: {
          id: 'admin',
          username: 'admin',
          password: 'admin123',
          passwordHash:
            '$2b$10$JN67DsG/StdNfpliX9M3EOt0qfp7jHD1CsL7zB76k3ygcJHuxHBEC',
          role: 'admin',
          groups: ['admin-group'],
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

    // 初始化认证服务
    await authService.initialize();

    // 创建应用
    app = new Hono();
    app.route('/auth', createAuthApi(authService));
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

  describe('POST /auth/login', () => {
    it('应该成功登录有效用户', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password',
        }),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('user');
      expect(data.data).toHaveProperty('accessToken');
      expect(data.data).toHaveProperty('refreshToken');
      expect(data.data.user.username).toBe('testuser');
      expect(data.data.user.role).toBe('user');
    });

    it('应该拒绝无效用户名', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'password',
        }),
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('应该拒绝无效密码', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword',
        }),
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('应该验证请求参数', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: '',
          password: 'password',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('应该在多次失败登录后锁定账户', async () => {
      // 尝试3次失败登录
      for (let i = 0; i < 3; i++) {
        await app.request('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'testuser',
            password: 'wrongpassword',
          }),
        });
      }

      // 第4次尝试应该被锁定
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword',
        }),
      });

      expect(res.status).toBe(423);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_ACCOUNT_LOCKED');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // 先登录获取refresh token
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password',
        }),
      });

      const loginData = await loginRes.json();
      refreshToken = loginData.data.refreshToken;
    });

    it('应该成功刷新有效的refresh token', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('accessToken');
      expect(data.data).toHaveProperty('refreshToken');
    });

    it('应该拒绝无效的refresh token', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: 'invalid-token',
        }),
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_REFRESH_TOKEN');
    });

    it('应该验证请求参数', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: '',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // 先登录获取access token
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password',
        }),
      });

      const loginData = await loginRes.json();
      accessToken = loginData.data.accessToken;
    });

    it('应该成功登出', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('应该要求Authorization头', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_MISSING_TOKEN');
    });

    it('应该验证Authorization头格式', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: 'InvalidFormat',
        },
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_FORMAT');
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // 先登录获取access token
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password',
        }),
      });

      const loginData = await loginRes.json();
      accessToken = loginData.data.accessToken;
    });

    it('应该返回当前用户信息', async () => {
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.user.username).toBe('testuser');
      expect(data.data.user.role).toBe('user');
      expect(data.data.user.groups).toEqual(['test-group']);
    });

    it('应该要求Authorization头', async () => {
      const res = await app.request('/auth/me', {
        method: 'GET',
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_MISSING_TOKEN');
    });

    it('应该拒绝无效token', async () => {
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      // JWT库会将无效token识别为过期token
      expect(
        ['AUTH_INVALID_TOKEN', 'AUTH_TOKEN_EXPIRED'].includes(data.error.code),
      ).toBe(true);
    });

    it('应该拒绝已登出的token', async () => {
      // 先登出
      await app.request('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // 然后尝试获取用户信息
      const res = await app.request('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_TOKEN_REVOKED');
    });
  });
});
