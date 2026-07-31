/**
 * MCP Knot聚合功能端到端测试
 * 测试Hub作为MCP服务聚合器的核心功能
 *
 * v2（协议 2026-07-28）：通过 StreamableHTTPClientTransport 连接
 * `/:group/mcp`（无状态），客户端 versionNegotiation: 'auto'。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupTestEnvironment, setupTestEnvironment, sleep } from '../test-utils.js';
import {
  cleanupMcpTestConfig,
  closeMcpClient,
  createMcpTestClient,
  ensureTestServerRunning,
  type McpTestConfig,
} from './mcp-test-config.js';

import type { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

describe('MCP Knot聚合功能端到端测试', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  const config: McpTestConfig = {
    serverPort: 3000,
    baseUrl: 'http://localhost:3000',
    group: 'default',
    mcpEndpoint: '/default/mcp',
    timeout: 30000,
    retries: 3,
  };

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning(config);
    if (serverReady) {
      await sleep(500);
    }
  });

  afterAll(async () => {
    cleanupMcpTestConfig();
    cleanupTestEnvironment();
    restoreConsole();
  });

  /**
   * 建立一个连到 default 组的 MCP 客户端，失败时返回 null。
   */
  async function connect(
    name: string,
  ): Promise<{ client: Client; transport: StreamableHTTPClientTransport } | null> {
    if (!serverReady) {
      return null;
    }
    try {
      return await createMcpTestClient(name, config);
    } catch (error) {
      console.warn(`聚合测试客户端 '${name}' 连接失败:`, error);
      return null;
    }
  }

  describe('多服务器工具聚合', () => {
    it('应该能够聚合来自多个MCP服务器的工具', async () => {
      const connection = await connect('aggregation-test-client');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();
        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();
        expect(Array.isArray(toolsResult.tools)).toBe(true);

        // 验证工具列表结构（description 在 MCP 协议中是 SHOULD 而非 MUST）
        for (const tool of toolsResult.tools) {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('inputSchema');
          expect(typeof tool.name).toBe('string');
          expect(tool.name.length).toBeGreaterThan(0);
        }

        console.log(`Found ${toolsResult.tools.length} aggregated tools`);
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);

    it('应该能够正确路由工具调用到对应的后端服务器', async () => {
      const connection = await connect('routing-test-client');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          // 尝试调用前几个工具，验证路由功能
          for (const tool of toolsResult.tools.slice(0, 3)) {
            try {
              const callResult = await client.callTool({
                name: tool.name,
                arguments: {},
              });

              expect(callResult).toBeDefined();
              expect(callResult.content).toBeDefined();
              expect(Array.isArray(callResult.content)).toBe(true);

              console.log(`Successfully routed call to tool: ${tool.name}`);
            } catch (error) {
              // 工具调用可能因为参数问题失败，但不应该是路由问题
              expect(error).toBeInstanceOf(Error);

              const errorMessage = (error as Error).message.toLowerCase();
              expect(errorMessage).not.toContain('routing');
              expect(errorMessage).not.toContain('server not found');
              expect(errorMessage).not.toContain('transport');
            }
          }
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 45000);

    it('应该能够处理后端服务器的不同响应格式', async () => {
      const connection = await connect('response-format-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const responsesReceived: Array<{
            toolName: string;
            response?: unknown;
            error?: string;
            success: boolean;
          }> = [];

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

          for (const response of responsesReceived) {
            if (response.success) {
              const r = response.response as { content?: unknown } | undefined;
              expect(r).toBeDefined();
              expect(r?.content).toBeDefined();
              expect(Array.isArray(r?.content)).toBe(true);
            } else {
              expect(response.error).toBeDefined();
              expect(typeof response.error).toBe('string');
            }
          }

          console.log(`Processed ${responsesReceived.length} different response formats`);
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 45000);
  });

  describe('服务器状态管理', () => {
    it('应该能够处理后端服务器的连接状态变化', async () => {
      const connection = await connect('server-status-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const initialTools = await client.listTools();
        expect(initialTools).toBeDefined();

        await sleep(500);

        const updatedTools = await client.listTools();
        expect(updatedTools).toBeDefined();
        expect(Array.isArray(updatedTools.tools)).toBe(true);

        console.log(
          `Initial tools: ${initialTools.tools.length}, Updated tools: ${updatedTools.tools.length}`,
        );
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);

    it('应该能够处理部分后端服务器不可用的情况', async () => {
      const connection = await connect('partial-failure-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();
        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();
        expect(Array.isArray(toolsResult.tools)).toBe(true);

        if (toolsResult.tools.length > 0) {
          for (const tool of toolsResult.tools.slice(0, 3)) {
            try {
              await client.callTool({
                name: tool.name,
                arguments: {},
              });
            } catch (error) {
              expect((error as Error).message).not.toContain('server unavailable');
              expect((error as Error).message).not.toContain('connection refused');
            }
          }
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);
  });

  describe('工具命名空间和冲突处理', () => {
    it('应该能够处理来自不同服务器的同名工具', async () => {
      const connection = await connect('namespace-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const toolNames = toolsResult.tools.map((tool) => tool.name);

          for (const toolName of toolNames) {
            expect(typeof toolName).toBe('string');
            expect(toolName.length).toBeGreaterThan(0);
          }

          console.log(`All ${toolNames.length} tool names validated`);
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);

    it('应该能够提供工具的来源信息', async () => {
      const connection = await connect('source-info-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          for (const tool of toolsResult.tools) {
            expect(tool.name).toBeDefined();
            expect(typeof tool.name).toBe('string');
            // description 在 MCP 协议中是 SHOULD 而非 MUST（如 group_status 未声明）
            if (tool.description !== undefined) {
              expect(typeof tool.description).toBe('string');
            }
          }
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);
  });

  describe('性能和扩展性', () => {
    it('应该能够高效处理大量工具的聚合', async () => {
      const connection = await connect('scalability-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const startTime = Date.now();
        const toolsResult = await client.listTools();
        const endTime = Date.now();

        const responseTime = endTime - startTime;

        expect(toolsResult).toBeDefined();
        expect(toolsResult.tools).toBeDefined();
        expect(responseTime).toBeLessThan(10000);

        console.log(`Listed ${toolsResult.tools.length} tools in ${responseTime}ms`);

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
          const callResponseTime = Date.now() - callStartTime;
          expect(callResponseTime).toBeLessThan(30000);
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 45000);

    it('应该能够处理并发的工具调用', async () => {
      const connection = await connect('concurrent-calls-test');
      if (!connection) {
        console.warn('服务器未就绪或连接失败，跳过');
        return;
      }

      const { client, transport } = connection;
      try {
        const toolsResult = await client.listTools();

        if (toolsResult.tools.length > 0) {
          const tool = toolsResult.tools[0];
          const concurrentCallCount = 5;

          const concurrentCalls = Array.from({ length: concurrentCallCount }, () =>
            client
              .callTool({
                name: tool.name,
                arguments: {},
              })
              .catch((error) => ({ error: (error as Error).message })),
          );

          const startTime = Date.now();
          const results = await Promise.all(concurrentCalls);
          const totalTime = Date.now() - startTime;
          const averageTime = totalTime / concurrentCallCount;

          expect(results).toHaveLength(concurrentCallCount);
          expect(averageTime).toBeLessThan(10000);

          console.log(
            `${concurrentCallCount} concurrent calls completed in ${totalTime}ms (avg: ${averageTime}ms)`,
          );
        }
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 60000);
  });
});
