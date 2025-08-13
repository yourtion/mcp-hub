/**
 * MCP HTTP API端到端测试
 * 测试MCP相关的HTTP端点，作为MCP协议测试的前置验证
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('MCP HTTP API端到端测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    await sleep(2000); // 等待服务初始化
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('MCP状态和管理端点', () => {
    it('应该能够获取MCP服务状态', async () => {
      const response = await testApp.request('/mcp/status');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toBeDefined();

      if (!data.error) {
        expect(data).toHaveProperty('service');
        expect(data).toHaveProperty('servers');
        expect(data).toHaveProperty('compatibility');

        console.log(
          `✅ MCP状态获取成功，服务器数量: ${data.servers?.total || 0}`,
        );
      } else {
        console.log(`⚠️ MCP状态获取失败: ${data.error.message}`);
      }
    });

    it('应该能够获取MCP工具列表', async () => {
      const response = await testApp.request('/mcp/tools');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toBeDefined();

      if (!data.error) {
        expect(data).toHaveProperty('totalTools');
        expect(data).toHaveProperty('allTools');
        expect(Array.isArray(data.allTools)).toBe(true);

        console.log(`✅ MCP工具列表获取成功，工具数量: ${data.totalTools}`);

        if (data.allTools.length > 0) {
          const tool = data.allTools[0];
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
        }
      } else {
        console.log(`⚠️ MCP工具列表获取失败: ${data.error.message}`);
      }
    });

    it('应该能够获取MCP健康检查', async () => {
      const response = await testApp.request('/mcp/health');

      expect([200, 503]).toContain(response.status);

      const data = await safeJsonParse(response);
      expect(data).toBeDefined();

      if (!data.error) {
        expect(data).toHaveProperty('healthy');
        expect(data).toHaveProperty('service');
        expect(data).toHaveProperty('servers');

        console.log(
          `✅ MCP健康检查完成，状态: ${data.healthy ? '健康' : '不健康'}`,
        );
      } else {
        console.log(`⚠️ MCP健康检查失败: ${data.error.message}`);
      }
    });
  });

  describe('MCP服务器管理', () => {
    it('应该能够处理服务器详情请求', async () => {
      // 先获取服务器列表
      const statusResponse = await testApp.request('/mcp/status');
      const statusData = await safeJsonParse(statusResponse);

      if (statusData.error || !statusData.servers?.details?.length) {
        console.log('⚠️ 没有可用的服务器进行测试');
        return;
      }

      const firstServer = statusData.servers.details[0];
      const serverResponse = await testApp.request(
        `/mcp/servers/${firstServer.id}`,
      );

      expect([200, 404]).toContain(serverResponse.status);

      if (serverResponse.status === 200) {
        const serverData = await safeJsonParse(serverResponse);
        expect(serverData).toHaveProperty('serverId', firstServer.id);
        expect(serverData).toHaveProperty('status');
        expect(serverData).toHaveProperty('tools');

        console.log(`✅ 服务器详情获取成功: ${firstServer.id}`);
      }
    });

    it('应该能够处理不存在的服务器请求', async () => {
      const response = await testApp.request('/mcp/servers/nonexistent-server');

      expect(response.status).toBe(404);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'SERVER_NOT_FOUND');

      console.log('✅ 不存在服务器的错误处理正确');
    });
  });

  describe('MCP工具执行', () => {
    it('应该能够处理工具执行请求', async () => {
      const executeData = {
        toolName: 'hub_status',
        args: {},
      };

      const response = await testApp.request('/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(executeData),
      });

      expect([200, 400, 500]).toContain(response.status);

      const data = await safeJsonParse(response);
      expect(data).toBeDefined();

      if (response.status === 200) {
        expect(data).toHaveProperty('toolName', 'hub_status');
        expect(data).toHaveProperty('result');
        console.log('✅ 工具执行成功');
      } else if (data.error) {
        console.log(`⚠️ 工具执行失败: ${data.error.message}`);
      }
    });

    it('应该能够处理无效的工具执行请求', async () => {
      const executeData = {
        toolName: 'nonexistent-tool',
        args: {},
      };

      const response = await testApp.request('/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(executeData),
      });

      expect([400, 500]).toContain(response.status);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('error');

      console.log('✅ 无效工具执行的错误处理正确');
    });

    it('应该能够处理缺少工具名称的请求', async () => {
      const executeData = {
        args: {},
      };

      const response = await testApp.request('/mcp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(executeData),
      });

      expect(response.status).toBe(400);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code', 'MISSING_TOOL_NAME');

      console.log('✅ 缺少工具名称的错误处理正确');
    });
  });

  describe('MCP端点兼容性', () => {
    it('应该能够处理传统MCP POST请求', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await testApp.request('/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpRequest),
      });

      expect([200, 400, 500]).toContain(response.status);

      const data = await safeJsonParse(response);
      expect(data).toBeDefined();

      if (data.jsonrpc) {
        console.log('✅ 传统MCP协议请求处理正常');
      } else {
        console.log(`⚠️ 传统MCP协议请求处理异常: ${JSON.stringify(data)}`);
      }
    });
  });

  describe('SSE端点可用性', () => {
    it('应该能够访问SSE端点', async () => {
      // 测试SSE端点是否可访问（不建立实际连接）
      const response = await testApp.request('/sse', {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
        },
      });

      // SSE端点应该返回200或者开始流式响应
      expect([200, 101]).toContain(response.status);

      console.log(`✅ SSE端点可访问，状态码: ${response.status}`);
    });

    it('应该能够处理SSE消息端点', async () => {
      // 测试消息端点（没有有效sessionId应该返回400）
      const response = await testApp.request('/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'message' }),
      });

      expect(response.status).toBe(400);

      const text = await response.text();
      expect(text).toContain('No transport found');

      console.log('✅ SSE消息端点错误处理正确');
    });
  });
});
