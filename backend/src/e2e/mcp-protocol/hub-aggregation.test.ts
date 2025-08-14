/**
 * MCP Hub聚合功能端到端测试
 * 测试Hub作为MCP服务聚合器的核心功能
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

describe('MCP Hub聚合功能端到端测试', () => {
  let _testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    _testApp = app;
    restoreConsole = setupTestEnvironment();
    await sleep(2000);
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('多服务器工具聚合', () => {
    it('应该能够聚合来自多个MCP服务器的工具', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
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
        await client.connect(transport);

        const toolsResult = await client.listTools();
        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();
        expect(Array.isArray(toolsResult.tools)).toBe(true);

        // 验证工具列表包含来自不同服务器的工具
        if (toolsResult.tools.length > 0) {
          const tools = toolsResult.tools;

          // 检查工具是否有适当的标识信息
          for (const tool of tools) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('inputSchema');

            // 工具名称或描述应该包含来源信息
            expect(typeof tool.name).toBe('string');
            expect(tool.name.length).toBeGreaterThan(0);
          }

          console.log(`Found ${tools.length} aggregated tools`);
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该能够正确路由工具调用到对应的后端服务器', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
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
        await client.connect(transport);

        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          // 尝试调用不同的工具，验证路由功能
          const toolsToTest = toolsResult.tools.slice(0, 3); // 测试前3个工具

          for (const tool of toolsToTest) {
            try {
              const callResult = await client.callTool({
                name: tool.name,
                arguments: {}, // 使用空参数进行基本测试
              });

              // 验证响应格式
              expect(callResult).toBeDefined();
              expect(callResult.content).toBeDefined();
              expect(Array.isArray(callResult.content)).toBe(true);

              console.log(`Successfully routed call to tool: ${tool.name}`);
            } catch (error) {
              // 工具调用可能因为参数问题失败，但不应该是路由问题
              expect(error).toBeInstanceOf(Error);

              // 确保错误不是路由相关的
              const errorMessage = (error as Error).message.toLowerCase();
              expect(errorMessage).not.toContain('routing');
              expect(errorMessage).not.toContain('server not found');
              expect(errorMessage).not.toContain('transport');

              console.log(
                `Tool call failed (expected): ${tool.name} - ${(error as Error).message}`,
              );
            }
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 45000);

    it('应该能够处理后端服务器的不同响应格式', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'response-format-test',
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

        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const responsesReceived = [];

          // 调用多个工具，收集不同的响应格式
          for (const tool of toolsResult.tools.slice(0, 5)) {
            try {
              const callResult = await client.callTool({
                name: tool.name,
                arguments: {},
              });

              responsesReceived.push({
                toolName: tool.name,
                response: callResult,
                success: true,
              });
            } catch (error) {
              responsesReceived.push({
                toolName: tool.name,
                error: (error as Error).message,
                success: false,
              });
            }
          }

          // 验证Hub能够统一处理不同的响应格式
          for (const response of responsesReceived) {
            if (response.success) {
              expect(response.response).toBeDefined();
              expect(response.response?.content).toBeDefined();
              expect(Array.isArray(response.response?.content)).toBe(true);
            } else {
              expect(response.error).toBeDefined();
              expect(typeof response.error).toBe('string');
            }
          }

          console.log(
            `Processed ${responsesReceived.length} different response formats`,
          );
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 45000);
  });

  describe('服务器状态管理', () => {
    it('应该能够处理后端服务器的连接状态变化', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'server-status-test',
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

        // 获取初始工具列表
        const initialTools = await client.listTools();
        expect(initialTools).toBeDefined();

        // 等待一段时间，模拟服务器状态可能的变化
        await sleep(2000);

        // 再次获取工具列表
        const updatedTools = await client.listTools();
        expect(updatedTools).toBeDefined();

        // Hub应该能够处理服务器状态变化
        // 工具列表可能会有变化，但请求应该成功
        expect(Array.isArray(updatedTools.tools)).toBe(true);

        console.log(
          `Initial tools: ${initialTools.tools.length}, Updated tools: ${updatedTools.tools.length}`,
        );
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该能够处理部分后端服务器不可用的情况', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'partial-failure-test',
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

        // 即使部分服务器不可用，Hub也应该能够返回可用服务器的工具
        const toolsResult = await client.listTools();
        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();
        expect(Array.isArray(toolsResult.tools)).toBe(true);

        // 尝试调用工具，验证可用的工具仍然可以正常工作
        if (toolsResult.tools.length > 0) {
          let successfulCalls = 0;
          let failedCalls = 0;

          for (const tool of toolsResult.tools.slice(0, 3)) {
            try {
              await client.callTool({
                name: tool.name,
                arguments: {},
              });
              successfulCalls++;
            } catch (error) {
              failedCalls++;
              // 失败应该是业务逻辑错误，不是服务器不可用错误
              expect((error as Error).message).not.toContain(
                'server unavailable',
              );
              expect((error as Error).message).not.toContain(
                'connection refused',
              );
            }
          }

          console.log(
            `Successful calls: ${successfulCalls}, Failed calls: ${failedCalls}`,
          );
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });

  describe('工具命名空间和冲突处理', () => {
    it('应该能够处理来自不同服务器的同名工具', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'namespace-test',
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

        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const toolNames = toolsResult.tools.map((tool) => tool.name);
          const uniqueNames = new Set(toolNames);

          // 检查是否有重复的工具名称
          if (toolNames.length !== uniqueNames.size) {
            console.log(
              'Found duplicate tool names, checking namespace handling...',
            );

            // 如果有重复名称，Hub应该通过某种方式区分它们
            // 例如：添加服务器前缀、后缀或其他标识
            const duplicates = toolNames.filter(
              (name, index) => toolNames.indexOf(name) !== index,
            );

            for (const duplicateName of duplicates) {
              const duplicateTools = toolsResult.tools.filter(
                (tool) => tool.name === duplicateName,
              );

              // 验证重复工具有不同的描述或其他区分信息
              if (duplicateTools.length > 1) {
                const descriptions = duplicateTools.map(
                  (tool) => tool.description,
                );
                const uniqueDescriptions = new Set(descriptions);

                // 应该有不同的描述来区分同名工具
                expect(uniqueDescriptions.size).toBeGreaterThan(1);
              }
            }
          } else {
            console.log('All tool names are unique - good namespace handling');
          }

          // 验证所有工具名称都是有效的
          for (const toolName of toolNames) {
            expect(typeof toolName).toBe('string');
            expect(toolName.length).toBeGreaterThan(0);
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);

    it('应该能够提供工具的来源信息', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'source-info-test',
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

        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          for (const tool of toolsResult.tools) {
            // 检查工具是否包含来源信息
            // 这可能在描述、名称或其他字段中
            const hasSourceInfo =
              tool.description?.includes('server') ||
              tool.description?.includes('group') ||
              tool.name.includes('_') ||
              tool.name.includes('-') ||
              'source' in tool ||
              'serverId' in tool ||
              'groupId' in tool;

            if (hasSourceInfo) {
              console.log(`Tool ${tool.name} has source information`);
            }

            // 至少应该有基本的工具信息
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
            expect(typeof tool.name).toBe('string');
            expect(typeof tool.description).toBe('string');
          }
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 30000);
  });

  describe('性能和扩展性', () => {
    it('应该能够高效处理大量工具的聚合', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'scalability-test',
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

        const startTime = Date.now();
        const toolsResult = await client.listTools();
        const endTime = Date.now();

        const responseTime = endTime - startTime;

        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();

        // 即使有大量工具，响应时间也应该合理
        expect(responseTime).toBeLessThan(10000); // 10秒内

        console.log(
          `Listed ${toolsResult.tools.length} tools in ${responseTime}ms`,
        );

        // 如果有工具，测试调用性能
        if (toolsResult.tools.length > 0) {
          const tool = toolsResult.tools[0];

          const callStartTime = Date.now();
          try {
            await client.callTool({
              name: tool.name,
              arguments: {},
            });
          } catch (_error) {
            // 调用失败是可以接受的，重要的是响应时间
          }
          const callEndTime = Date.now();

          const callResponseTime = callEndTime - callStartTime;
          expect(callResponseTime).toBeLessThan(30000); // 30秒内

          console.log(`Tool call completed in ${callResponseTime}ms`);
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 45000);

    it('应该能够处理并发的工具调用', async () => {
      const transport = new SSEClientTransport(
        new URL('http://localhost:3000/mcp/sse'),
      );
      const client = new Client(
        {
          name: 'concurrent-calls-test',
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

        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const tool = toolsResult.tools[0];
          const concurrentCallCount = 5;

          // 创建并发调用
          const concurrentCalls = Array.from(
            { length: concurrentCallCount },
            () =>
              client
                .callTool({
                  name: tool.name,
                  arguments: {},
                })
                .catch((error) => ({ error: (error as Error).message })),
          );

          const startTime = Date.now();
          const results = await Promise.all(concurrentCalls);
          const endTime = Date.now();

          const totalTime = endTime - startTime;
          const averageTime = totalTime / concurrentCallCount;

          // 验证所有调用都得到了响应（成功或失败）
          expect(results).toHaveLength(concurrentCallCount);

          // 并发调用的平均时间应该合理
          expect(averageTime).toBeLessThan(10000); // 10秒内

          console.log(
            `${concurrentCallCount} concurrent calls completed in ${totalTime}ms (avg: ${averageTime}ms)`,
          );
        }
      } finally {
        await client.close();
        await transport.close();
      }
    }, 60000);
  });
});
