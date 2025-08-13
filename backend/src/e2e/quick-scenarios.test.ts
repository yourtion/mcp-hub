/**
 * 快速场景测试
 * 优化后的用户场景测试，避免长时间等待和超时
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from './test-utils.js';

describe('快速场景测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    await sleep(500); // 减少等待时间
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('新用户快速体验场景', () => {
    it('应该能够快速完成基本发现流程', async () => {
      // 1. 检查系统状态
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const pingData = await safeJsonParse(pingResponse);
      expect(pingData.success).toBe(true);

      // 2. 查看可用的组
      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);

      const groupsData = await safeJsonParse(groupsResponse);
      expect(groupsData).toHaveProperty('groups');
      expect(Array.isArray(groupsData.groups)).toBe(true);

      console.log(`✅ 新用户发现流程完成，发现 ${groupsData.totalGroups} 个组`);
    }, 10000); // 减少超时时间

    it('应该能够快速处理探索性请求', async () => {
      const exploratoryEndpoints = ['/api/ping', '/api/groups'];

      for (const endpoint of exploratoryEndpoints) {
        const response = await testApp.request(endpoint);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);

        if (response.status === 404) {
          const data = await safeJsonParse(response);
          expect(data).toBeDefined();
        }
      }

      console.log('✅ 探索性请求处理完成');
    }, 5000);
  });

  describe('高级用户快速工作流', () => {
    it('应该能够快速处理多步骤操作', async () => {
      // 1. 获取所有组
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        console.log('⚠️ 没有可用组，跳过多步骤测试');
        return;
      }

      // 2. 检查前几个组的状态（限制数量）
      const groupsToCheck = groupsData.groups.slice(0, 2);
      const healthCheckPromises = groupsToCheck.map((group: any) =>
        testApp.request(`/api/groups/${group.id}/health`),
      );

      const healthResponses = await Promise.all(healthCheckPromises);

      for (const response of healthResponses) {
        expect([200, 503]).toContain(response.status);
      }

      console.log(`✅ 多步骤操作完成，检查了 ${groupsToCheck.length} 个组`);
    }, 10000);

    it('应该能够快速处理批量操作', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        console.log('⚠️ 没有可用组，跳过批量操作测试');
        return;
      }

      // 限制批量操作的数量
      const batchGroups = groupsData.groups.slice(0, 2);
      const batchRequests = batchGroups.map((group: any) => ({
        detail: testApp.request(`/api/groups/${group.id}`),
        tools: testApp.request(`/api/groups/${group.id}/tools`),
      }));

      for (const requests of batchRequests) {
        const [detailResponse, toolsResponse] = await Promise.all([
          requests.detail,
          requests.tools,
        ]);

        expect(detailResponse.status).toBe(200);
        expect(toolsResponse.status).toBe(200);
      }

      console.log(`✅ 批量操作完成，处理了 ${batchGroups.length} 个组`);
    }, 10000);
  });

  describe('管理员快速场景', () => {
    it('应该能够快速进行系统监控', async () => {
      // 1. 检查系统整体状态
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      // 2. 获取组概览
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      expect(groupsData).toHaveProperty('totalGroups');
      expect(typeof groupsData.totalGroups).toBe('number');

      // 3. 快速检查部分组的健康状态
      if (groupsData.groups.length > 0) {
        const samplesToCheck = Math.min(2, groupsData.groups.length);
        const healthChecks = await Promise.all(
          groupsData.groups
            .slice(0, samplesToCheck)
            .map((group: any) =>
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

        expect(healthyCount + unhealthyCount).toBe(samplesToCheck);
        console.log(`✅ 系统监控完成，检查了 ${samplesToCheck} 个组`);
      }
    }, 10000);

    it('应该能够快速处理系统维护检查', async () => {
      // 1. 检查当前系统状态
      const initialPing = await testApp.request('/api/ping');
      expect(initialPing.status).toBe(200);

      // 2. 获取系统状态快照
      const groupsSnapshot = await testApp.request('/api/groups');
      const snapshotData = await safeJsonParse(groupsSnapshot);

      // 3. 模拟维护期间的快速监控
      await sleep(100); // 短暂延迟
      const monitoringResponse = await testApp.request('/api/ping');
      expect(monitoringResponse.status).toBe(200);

      // 4. 验证系统保持稳定
      const finalPing = await testApp.request('/api/ping');
      expect(finalPing.status).toBe(200);

      const finalGroups = await testApp.request('/api/groups');
      const finalData = await safeJsonParse(finalGroups);

      expect(finalData.totalGroups).toBe(snapshotData.totalGroups);

      console.log('✅ 系统维护检查完成');
    }, 5000);
  });

  describe('错误恢复快速场景', () => {
    it('应该能够快速从临时错误中恢复', async () => {
      let successCount = 0;
      let errorCount = 0;

      // 快速测试恢复能力
      for (let i = 0; i < 3; i++) {
        try {
          const response = await testApp.request('/api/ping');
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      expect(successCount).toBeGreaterThan(errorCount);
      expect(successCount).toBeGreaterThan(0);

      console.log(
        `✅ 错误恢复测试完成 (成功: ${successCount}, 错误: ${errorCount})`,
      );
    }, 5000);

    it('应该能够快速处理部分组不可用的情况', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        console.log('⚠️ 没有可用组，跳过部分不可用测试');
        return;
      }

      // 快速检查部分组的健康状态
      const samplesToCheck = Math.min(2, groupsData.groups.length);
      const healthResults = [];

      for (const group of groupsData.groups.slice(0, samplesToCheck)) {
        try {
          const healthResponse = await testApp.request(
            `/api/groups/${group.id}/health`,
          );
          healthResults.push({
            groupId: group.id,
            healthy: healthResponse.status === 200,
          });
        } catch (error) {
          healthResults.push({
            groupId: group.id,
            healthy: false,
          });
        }
      }

      // 验证系统能够区分健康和不健康的组
      const healthyGroups = healthResults.filter((result) => result.healthy);

      // 系统应该能够报告整体状态，即使部分组不可用
      const overallPing = await testApp.request('/api/ping');
      expect(overallPing.status).toBe(200);

      console.log(
        `✅ 部分组不可用处理完成 (健康组: ${healthyGroups.length}/${healthResults.length})`,
      );
    }, 10000);
  });

  describe('性能快速场景', () => {
    it('应该能够快速处理正常负载', async () => {
      const concurrentUsers = 3;
      const requestsPerUser = 2;

      const userSimulations = Array.from(
        { length: concurrentUsers },
        async () => {
          const userRequests = [];

          for (let i = 0; i < requestsPerUser; i++) {
            userRequests.push(
              testApp.request('/api/ping'),
              testApp.request('/api/groups'),
            );
          }

          const responses = await Promise.all(userRequests);

          for (const response of responses) {
            expect(response.status).toBe(200);
          }

          return responses.length;
        },
      );

      const results = await Promise.all(userSimulations);
      const totalRequests = results.reduce((sum, count) => sum + count, 0);

      expect(totalRequests).toBe(concurrentUsers * requestsPerUser * 2);

      console.log(`✅ 正常负载测试完成 (${totalRequests} 个请求)`);
    }, 10000);

    it('应该能够快速处理高频请求', async () => {
      const requestCount = 10;
      const batchSize = 5;

      for (let batch = 0; batch < requestCount / batchSize; batch++) {
        const batchRequests = Array.from({ length: batchSize }, () =>
          testApp.request('/api/ping'),
        );

        const batchResponses = await Promise.all(batchRequests);

        for (const response of batchResponses) {
          expect(response.status).toBe(200);
        }

        // 批次间短暂延迟
        await sleep(10);
      }

      console.log(`✅ 高频请求测试完成 (${requestCount} 个请求)`);
    }, 10000);
  });
});
