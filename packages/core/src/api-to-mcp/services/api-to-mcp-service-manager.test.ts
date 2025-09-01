/**
 * API转MCP服务管理器测试
 */

import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiToolsConfig } from '../types/api-config.js';
import {
  ApiToMcpServiceManagerImpl,
  ServiceStatus,
} from './api-to-mcp-service-manager.js';

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

describe('ApiToMcpServiceManagerImpl', () => {
  let serviceManager: ApiToMcpServiceManagerImpl;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    serviceManager = new ApiToMcpServiceManagerImpl();

    // 创建临时目录和配置文件
    tempDir = await fs.mkdtemp(join(tmpdir(), 'service-manager-test-'));
    configPath = join(tempDir, 'api-tools.json');
  });

  afterEach(async () => {
    // 关闭服务管理器
    try {
      await serviceManager.shutdown();
    } catch (_error) {
      // 忽略关闭错误
    }

    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // 忽略清理错误
    }
  });

  describe('初始化和生命周期', () => {
    it('应该成功初始化服务管理器', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-tool',
            name: '测试工具',
            description: '用于测试的API工具',
            api: {
              url: 'https://api.example.com/test',
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '查询参数',
                },
              },
              required: ['query'],
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

      await serviceManager.initialize(configPath);

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.RUNNING);
      expect(health.healthy).toBe(true);
      expect(health.toolStats.total).toBe(1);
    });

    it('应该在配置文件不存在时抛出错误', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json');

      await expect(serviceManager.initialize(nonExistentPath)).rejects.toThrow(
        '初始化失败',
      );

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.ERROR);
    });

    it('应该在重复初始化时发出警告', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(validConfig));
      await serviceManager.initialize(configPath);

      // 第二次初始化应该不会抛出错误，但会发出警告
      await serviceManager.initialize(configPath);

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.RUNNING);
    });

    it('应该成功关闭服务管理器', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(validConfig));
      await serviceManager.initialize(configPath);

      await serviceManager.shutdown();

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.SHUTDOWN);
    });

    it('应该成功重启服务管理器', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'restart-test',
            name: '重启测试',
            description: '测试重启功能',
            api: {
              url: 'https://api.example.com/restart',
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

      await fs.writeFile(configPath, JSON.stringify(validConfig));
      await serviceManager.initialize(configPath);

      const initialHealth = serviceManager.getHealthStatus();
      expect(initialHealth.status).toBe(ServiceStatus.RUNNING);

      await serviceManager.restart();

      const restartedHealth = serviceManager.getHealthStatus();
      expect(restartedHealth.status).toBe(ServiceStatus.RUNNING);
      expect(restartedHealth.toolStats.total).toBe(1);
    });
  });

  describe('配置管理', () => {
    it('应该成功重新加载配置', async () => {
      const initialConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'initial-tool',
            name: '初始工具',
            description: '初始配置的工具',
            api: {
              url: 'https://api.example.com/initial',
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

      await fs.writeFile(configPath, JSON.stringify(initialConfig));
      await serviceManager.initialize(configPath);

      const initialTools = await serviceManager.getApiTools();
      expect(initialTools).toHaveLength(1);
      expect(initialTools[0].name).toBe('initial-tool');

      // 更新配置文件
      const updatedConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'updated-tool',
            name: '更新工具',
            description: '更新后的工具',
            api: {
              url: 'https://api.example.com/updated',
              method: 'POST',
            },
            parameters: {
              type: 'object',
              properties: {
                data: {
                  type: 'string',
                },
              },
            },
            response: {},
          },
          {
            id: 'new-tool',
            name: '新工具',
            description: '新增的工具',
            api: {
              url: 'https://api.example.com/new',
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

      await fs.writeFile(configPath, JSON.stringify(updatedConfig));
      await serviceManager.reloadConfig();

      const updatedTools = await serviceManager.getApiTools();
      expect(updatedTools).toHaveLength(2);
      expect(updatedTools.map((t) => t.name)).toEqual([
        'updated-tool',
        'new-tool',
      ]);
    });

    it('应该在未初始化时拒绝重新加载配置', async () => {
      await expect(serviceManager.reloadConfig()).rejects.toThrow(
        '服务管理器未运行',
      );
    });
  });

  describe('工具管理', () => {
    beforeEach(async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-tool',
            name: '测试工具',
            description: '用于测试的API工具',
            api: {
              url: 'https://api.example.com/test',
              method: 'GET',
              queryParams: {
                q: '{{data.query}}',
              },
            },
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '查询参数',
                  minLength: 1,
                },
              },
              required: ['query'],
            },
            response: {
              jsonata: '{ "result": data }',
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config));
      await serviceManager.initialize(configPath);
    });

    it('应该获取所有API工具', async () => {
      const tools = await serviceManager.getApiTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(tools[0].description).toContain('用于测试的API工具');
    });

    it('应该获取工具定义', () => {
      const tool = serviceManager.getToolDefinition('test-tool');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('test-tool');
    });

    it('应该在工具不存在时返回undefined', () => {
      const tool = serviceManager.getToolDefinition('non-existent-tool');

      expect(tool).toBeUndefined();
    });

    it('应该验证工具参数', () => {
      const validParams = { query: 'test query' };
      const result = serviceManager.validateToolParameters(
        'test-tool',
        validParams,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的工具参数', () => {
      const invalidParams = {}; // 缺少必需的query参数
      const result = serviceManager.validateToolParameters(
        'test-tool',
        invalidParams,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该在工具不存在时返回验证错误', () => {
      const result = serviceManager.validateToolParameters(
        'non-existent-tool',
        {},
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('工具执行', () => {
    beforeEach(async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'mock-tool',
            name: 'Mock工具',
            description: '用于测试的Mock工具',
            api: {
              url: 'https://httpbin.org/json',
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

      await fs.writeFile(configPath, JSON.stringify(config));
      await serviceManager.initialize(configPath);
    });

    it('应该在工具不存在时返回错误结果', async () => {
      const result = await serviceManager.executeApiTool('non-existent', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('不存在');
    });

    it('应该在参数验证失败时返回错误结果', async () => {
      // 创建一个需要参数的工具配置
      const configWithParams: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'param-tool',
            name: '参数工具',
            description: '需要参数的工具',
            api: {
              url: 'https://httpbin.org/get',
              method: 'GET',
            },
            parameters: {
              type: 'object',
              properties: {
                required_param: {
                  type: 'string',
                  minLength: 1,
                },
              },
              required: ['required_param'],
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(configWithParams));
      await serviceManager.reloadConfig();

      const result = await serviceManager.executeApiTool('param-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('参数验证失败');
    });
  });

  describe('健康检查', () => {
    it('应该返回基本的健康状态', () => {
      const health = serviceManager.getHealthStatus();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('toolStats');
      expect(health.toolStats).toHaveProperty('total');
      expect(health.toolStats).toHaveProperty('registered');
      expect(health.toolStats).toHaveProperty('failed');
    });

    it('应该执行健康检查', async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'health-test',
            name: '健康测试',
            description: '健康检查测试工具',
            api: {
              url: 'https://api.example.com/health',
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

      await fs.writeFile(configPath, JSON.stringify(config));
      await serviceManager.initialize(configPath);

      const health = await serviceManager.performHealthCheck();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe(ServiceStatus.RUNNING);
      expect(health.lastHealthCheck).toBeDefined();
      expect(health.toolStats.total).toBe(1);
    });

    it('应该检测到没有工具的问题', async () => {
      const emptyConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(emptyConfig));
      await serviceManager.initialize(configPath);

      const health = await serviceManager.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.errors).toContain('没有注册的API工具');
    });

    it('应该在未初始化时报告不健康状态', () => {
      const health = serviceManager.getHealthStatus();

      expect(health.healthy).toBe(false);
      expect(health.status).toBe(ServiceStatus.NOT_INITIALIZED);
    });
  });

  describe('错误处理', () => {
    it('应该在未初始化时拒绝获取工具', async () => {
      await expect(serviceManager.getApiTools()).rejects.toThrow(
        '服务管理器未运行',
      );
    });

    it('应该在未初始化时拒绝执行工具', async () => {
      await expect(serviceManager.executeApiTool('test', {})).rejects.toThrow(
        '服务管理器未运行',
      );
    });

    it('应该处理配置文件格式错误', async () => {
      await fs.writeFile(configPath, '{ invalid json }');

      await expect(serviceManager.initialize(configPath)).rejects.toThrow(
        '初始化失败',
      );

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.ERROR);
    });

    it('应该处理重新加载时的配置错误', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(validConfig));
      await serviceManager.initialize(configPath);

      // 写入无效配置
      await fs.writeFile(configPath, '{ invalid }');

      await expect(serviceManager.reloadConfig()).rejects.toThrow(
        '重新加载失败',
      );

      const health = serviceManager.getHealthStatus();
      expect(health.status).toBe(ServiceStatus.ERROR);
    });

    it('应该在没有配置路径时拒绝重启', async () => {
      // 创建一个没有配置路径的服务管理器
      const manager = new ApiToMcpServiceManagerImpl();
      await manager.shutdown(); // 设置为关闭状态

      await expect(manager.restart()).rejects.toThrow(
        '无法重启：配置文件路径未设置',
      );
    });
  });

  describe('并发和资源管理', () => {
    it('应该处理并发的工具执行请求', async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'concurrent-tool',
            name: '并发工具',
            description: '用于并发测试的工具',
            api: {
              url: 'https://httpbin.org/delay/1',
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

      await fs.writeFile(configPath, JSON.stringify(config));
      await serviceManager.initialize(configPath);

      // 并发执行多个工具调用
      const promises = Array.from({ length: 3 }, () =>
        serviceManager.executeApiTool('concurrent-tool', {}),
      );

      const results = await Promise.allSettled(promises);

      // 所有请求都应该完成（无论成功还是失败）
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('应该正确清理资源', async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'cleanup-test',
            name: '清理测试',
            description: '测试资源清理',
            api: {
              url: 'https://api.example.com/cleanup',
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

      await fs.writeFile(configPath, JSON.stringify(config));
      await serviceManager.initialize(configPath);

      const initialHealth = serviceManager.getHealthStatus();
      expect(initialHealth.toolStats.total).toBe(1);

      await serviceManager.shutdown();

      const finalHealth = serviceManager.getHealthStatus();
      expect(finalHealth.status).toBe(ServiceStatus.SHUTDOWN);
    });
  });
});
