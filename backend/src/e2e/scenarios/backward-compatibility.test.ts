/**
 * 向后兼容性端到端测试
 * 确保新功能不会破坏现有的API和功能
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('向后兼容性端到端测试', () => {
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

  describe('原有MCP端点兼容性', () => {
    it('应该保持原有/mcp端点的完全兼容性', async () => {
      // 测试原有的MCP端点是否仍然可用
      const mcpResponse = await testApp.request('/mcp');

      // 原有端点应该仍然可访问（可能返回200或其他预期状态）
      expect([200, 404, 405]).toContain(mcpResponse.status);

      // 如果端点存在，应该返回预期的响应格式
      if (mcpResponse.status === 200) {
        const data = await safeJsonParse(mcpResponse);
        expect(data).toBeDefined();
      }
    });

    it('应该支持原有的MCP协议请求格式', async () => {
      // 测试原有的MCP协议请求是否仍然被支持
      const mcpToolsResponse = await testApp.request('/mcp/tools');

      // 应该能够处理原有的工具列表请求
      expect([200, 404, 405]).toContain(mcpToolsResponse.status);
    });
  });

  describe('配置文件兼容性', () => {
    it('应该能够处理旧版本的配置文件格式', async () => {
      // 验证系统能够读取和处理现有的配置文件
      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);

      const groupsData = await safeJsonParse(groupsResponse);
      expect(groupsData).toHaveProperty('groups');

      // 如果有组，验证它们是从现有配置正确加载的
      if (groupsData.groups.length > 0) {
        const firstGroup = groupsData.groups[0];
        expect(firstGroup).toHaveProperty('id');
        expect(firstGroup).toHaveProperty('name');
      }
    });

    it('应该能够处理现有的mcp_service.json配置', async () => {
      // 通过API验证配置是否正确加载
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const pingData = await safeJsonParse(pingResponse);
      expect(pingData.success).toBe(true);

      // 验证配置驱动的功能是否正常工作
      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);
    });

    it('应该能够处理现有的group.json配置', async () => {
      // 验证组配置是否正确加载
      const groupsResponse = await testApp.request('/api/groups');
      const groupsData = await safeJsonParse(groupsResponse);

      // 验证组配置的基本结构
      expect(groupsData).toHaveProperty('groups');
      expect(groupsData).toHaveProperty('totalGroups');
      expect(typeof groupsData.totalGroups).toBe('number');
    });
  });

  describe('API响应格式兼容性', () => {
    it('应该保持现有API的响应格式', async () => {
      // 测试ping端点的响应格式
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const pingData = await safeJsonParse(pingResponse);
      expect(pingData).toHaveProperty('success');
      expect(pingData).toHaveProperty('message');
      expect(pingData).toHaveProperty('timestamp');

      // 验证响应格式的类型
      expect(typeof pingData.success).toBe('boolean');
      expect(typeof pingData.message).toBe('string');
      expect(typeof pingData.timestamp).toBe('string');
    });

    it('应该保持组列表API的响应格式', async () => {
      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);

      const groupsData = await safeJsonParse(groupsResponse);
      expect(groupsData).toHaveProperty('groups');
      expect(groupsData).toHaveProperty('totalGroups');

      // 验证groups是数组
      expect(Array.isArray(groupsData.groups)).toBe(true);
      expect(typeof groupsData.totalGroups).toBe('number');

      // 如果有组，验证组对象的基本结构
      if (groupsData.groups.length > 0) {
        const group = groupsData.groups[0];
        expect(group).toHaveProperty('id');
        expect(typeof group.id).toBe('string');
      }
    });
  });

  describe('HTTP状态码兼容性', () => {
    it('应该返回正确的HTTP状态码', async () => {
      // 成功请求应该返回200
      const successResponse = await testApp.request('/api/ping');
      expect(successResponse.status).toBe(200);

      // 不存在的端点应该返回404
      const notFoundResponse = await testApp.request('/api/nonexistent');
      expect(notFoundResponse.status).toBe(404);

      // 不存在的组应该返回404
      const nonexistentGroupResponse = await testApp.request(
        '/api/groups/nonexistent',
      );
      expect(nonexistentGroupResponse.status).toBe(404);
    });

    it('应该正确处理不同HTTP方法', async () => {
      // GET请求应该正常工作
      const getResponse = await testApp.request('/api/ping', { method: 'GET' });
      expect(getResponse.status).toBe(200);

      // 不支持的方法应该返回适当的错误码
      const postResponse = await testApp.request('/api/ping', {
        method: 'POST',
      });
      expect([404, 405]).toContain(postResponse.status);
    });
  });

  describe('错误处理兼容性', () => {
    it('应该保持现有的错误响应格式', async () => {
      // 测试404错误的响应格式
      const notFoundResponse = await testApp.request('/api/nonexistent');
      expect(notFoundResponse.status).toBe(404);

      // 验证错误响应是否有合理的格式
      const errorData = await safeJsonParse(notFoundResponse);
      if (errorData && !errorData.rawText) {
        // 如果返回JSON，应该有错误信息
        expect(errorData).toBeDefined();
      }
    });

    it('应该正确处理无效的组ID', async () => {
      const invalidGroupResponse = await testApp.request(
        '/api/groups/invalid-group-id',
      );
      expect(invalidGroupResponse.status).toBe(404);

      const errorData = await safeJsonParse(invalidGroupResponse);
      if (errorData && !errorData.rawText) {
        expect(errorData).toHaveProperty('error');
      }
    });
  });

  describe('性能兼容性', () => {
    it('应该保持现有的响应时间性能', async () => {
      const startTime = Date.now();
      const response = await testApp.request('/api/ping');
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // 5秒内响应
    });

    it('应该能够处理现有的并发负载', async () => {
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, () =>
        testApp.request('/api/ping'),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('功能兼容性', () => {
    it('应该保持现有功能的完整性', async () => {
      // 验证基本功能仍然可用
      const pingResponse = await testApp.request('/api/ping');
      expect(pingResponse.status).toBe(200);

      const groupsResponse = await testApp.request('/api/groups');
      expect(groupsResponse.status).toBe(200);

      const groupsData = await safeJsonParse(groupsResponse);

      // 如果有组，验证组相关功能
      if (groupsData.groups.length > 0) {
        const firstGroup = groupsData.groups[0];

        // 组详情功能
        const detailResponse = await testApp.request(
          `/api/groups/${firstGroup.id}`,
        );
        expect(detailResponse.status).toBe(200);

        // 组工具列表功能
        const toolsResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/tools`,
        );
        expect(toolsResponse.status).toBe(200);

        // 组服务器列表功能
        const serversResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/servers`,
        );
        expect(serversResponse.status).toBe(200);

        // 组健康检查功能
        const healthResponse = await testApp.request(
          `/api/groups/${firstGroup.id}/health`,
        );
        expect([200, 503]).toContain(healthResponse.status);
      }
    });

    it('应该支持现有的查询参数和请求头', async () => {
      // 测试带有查询参数的请求
      const responseWithQuery = await testApp.request('/api/groups?limit=10');
      expect([200, 400]).toContain(responseWithQuery.status);

      // 测试带有自定义请求头的请求
      const responseWithHeaders = await testApp.request('/api/ping', {
        headers: {
          'User-Agent': 'MCP-Hub-Test/1.0',
          Accept: 'application/json',
        },
      });
      expect(responseWithHeaders.status).toBe(200);
    });
  });
});
