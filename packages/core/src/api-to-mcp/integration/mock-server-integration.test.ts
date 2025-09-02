/**
 * 使用Mock服务器的集成测试
 */

import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiToMcpServiceManagerImpl } from '../services/api-to-mcp-service-manager.js';
import type { ApiToolsConfig } from '../types/api-config.js';
import {
  createMockApiServer,
  type MockApiServer,
  MockResponses,
} from './mock-api-server.js';

// Mock日志记录器
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Mock服务器集成测试', () => {
  let serviceManager: ApiToMcpServiceManagerImpl;
  let mockServer: MockApiServer;
  let tempDir: string;
  let configPath: string;
  let serverBaseUrl: string;

  beforeEach(async () => {
    serviceManager = new ApiToMcpServiceManagerImpl();
    mockServer = createMockApiServer();

    // 启动Mock服务器
    const port = await mockServer.start();
    serverBaseUrl = `http://localhost:${port}`;

    tempDir = await fs.mkdtemp(join(tmpdir(), 'mock-integration-'));
    configPath = join(tempDir, 'api-tools.json');
  });

  afterEach(async () => {
    try {
      await serviceManager.shutdown();
    } catch (_error) {
      // 忽略关闭错误
    }

    try {
      await mockServer.stop();
    } catch (_error) {
      // 忽略关闭错误
    }

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // 忽略清理错误
    }
  });

  describe('基本API调用测试', () => {
    it('应该成功调用Mock API', async () => {
      // 设置Mock端点
      mockServer.setupEndpoint({
        path: '/users',
        method: 'GET',
        response: MockResponses.json([
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        ]),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'get-users',
            name: '获取用户列表',
            description: '获取所有用户',
            api: {
              url: `${serverBaseUrl}/users`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {
              jsonata: '$[0].name',
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool('get-users', {});

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('John Doe');

      // 验证请求被正确发送
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('GET');
      expect(logs[0].url).toBe('/users');
    });

    it('应该处理POST请求和请求体', async () => {
      // 设置Mock端点
      mockServer.setupEndpoint({
        path: '/users',
        method: 'POST',
        response: MockResponses.json({
          id: 3,
          name: 'New User',
          email: 'new@example.com',
          created: true,
        }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'create-user',
            name: '创建用户',
            description: '创建新用户',
            api: {
              url: `${serverBaseUrl}/users`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: {
                name: '{{data.name}}',
                email: '{{data.email}}',
              },
            },
            parameters: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                },
                email: {
                  type: 'string',
                  format: 'email',
                },
              },
              required: ['name', 'email'],
            },
            response: {
              jsonata: '{ "id": id, "created": created }',
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool('create-user', {
        name: 'Test User',
        email: 'test@example.com',
      });

      expect(result.isError).toBe(false);
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.id).toBe(3);
      expect(responseData.created).toBe(true);

      // 验证请求体
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('POST');
      expect(logs[0].body).toContain('Test User');
      expect(logs[0].body).toContain('test@example.com');
    }, 10000); // 增加测试超时时间

    it('应该处理查询参数', async () => {
      // 设置Mock端点
      mockServer.setupEndpoint({
        path: '/search',
        method: 'GET',
        response: MockResponses.json({
          query: 'test',
          results: [
            { id: 1, title: 'Test Result 1' },
            { id: 2, title: 'Test Result 2' },
          ],
        }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'search',
            name: '搜索',
            description: '搜索内容',
            api: {
              url: `${serverBaseUrl}/search`,
              method: 'GET',
              queryParams: {
                q: '{{data.query}}',
                limit: '{{data.limit}}',
              },
            },
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  minLength: 1,
                },
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 100,
                  default: 10,
                },
              },
              required: ['query'],
            },
            response: {
              jsonata: 'results.title',
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool('search', {
        query: 'test',
        limit: 5,
      });

      expect(result.isError).toBe(false);
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toEqual(['Test Result 1', 'Test Result 2']);

      // 验证查询参数
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].url).toContain('q=test');
      expect(logs[0].url).toContain('limit=5');
    });
  });

  describe('认证测试', () => {
    it('应该处理Bearer Token认证', async () => {
      // 设置需要认证的端点
      mockServer.setupEndpoint({
        path: '/protected',
        method: 'GET',
        response: MockResponses.authenticated('valid-token'),
      });

      // 设置环境变量
      process.env.TEST_BEARER_TOKEN = 'valid-token';

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'protected-resource',
            name: '受保护资源',
            description: '需要认证的资源',
            api: {
              url: `${serverBaseUrl}/protected`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
            security: {
              authentication: {
                type: 'bearer',
                token: '{{env.TEST_BEARER_TOKEN}}',
              },
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool(
        'protected-resource',
        {},
      );

      expect(result.isError).toBe(false);

      // 验证认证头
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].headers.authorization).toBe('Bearer valid-token');

      // 清理环境变量
      delete process.env.TEST_BEARER_TOKEN;
    });

    it('应该处理API Key认证', async () => {
      // 设置需要API Key的端点
      mockServer.setupEndpoint({
        path: '/api-key-protected',
        method: 'GET',
        response: MockResponses.json({ message: 'API key valid' }),
      });

      // 设置环境变量
      process.env.TEST_API_KEY = 'secret-api-key';

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'api-key-resource',
            name: 'API Key资源',
            description: '需要API Key的资源',
            api: {
              url: `${serverBaseUrl}/api-key-protected`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
            security: {
              authentication: {
                type: 'apikey',
                token: '{{env.TEST_API_KEY}}',
                header: 'X-API-Key',
              },
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool(
        'api-key-resource',
        {},
      );

      expect(result.isError).toBe(false);

      // 验证API Key头
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].headers['x-api-key']).toBe('secret-api-key');

      // 清理环境变量
      delete process.env.TEST_API_KEY;
    });
  });

  describe('错误处理测试', () => {
    it('应该处理HTTP错误状态码', async () => {
      // 设置错误端点
      mockServer.simulateError('/error', 'GET', {
        status: 500,
        message: 'Internal Server Error',
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'error-tool',
            name: '错误工具',
            description: '会返回错误的工具',
            api: {
              url: `${serverBaseUrl}/error`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool('error-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Internal Server Error');
    });

    it('应该处理网络超时', async () => {
      // 设置延迟端点（5秒延迟，超过1秒超时）
      mockServer.simulateDelay('/slow', 'GET', 5000, {
        message: 'slow response',
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'timeout-tool',
            name: '超时工具',
            description: '会超时的工具',
            api: {
              url: `${serverBaseUrl}/slow`,
              method: 'GET',
              timeout: 1000, // 1秒超时
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool('timeout-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network timeout');
    }, 15000); // 设置测试超时时间为15秒
  });

  describe('JSONata响应处理测试', () => {
    it('应该正确处理复杂的JSONata表达式', async () => {
      // 设置复杂数据端点
      mockServer.setupEndpoint({
        path: '/complex-data',
        method: 'GET',
        response: MockResponses.json({
          users: [
            { id: 1, name: 'John', age: 30, active: true },
            { id: 2, name: 'Jane', age: 25, active: false },
            { id: 3, name: 'Bob', age: 35, active: true },
          ],
          metadata: {
            total: 3,
            page: 1,
          },
        }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'complex-data-tool',
            name: '复杂数据工具',
            description: '处理复杂数据的工具',
            api: {
              url: `${serverBaseUrl}/complex-data`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {
              jsonata: `{
                "activeUsers": users[active = true].name,
                "averageAge": $round($average(users.age)),
                "totalCount": metadata.total
              }`,
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool(
        'complex-data-tool',
        {},
      );

      expect(result.isError).toBe(false);
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.activeUsers).toEqual(['John', 'Bob']);
      expect(responseData.averageAge).toBe(30);
      expect(responseData.totalCount).toBe(3);
    });

    it('应该处理JSONata表达式错误', async () => {
      // 设置数据端点
      mockServer.setupEndpoint({
        path: '/data',
        method: 'GET',
        response: MockResponses.json({ message: 'test data' }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'jsonata-error-tool',
            name: 'JSONata错误工具',
            description: '包含错误JSONata表达式的工具',
            api: {
              url: `${serverBaseUrl}/data`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {
              jsonata: 'invalid[syntax', // 无效表达式
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const result = await serviceManager.executeApiTool(
        'jsonata-error-tool',
        {},
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('失败');
    });
  });

  describe('并发和性能测试', () => {
    it('应该处理并发请求', async () => {
      // 设置端点
      mockServer.setupEndpoint({
        path: '/concurrent',
        method: 'GET',
        response: MockResponses.json({ timestamp: Date.now() }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'concurrent-tool',
            name: '并发工具',
            description: '用于并发测试的工具',
            api: {
              url: `${serverBaseUrl}/concurrent`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      // 并发执行多个请求
      const promises = Array.from({ length: 10 }, () =>
        serviceManager.executeApiTool('concurrent-tool', {}),
      );

      const results = await Promise.all(promises);

      // 所有请求都应该成功
      results.forEach((result) => {
        expect(result.isError).toBe(false);
      });

      // 验证所有请求都被发送
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(10);
    });

    it('应该处理高频率请求', async () => {
      // 设置快速响应端点
      mockServer.setupEndpoint({
        path: '/fast',
        method: 'GET',
        response: MockResponses.json({ id: Math.random() }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'fast-tool',
            name: '快速工具',
            description: '快速响应的工具',
            api: {
              url: `${serverBaseUrl}/fast`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      const startTime = Date.now();

      // 快速连续执行请求
      const promises = Array.from({ length: 50 }, () =>
        serviceManager.executeApiTool('fast-tool', {}),
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 所有请求都应该成功
      results.forEach((result) => {
        expect(result.isError).toBe(false);
      });

      // 验证性能（应该在合理时间内完成）
      expect(duration).toBeLessThan(5000); // 5秒内完成50个请求

      // 验证所有请求都被发送
      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(50);
    });
  });

  describe('请求日志和监控测试', () => {
    it('应该正确记录请求日志', async () => {
      // 设置端点
      mockServer.setupEndpoint({
        path: '/logging-test',
        method: 'POST',
        response: MockResponses.json({ received: true }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'logging-tool',
            name: '日志工具',
            description: '用于测试请求日志的工具',
            api: {
              url: `${serverBaseUrl}/logging-test`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Custom-Header': 'test-value',
              },
              body: {
                message: '{{data.message}}',
                timestamp: '{{data.timestamp}}',
              },
            },
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                timestamp: { type: 'string' },
              },
              required: ['message', 'timestamp'],
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      await serviceManager.executeApiTool('logging-tool', {
        message: 'test message',
        timestamp: '2024-01-01T00:00:00Z',
      });

      const logs = mockServer.getRequestLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.method).toBe('POST');
      expect(log.url).toBe('/logging-test');
      expect(log.headers['content-type']).toBe('application/json');
      expect(log.headers['x-custom-header']).toBe('test-value');
      expect(log.body).toContain('test message');
      expect(log.body).toContain('2024-01-01T00:00:00Z');
      expect(log.timestamp).toBeInstanceOf(Date);
    }, 10000); // 增加测试超时时间

    it('应该支持请求日志的清理和重置', async () => {
      // 设置端点
      mockServer.setupEndpoint({
        path: '/reset-test',
        method: 'GET',
        response: MockResponses.json({ message: 'ok' }),
      });

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'reset-tool',
            name: '重置工具',
            description: '用于测试重置功能的工具',
            api: {
              url: `${serverBaseUrl}/reset-test`,
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      await serviceManager.initialize(configPath);

      // 发送几个请求
      await serviceManager.executeApiTool('reset-tool', {});
      await serviceManager.executeApiTool('reset-tool', {});

      expect(mockServer.getRequestLogs()).toHaveLength(2);

      // 清理日志
      mockServer.clearRequestLogs();
      expect(mockServer.getRequestLogs()).toHaveLength(0);

      // 重置服务器
      mockServer.reset();
      expect(mockServer.getRequestLogs()).toHaveLength(0);
    });
  });
});
