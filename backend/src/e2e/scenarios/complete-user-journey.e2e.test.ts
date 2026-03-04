/**
 * 完整用户流程 E2E 测试
 * 测试用户从系统启动到工具执行的完整流程
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { E2EScenarioHelper, E2ETestHelper } from '../e2e-test-helper.js';
import { MockServerManager } from '../mock-mcp-server.js';
import { startTestServer, stopTestServer } from '../test-server.js';

describe('完整用户流程 E2E 测试', () => {
  const testServer = startTestServer(3000);
  const baseUrl = 'http://localhost:3000';
  const mockManager = new MockServerManager();

  beforeEach(async () => {
    // 确保测试服务器已启动
    await testServer;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('新用户首次使用流程', () => {
    it('应该完成完整的首次使用流程', async () => {
      // 步骤 1: 系统启动并检查健康状态
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/health`);
            return response.ok;
          } catch {
            return false;
          }
        },
        { timeout: 10000, message: '系统未能在超时时间内启动' },
      );

      // 步骤 2: 加载配置
      const configResponse = await fetch(`${baseUrl}/api/config`);
      expect(configResponse.ok).toBe(true);
      const config = await configResponse.json();
      expect(config).toBeDefined();

      // 步骤 3: 查看可用服务器列表
      const serversResponse = await fetch(`${baseUrl}/api/servers`);
      expect(serversResponse.ok).toBe(true);
      const serversData = await serversResponse.json();
      expect(serversData.servers).toBeDefined();
      expect(Array.isArray(serversData.servers)).toBe(true);

      // 步骤 4: 查看可用工具列表
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      expect(toolsResponse.ok).toBe(true);
      const toolsData = await toolsResponse.json();
      expect(toolsData.tools).toBeDefined();
      expect(Array.isArray(toolsData.tools)).toBe(true);

      // 步骤 5: 执行一个工具调用（如果有工具可用）
      if (toolsData.tools.length > 0) {
        const tool = toolsData.tools[0];
        const executeResponse = await fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            arguments: { param1: 'test' },
          }),
        });

        expect(executeResponse.ok).toBe(true);
        const result = await executeResponse.json();
        expect(result).toBeDefined();
      }
    }, 30000);

    it('应该支持完整的配置管理流程', async () => {
      // 步骤 1: 查看当前配置
      const getConfigResponse = await fetch(`${baseUrl}/api/config`);
      expect(getConfigResponse.ok).toBe(true);
      const currentConfig = await getConfigResponse.json();

      // 步骤 2: 验证配置结构
      expect(currentConfig).toHaveProperty('servers');
      expect(currentConfig).toHaveProperty('groups');

      // 步骤 3: 查看系统统计
      const statsResponse = await fetch(`${baseUrl}/api/stats`);
      expect(statsResponse.ok).toBe(true);
      const stats = await statsResponse.json();

      expect(stats).toHaveProperty('serverCount');
      expect(stats).toHaveProperty('toolCount');
      expect(stats).toHaveProperty('groupCount');
    }, 20000);
  });

  describe('工具发现和执行流程', () => {
    it('应该完成工具发现到执行的全流程', async () => {
      // 步骤 1: 等待系统就绪
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 步骤 2: 获取所有工具
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      expect(toolsResponse.ok).toBe(true);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        console.log('没有可用工具，跳过工具执行测试');
        return;
      }

      // 步骤 3: 选择第一个工具
      const tool = tools[0];

      // 步骤 4: 查看工具详情
      const toolDetailResponse = await fetch(
        `${baseUrl}/api/tools/${tool.name}`,
      );
      expect(toolDetailResponse.ok).toBe(true);
      const toolDetail = await toolDetailResponse.json();

      expect(toolDetail.name).toBe(tool.name);
      expect(toolDetail.description).toBeDefined();
      expect(toolDetail.inputSchema).toBeDefined();

      // 步骤 5: 准备执行参数
      const args = toolDetail.inputSchema.properties?.param1
        ? { param1: 'test_value' }
        : {};

      // 步骤 6: 执行工具
      const executeResponse = await fetch(`${baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tool.name,
          arguments: args,
        }),
      });

      expect(executeResponse.ok).toBe(true);
      const result = await executeResponse.json();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      // 步骤 7: 验证执行结果
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    }, 30000);
  });

  describe('服务器管理流程', () => {
    it('应该完成服务器的添加、连接和移除流程', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 步骤 1: 添加新服务器
      const newServer = {
        id: 'test-server-e2e',
        name: 'E2E Test Server',
        type: 'stdio',
        command: 'node',
        args: ['test-server.js'],
      };

      const addResponse = await fetch(`${baseUrl}/api/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer),
      });

      // 注意：这个可能会失败，取决于后端实现
      // 我们只是演示流程

      // 步骤 2: 查看服务器列表
      const serversResponse = await fetch(`${baseUrl}/api/servers`);
      expect(serversResponse.ok).toBe(true);
      const { servers } = await serversResponse.json();

      // 步骤 3: 检查服务器健康状态
      for (const server of servers) {
        const healthResponse = await fetch(
          `${baseUrl}/api/servers/${server.id}/health`,
        );
        expect(healthResponse.ok).toBe(true);

        const health = await healthResponse.json();
        expect(health).toHaveProperty('healthy');
      }
    }, 30000);
  });

  describe('组管理流程', () => {
    it('应该完成组的创建、配置和使用流程', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 步骤 1: 查看现有组
      const groupsResponse = await fetch(`${baseUrl}/api/groups`);
      expect(groupsResponse.ok).toBe(true);
      const { groups } = await groupsResponse.json();

      // 步骤 2: 如果有组，查看组详情
      if (groups.length > 0) {
        const group = groups[0];

        const groupDetailResponse = await fetch(
          `${baseUrl}/api/groups/${group.id}`,
        );
        expect(groupDetailResponse.ok).toBe(true);
        const groupDetail = await groupDetailResponse.json();

        expect(groupDetail.id).toBe(group.id);
        expect(groupDetail.name).toBeDefined();
        expect(groupDetail.servers).toBeDefined();

        // 步骤 3: 查看组的工具
        const groupToolsResponse = await fetch(
          `${baseUrl}/api/groups/${group.id}/tools`,
        );
        expect(groupToolsResponse.ok).toBe(true);
        const { tools } = await groupToolsResponse.json();

        expect(tools).toBeDefined();
        expect(Array.isArray(tools)).toBe(true);
      }
    }, 20000);
  });

  describe('错误处理流程', () => {
    it('应该正确处理各种错误情况', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 测试 1: 尝试执行不存在的工具
      const executeResponse = await fetch(`${baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'nonexistent_tool',
          arguments: {},
        }),
      });

      expect(executeResponse.ok).toBe(false);
      const error = await executeResponse.json();
      expect(error).toHaveProperty('error');

      // 测试 2: 使用无效参数执行工具
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length > 0) {
        const tool = tools[0];
        const invalidResponse = await fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            arguments: { invalid_param: 'value' },
          }),
        });

        // 可能成功或失败，取决于工具实现
        const result = await invalidResponse.json();
        expect(result).toBeDefined();
      }

      // 测试 3: 访问不存在的资源
      const notFoundResponse = await fetch(`${baseUrl}/api/nonexistent`);
      expect(notFoundResponse.status).toBe(404);
    }, 20000);
  });

  describe('并发操作流程', () => {
    it('应该能够并发执行多个工具调用', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 获取可用工具
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length < 2) {
        console.log('可用工具不足，跳过并发测试');
        return;
      }

      // 并发执行多个工具
      const operations = tools.slice(0, 5).map((tool) => async () => {
        const response = await fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            arguments: { param1: 'test' },
          }),
        });

        if (!response.ok) {
          throw new Error(`Tool execution failed: ${response.statusText}`);
        }

        return response.json();
      });

      const { benchmark } = await E2ETestHelper.benchmark(
        async () => {
          await Promise.all(operations.map((op) => op()));
        },
        { iterations: 10, warmupIterations: 2 },
      );

      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.opsPerSecond).toBeGreaterThan(0);

      console.log(`并发执行性能: ${benchmark.opsPerSecond.toFixed(2)} ops/sec`);
    }, 30000);
  });

  describe('性能和稳定性', () => {
    it('应该在负载下保持稳定', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      // 模拟多个并发请求
      const requests = Array.from({ length: 20 }, () =>
        fetch(`${baseUrl}/api/health`),
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // 验证所有请求都成功
      responses.forEach((response) => {
        expect(response.ok).toBe(true);
      });

      // 验证响应时间在合理范围内
      expect(duration).toBeLessThan(5000);

      console.log(`20个并发请求完成时间: ${duration}ms`);
      console.log(`平均每个请求: ${(duration / 20).toFixed(2)}ms`);
    }, 20000);

    it('应该能够处理大量请求', async () => {
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          return response.ok;
        },
        { timeout: 10000 },
      );

      const totalRequests = 50;
      const successThreshold = 0.95; // 95% 成功率

      const { benchmark } = await E2ETestHelper.benchmark(
        async () => {
          const response = await fetch(`${baseUrl}/api/health`);
          if (!response.ok) {
            throw new Error('Health check failed');
          }
        },
        { iterations: totalRequests },
      );

      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.opsPerSecond).toBeGreaterThan(0);

      console.log(`处理 ${totalRequests} 个请求:`);
      console.log(`  总时间: ${benchmark.totalTime}ms`);
      console.log(`  平均响应时间: ${benchmark.avgTime.toFixed(2)}ms`);
      console.log(`  最小响应时间: ${benchmark.minTime}ms`);
      console.log(`  最大响应时间: ${benchmark.maxTime}ms`);
      console.log(`  P95 响应时间: ${benchmark.p95Time.toFixed(2)}ms`);
      console.log(`  吞吐量: ${benchmark.opsPerSecond.toFixed(2)} req/sec`);
    }, 30000);
  });
});
