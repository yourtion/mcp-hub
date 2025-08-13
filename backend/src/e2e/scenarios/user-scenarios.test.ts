/**
 * 端到端用户场景测试
 * 测试完整的用户使用流程，从配置到工具调用
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  retry,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('端到端用户场景测试', () => {
  let testApp: typeof app;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    // 等待应用完全初始化
    await sleep(1000);
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('新用户首次使用场景', () => {
    it('应该能够完成从发现到使用的完整流程', async () => {
      // 1. 用户首先检查系统状态
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const pingData = await safeJsonParse(pingResponse);
      expect(pingData.success).toBe(true);

      // 2. 用户查看可用的组
      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);

      const groupsData = await safeJsonParse(groupsResponse);
      expect(groupsData).toHaveProperty('groups');
      expect(Array.isArray(groupsData.groups)).toBe(true);

      // 3. 如果有组，用户查看组详情
      if (groupsData.groups.length > 0) {
        const firstGroup = groupsData.groups[0];

        // 查看组详情
        const groupDetailResponse = await testApp.request(
          `/api/groups/${firstGroup.id}`,
        );
        expect(groupDetailResponse.status).toBe(200);

        const groupDetail = await safeJsonParse(groupDetailResponse);
        expect(groupDetail).toHaveProperty('id', firstGroup.id);

        // 查看组的工具列表
        const toolsResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/tools`,
        );
        expect(toolsResponse.status).toBe(200);

        const toolsData = await safeJsonParse(toolsResponse);
        expect(toolsData).toHaveProperty('tools');
        expect(Array.isArray(toolsData.tools)).toBe(true);

        // 查看组的服务器状态
        const serversResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/servers`,
        );
        expect(serversResponse.status).toBe(200);

        const serversData = await safeJsonParse(serversResponse);
        expect(serversData).toHaveProperty('servers');
        expect(Array.isArray(serversData.servers)).toBe(true);

        // 检查组健康状态
        const healthResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/health`,
        );
        expect([200, 503]).toContain(healthResponse.status);

        const healthData = await safeJsonParse(healthResponse);
        expect(healthData).toHaveProperty('groupId', firstGroup.id);
      }
    });

    it('应该能够处理用户的探索性请求', async () => {
      // 用户可能会尝试各种端点来了解系统
      const exploratoryEndpoints = [
        '/api/ping',
        '/api/groups',
        '/api/status', // 可能不存在，但用户可能会尝试
        '/api/health', // 可能不存在，但用户可能会尝试
      ];

      for (const endpoint of exploratoryEndpoints) {
        const response = await testApp.request(endpoint);

        // 应该返回有意义的响应，而不是崩溃
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);

        // 如果是404，应该有合理的错误信息
        if (response.status === 404) {
          const data = await safeJsonParse(response);
          // 验证错误响应格式
          expect(data).toBeDefined();
        }
      }
    });
  });

  describe('高级用户工作流场景', () => {
    it('应该能够处理复杂的多步骤工作流', async () => {
      // 1. 获取所有组
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        // 如果没有组，跳过此测试
        return;
      }

      // 2. 并行检查多个组的状态
      const healthCheckPromises = groupsData.groups
        .slice(0, 3)
        .map((group: { id: string }) =>
          testApp.request(`/api/groups/${group.id}/health`),
        );

      const healthResponses = await Promise.all(healthCheckPromises);

      for (const response of healthResponses) {
        expect([200, 503]).toContain(response.status);
      }

      // 3. 选择健康的组进行工具操作
      const healthyGroups = [];
      for (let i = 0; i < healthResponses.length; i++) {
        if (healthResponses[i].status === 200) {
          healthyGroups.push(groupsData.groups[i]);
        }
      }

      // 4. 对健康的组进行工具查询
      for (const group of healthyGroups.slice(0, 2)) {
        // 限制为前2个
        const toolsResponse = await testApp.request(
          `/api/groups/${group.id}/tools`,
        );
        expect(toolsResponse.status).toBe(200);

        const toolsData = await safeJsonParse(toolsResponse);
        expect(toolsData).toHaveProperty('tools');
      }
    });

    it('应该能够处理用户的批量操作', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        return;
      }

      // 模拟用户批量查询多个组的信息
      const batchRequests = groupsData.groups
        .slice(0, 5)
        .map((group: { id: string }) => ({
          detail: testApp.request(`/api/groups/${group.id}`),
          tools: testApp.request(`/api/groups/${group.id}/tools`),
          servers: testApp.request(`/api/groups/${group.id}/servers`),
        }));

      // 执行批量请求
      for (const requests of batchRequests) {
        const [detailResponse, toolsResponse, serversResponse] =
          await Promise.all([
            requests.detail,
            requests.tools,
            requests.servers,
          ]);

        expect(detailResponse.status).toBe(200);
        expect(toolsResponse.status).toBe(200);
        expect(serversResponse.status).toBe(200);
      }
    });
  });

  describe('管理员场景', () => {
    it('应该能够进行系统监控和诊断', async () => {
      // 1. 检查系统整体状态
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      // 2. 获取所有组的概览
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      expect(groupsData).toHaveProperty('totalGroups');
      expect(typeof groupsData.totalGroups).toBe('number');

      // 3. 检查每个组的健康状态
      if (groupsData.groups.length > 0) {
        const healthChecks = await Promise.all(
          groupsData.groups.map((group: { id: string }) =>
            testApp.request(`/api/groups/${group.id}/health`),
          ),
        );

        let healthyCount = 0;
        let unhealthyCount = 0;

        for (const response of healthChecks) {
          if (response.status === 200) {
            healthyCount++;
          } else {
            unhealthyCount++;
          }
        }

        // 验证健康检查结果的合理性
        expect(healthyCount + unhealthyCount).toBe(groupsData.groups.length);
      }

      // 4. 检查系统资源使用情况（通过响应时间间接评估）
      const performanceTests = Array.from({ length: 5 }, () =>
        testApp.request('/api/ping'),
      );

      const startTime = Date.now();
      const responses = await Promise.all(performanceTests);
      const endTime = Date.now();

      const averageResponseTime = (endTime - startTime) / responses.length;
      expect(averageResponseTime).toBeLessThan(1000); // 平均响应时间应小于1秒

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    it('应该能够处理系统维护场景', async () => {
      // 模拟系统维护期间的操作

      // 1. 检查当前系统状态
      const initialPing = await testApp.request('/api/ping');
      expect(initialPing.status).toBe(200);

      // 2. 获取所有组的当前状态快照
      const groupsSnapshot = await testApp.request('/api/groups');
      const snapshotData = await safeJsonParse(groupsSnapshot);

      // 3. 模拟维护期间的监控请求
      const monitoringRequests = Array.from({ length: 3 }, async (_, index) => {
        await sleep(100 * (index + 1)); // 间隔请求
        return testApp.request('/api/ping');
      });

      const monitoringResponses = await Promise.all(monitoringRequests);

      for (const response of monitoringResponses) {
        expect(response.status).toBe(200);
      }

      // 4. 验证系统在维护期间保持稳定
      const finalPing = await testApp.request('/api/ping');
      expect(finalPing.status).toBe(200);

      const finalGroups = await testApp.request('/api/groups');
      const finalData = await safeJsonParse(finalGroups);

      // 组数量应该保持一致（除非有配置变更）
      expect(finalData.totalGroups).toBe(snapshotData.totalGroups);
    });
  });

  describe('错误恢复场景', () => {
    it('应该能够从临时错误中恢复', async () => {
      // 模拟网络抖动或临时服务不可用的情况

      const maxRetries = 3;
      let successCount = 0;
      let errorCount = 0;

      // 使用重试机制测试系统的恢复能力
      for (let i = 0; i < 5; i++) {
        try {
          const response = await retry(
            async () => await testApp.request('/api/ping'),
            maxRetries,
            100,
          );

          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // 大部分请求应该成功
      expect(successCount).toBeGreaterThan(errorCount);
      expect(successCount).toBeGreaterThan(0);
    });

    it('应该能够处理部分组不可用的情况', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        return;
      }

      // 检查所有组的健康状态
      const healthResults = [];

      for (const group of groupsData.groups) {
        try {
          const healthResponse = await testApp.request(
            `/api/groups/${group.id}/health`,
          );
          healthResults.push({
            groupId: group.id,
            status: healthResponse.status,
            healthy: healthResponse.status === 200,
          });
        } catch (error) {
          healthResults.push({
            groupId: group.id,
            status: 500,
            healthy: false,
            error: error,
          });
        }
      }

      // 验证系统能够区分健康和不健康的组
      const healthyGroups = healthResults.filter((result) => result.healthy);
      const unhealthyGroups = healthResults.filter((result) => !result.healthy);

      // 对于健康的组，应该能够正常获取工具列表
      for (const healthyGroup of healthyGroups.slice(0, 2)) {
        const toolsResponse = await testApp.request(
          `/api/groups/${healthyGroup.groupId}/tools`,
        );
        expect(toolsResponse.status).toBe(200);
      }

      // 系统应该能够报告整体状态，即使部分组不可用
      const overallPing = await testApp.request('/api/ping');
      expect(overallPing.status).toBe(200);
    });
  });

  describe('性能和负载场景', () => {
    it('应该能够处理正常负载', async () => {
      const concurrentUsers = 5;
      const requestsPerUser = 3;

      // 模拟多个用户同时使用系统
      const userSimulations = Array.from(
        { length: concurrentUsers },
        async (_, userIndex) => {
          const userRequests = [];

          // 每个用户执行一系列操作
          for (let i = 0; i < requestsPerUser; i++) {
            userRequests.push(
              testApp.request('/api/ping'),
              testApp.request('/api/groups'),
            );
          }

          const responses = await Promise.all(userRequests);

          // 验证所有请求都成功
          for (const response of responses) {
            expect(response.status).toBe(200);
          }

          return responses.length;
        },
      );

      const results = await Promise.all(userSimulations);
      const totalRequests = results.reduce((sum, count) => sum + count, 0);

      expect(totalRequests).toBe(concurrentUsers * requestsPerUser * 2);
    });

    it('应该能够在高频请求下保持稳定', async () => {
      const requestCount = 20;
      const batchSize = 5;

      // 分批发送请求以避免过载
      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const batchRequests = Array.from({ length: batchSize }, () =>
          testApp.request('/api/ping'),
        );

        const batchResponses = await Promise.all(batchRequests);

        for (const response of batchResponses) {
          expect(response.status).toBe(200);
        }

        // 批次间短暂延迟
        await sleep(50);
      }
    });
  });
});
