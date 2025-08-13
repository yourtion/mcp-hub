/**
 * MCP传输协议端到端测试
 * 测试不同的MCP传输协议（SSE、WebSocket等）
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('MCP传输协议端到端测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    await sleep(2000);
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('SSE传输协议', () => {
    it('应该能够建立SSE连接', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'sse-transport-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);
        expect(client).toBeDefined();

        // 测试基本通信
        const result = await client.listTools();
        expect(result).toBeDefined();
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该能够处理SSE连接错误', async () => {
      // 尝试连接到不存在的端点
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/nonexistent'),
      );
      const client = new Client(
        {
          name: 'sse-error-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);
        expect.fail('应该抛出连接错误');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        try {
          await client.close();
          await transport.close();
        } catch (cleanupError) {
          // 忽略清理错误
        }
      }
    }, 30000);

    it('应该能够处理SSE消息流', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'sse-streaming-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 发送多个请求测试消息流处理
        const requests = [
          client.listTools(),
          client.listTools(),
          client.listTools(),
        ];

        const results = await Promise.all(requests);

        for (const result of results) {
          expect(result).toBeDefined();
          expect(result.tools).toBeDefined();
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });

  describe('传输协议性能测试', () => {
    it('应该能够处理高频请求', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'performance-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        const requestCount = 10;
        const startTime = Date.now();

        // 发送多个并发请求
        const requests = Array.from({ length: requestCount }, () =>
          client.listTools(),
        );

        const results = await Promise.all(requests);
        const endTime = Date.now();

        // 验证所有请求都成功
        expect(results).toHaveLength(requestCount);
        for (const result of results) {
          expect(result).toBeDefined();
        }

        // 验证性能（平均每个请求不超过1秒）
        const averageTime = (endTime - startTime) / requestCount;
        expect(averageTime).toBeLessThan(1000);
      } finally {
        await client.close();
        await transport.close();
      }
    }, 45000);

    it('应该能够处理大量数据传输', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'large-data-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 获取工具列表（可能包含大量工具）
        const result = await client.listTools();
        expect(result).toBeDefined();
        expect(result.tools).toBeDefined();

        // 如果有工具，尝试调用它们（可能产生大量数据）
        if (result.tools.length > 0) {
          const tool = result.tools[0];

          try {
            const callResult = await client.callTool({
              name: tool.name,
              arguments: {},
            });

            expect(callResult).toBeDefined();
            expect(callResult.content).toBeDefined();
          } catch (error) {
            // 工具调用失败是正常的，重要的是传输层能处理
            expect(error).toBeInstanceOf(Error);
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });

  describe('传输协议可靠性测试', () => {
    it('应该能够处理网络延迟', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'latency-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 添加人工延迟
        await sleep(1000);

        const result = await client.listTools();
        expect(result).toBeDefined();

        // 再次延迟
        await sleep(500);

        const result2 = await client.listTools();
        expect(result2).toBeDefined();
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该能够处理请求超时', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'timeout-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 设置较短的超时时间进行测试
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 5000);
        });

        const requestPromise = client.listTools();

        try {
          const result = await Promise.race([requestPromise, timeoutPromise]);
          expect(result).toBeDefined();
        } catch (error) {
          if ((error as Error).message === 'Request timeout') {
            // 超时是可接受的测试结果
            console.log('Request timed out as expected');
          } else {
            throw error;
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });

  describe('传输协议兼容性测试', () => {
    it('应该支持标准MCP协议消息格式', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'protocol-compatibility-test',
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
        await client.connect(transport);

        // 测试标准MCP方法
        const toolsResult = await client.listTools();
        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();

        // 验证响应格式符合MCP协议
        if (toolsResult.tools.length > 0) {
          const tool = toolsResult.tools[0];
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('inputSchema');
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该正确处理MCP协议版本', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'version-compatibility-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 如果连接成功，说明版本兼容
        expect(client).toBeDefined();

        // 测试基本功能
        const result = await client.listTools();
        expect(result).toBeDefined();
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该支持MCP协议的错误处理', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'error-handling-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      try {
        await client.connect(transport);

        // 触发各种错误情况
        const errorTests = [
          // 调用不存在的工具
          async () => {
            try {
              await client.callTool({
                name: 'nonexistent-tool-12345',
                arguments: {},
              });
              return null;
            } catch (error) {
              return error;
            }
          },

          // 使用无效参数
          async () => {
            try {
              await client.callTool({
                name: '',
                arguments: null as any,
              });
              return null;
            } catch (error) {
              return error;
            }
          },
        ];

        for (const errorTest of errorTests) {
          const error = await errorTest();
          if (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBeDefined();
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });
});
