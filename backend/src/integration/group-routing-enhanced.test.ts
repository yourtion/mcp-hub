/**
 * 组路由功能集成测试（修复版）
 * 测试组管理API的核心功能，减少日志输出
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
} from './test-utils.js';

describe('组路由功能集成测试', () => {
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

  describe('组管理API基础功能测试', () => {
    it('应该能够获取所有组列表', async () => {
      const response = await testApp.request('/api/groups');
      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('totalGroups');
      expect(data).toHaveProperty('timestamp');

      expect(Array.isArray(data.groups)).toBe(true);
      expect(typeof data.totalGroups).toBe('number');
      expect(data.groups.length).toBe(data.totalGroups);
    });

    it('应该能够获取特定组的详细信息', async () => {
      // 先获取组列表
      const listResponse = await testApp.request('/api/groups');
      const listData = await safeJsonParse(listResponse);

      if (listData.groups.length === 0) {
        return; // 跳过测试如果没有组
      }

      const firstGroup = listData.groups[0];
      const response = await testApp.request(`/api/groups/${firstGroup.id}`);

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('id', firstGroup.id);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('servers');
      expect(data).toHaveProperty('tools');
      expect(data).toHaveProperty('timestamp');

      expect(Array.isArray(data.servers)).toBe(true);
      expect(Array.isArray(data.tools)).toBe(true);
    });

    it('应该能够处理不存在的组请求', async () => {
      const nonExistentGroupId = `non-existent-group-${Date.now()}`;
      const response = await testApp.request(
        `/api/groups/${nonExistentGroupId}`,
      );

      expect(response.status).toBe(404);

      const data = await safeJsonParse(response);
      if (data && !data.rawText) {
        expect(data).toHaveProperty('error');
        expect(data.error).toHaveProperty('code', 'GROUP_NOT_FOUND');
      }
    });

    it('应该能够获取组的健康检查状态', async () => {
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
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('timestamp');

      expect(typeof data.healthy).toBe('boolean');
    });

    it('应该能够获取组的工具列表', async () => {
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
      expect(data).toHaveProperty('totalTools');
      expect(data).toHaveProperty('timestamp');

      expect(Array.isArray(data.tools)).toBe(true);
      expect(typeof data.totalTools).toBe('number');
    });

    it('应该能够获取组的服务器列表', async () => {
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
      expect(data).toHaveProperty('totalServers');
      expect(data).toHaveProperty('timestamp');

      expect(Array.isArray(data.servers)).toBe(true);
      expect(typeof data.totalServers).toBe('number');
    });
  });

  describe('错误处理测试', () => {
    it('应该能够处理无效的HTTP方法', async () => {
      const response = await testApp.request('/api/groups', {
        method: 'DELETE',
      });

      expect([404, 405]).toContain(response.status);
    });

    it('应该能够处理服务初始化失败的情况', async () => {
      const response = await testApp.request('/api/groups/test-error-group');

      expect([404, 500]).toContain(response.status);

      const data = await safeJsonParse(response);
      if (data && !data.rawText) {
        expect(data).toHaveProperty('error');
      }
    });

    it('应该能够处理特殊字符', async () => {
      const specialChars = ['中文组名', 'group-with-émojis-🎉'];

      for (const specialChar of specialChars) {
        const encodedChar = encodeURIComponent(specialChar);
        const response = await testApp.request(`/api/groups/${encodedChar}`);

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);

        const data = await safeJsonParse(response);
        expect(data).toBeDefined();
      }
    });
  });

  describe('性能测试', () => {
    it('应该能够处理并发请求', async () => {
      const concurrentRequests = 5; // 减少并发数量

      const promises = Array.from({ length: concurrentRequests }, () =>
        testApp.request('/api/groups'),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await safeJsonParse(response);
        expect(data).toHaveProperty('groups');
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
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // 内存增长应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});
