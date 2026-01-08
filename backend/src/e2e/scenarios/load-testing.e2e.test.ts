/**
 * 性能和压力测试 E2E
 * 测试系统在高负载和极限条件下的表现
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, stopTestServer } from '../test-server.js';
import { E2ETestHelper } from '../e2e-test-helper.js';
import { MockServerManager, type MockServerConfig } from '../mock-mcp-server.js';

describe('性能和压力测试 E2E', () => {
  const testServer = startTestServer(3000);
  const baseUrl = 'http://localhost:3000';
  const mockManager = new MockServerManager();

  beforeEach(async () => {
    await testServer;
    mockManager.resetAllStats();
  });

  afterAll(async () => {
    await stopTestServer();
    await mockManager.stopAll();
  });

  describe('负载测试', () => {
    it('应该处理 100 个并发工具调用', async () => {
      // 创建测试服务器
      const serverConfig: MockServerConfig = {
        id: 'load-test-server',
        name: 'Load Test Server',
        toolCount: 5,
        delay: 20,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      // 等待服务器就绪
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      // 获取可用工具
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        console.log('没有可用工具，跳过测试');
        return;
      }

      const tool = tools[0];
      const concurrentRequests = 100;

      // 创建并发请求
      const requests = Array.from({ length: concurrentRequests }, () =>
        fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            arguments: { param1: 'load-test' },
          }),
        }),
      );

      // 执行并测量
      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      // 分析结果
      const successful = responses.filter(
        r => r.status === 'fulfilled' && r.value.ok,
      );
      const failed = responses.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok),
      );

      const successRate = (successful.length / concurrentRequests) * 100;
      const throughput = (concurrentRequests / duration) * 1000; // req/sec

      console.log(`\n负载测试结果 (${concurrentRequests} 并发):`);
      console.log(`  总耗时: ${duration}ms`);
      console.log(`  成功: ${successful.length}`);
      console.log(`  失败: ${failed.length}`);
      console.log(`  成功率: ${successRate.toFixed(2)}%`);
      console.log(`  吞吐量: ${throughput.toFixed(2)} req/sec`);

      // 验证系统保持稳定
      expect(successRate).toBeGreaterThan(80); // 至少 80% 成功率
      expect(duration).toBeLessThan(60000); // 60秒内完成
    }, 90000);

    it('应该处理持续负载', async () => {
      const serverConfig: MockServerConfig = {
        id: 'sustained-load-server',
        name: 'Sustained Load Server',
        toolCount: 3,
        delay: 10,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      const tool = tools[0];
      const batchSize = 10;
      const batches = 20;
      const totalRequests = batchSize * batches;

      let totalSuccessful = 0;
      const startTime = Date.now();

      // 分批执行请求
      for (let i = 0; i < batches; i++) {
        const batch = Array.from({ length: batchSize }, () =>
          fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tool.name,
              arguments: { param1: `batch-${i}` },
            }),
          }),
        );

        const responses = await Promise.allSettled(batch);

        const batchSuccessful = responses.filter(
          r => r.status === 'fulfilled' && r.value.ok,
        ).length;

        totalSuccessful += batchSuccessful;

        console.log(
          `批次 ${i + 1}/${batches}: ${batchSuccessful}/${batchSize} 成功`,
        );

        // 批次间短暂延迟
        await E2ETestHelper.delay(100);
      }

      const duration = Date.now() - startTime;
      const successRate = (totalSuccessful / totalRequests) * 100;
      const avgThroughput = (totalRequests / duration) * 1000;

      console.log(`\n持续负载测试结果:`);
      console.log(`  总请求数: ${totalRequests}`);
      console.log(`  成功请求: ${totalSuccessful}`);
      console.log(`  成功率: ${successRate.toFixed(2)}%`);
      console.log(`  总耗时: ${duration}ms`);
      console.log(`  平均吞吐量: ${avgThroughput.toFixed(2)} req/sec`);

      expect(successRate).toBeGreaterThan(90);
    }, 120000);
  });

  describe('压力测试', () => {
    it('应该在极限压力下保持运行', async () => {
      const serverConfig: MockServerConfig = {
        id: 'stress-test-server',
        name: 'Stress Test Server',
        toolCount: 10,
        delay: 5,
        failureRate: 0.05, // 5% 失败率
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      // 极限并发
      const extremeConcurrency = 200;
      const tool = tools[Math.floor(Math.random() * tools.length)];

      const requests = Array.from({ length: extremeConcurrency }, (_, i) =>
        fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            arguments: { param1: `stress-${i}` },
          }),
        }),
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      const successful = responses.filter(
        r => r.status === 'fulfilled' && r.value.ok,
      );

      const successRate = (successful.length / extremeConcurrency) * 100;

      console.log(`\n压力测试结果 (${extremeConcurrency} 并发):`);
      console.log(`  总耗时: ${duration}ms`);
      console.log(`  成功: ${successful.length}`);
      console.log(`  成功率: ${successRate.toFixed(2)}%`);

      // 在压力下，我们允许较低的失败率
      expect(successRate).toBeGreaterThan(50);
      expect(duration).toBeLessThan(120000); // 2分钟内完成
    }, 180000);

    it('应该处理突发流量', async () => {
      const serverConfig: MockServerConfig = {
        id: 'burst-test-server',
        name: 'Burst Test Server',
        toolCount: 5,
        delay: 15,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      const tool = tools[0];

      // 模拟突发流量：多次高峰，中间有低谷
      const burstSize = 50;
      const bursts = 3;
      const cooldownTime = 2000; // 突发间冷却时间

      let totalSuccessful = 0;
      let totalRequests = 0;

      for (let burst = 0; burst < bursts; burst++) {
        console.log(`\n突发流量 ${burst + 1}/${bursts}:`);

        const requests = Array.from({ length: burstSize }, () =>
          fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tool.name,
              arguments: { param1: `burst-${burst}` },
            }),
          }),
        );

        const startTime = Date.now();
        const responses = await Promise.allSettled(requests);
        const duration = Date.now() - startTime;

        const successful = responses.filter(
          r => r.status === 'fulfilled' && r.value.ok,
        );

        totalSuccessful += successful.length;
        totalRequests += burstSize;

        console.log(`  请求数: ${burstSize}`);
        console.log(`  成功: ${successful.length}`);
        console.log(`  耗时: ${duration}ms`);

        // 突发间冷却
        if (burst < bursts - 1) {
          await E2ETestHelper.delay(cooldownTime);
        }
      }

      const overallSuccessRate = (totalSuccessful / totalRequests) * 100;

      console.log(`\n突发流量总体结果:`);
      console.log(`  总请求数: ${totalRequests}`);
      console.log(`  成功请求: ${totalSuccessful}`);
      console.log(`  总成功率: ${overallSuccessRate.toFixed(2)}%`);

      expect(overallSuccessRate).toBeGreaterThan(70);
    }, 120000);
  });

  describe('性能基准测试', () => {
    it('应该测量工具执行性能', async () => {
      const serverConfig: MockServerConfig = {
        id: 'benchmark-server',
        name: 'Benchmark Server',
        toolCount: 5,
        delay: 10,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      const tool = tools[0];

      // 性能基准测试
      const { benchmark } = await E2ETestHelper.benchmark(
        async () => {
          const response = await fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tool.name,
              arguments: { param1: 'benchmark' },
            }),
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.statusText}`);
          }
        },
        {
          iterations: 50,
          warmupIterations: 10,
          concurrency: 5,
        },
      );

      console.log(`\n工具执行性能基准:`);
      console.log(`  总时间: ${benchmark.totalTime}ms`);
      console.log(`  平均响应时间: ${benchmark.avgTime.toFixed(2)}ms`);
      console.log(`  最小响应时间: ${benchmark.minTime}ms`);
      console.log(`  最大响应时间: ${benchmark.maxTime}ms`);
      console.log(`  P95 响应时间: ${benchmark.p95Time.toFixed(2)}ms`);
      console.log(`  P99 响应时间: ${benchmark.p99Time.toFixed(2)}ms`);
      console.log(`  吞吐量: ${benchmark.opsPerSecond.toFixed(2)} ops/sec`);

      // 性能断言
      expect(benchmark.avgTime).toBeLessThan(500); // 平均响应时间 < 500ms
      expect(benchmark.p95Time).toBeLessThan(1000); // P95 < 1000ms
      expect(benchmark.opsPerSecond).toBeGreaterThan(5); // 至少 5 ops/sec
    }, 60000);

    it('应该测量网络延迟', async () => {
      const { measureNetworkLatency } = E2ETestHelper;

      const latency = await measureNetworkLatency(baseUrl, {
        samples: 20,
        endpoint: '/api/health',
      });

      console.log(`\n网络延迟测量:`);
      console.log(`  平均延迟: ${latency.avgLatency.toFixed(2)}ms`);
      console.log(`  最小延迟: ${latency.minLatency}ms`);
      console.log(`  最大延迟: ${latency.maxLatency}ms`);
      console.log(`  标准差: ${latency.stdDev.toFixed(2)}ms`);

      // 延迟应该在合理范围内
      expect(latency.avgLatency).toBeLessThan(500); // 平均延迟 < 500ms
      expect(latency.maxLatency).toBeLessThan(2000); // 最大延迟 < 2000ms
    }, 30000);
  });

  describe('资源监控', () => {
    it('应该监控资源使用情况', async () => {
      const serverConfig: MockServerConfig = {
        id: 'monitor-server',
        name: 'Monitor Server',
        toolCount: 3,
        delay: 10,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      const tool = tools[0];

      // 监控资源使用情况
      const { memoryUsage, duration } = await E2ETestHelper.monitorResources(
        async () => {
          // 执行一批操作
          const operations = Array.from({ length: 50 }, () =>
            fetch(`${baseUrl}/api/tools/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: tool.name,
                arguments: { param1: 'monitor-test' },
              }),
            }),
          );

          await Promise.allSettled(operations);
        },
        { sampleInterval: 50 },
      );

      if (memoryUsage.length === 0) {
        console.log('没有收集到内存使用数据');
        return;
      }

      const memoryValues = memoryUsage.map(m => m.used);
      const minMemory = Math.min(...memoryValues);
      const maxMemory = Math.max(...memoryValues);
      const avgMemory =
        memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;

      console.log(`\n资源使用监控:`);
      console.log(`  执行时间: ${duration}ms`);
      console.log(`  采样点数: ${memoryUsage.length}`);
      console.log(`  最小内存: ${(minMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  最大内存: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  平均内存: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);

      // 检查是否有内存泄漏（内存持续增长）
      const firstQuarter = memoryUsage.slice(0, Math.floor(memoryUsage.length / 4));
      const lastQuarter = memoryUsage.slice(-Math.floor(memoryUsage.length / 4));

      const avgFirstQuarter =
        firstQuarter.reduce((sum, m) => sum + m.used, 0) / firstQuarter.length;
      const avgLastQuarter =
        lastQuarter.reduce((sum, m) => sum + m.used, 0) / lastQuarter.length;

      const growthRate = ((avgLastQuarter - avgFirstQuarter) / avgFirstQuarter) * 100;

      console.log(`  内存增长率: ${growthRate.toFixed(2)}%`);

      // 内存增长不应超过 50%
      expect(growthRate).toBeLessThan(50);
    }, 60000);
  });

  describe('性能退化检测', () => {
    it('应该检测性能退化', async () => {
      const serverConfig: MockServerConfig = {
        id: 'degradation-server',
        name: 'Degradation Server',
        toolCount: 3,
        delay: 10,
      };

      mockManager.addServer(serverConfig);
      await mockManager.startAll();

      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      const { tools } = await toolsResponse.json();

      if (tools.length === 0) {
        return;
      }

      const tool = tools[0];

      // 测试三轮，每轮性能可能因负载而变化
      const rounds = 3;
      const results: Array<{ round: number; avgTime: number }> = [];

      for (let round = 0; round < rounds; round++) {
        const { benchmark } = await E2ETestHelper.benchmark(
          async () => {
            await fetch(`${baseUrl}/api/tools/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: tool.name,
                arguments: { param1: `round-${round}` },
              }),
            });
          },
          { iterations: 20, warmupIterations: 5 },
        );

        results.push({ round: round + 1, avgTime: benchmark.avgTime });

        console.log(
          `第 ${round + 1} 轮平均响应时间: ${benchmark.avgTime.toFixed(2)}ms`,
        );

        // 轮次间短暂延迟
        if (round < rounds - 1) {
          await E2ETestHelper.delay(1000);
        }
      }

      // 检查性能退化（最后一轮显著慢于第一轮）
      const degradationRate =
        ((results[rounds - 1].avgTime - results[0].avgTime) /
          results[0].avgTime) *
        100;

      console.log(`\n性能退化率: ${degradationRate.toFixed(2)}%`);

      // 性能退化不应超过 100%
      expect(degradationRate).toBeLessThan(100);
    }, 60000);
  });
});
