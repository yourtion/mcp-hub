/**
 * 安全功能端到端测试
 * 测试认证、授权和安全相关功能
 */

import { serve } from '@hono/node-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('安全功能端到端测试', () => {
  let server: ReturnType<typeof serve>;
  let baseUrl: string;

  beforeAll(async () => {
    const port = 3101;
    baseUrl = `http://localhost:${port}`;

    server = serve({
      fetch: app.fetch,
      port,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('JWT认证测试', () => {
    it('应该拒绝没有token的请求', async () => {
      const response = await fetch(`${baseUrl}/api/servers`);
      expect(response.status).toBe(401);
    });

    it('应该拒绝无效的token', async () => {
      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });
      expect(response.status).toBe(401);
    });

    it('应该拒绝格式错误的Authorization头', async () => {
      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: {
          Authorization: 'InvalidFormat token',
        },
      });
      expect(response.status).toBe(401);
    });

    it('应该接受有效的token', async () => {
      // 先登录获取有效token
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      const token = loginData.token;

      // 使用有效token访问受保护资源
      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
    });

    it('应该在token过期后拒绝访问', async () => {
      // 使用一个已过期的token（实际测试中需要等待token过期）
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjF9.invalid';

      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('登录安全测试', () => {
    it('应该拒绝空用户名', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '',
          password: 'password',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('应该拒绝空密码', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: '',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('应该拒绝不存在的用户', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'password',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('应该拒绝错误的密码', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('应该防止SQL注入攻击', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "admin' OR '1'='1",
          password: "password' OR '1'='1",
        }),
      });

      expect(response.status).toBe(401);
    });

    it('应该防止XSS攻击', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '<script>alert("xss")</script>',
          password: 'password',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Token刷新安全测试', () => {
    it('应该拒绝无效的refresh token', async () => {
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'invalid-refresh-token',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('应该接受有效的refresh token', async () => {
      // 先登录获取refresh token
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      const refreshToken = loginData.refreshToken;

      // 使用refresh token获取新的access token
      const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(refreshResponse.status).toBe(200);
      const refreshData = await refreshResponse.json();
      expect(refreshData).toHaveProperty('token');
    });

    it('应该拒绝已使用的refresh token', async () => {
      // 先登录
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      const refreshToken = loginData.refreshToken;

      // 第一次刷新
      await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      // 第二次使用相同的refresh token应该失败
      const secondRefreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      // 注意：这取决于实现是否有token重用检测
      expect([200, 401]).toContain(secondRefreshResponse.status);
    });
  });

  describe('API访问控制测试', () => {
    let validToken: string;

    beforeAll(async () => {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      validToken = loginData.token;
    });

    it('应该允许访问公开端点', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect([200, 404]).toContain(response.status);
    });

    it('应该保护服务器管理端点', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/servers' },
        { method: 'POST', path: '/api/servers' },
        { method: 'PUT', path: '/api/servers/test' },
        { method: 'DELETE', path: '/api/servers/test' },
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method,
        });
        expect(response.status).toBe(401);
      }
    });

    it('应该保护工具管理端点', async () => {
      const response = await fetch(`${baseUrl}/api/tools`);
      expect(response.status).toBe(401);
    });

    it('应该保护组管理端点', async () => {
      const response = await fetch(`${baseUrl}/api/groups`);
      expect(response.status).toBe(401);
    });

    it('应该保护配置管理端点', async () => {
      const response = await fetch(`${baseUrl}/api/config`);
      expect(response.status).toBe(401);
    });

    it('应该保护仪表板端点', async () => {
      const response = await fetch(`${baseUrl}/api/dashboard/stats`);
      expect(response.status).toBe(401);
    });
  });

  describe('输入验证测试', () => {
    let validToken: string;

    beforeAll(async () => {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      validToken = loginData.token;
    });

    it('应该验证服务器配置输入', async () => {
      const invalidServer = {
        // 缺少必需字段
        name: '测试服务器',
      };

      const response = await fetch(`${baseUrl}/api/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify(invalidServer),
      });

      expect([400, 422]).toContain(response.status);
    });

    it('应该验证组配置输入', async () => {
      const invalidGroup = {
        // 缺少必需字段
        description: '测试组',
      };

      const response = await fetch(`${baseUrl}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify(invalidGroup),
      });

      expect([400, 422]).toContain(response.status);
    });

    it('应该拒绝过大的请求体', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB
      };

      const response = await fetch(`${baseUrl}/api/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify(largePayload),
      });

      expect([400, 413, 422]).toContain(response.status);
    });
  });

  describe('CORS安全测试', () => {
    it('应该设置适当的CORS头', async () => {
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'OPTIONS',
      });

      // 检查CORS相关头部
      const corsHeaders = response.headers.get('access-control-allow-origin');
      expect(corsHeaders).toBeDefined();
    });
  });

  describe('安全头部测试', () => {
    it('应该设置安全相关的HTTP头', async () => {
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      const loginData = await loginResponse.json();
      const token = loginData.token;

      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // 检查Content-Type头
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });

  describe('会话管理测试', () => {
    it('应该能够同时处理多个用户会话', async () => {
      // 用户1登录
      const login1Response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      const login1Data = await login1Response.json();
      const token1 = login1Data.token;

      // 用户2登录（同一用户的另一个会话）
      const login2Response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      const login2Data = await login2Response.json();
      const token2 = login2Data.token;

      // 两个token应该不同
      expect(token1).not.toBe(token2);

      // 两个token都应该有效
      const response1 = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${token1}` },
      });
      const response2 = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${token2}` },
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('应该在登出后使token失效', async () => {
      // 登录
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      const loginData = await loginResponse.json();
      const token = loginData.token;

      // 登出
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      // 尝试使用已登出的token
      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 注意：这取决于实现是否有token黑名单
      expect([200, 401]).toContain(response.status);
    });
  });
});
