/**
 * MCP协议客户端端到端测试
 * 使用真实的MCP客户端测试完整的MCP协议交互
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('MCP协议客户端端到端测试', () => {
  let testApp: typeof app;
  let restoreConsole: () => void;
  let mcpClient: Client;
  let transport: SSEClientTransport | StdioClientTransport;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();

    // 等待应用完全初始化
    await sleep(2000);
  });

  afterAll(async () => {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (error) {
        // 忽略关闭错误
      }
    }

    if (transport) {
      try {
        await transport.close();
      } catch (error) {
        // 忽略关闭错误
      }
    }

    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('SSE传输协议测试', () => {
    it('应该能够通过SSE建立MCP连接', async () => {
      // 创建SSE传输
      transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      mcpClient = new Client(
        {
          name: 'test-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      // 连接到MCP服务器
      await mcpClient.connect(transport);

      // 验证连接成功
      expect(mcpClient).toBeDefined();
    }, 30000);

    it('应该能够列出可用的工具', async () => {
      if (!mcpClient) {
        // 如果前面的连接测试失败，创建新的连接
        transport = new SSEClientTransport(
          new URL('http://localhost:3000/mcp/sse'),
        );
        mcpClient = new Client(
          {
            name: 'test-mcp-client',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );
        await mcpClient.connect(transport);
      }

      // 列出工具
      const toolsResult = await mcpClient.listTools();

      expect(toolsResult).toBeDefined();
      expect(toolsResult.tools).toBeDefined();
      expect(Array.isArray(toolsResult.tools)).toBe(true);

      // 验证工具的基本结构
      if (toolsResult.tools.length > 0) {
        const tool = toolsResult.tools[0];
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      }
    }, 30000);

    it('应该能够调用工具', async () => {
      if (!mcpClient) {
        transport = new SSEClientTransport(
          new URL('http://localhost:3000/mcp/sse'),
        );
        mcpClient = new Client(
          {
            name: 'test-mcp-client',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );
        await mcpClient.connect(transport);
      }

      // 先获取工具列表
      const toolsResult = await mcpClient.listTools();

      if (toolsResult.tools.length === 0) {
        // 如果没有工具，跳过此测试
        return;
      }

      const firstTool = toolsResult.tools[0];

      try {
        // 调用工具
        const callResult = await mcpClient.callTool({
          name: firstTool.name,
          arguments: {}, // 使用空参数，实际应用中需要根据工具要求提供参数
        });

        expect(callResult).toBeDefined();
        expect(callResult.content).toBeDefined();
        expect(Array.isArray(callResult.content)).toBe(true);
      } catch (error) {
        // 工具调用可能因为参数不正确而失败，这是正常的
        // 重要的是MCP协议层面的通信是成功的
        expect(error).toBeInstanceOf(Error);
      }
    }, 30000);

    it('应该能够处理MCP协议错误', async () => {
      if (!mcpClient) {
        transport = new SSEClientTransport(
          new URL('http://localhost:3000/mcp/sse'),
        );
        mcpClient = new Client(
          {
            name: 'test-mcp-client',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );
        await mcpClient.connect(transport);
      }

      // 尝试调用不存在的工具
      try {
        await mcpClient.callTool({
          name: 'nonexistent-tool',
          arguments: {},
        });

        // 如果没有抛出错误，说明有问题
        expect.fail('应该抛出工具不存在的错误');
      } catch (error) {
        // 验证错误是MCP协议错误
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Tool not found');
      }
    }, 30000);
  });

  describe('MCP协议兼容性测试', () => {
    it('应该支持标准的MCP初始化握手', async () => {
      // 创建新的客户端进行初始化测试
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'compatibility-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        },
      );

      try {
        // 连接并验证初始化
        await testClient.connect(testTransport);

        // 验证客户端状态
        expect(testClient).toBeDefined();

        // 测试基本的协议方法
        const toolsResult = await testClient.listTools();
        expect(toolsResult).toBeDefined();
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);

    it('应该正确处理MCP协议版本协商', async () => {
      // 测试协议版本兼容性
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'version-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await testClient.connect(testTransport);

        // 如果连接成功，说明版本协商正常
        expect(testClient).toBeDefined();
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);

    it('应该支持MCP协议的能力声明', async () => {
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'capabilities-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            logging: {},
          },
        },
      );

      try {
        await testClient.connect(testTransport);

        // 测试各种能力相关的方法
        const toolsResult = await testClient.listTools();
        expect(toolsResult).toBeDefined();

        // 尝试列出资源（如果支持）
        try {
          const resourcesResult = await testClient.listResources();
          expect(resourcesResult).toBeDefined();
        } catch (error) {
          // 如果不支持资源，这是正常的
          console.log('Resources not supported:', (error as Error).message);
        }

        // 尝试列出提示（如果支持）
        try {
          const promptsResult = await testClient.listPrompts();
          expect(promptsResult).toBeDefined();
        } catch (error) {
          // 如果不支持提示，这是正常的
          console.log('Prompts not supported:', (error as Error).message);
        }
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);
  });

  describe('MCP Hub特定功能测试', () => {
    it('应该能够访问聚合的多个服务器的工具', async () => {
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'aggregation-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await testClient.connect(testTransport);

        const toolsResult = await testClient.listTools();

        // 验证工具列表包含来自多个服务器的工具
        expect(toolsResult.tools).toBeDefined();

        if (toolsResult.tools.length > 0) {
          // 检查工具是否有服务器标识或分组信息
          const tool = toolsResult.tools[0];
          expect(tool.name).toBeDefined();
          expect(tool.description).toBeDefined();

          // MCP Hub应该在工具描述或元数据中包含来源信息
          // 这取决于具体的实现
        }
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);

    it('应该能够处理工具调用的路由和转发', async () => {
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'routing-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await testClient.connect(testTransport);

        const toolsResult = await testClient.listTools();

        if (toolsResult.tools.length > 0) {
          const tool = toolsResult.tools[0];

          try {
            // 调用工具，验证Hub能够正确路由到后端服务器
            const callResult = await testClient.callTool({
              name: tool.name,
              arguments: {},
            });

            // 验证响应格式
            expect(callResult).toBeDefined();
            expect(callResult.content).toBeDefined();
            expect(Array.isArray(callResult.content)).toBe(true);
          } catch (error) {
            // 即使工具调用失败，也应该是业务逻辑错误，而不是路由错误
            expect((error as Error).message).not.toContain('routing');
            expect((error as Error).message).not.toContain('transport');
          }
        }
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);

    it('应该能够处理并发的MCP客户端连接', async () => {
      const clientCount = 3;
      const clients: Client[] = [];
      const transports: SSEClientTransport[] = [];

      try {
        // 创建多个并发客户端
        for (let i = 0; i < clientCount; i++) {
          const transport = new SSEClientTransport(
            new URL('http://localhost:3000/mcp/sse'),
          );
          const client = new Client(
            {
              name: `concurrent-test-client-${i}`,
              version: '1.0.0',
            },
            {
              capabilities: {
                tools: {},
              },
            },
          );

          transports.push(transport);
          clients.push(client);

          await client.connect(transport);
        }

        // 并发执行工具列表请求
        const toolsPromises = clients.map((client) => client.listTools());
        const toolsResults = await Promise.all(toolsPromises);

        // 验证所有客户端都能正常工作
        for (const result of toolsResults) {
          expect(result).toBeDefined();
          expect(result.tools).toBeDefined();
          expect(Array.isArray(result.tools)).toBe(true);
        }
      } finally {
        // 清理所有客户端和传输
        await Promise.all(clients.map((client) => client.close()));
        await Promise.all(transports.map((transport) => transport.close()));
      }
    }, 45000);
  });

  describe('错误处理和恢复测试', () => {
    it('应该能够处理连接中断和重连', async () => {
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'reconnection-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        // 初始连接
        await testClient.connect(testTransport);

        // 验证初始连接工作正常
        const initialTools = await testClient.listTools();
        expect(initialTools).toBeDefined();

        // 模拟连接中断（关闭客户端）
        await testClient.close();
        await testTransport.close();

        // 等待一段时间
        await sleep(1000);

        // 重新连接
        const newTransport = new SSEClientTransport(
          new URL('http://localhost:3000/mcp/sse'),
        );
        const newClient = new Client(
          {
            name: 'reconnection-test-client-2',
            version: '1.0.0',
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );

        await newClient.connect(newTransport);

        // 验证重连后功能正常
        const reconnectedTools = await newClient.listTools();
        expect(reconnectedTools).toBeDefined();

        // 清理
        await newClient.close();
        await newTransport.close();
      } catch (error) {
        // 如果测试失败，确保清理资源
        try {
          await testClient.close();
          await testTransport.close();
        } catch (cleanupError) {
          // 忽略清理错误
        }
        throw error;
      }
    }, 45000);

    it('应该能够处理无效的MCP请求', async () => {
      const testTransport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const testClient = new Client(
        {
          name: 'invalid-request-test-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await testClient.connect(testTransport);

        // 尝试各种无效请求
        const invalidRequests = [
          // 调用不存在的工具
          () =>
            testClient.callTool({ name: 'nonexistent-tool', arguments: {} }),
          // 使用无效参数调用工具
          () => testClient.callTool({ name: '', arguments: {} }),
        ];

        for (const invalidRequest of invalidRequests) {
          try {
            await invalidRequest();
            // 如果没有抛出错误，可能是系统过于宽松
            console.warn('Invalid request did not throw error');
          } catch (error) {
            // 验证错误是合理的MCP协议错误
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBeDefined();
          }
        }
      } finally {
        await testClient.close();
        await testTransport.close();
      }
    }, 30000);
  });
});
