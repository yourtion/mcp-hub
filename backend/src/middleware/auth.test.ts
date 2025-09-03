/**
 * 认证中间件测试
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.js';
import {
  corsMiddleware,
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  createRoleMiddleware,
  errorHandlerMiddleware,
  requestLogMiddleware,
} from './auth.js';

describe('认证中间件', () => {
  let app: Hono;
  let authService: AuthService;
  let tempConfigPath: string;
  let accessToken: string;
  let adminToken: string;

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
          secret: 'test-secret-key-for-middleware',
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

    // 获取测试用的tokens
    const userLogin = await authService.login('testuser', 'password');
    accessToken = userLogin.accessToken;

    const adminLogin = await authService.login('admin', 'admin123');
    adminToken = adminLogin.accessToken;

    // 创建应用
    app = new Hono();
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

  describe('createAuthMiddleware', () => {
    beforeEach(() => {
      app = new Hono();
      app.use('*', createAuthMiddleware(authService));
      app.get('/protected', (c) => {
        const auth = c.get('auth');
        return c.json({ user: auth.user });
      });
    });

    it('应该允许有效token访问', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user.username).toBe('testuser');
    });

    it('应该拒绝缺少Authorization头的请求', async () => {
      const res = await app.request('/protected');

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_MISSING_TOKEN');
    });

    it('应该拒绝无效格式的Authorization头', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: 'InvalidFormat',
        },
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_FORMAT');
    });

    it('应该拒绝无效token', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(
        ['AUTH_INVALID_TOKEN', 'AUTH_TOKEN_EXPIRED'].includes(data.error.code),
      ).toBe(true);
    });

    it('应该拒绝已撤销的token', async () => {
      // 先撤销token
      await authService.logout(accessToken);

      const res = await app.request('/protected', {
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

  describe('createRoleMiddleware', () => {
    beforeEach(() => {
      app = new Hono();
      app.use('*', createAuthMiddleware(authService));
      app.use('/admin/*', createRoleMiddleware(['admin']));
      app.use('/user/*', createRoleMiddleware(['user', 'admin']));

      app.get('/admin/dashboard', (c) => {
        return c.json({ message: 'Admin dashboard' });
      });

      app.get('/user/profile', (c) => {
        return c.json({ message: 'User profile' });
      });
    });

    it('应该允许admin角色访问admin路由', async () => {
      const res = await app.request('/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('Admin dashboard');
    });

    it('应该拒绝user角色访问admin路由', async () => {
      const res = await app.request('/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    });

    it('应该允许user角色访问user路由', async () => {
      const res = await app.request('/user/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('User profile');
    });

    it('应该允许admin角色访问user路由', async () => {
      const res = await app.request('/user/profile', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('User profile');
    });
  });

  describe('createOptionalAuthMiddleware', () => {
    beforeEach(() => {
      app = new Hono();
      app.use('*', createOptionalAuthMiddleware(authService));
      app.get('/public', (c) => {
        const auth = c.get('auth');
        return c.json({
          authenticated: !!auth,
          user: auth?.user || null,
        });
      });
    });

    it('应该在有有效token时设置认证上下文', async () => {
      const res = await app.request('/public', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.username).toBe('testuser');
    });

    it('应该在没有token时允许访问', async () => {
      const res = await app.request('/public');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });

    it('应该在无效token时忽略认证错误', async () => {
      const res = await app.request('/public', {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });
  });

  describe('corsMiddleware', () => {
    beforeEach(() => {
      app = new Hono();
      app.use('*', corsMiddleware());
      app.get('/test', (c) => c.json({ message: 'test' }));
    });

    it('应该设置CORS头', async () => {
      const res = await app.request('/test');

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization',
      );
    });

    it('应该处理OPTIONS预检请求', async () => {
      const res = await app.request('/test', {
        method: 'OPTIONS',
      });

      expect(res.status).toBe(204);
    });
  });

  describe('errorHandlerMiddleware', () => {
    beforeEach(() => {
      app = new Hono();
      app.use('*', errorHandlerMiddleware());
      app.get('/error', () => {
        throw new Error('Test error');
      });
      app.get('/success', (c) => c.json({ message: 'success' }));
    });

    it('应该捕获并处理错误', async () => {
      const res = await app.request('/error');

      expect(res.status).toBe(500);

      const text = await res.text();
      // Hono的默认错误处理返回"Internal Server Error"
      expect(text).toBe('Internal Server Error');
    });

    it('应该允许正常请求通过', async () => {
      const res = await app.request('/success');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('success');
    });
  });
});
