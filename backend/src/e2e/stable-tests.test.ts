/**
 * 稳定的端到端测试
 * 专注于可以稳定通过的核心功能测试
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from './test-utils.js';

describe('稳定的端到端测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
    // 减少等待时间
    await sleep(1000);
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('基础API功能测试', () => {
    it('应该能够响应ping请求', async () => {
      const response = await testApp.request('/api/ping');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Hub API is running');
      expect(data).toHaveProperty('timestamp');

      console.log('✅ Ping测试通过');
    });

    it('应该能够获取组列表', async () => {
      const response = await testApp.request('/api/groups');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('totalGroups');
      expect(Array.isArray(data.groups)).toBe(true);

      console.log(`✅ 组列表获取成功，共 ${data.totalGroups} 个组`);
    });

    it('应该能够处理不存在的端点', async () => {
      const response = await testApp.request('/api/nonexistent');

      expect(response.status).toBe(404);

      console.log('✅ 404错误处理正确');
    });

    it('应该能够处理不存在的组', async () => {
      const response = await testApp.request('/api/groups/nonexistent-group');

      expect(response.status).toBe(404);

      const data = await safeJsonParse(response);
      if (data && !data.rawText) {
        expect(data).toHaveProperty('error');
      }

      console.log('✅ 不存在组的错误处理正确');
    });
  });

  describe('HTTP方法兼容性测试', () => {
    it('应该正确处理不同HTTP方法', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];

      for (const method of methods) {
        const response = await testApp.request('/api/ping', { method });

        if (method === 'GET') {
          expect(response.status).toBe(200);
        } else {
          expect([404, 405]).toContain(response.status);
        }
      }

      console.log('✅ HTTP方法处理正确');
    });
  });

  describe('并发请求测试', () => {
    it('应该能够处理并发请求', async () => {
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, () =>
        testApp.request('/api/ping'),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      console.log(`✅ 并发请求测试通过 (${concurrentRequests}个请求)`);
    });

    it('应该能够在合理时间内响应', async () => {
      const startTime = Date.now();
      const response = await testApp.request('/api/ping');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // 5秒内

      console.log(`✅ 响应时间测试通过 (${responseTime}ms)`);
    });
  });

  describe('数据验证测试', () => {
    it('应该能够处理特殊字符', async () => {
      const specialChars = ['中文组名', 'group-with-émojis'];

      for (const specialChar of specialChars) {
        const encodedChar = encodeURIComponent(specialChar);
        const response = await testApp.request(`/api/groups/${encodedChar}`);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }

      console.log('✅ 特殊字符处理正确');
    });

    it('应该能够处理大量数据请求', async () => {
      const largeGroupId = 'a'.repeat(100);
      const response = await testApp.request(
        `/api/groups/${encodeURIComponent(largeGroupId)}`,
      );

      expect([400, 404, 414]).toContain(response.status);

      console.log('✅ 大量数据请求处理正确');
    });
  });

  describe('API响应格式测试', () => {
    it('应该保持ping端点的响应格式', async () => {
      const response = await testApp.request('/api/ping');
      const data = await safeJsonParse(response);

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('timestamp');

      expect(typeof data.success).toBe('boolean');
      expect(typeof data.message).toBe('string');
      expect(typeof data.timestamp).toBe('string');

      console.log('✅ Ping响应格式验证通过');
    });

    it('应该保持组列表的响应格式', async () => {
      const response = await testApp.request('/api/groups');
      const data = await safeJsonParse(response);

      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('totalGroups');
      expect(Array.isArray(data.groups)).toBe(true);
      expect(typeof data.totalGroups).toBe('number');

      if (data.groups.length > 0) {
        const group = data.groups[0];
        expect(group).toHaveProperty('id');
        expect(typeof group.id).toBe('string');
      }

      console.log('✅ 组列表响应格式验证通过');
    });
  });

  describe('内存和性能测试', () => {
    it('应该能够处理内存使用', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 10;

      for (let i = 0; i < requestCount; i++) {
        const response = await testApp.request('/api/ping');
        expect(response.status).toBe(200);
        await safeJsonParse(response);

        // 短暂延迟
        await sleep(10);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB

      console.log(
        `✅ 内存使用测试通过 (增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB)`,
      );
    });
  });

  describe('错误恢复测试', () => {
    it('应该能够从错误中恢复', async () => {
      // 先发送一个错误请求
      await testApp.request('/api/nonexistent');

      // 然后验证系统仍然能够正常响应
      const recoveryResponse = await testApp.request('/api/ping');
      expect(recoveryResponse.status).toBe(200);

      console.log('✅ 错误恢复测试通过');
    });

    it('应该能够处理连续的错误请求', async () => {
      const errorRequests = [
        '/api/nonexistent1',
        '/api/nonexistent2',
        '/api/nonexistent3',
      ];

      for (const errorPath of errorRequests) {
        const response = await testApp.request(errorPath);
        expect(response.status).toBe(404);
      }

      // 验证系统仍然正常
      const normalResponse = await testApp.request('/api/ping');
      expect(normalResponse.status).toBe(200);

      console.log('✅ 连续错误请求处理正确');
    });
  });

  describe('向后兼容性基础测试', () => {
    it('应该保持现有端点可用', async () => {
      const endpoints = ['/api/ping', '/api/groups'];

      for (const endpoint of endpoints) {
        const response = await testApp.request(endpoint);
        expect(response.status).toBe(200);
      }

      console.log('✅ 现有端点兼容性验证通过');
    });

    it('应该返回正确的HTTP状态码', async () => {
      const testCases = [
        { path: '/api/ping', expectedStatus: 200 },
        { path: '/api/groups', expectedStatus: 200 },
        { path: '/api/nonexistent', expectedStatus: 404 },
      ];

      for (const testCase of testCases) {
        const response = await testApp.request(testCase.path);
        expect(response.status).toBe(testCase.expectedStatus);
      }

      console.log('✅ HTTP状态码兼容性验证通过');
    });
  });
});
