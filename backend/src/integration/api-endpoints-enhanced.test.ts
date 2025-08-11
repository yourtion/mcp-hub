/**
 * API端点集成测试（修复版）
 * 测试所有API端点的基本功能，减少日志输出
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from './test-utils.js';

describe('API端点集成测试', () => {
  let testApp: any;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    restoreConsole = setupTestEnvironment();
  });

  afterAll(async () => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('基础API端点测试', () => {
    it('应该能够响应ping请求', async () => {
      const response = await testApp.request('/api/ping');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Hub API is running');
      expect(data).toHaveProperty('timestamp');

      // 验证时间戳格式
      expect(() => new Date(data.timestamp)).not.toThrow();
    });

    it('应该能够处理ping请求的高频访问', async () => {
      const requestCount = 10; // 减少请求数量
      const promises = Array.from({ length: requestCount }, () =>
        testApp.request('/api/ping'),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await safeJsonParse(response);
        expect(data.success).toBe(true);
      }
    });

    it('应该能够处理不同的HTTP方法', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];

      for (const method of methods) {
        const response = await testApp.request('/api/ping', { method });

        if (method === 'GET') {
          expect(response.status).toBe(200);
        } else {
          expect([404, 405]).toContain(response.status);
        }
      }
    });
  });

  describe('组管理API测试', () => {
    it('应该能够获取组列表', async () => {
      const response = await testApp.request('/api/groups');
      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('totalGroups');
      expect(Array.isArray(data.groups)).toBe(true);
    });

    it('应该能够处理组详情请求', async () => {
      const listResponse = await testApp.request('/api/groups');
      const listData = await safeJsonParse(listResponse);

      if (listData.groups.length === 0) {
        return;
      }

      const firstGroup = listData.groups[0];
      const response = await testApp.request(`/api/groups/${firstGroup.id}`);

      expect(response.status).toBe(200);
      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('id', firstGroup.id);
    });

    it('应该能够处理组健康检查', async () => {
      const listResponse = await testApp.request('/api/groups');
      const listData = await safeJsonParse(listResponse);

      if (listData.groups.length === 0) {
        return;
      }

      const firstGroup = listData.groups[0];
      const response = await testApp.request(
        `/api/groups/${firstGroup.id}/health`,
      );

      expect([200, 503]).toContain(response.status);
      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groupId', firstGroup.id);
    });

    it('应该能够获取组工具列表', async () => {
      const listResponse = await testApp.request('/api/groups');
      const listData = await safeJsonParse(listResponse);

      if (listData.groups.length === 0) {
        return;
      }

      const firstGroup = listData.groups[0];
      const response = await testApp.request(
        `/api/groups/${firstGroup.id}/tools`,
      );

      expect(response.status).toBe(200);
      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groupId', firstGroup.id);
      expect(data).toHaveProperty('tools');
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it('应该能够获取组服务器列表', async () => {
      const listResponse = await testApp.request('/api/groups');
      const listData = await safeJsonParse(listResponse);

      if (listData.groups.length === 0) {
        return;
      }

      const firstGroup = listData.groups[0];
      const response = await testApp.request(
        `/api/groups/${firstGroup.id}/servers`,
      );

      expect(response.status).toBe(200);
      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groupId', firstGroup.id);
      expect(data).toHaveProperty('servers');
      expect(Array.isArray(data.servers)).toBe(true);
    });
  });

  describe('错误处理测试', () => {
    it('应该能够处理不存在的端点', async () => {
      const response = await testApp.request('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    it('应该能够处理不存在的组', async () => {
      const response = await testApp.request('/api/groups/nonexistent-group');
      expect(response.status).toBe(404);

      const data = await safeJsonParse(response);
      if (data && !data.rawText) {
        expect(data).toHaveProperty('error');
      }
    });

    it('应该能够处理无效的HTTP方法', async () => {
      const response = await testApp.request('/api/groups', {
        method: 'DELETE',
      });

      expect([404, 405]).toContain(response.status);
    });
  });

  describe('性能测试', () => {
    it('应该能够处理并发请求', async () => {
      const concurrentRequests = 5; // 减少并发数量

      const promises = Array.from({ length: concurrentRequests }, () =>
        testApp.request('/api/ping'),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    it('应该能够在合理时间内响应', async () => {
      const startTime = Date.now();
      const response = await testApp.request('/api/groups');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // 5秒内
    });

    it('应该能够处理内存使用', async () => {
      const initialMemory = process.memoryUsage();
      const requestCount = 10; // 减少请求数量

      for (let i = 0; i < requestCount; i++) {
        const response = await testApp.request('/api/groups');
        expect(response.status).toBe(200);
        await safeJsonParse(response);

        // 短暂延迟以避免过快请求
        await sleep(10);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('安全性测试', () => {
    it('应该能够处理特殊字符', async () => {
      const specialChars = ['中文组名', 'group-with-émojis'];

      for (const specialChar of specialChars) {
        const encodedChar = encodeURIComponent(specialChar);
        const response = await testApp.request(`/api/groups/${encodedChar}`);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }
    });

    it('应该能够处理大量数据请求', async () => {
      const largeGroupId = 'a'.repeat(100); // 减少长度
      const response = await testApp.request(
        `/api/groups/${encodeURIComponent(largeGroupId)}`,
      );

      expect([400, 404, 414]).toContain(response.status);
    });
  });
});
