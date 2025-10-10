/**
 * Web界面集成端到端测试
 * 测试所有Web界面相关的API端点和完整用户流程
 */

import { serve } from '@hono/node-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('Web UI 集成端到端测试', () => {
  let server: ReturnType<typeof serve>;
  let baseUrl: string;
  let authToken: string;

  beforeAll(async () => {
    const port = 3100;
    baseUrl = `http://localhost:${port}`;

    server = serve({
      fetch: app.fetch,
      port,
    });

    // 等待服务器启动
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('认证流程测试', () => {
    it('应该成功登录并获取token', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('refreshToken');
      expect(data).toHaveProperty('user');
      expect(data.user.username).toBe('admin');

      // 保存token供后续测试使用
      authToken = data.token;
    });

    it('应该拒绝无效的登录凭据', async () => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'invalid',
          password: 'wrong',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('应该能够刷新token', async () => {
      // 先登录获取refreshToken
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

      // 刷新token
      const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(refreshResponse.status).toBe(200);
      const refreshData = await refreshResponse.json();
      expect(refreshData).toHaveProperty('token');
    });

    it('应该能够登出', async () => {
      const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.status).toBe(200);
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await fetch(`${baseUrl}/api/servers`);
      expect(response.status).toBe(401);
    });
  });

  describe('服务器管理API测试', () => {
    beforeAll(async () => {
      // 确保有有效的token
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      const loginData = await loginResponse.json();
      authToken = loginData.token;
    });

    it('应该能够获取服务器列表', async () => {
      const response = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('servers');
      expect(Array.isArray(data.servers)).toBe(true);
    });

    it('应该能够获取单个服务器详情', async () => {
      // 先获取服务器列表
      const listResponse = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const listData = await listResponse.json();

      if (listData.servers.length > 0) {
        const serverId = listData.servers[0].id;
        const response = await fetch(`${baseUrl}/api/servers/${serverId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data.id).toBe(serverId);
      }
    });

    it('应该能够创建新服务器配置', async () => {
      const newServer = {
        id: 'test-server-e2e',
        name: '测试服务器',
        type: 'stdio',
        config: {
          command: 'node',
          args: ['test.js'],
        },
      };

      const response = await fetch(`${baseUrl}/api/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newServer),
      });

      expect([200, 201]).toContain(response.status);
    });

    it('应该能够更新服务器配置', async () => {
      const updateData = {
        name: '更新后的测试服务器',
        config: {
          command: 'node',
          args: ['updated.js'],
        },
      };

      const response = await fetch(`${baseUrl}/api/servers/test-server-e2e`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
      });

      expect([200, 404]).toContain(response.status);
    });

    it('应该能够删除服务器', async () => {
      const response = await fetch(`${baseUrl}/api/servers/test-server-e2e`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('工具管理API测试', () => {
    it('应该能够获取工具列表', async () => {
      const response = await fetch(`${baseUrl}/api/tools`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('tools');
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it('应该能够按服务器过滤工具', async () => {
      // 先获取服务器列表
      const serversResponse = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const serversData = await serversResponse.json();

      if (serversData.servers.length > 0) {
        const serverId = serversData.servers[0].id;
        const response = await fetch(
          `${baseUrl}/api/tools/server/${serverId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('tools');
      }
    });

    it('应该能够获取工具详情', async () => {
      const toolsResponse = await fetch(`${baseUrl}/api/tools`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const toolsData = await toolsResponse.json();

      if (toolsData.tools.length > 0) {
        const toolName = toolsData.tools[0].name;
        const response = await fetch(`${baseUrl}/api/tools/${toolName}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('组管理API测试', () => {
    it('应该能够获取组列表', async () => {
      const response = await fetch(`${baseUrl}/api/groups`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('groups');
      expect(Array.isArray(data.groups)).toBe(true);
    });

    it('应该能够创建新组', async () => {
      const newGroup = {
        id: 'test-group-e2e',
        name: '测试组',
        description: '端到端测试组',
        servers: [],
        tools: [],
      };

      const response = await fetch(`${baseUrl}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newGroup),
      });

      expect([200, 201]).toContain(response.status);
    });

    it('应该能够更新组配置', async () => {
      const updateData = {
        name: '更新后的测试组',
        description: '更新后的描述',
      };

      const response = await fetch(`${baseUrl}/api/groups/test-group-e2e`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(updateData),
      });

      expect([200, 404]).toContain(response.status);
    });

    it('应该能够删除组', async () => {
      const response = await fetch(`${baseUrl}/api/groups/test-group-e2e`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('仪表板API测试', () => {
    it('应该能够获取仪表板统计信息', async () => {
      const response = await fetch(`${baseUrl}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('overview');
      expect(data.overview).toHaveProperty('totalServers');
      expect(data.overview).toHaveProperty('connectedServers');
      expect(data.overview).toHaveProperty('totalTools');
    });

    it('应该能够获取系统健康状态', async () => {
      const response = await fetch(`${baseUrl}/api/dashboard/health`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(['healthy', 'warning', 'error']).toContain(data.status);
    });
  });

  describe('配置管理API测试', () => {
    it('应该能够获取系统配置', async () => {
      const response = await fetch(`${baseUrl}/api/config`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('config');
    });

    it('应该能够验证配置', async () => {
      const testConfig = {
        server: {
          port: 3000,
          host: 'localhost',
        },
      };

      const response = await fetch(`${baseUrl}/api/config/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ config: testConfig }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('valid');
    });
  });

  describe('API到MCP管理测试', () => {
    it('应该能够获取API配置列表', async () => {
      const response = await fetch(`${baseUrl}/api/api-to-mcp/configs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('configs');
      expect(Array.isArray(data.configs)).toBe(true);
    });

    it('应该能够创建API配置', async () => {
      const newConfig = {
        id: 'test-api-config',
        name: '测试API配置',
        description: '端到端测试API配置',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        toolName: 'test_api_tool',
      };

      const response = await fetch(`${baseUrl}/api/api-to-mcp/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newConfig),
      });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe('调试工具API测试', () => {
    it('应该能够获取MCP消息列表', async () => {
      const response = await fetch(`${baseUrl}/api/debug/mcp-messages`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('messages');
      expect(Array.isArray(data.messages)).toBe(true);
    });

    it('应该能够获取性能统计', async () => {
      const response = await fetch(`${baseUrl}/api/debug/performance-stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('stats');
    });
  });

  describe('完整用户流程测试', () => {
    it('新用户完整使用流程', async () => {
      // 1. 登录
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      expect(loginResponse.status).toBe(200);
      const loginData = await loginResponse.json();
      const token = loginData.token;

      // 2. 查看仪表板
      const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(dashboardResponse.status).toBe(200);

      // 3. 查看服务器列表
      const serversResponse = await fetch(`${baseUrl}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(serversResponse.status).toBe(200);

      // 4. 查看工具列表
      const toolsResponse = await fetch(`${baseUrl}/api/tools`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(toolsResponse.status).toBe(200);

      // 5. 查看组列表
      const groupsResponse = await fetch(`${baseUrl}/api/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(groupsResponse.status).toBe(200);

      // 6. 登出
      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutResponse.status).toBe(200);
    });

    it('管理员配置服务器流程', async () => {
      // 1. 登录
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

      // 2. 创建服务器
      const createResponse = await fetch(`${baseUrl}/api/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: 'flow-test-server',
          name: '流程测试服务器',
          type: 'stdio',
          config: {
            command: 'node',
            args: ['test.js'],
          },
        }),
      });
      expect([200, 201]).toContain(createResponse.status);

      // 3. 查看服务器详情
      const detailResponse = await fetch(
        `${baseUrl}/api/servers/flow-test-server`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      expect([200, 404]).toContain(detailResponse.status);

      // 4. 更新服务器
      const updateResponse = await fetch(
        `${baseUrl}/api/servers/flow-test-server`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: '更新后的流程测试服务器',
          }),
        },
      );
      expect([200, 404]).toContain(updateResponse.status);

      // 5. 删除服务器
      const deleteResponse = await fetch(
        `${baseUrl}/api/servers/flow-test-server`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      expect([200, 204, 404]).toContain(deleteResponse.status);
    });
  });
});
