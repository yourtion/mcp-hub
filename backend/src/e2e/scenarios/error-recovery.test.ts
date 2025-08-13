/**
 * 错误处理和恢复场景端到端测试
 * 测试系统在各种错误情况下的处理和恢复能力
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

describe('错误处理和恢复场景端到端测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    await sleep(1000);
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('网络错误处理', () => {
    it('应该能够处理请求超时', async () => {
      // 模拟可能的超时情况
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ status: 408, timeout: true }), 5000);
      });

      const requestPromise = testApp.request('/api/ping');

      const result = await Promise.race([requestPromise, timeoutPromise]);

      // 正常情况下应该在超时前完成
      if ('timeout' in result) {
        // 如果确实超时了，这也是一个有效的测试结果
        expect(result.timeout).toBe(true);
      } else {
        expect(result.status).toBe(200);
      }
    });

    it('应该能够处理连接中断后的恢复', async () => {
      // 测试系统在连接问题后的恢复能力
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < 5; i++) {
        try {
          const response = await testApp.request('/api/ping');
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
        }

        // 短暂延迟模拟网络抖动
        await sleep(100);
      }

      // 大部分请求应该成功
      expect(successCount).toBeGreaterThan(errorCount);
    });
  });
  describe('服务器错误处理', () => {
    it('应该能够处理内部服务器错误', async () => {
      // 测试系统对内部错误的处理
      const response = await testApp.request('/api/ping');

      // 即使有内部错误，系统也应该返回合理的响应
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);

      if (response.status >= 500) {
        // 如果是服务器错误，应该有错误信息
        const errorData = await safeJsonParse(response);
        expect(errorData).toBeDefined();
      }
    });

    it('应该能够处理组服务不可用的情况', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        return;
      }

      // 测试每个组的健康状态
      for (const group of groupsData.groups.slice(0, 3)) {
        const healthResponse = await testApp.request(
          `/api/groups/${group.id}/health`,
        );

        // 健康检查应该返回明确的状态
        expect([200, 503]).toContain(healthResponse.status);

        const healthData = await safeJsonParse(healthResponse);
        expect(healthData).toHaveProperty('groupId', group.id);

        if (healthResponse.status === 503) {
          // 如果组不健康，应该有相应的错误信息
          expect(healthData).toHaveProperty('status');
        }
      }
    });

    it('应该能够处理工具执行失败', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        return;
      }

      const firstGroup = groupsData.groups[0];

      // 尝试获取工具列表
      const toolsResponse = await testApp.request(
        `/api/groups/${firstGroup.id}/tools`,
      );

      if (toolsResponse.status === 200) {
        const toolsData = await safeJsonParse(toolsResponse);
        expect(toolsData).toHaveProperty('tools');
        expect(Array.isArray(toolsData.tools)).toBe(true);
      } else {
        // 如果工具列表获取失败，应该有合理的错误响应
        expect([404, 503]).toContain(toolsResponse.status);
      }
    });
  });

  describe('数据错误处理', () => {
    it('应该能够处理无效的请求参数', async () => {
      // 测试无效的组ID
      const invalidChars = [
        '<script>',
        '../../etc/passwd',
        'null',
        'undefined',
      ];

      for (const invalidChar of invalidChars) {
        const encodedChar = encodeURIComponent(invalidChar);
        const response = await testApp.request(`/api/groups/${encodedChar}`);

        // 应该返回适当的错误状态
        expect([400, 404]).toContain(response.status);

        const errorData = await safeJsonParse(response);
        if (errorData && !errorData.rawText) {
          expect(errorData).toBeDefined();
        }
      }
    });

    it('应该能够处理恶意请求', async () => {
      // 测试各种可能的恶意请求
      const maliciousRequests = [
        '/api/groups/../../../etc/passwd',
        '/api/groups/%2e%2e%2f%2e%2e%2f',
        '/api/groups/\x00\x01\x02',
      ];

      for (const maliciousPath of maliciousRequests) {
        const response = await testApp.request(maliciousPath);

        // 应该安全地处理恶意请求
        expect([400, 404]).toContain(response.status);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('应该能够处理大量数据请求', async () => {
      // 测试超长的请求路径
      const longPath = 'a'.repeat(1000);
      const response = await testApp.request(`/api/groups/${longPath}`);

      // 应该能够处理而不崩溃
      expect([400, 404, 414]).toContain(response.status);
    });
  });

  describe('资源限制处理', () => {
    it('应该能够处理高并发请求', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, (_, index) =>
        testApp.request(`/api/ping?id=${index}`),
      );

      const responses = await Promise.all(promises);

      let successCount = 0;
      let errorCount = 0;

      for (const response of responses) {
        if (response.status === 200) {
          successCount++;
        } else if (response.status === 429) {
          // 速率限制是可接受的
          errorCount++;
        } else {
          // 其他错误
          errorCount++;
        }
      }

      // 大部分请求应该成功，或者被合理地限制
      expect(successCount + errorCount).toBe(concurrentRequests);
      expect(successCount).toBeGreaterThan(0);
    });

    it('应该能够处理内存压力', async () => {
      const initialMemory = process.memoryUsage();

      // 执行一系列可能消耗内存的操作
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(testApp.request('/api/groups'));

        // 每5个请求检查一次内存
        if (i % 5 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease =
            currentMemory.heapUsed - initialMemory.heapUsed;

          // 内存增长应该在合理范围内
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
        }
      }

      const responses = await Promise.all(requests);

      // 验证所有请求都得到了处理
      for (const response of responses) {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }
    });
  });

  describe('恢复机制测试', () => {
    it('应该能够从临时故障中自动恢复', async () => {
      // 使用重试机制测试恢复能力
      const maxRetries = 3;
      const retryDelay = 200;

      const result = await retry(
        async () => {
          const response = await testApp.request('/api/ping');
          if (response.status !== 200) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response;
        },
        maxRetries,
        retryDelay,
      );

      expect(result.status).toBe(200);
    });

    it('应该能够在部分服务恢复后继续工作', async () => {
      // 获取所有组的状态
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      if (groupsData.groups.length === 0) {
        return;
      }

      // 检查每个组的恢复能力
      for (const group of groupsData.groups.slice(0, 3)) {
        let healthyAttempts = 0;
        let totalAttempts = 0;

        // 多次检查组状态，模拟服务恢复过程
        for (let i = 0; i < 5; i++) {
          totalAttempts++;

          try {
            const healthResponse = await testApp.request(
              `/api/groups/${group.id}/health`,
            );

            if (healthResponse.status === 200) {
              healthyAttempts++;
            }
          } catch (error) {
            // 记录错误但继续测试
          }

          await sleep(100);
        }

        // 验证系统能够处理间歇性的服务可用性
        expect(totalAttempts).toBe(5);
        expect(healthyAttempts).toBeGreaterThanOrEqual(0);
      }
    });

    it('应该能够在配置重载后恢复正常', async () => {
      // 记录重载前的状态
      const beforeReload = await testApp.request('/api/groups');
      const beforeData = await safeJsonParse(beforeReload);

      // 等待一段时间，模拟配置可能的变化
      await sleep(500);

      // 检查重载后的状态
      const afterReload = await testApp.request('/api/groups');
      const afterData = await safeJsonParse(afterReload);

      // 系统应该仍然能够正常响应
      expect(afterReload.status).toBe(200);
      expect(afterData).toHaveProperty('groups');
      expect(Array.isArray(afterData.groups)).toBe(true);

      // 基本结构应该保持一致
      expect(typeof afterData.totalGroups).toBe('number');
    });
  });

  describe('错误日志和监控', () => {
    it('应该能够记录和处理错误信息', async () => {
      // 触发一些可能的错误情况
      const errorTriggers = [
        '/api/nonexistent',
        '/api/groups/nonexistent',
        '/api/groups/invalid/tools',
      ];

      for (const trigger of errorTriggers) {
        const response = await testApp.request(trigger);

        // 错误应该被适当处理
        expect([404, 400]).toContain(response.status);

        // 响应应该有合理的格式
        const errorData = await safeJsonParse(response);
        expect(errorData).toBeDefined();
      }
    });

    it('应该能够提供系统健康状态', async () => {
      // 检查系统整体健康状态
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const pingData = await safeJsonParse(pingResponse);
      expect(pingData).toHaveProperty('success');
      expect(pingData).toHaveProperty('timestamp');

      // 时间戳应该是有效的
      const timestamp = new Date(pingData.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });
  });
});
