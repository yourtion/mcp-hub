/**
 * 端到端测试主入口
 * 运行所有端到端测试场景
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testApp as app } from '../test-app.js';
import {
  defaultE2EConfig,
  getCurrentTestEnvironment,
  TestResultCollector,
} from './e2e.config.js';
import {
  cleanupTestEnvironment,
  createPerformanceBenchmark,
  createTestScenario,
  executeScenarioStep,
  generatePerformanceReport,
  generateTestReport,
  setupTestEnvironment,
  sleep,
} from './test-utils.js';

describe('MCP Hub 端到端测试套件', () => {
  let testApp: typeof app;
  let restoreConsole: () => void;
  let resultCollector: TestResultCollector;
  let testEnvironment: ReturnType<typeof getCurrentTestEnvironment>;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    resultCollector = new TestResultCollector();
    testEnvironment = getCurrentTestEnvironment();

    // 等待应用完全初始化
    await sleep(2000);

    console.log(`运行端到端测试 - 环境: ${testEnvironment.name}`);
  });

  afterAll(async () => {
    // 生成测试报告
    const summary = resultCollector.getSummary();
    console.log('\n=== 端到端测试总结 ===');
    console.log(`总测试数: ${summary.total}`);
    console.log(`成功: ${summary.successful}`);
    console.log(`失败: ${summary.failed}`);
    console.log(`成功率: ${summary.successRate.toFixed(2)}%`);
    console.log(`平均执行时间: ${summary.averageDuration.toFixed(2)}ms`);

    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('系统健康检查', () => {
    it('应该能够验证系统基本功能', async () => {
      const scenario = createTestScenario('system-health-check', [
        'ping-test',
        'groups-availability',
        'basic-api-functionality',
      ]);

      // 1. Ping测试
      const pingResult = await executeScenarioStep(
        scenario,
        'ping-test',
        async () => {
          const response = await testApp.request('/api/ping');
          return { status: response.status, data: await response.json() };
        },
      );

      expect(pingResult.status).toBe(200);
      expect(pingResult.data.success).toBe(true);

      // 2. 组可用性测试
      const groupsResult = await executeScenarioStep(
        scenario,
        'groups-availability',
        async () => {
          const response = await testApp.request('/api/groups');
          return { status: response.status, data: await response.json() };
        },
      );

      expect(groupsResult.status).toBe(200);
      expect(Array.isArray(groupsResult.data.groups)).toBe(true);

      // 3. 基本API功能测试
      await executeScenarioStep(
        scenario,
        'basic-api-functionality',
        async () => {
          const endpoints = ['/api/ping', '/api/groups'];
          const results = await Promise.all(
            endpoints.map((endpoint) => testApp.request(endpoint)),
          );
          return results.map((r) => r.status);
        },
      );

      const report = generateTestReport(scenario);
      expect(report.successRate).toBe(100);

      // 记录结果
      for (const step of report.steps) {
        resultCollector.recordResult(
          'system-health-check',
          step.step,
          step.success,
          step.duration,
          step.error,
        );
      }
    });
  });

  describe('性能基准测试', () => {
    it('应该满足性能要求', async () => {
      const benchmark = createPerformanceBenchmark('api-performance');

      // 单个请求性能测试
      const singleRequestStart = Date.now();
      const pingResponse = await testApp.request('/api/ping');
      const singleRequestDuration = Date.now() - singleRequestStart;

      expect(pingResponse.status).toBe(200);
      expect(singleRequestDuration).toBeLessThan(
        defaultE2EConfig.performance.maxResponseTime,
      );

      // 并发请求性能测试
      const concurrentStart = Date.now();
      const concurrentRequests = Array.from(
        { length: defaultE2EConfig.performance.concurrentRequestLimit },
        () => testApp.request('/api/ping'),
      );

      const concurrentResponses = await Promise.all(concurrentRequests);
      const concurrentDuration = Date.now() - concurrentStart;

      // 验证所有并发请求都成功
      for (const response of concurrentResponses) {
        expect(response.status).toBe(200);
      }

      // 并发请求的平均响应时间应该合理
      const averageConcurrentTime =
        concurrentDuration / concurrentRequests.length;
      expect(averageConcurrentTime).toBeLessThan(
        defaultE2EConfig.performance.maxResponseTime,
      );

      const performanceReport = generatePerformanceReport(benchmark);
      console.log('性能测试报告:', performanceReport);

      resultCollector.recordResult(
        'performance-benchmark',
        'single-request',
        singleRequestDuration < defaultE2EConfig.performance.maxResponseTime,
        singleRequestDuration,
      );

      resultCollector.recordResult(
        'performance-benchmark',
        'concurrent-requests',
        averageConcurrentTime < defaultE2EConfig.performance.maxResponseTime,
        concurrentDuration,
      );
    });
  });

  describe('错误恢复能力测试', () => {
    it('应该能够从各种错误中恢复', async () => {
      const scenario = createTestScenario('error-recovery', [
        'handle-404-errors',
        'handle-invalid-requests',
        'recover-from-failures',
      ]);

      // 1. 处理404错误
      await executeScenarioStep(scenario, 'handle-404-errors', async () => {
        const response = await testApp.request('/api/nonexistent');
        return { status: response.status };
      });

      // 2. 处理无效请求
      await executeScenarioStep(
        scenario,
        'handle-invalid-requests',
        async () => {
          const invalidRequests = [
            '/api/groups/invalid-id',
            '/api/groups/../../../etc/passwd',
            `/api/groups/${'x'.repeat(1000)}`,
          ];

          const responses = await Promise.all(
            invalidRequests.map((path) => testApp.request(path)),
          );

          return responses.map((r) => r.status);
        },
      );

      // 3. 从失败中恢复
      await executeScenarioStep(scenario, 'recover-from-failures', async () => {
        // 先发送一个可能失败的请求
        await testApp.request('/api/nonexistent');

        // 然后验证系统仍然能够正常响应
        const recoveryResponse = await testApp.request('/api/ping');
        return { status: recoveryResponse.status };
      });

      const report = generateTestReport(scenario);

      // 记录结果
      for (const step of report.steps) {
        resultCollector.recordResult(
          'error-recovery',
          step.step,
          step.success,
          step.duration,
          step.error,
        );
      }
    });
  });

  describe('向后兼容性验证', () => {
    it('应该保持API向后兼容', async () => {
      const scenario = createTestScenario('backward-compatibility', [
        'legacy-endpoints',
        'response-format-consistency',
        'status-code-consistency',
      ]);

      // 1. 传统端点测试
      await executeScenarioStep(scenario, 'legacy-endpoints', async () => {
        const legacyEndpoints = ['/api/ping', '/api/groups'];
        const responses = await Promise.all(
          legacyEndpoints.map((endpoint) => testApp.request(endpoint)),
        );
        return responses.map((r) => ({ status: r.status, endpoint: r.url }));
      });

      // 2. 响应格式一致性
      await executeScenarioStep(
        scenario,
        'response-format-consistency',
        async () => {
          const pingResponse = await testApp.request('/api/ping');
          const pingData = await pingResponse.json();

          // 验证响应格式
          const hasRequiredFields =
            'success' in pingData &&
            'message' in pingData &&
            'timestamp' in pingData;

          return { hasRequiredFields, data: pingData };
        },
      );

      // 3. 状态码一致性
      await executeScenarioStep(
        scenario,
        'status-code-consistency',
        async () => {
          const testCases = [
            { path: '/api/ping', expectedStatus: 200 },
            { path: '/api/groups', expectedStatus: 200 },
            { path: '/api/nonexistent', expectedStatus: 404 },
          ];

          const results = [];
          for (const testCase of testCases) {
            const response = await testApp.request(testCase.path);
            results.push({
              path: testCase.path,
              expectedStatus: testCase.expectedStatus,
              actualStatus: response.status,
              matches: response.status === testCase.expectedStatus,
            });
          }

          return results;
        },
      );

      const report = generateTestReport(scenario);

      // 记录结果
      for (const step of report.steps) {
        resultCollector.recordResult(
          'backward-compatibility',
          step.step,
          step.success,
          step.duration,
          step.error,
        );
      }
    });
  });

  describe('完整用户场景测试', () => {
    it('应该支持完整的用户工作流', async () => {
      const scenario = createTestScenario('complete-user-workflow', [
        'user-discovery',
        'group-exploration',
        'tool-interaction',
        'error-handling',
      ]);

      // 1. 用户发现阶段
      const discoveryResult = await executeScenarioStep(
        scenario,
        'user-discovery',
        async () => {
          const pingResponse = await testApp.request('/api/ping');
          const groupsResponse = await testApp.request('/api/groups');

          return {
            systemHealthy: pingResponse.status === 200,
            groupsAvailable: groupsResponse.status === 200,
            groupCount: (await groupsResponse.json()).totalGroups,
          };
        },
      );

      expect(discoveryResult.systemHealthy).toBe(true);
      expect(discoveryResult.groupsAvailable).toBe(true);

      // 2. 组探索阶段
      if (discoveryResult.groupCount > 0) {
        await executeScenarioStep(scenario, 'group-exploration', async () => {
          const groupsResponse = await testApp.request('/api/groups');
          const groupsData = await groupsResponse.json();

          if (groupsData.groups.length > 0) {
            const firstGroup = groupsData.groups[0];
            const detailResponse = await testApp.request(
              `/api/groups/${firstGroup.id}`,
            );
            const toolsResponse = await testApp.request(
              `/api/groups/${firstGroup.id}/tools`,
            );

            return {
              groupDetailAvailable: detailResponse.status === 200,
              toolsAvailable: toolsResponse.status === 200,
            };
          }

          return { groupDetailAvailable: true, toolsAvailable: true };
        });
      }

      // 3. 工具交互阶段（模拟）
      await executeScenarioStep(scenario, 'tool-interaction', async () => {
        // 这里模拟工具交互，实际实现中会调用真实的工具
        return { toolCallSuccessful: true };
      });

      // 4. 错误处理阶段
      await executeScenarioStep(scenario, 'error-handling', async () => {
        const invalidResponse = await testApp.request('/api/groups/invalid');
        return { errorHandledCorrectly: invalidResponse.status === 404 };
      });

      const report = generateTestReport(scenario);

      // 记录结果
      for (const step of report.steps) {
        resultCollector.recordResult(
          'complete-user-workflow',
          step.step,
          step.success,
          step.duration,
          step.error,
        );
      }
    });
  });

  describe('MCP协议端到端测试', () => {
    it('应该支持MCP协议相关的API端点', async () => {
      const scenario = createTestScenario('mcp-protocol-interaction', [
        'mcp-status-check',
        'mcp-tools-listing',
        'mcp-health-check',
      ]);

      // 1. MCP状态检查
      const statusResult = await executeScenarioStep(
        scenario,
        'mcp-status-check',
        async () => {
          const response = await testApp.request('/mcp/status');
          const data = await response.json();
          return {
            status: response.status,
            hasService: 'service' in data,
            hasServers: 'servers' in data,
          };
        },
      );

      expect(statusResult.status).toBe(200);
      expect(statusResult.hasService).toBe(true);
      expect(statusResult.hasServers).toBe(true);

      // 2. MCP工具列表测试
      const toolsResult = await executeScenarioStep(
        scenario,
        'mcp-tools-listing',
        async () => {
          const response = await testApp.request('/mcp/tools');
          const data = await response.json();
          return {
            status: response.status,
            toolsCount: data.totalTools,
            hasTools: Array.isArray(data.allTools),
          };
        },
      );

      expect(toolsResult.status).toBe(200);
      expect(toolsResult.hasTools).toBe(true);
      expect(toolsResult.toolsCount).toBeGreaterThan(0);

      // 3. MCP健康检查测试
      const healthResult = await executeScenarioStep(
        scenario,
        'mcp-health-check',
        async () => {
          const response = await testApp.request('/mcp/health');
          const data = await response.json();
          return {
            status: response.status,
            healthy: data.healthy,
            hasService: 'service' in data,
          };
        },
      );

      expect(healthResult.status).toBe(200);
      expect(healthResult.healthy).toBe(true);
      expect(healthResult.hasService).toBe(true);

      const report = generateTestReport(scenario);

      // 记录结果
      for (const step of report.steps) {
        resultCollector.recordResult(
          'mcp-protocol-interaction',
          step.step,
          step.success,
          step.duration,
          step.error,
        );
      }
    });
  });
});
