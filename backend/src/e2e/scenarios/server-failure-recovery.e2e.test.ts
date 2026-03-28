/**
 * 故障恢复 E2E 测试
 * 测试系统在各种故障场景下的恢复能力
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { E2ETestHelper } from '../e2e-test-helper.js';
import {
  type MockServerConfig,
  MockServerManager,
} from '../mock-mcp-server.js';
import { startTestServer, stopTestServer } from '../test-server.js';

describe('故障恢复 E2E 测试', () => {
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

  describe('服务器连接中断恢复', () => {
    it('应该在服务器连接中断后自动重连', async () => {
      // 创建 Mock 服务器
      const serverConfig: MockServerConfig = {
        id: 'test-server-1',
        name: 'Test Server 1',
        toolCount: 3,
        delay: 50,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 步骤 1: 初始连接
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      // 步骤 2: 模拟连接中断
      mockServer.configureErrorInjection({
        errorType: 'network',
        injectAt: Date.now(),
        duration: 2000,
      });

      // 步骤 3: 等待连接失败
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(
              `${baseUrl}/api/servers/${serverConfig.id}/health`,
            );
            const data = await response.json();
            return data.healthy === false;
          } catch {
            return true; // 网络错误也算失败
          }
        },
        { timeout: 5000, message: 'Server did not fail as expected' },
      );

      // 步骤 4: 清除错误注入，允许恢复
      mockServer.clearErrorInjection();

      // 步骤 5: 等待自动恢复
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 15000,
      });

      // 步骤 6: 验证服务器恢复正常
      const healthResponse = await fetch(
        `${baseUrl}/api/servers/${serverConfig.id}/health`,
      );
      const health = await healthResponse.json();
      expect(health.healthy).toBe(true);

      console.log('服务器成功从连接中断中恢复');
    }, 30000);

    it('应该在多次连接中断后仍能恢复', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-2',
        name: 'Test Server 2',
        toolCount: 2,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 模拟多次故障
      for (let i = 0; i < 3; i++) {
        // 注入错误
        mockServer.configureErrorInjection({
          errorType: 'network',
          injectAt: Date.now(),
          duration: 1000,
        });

        // 等待失败
        await E2ETestHelper.waitFor(
          async () => {
            try {
              const response = await fetch(
                `${baseUrl}/api/servers/${serverConfig.id}/health`,
              );
              return !response.ok;
            } catch {
              return true;
            }
          },
          { timeout: 5000 },
        );

        // 清除错误
        mockServer.clearErrorInjection();

        // 等待恢复
        await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
          timeout: 10000,
        });

        console.log(`第 ${i + 1} 次恢复成功`);
      }

      // 最终验证
      const healthResponse = await fetch(
        `${baseUrl}/api/servers/${serverConfig.id}/health`,
      );
      const health = await healthResponse.json();
      expect(health.healthy).toBe(true);
    }, 60000);
  });

  describe('服务器崩溃恢复', () => {
    it('应该在服务器崩溃后重启并恢复', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-3',
        name: 'Test Server 3',
        toolCount: 3,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 初始健康检查
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 5000,
      });

      // 模拟服务器崩溃
      mockServer.configureErrorInjection({
        errorType: 'crash',
        injectAt: Date.now(),
        duration: 5000,
      });

      // 等待崩溃被检测到
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(
            `${baseUrl}/api/servers/${serverConfig.id}/health`,
          );
          const data = await response.json();
          return data.healthy === false || !response.ok;
        },
        { timeout: 10000 },
      );

      // 尝试恢复服务器
      await mockServer.recover();

      // 等待恢复完成
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverConfig.id, {
        timeout: 15000,
      });

      // 验证服务器功能正常
      const toolsResponse = await fetch(
        `${baseUrl}/api/servers/${serverConfig.id}/tools`,
      );
      expect(toolsResponse.ok).toBe(true);

      console.log('服务器从崩溃中成功恢复');
    }, 30000);
  });

  describe('部分服务器故障降级', () => {
    it('应该在部分服务器故障时降级服务', async () => {
      // 创建多个服务器
      const servers: MockServerConfig[] = [
        { id: 'server-a', name: 'Server A', toolCount: 3 },
        { id: 'server-b', name: 'Server B', toolCount: 3 },
        { id: 'server-c', name: 'Server C', toolCount: 3 },
      ];

      servers.forEach((config) => {
        mockManager.addServer(config);
      });

      await mockManager.startAll();

      // 等待所有服务器就绪
      await E2ETestHelper.waitForAll(
        servers.map((s) => async () => {
          try {
            const response = await fetch(
              `${baseUrl}/api/servers/${s.id}/health`,
            );
            const data = await response.json();
            return data.healthy === true;
          } catch {
            return false;
          }
        }),
        { timeout: 10000 },
      );

      // 让 Server B 故障
      const serverB = mockManager.getServer('server-b');
      serverB?.configureErrorInjection({
        errorType: 'crash',
        injectAt: Date.now(),
        duration: 10000,
      });

      // 等待故障检测
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(
            `${baseUrl}/api/servers/server-b/health`,
          );
          const data = await response.json();
          return data.healthy === false;
        },
        { timeout: 10000 },
      );

      // 验证其他服务器仍然可用
      const serverAHealth = await fetch(
        `${baseUrl}/api/servers/server-a/health`,
      );
      const serverAData = await serverAHealth.json();
      expect(serverAData.healthy).toBe(true);

      const serverCHealth = await fetch(
        `${baseUrl}/api/servers/server-c/health`,
      );
      const serverCData = await serverCHealth.json();
      expect(serverCData.healthy).toBe(true);

      // 验证工具列表仍然可用（来自健康的服务器）
      const toolsResponse = await fetch(`${baseUrl}/api/tools`);
      expect(toolsResponse.ok).toBe(true);

      console.log('系统在部分服务器故障时成功降级服务');
    }, 45000);
  });

  describe('超时恢复', () => {
    it('应该在超时后重试并恢复', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-4',
        name: 'Test Server 4',
        toolCount: 2,
        delay: 100,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 配置超时
      mockServer.configureErrorInjection({
        errorType: 'timeout',
        injectAt: Date.now(),
        duration: 3000,
      });

      // 尝试执行工具（应该超时）
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/tools/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: `${serverConfig.id}_tool1`,
                arguments: { param1: 'test' },
              }),
            });
            return !response.ok;
          } catch {
            return true;
          }
        },
        { timeout: 10000 },
      );

      // 清除超时配置
      mockServer.clearErrorInjection();

      // 等待恢复
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${serverConfig.id}_tool1`,
              arguments: { param1: 'test' },
            }),
          });
          return response.ok;
        },
        { timeout: 15000 },
      );

      console.log('服务器从超时中成功恢复');
    }, 30000);
  });

  describe('网络波动模拟', () => {
    it('应该在网络波动下保持稳定', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-5',
        name: 'Test Server 5',
        toolCount: 2,
        failureRate: 0.1, // 10% 失败率
        delay: 50,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 执行多次操作，模拟网络波动
      const totalRequests = 20;
      const successThreshold = 0.8; // 至少 80% 成功率

      let successCount = 0;

      for (let i = 0; i < totalRequests; i++) {
        try {
          const response = await fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${serverConfig.id}_tool1`,
              arguments: { param1: `test-${i}` },
            }),
          });

          if (response.ok) {
            successCount++;
          }

          // 添加随机延迟，模拟网络波动
          await E2ETestHelper.delay(Math.random() * 100);
        } catch {
          // 网络错误
        }
      }

      const successRate = successCount / totalRequests;

      expect(successRate).toBeGreaterThanOrEqual(successThreshold);

      console.log(
        `网络波动测试: ${successCount}/${totalRequests} 成功 (${(successRate * 100).toFixed(1)}%)`,
      );
    }, 60000);
  });

  describe('资源耗尽恢复', () => {
    it('应该在资源耗尽后恢复', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-6',
        name: 'Test Server 6',
        toolCount: 2,
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 发送大量并发请求，模拟资源耗尽
      const concurrentRequests = 50;

      const requests = Array.from({ length: concurrentRequests }, () =>
        fetch(`${baseUrl}/api/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${serverConfig.id}_tool1`,
            arguments: { param1: 'stress-test' },
          }),
        }),
      );

      const responses = await Promise.allSettled(requests);

      const successful = responses.filter((r) => {
        if (r.status === 'fulfilled') {
          return r.value.ok;
        }
        return false;
      });

      console.log(
        `资源压力测试: ${successful.length}/${concurrentRequests} 成功`,
      );

      // 等待系统恢复
      await E2ETestHelper.delay(2000);

      // 验证系统已恢复
      const healthResponse = await fetch(
        `${baseUrl}/api/servers/${serverConfig.id}/health`,
      );
      const health = await healthResponse.json();
      expect(health.healthy).toBe(true);

      console.log('系统从资源耗尽中成功恢复');
    }, 30000);
  });

  describe('故障统计和监控', () => {
    it('应该正确记录故障统计', async () => {
      const serverConfig: MockServerConfig = {
        id: 'test-server-7',
        name: 'Test Server 7',
        toolCount: 2,
        failureRate: 0.2, // 20% 失败率
      };

      const mockServer = mockManager.addServer(serverConfig);
      await mockServer.startAll();

      // 执行一些操作
      const operations = 20;

      for (let i = 0; i < operations; i++) {
        try {
          await fetch(`${baseUrl}/api/tools/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${serverConfig.id}_tool1`,
              arguments: { param1: `test-${i}` },
            }),
          });
        } catch {
          // 忽略错误
        }
      }

      // 获取统计信息
      const stats = mockServer.getStats();

      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.failedRequests).toBeGreaterThan(0);

      console.log('故障统计:');
      console.log(`  总请求数: ${stats.totalRequests}`);
      console.log(`  成功请求: ${stats.successfulRequests}`);
      console.log(`  失败请求: ${stats.failedRequests}`);
      console.log(`  超时请求: ${stats.timeoutRequests}`);
      console.log(`  平均响应时间: ${stats.avgResponseTime.toFixed(2)}ms`);
    }, 30000);
  });
});
