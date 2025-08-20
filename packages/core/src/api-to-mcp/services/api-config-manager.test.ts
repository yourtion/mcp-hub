/**
 * API配置管理器测试
 */

import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiToolsConfig } from '../types/api-config.js';
import { ApiConfigManagerImpl, ConfigLoadError } from './api-config-manager.js';

// Mock环境变量
const originalEnv = process.env;

describe('ApiConfigManagerImpl', () => {
  let configManager: ApiConfigManagerImpl;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    configManager = new ApiConfigManagerImpl();

    // 创建临时目录和配置文件
    tempDir = await fs.mkdtemp(join(tmpdir(), 'api-config-test-'));
    configPath = join(tempDir, 'api-tools.json');

    // 重置环境变量
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    // 停止监听
    configManager.stopWatching();

    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // 忽略清理错误
    }

    // 恢复环境变量
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('应该成功加载有效的配置文件', async () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-api',
            name: '测试API',
            description: '用于测试的API工具',
            api: {
              url: 'https://api.example.com/test',
              method: 'GET',
              timeout: 5000,
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
            response: {
              jsonata: '$.data',
            },
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

      const tools = await configManager.loadConfig(configPath);

      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('test-api');
      expect(tools[0].name).toBe('测试API');
    });

    it('应该解析环境变量引用', async () => {
      process.env.TEST_API_KEY = 'secret-key';
      process.env.TEST_URL = 'https://api.example.com';

      const configWithEnv: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'env-test',
            name: '环境变量测试',
            description: '测试环境变量解析',
            api: {
              url: '{{env.TEST_URL}}/data',
              method: 'GET',
              headers: {
                Authorization: 'Bearer {{env.TEST_API_KEY}}',
              },
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(configWithEnv, null, 2));

      const tools = await configManager.loadConfig(configPath);

      expect(tools[0].api.url).toBe('https://api.example.com/data');
      expect(tools[0].api.headers?.Authorization).toBe('Bearer secret-key');
    });

    it('应该在文件不存在时抛出ConfigLoadError', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json');

      await expect(configManager.loadConfig(nonExistentPath)).rejects.toThrow(
        ConfigLoadError,
      );
    });

    it('应该在JSON格式错误时抛出ConfigLoadError', async () => {
      await fs.writeFile(configPath, '{ invalid json }');

      await expect(configManager.loadConfig(configPath)).rejects.toThrow(
        ConfigLoadError,
      );
    });

    it('应该在配置格式验证失败时抛出ConfigLoadError', async () => {
      const invalidConfig = {
        version: '1.0',
        tools: [
          {
            // 缺少必需字段
            id: 'invalid',
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      await expect(configManager.loadConfig(configPath)).rejects.toThrow(
        ConfigLoadError,
      );
    });
  });

  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-tool',
            name: '测试工具',
            description: '测试描述',
            api: {
              url: 'https://api.example.com',
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

      const result = configManager.validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测重复的工具ID', () => {
      const configWithDuplicates: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'duplicate-id',
            name: '工具1',
            description: '描述1',
            api: { url: 'https://api1.com', method: 'GET' },
            parameters: { type: 'object', properties: {} },
            response: {},
          },
          {
            id: 'duplicate-id',
            name: '工具2',
            description: '描述2',
            api: { url: 'https://api2.com', method: 'GET' },
            parameters: { type: 'object', properties: {} },
            response: {},
          },
        ],
      };

      const result = configManager.validateConfig(configWithDuplicates);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DUPLICATE_TOOL_ID');
    });

    it('应该返回Zod验证错误', () => {
      const invalidConfig = {
        version: '1.0',
        tools: [
          {
            id: '', // 空ID无效
            name: '测试',
            description: '描述',
            api: {
              url: 'invalid-url', // 无效URL
              method: 'INVALID_METHOD', // 无效HTTP方法
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      } as ApiToolsConfig;

      const result = configManager.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('watchConfigFile', () => {
    it('应该监听配置文件变化', async () => {
      const initialConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'initial-tool',
            name: '初始工具',
            description: '初始描述',
            api: { url: 'https://api.example.com', method: 'GET' },
            parameters: { type: 'object', properties: {} },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(initialConfig, null, 2));
      await configManager.loadConfig(configPath);

      const mockCallback = vi.fn();
      configManager.watchConfigFile(mockCallback);

      // 修改配置文件
      const updatedConfig: ApiToolsConfig = {
        ...initialConfig,
        tools: [
          {
            ...initialConfig.tools[0],
            name: '更新后的工具',
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

      // 等待文件系统事件
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockCallback).toHaveBeenCalled();
    });

    it('应该在未加载配置时抛出错误', () => {
      const mockCallback = vi.fn();

      expect(() => configManager.watchConfigFile(mockCallback)).toThrow(
        '必须先调用 loadConfig() 才能监听配置文件变化',
      );
    });
  });

  describe('resolveEnvironmentVariables', () => {
    it('应该解析环境变量引用', () => {
      process.env.TEST_TOKEN = 'test-token';
      process.env.TEST_HOST = 'api.test.com';

      const config = {
        id: 'test',
        name: '测试',
        description: '测试工具',
        api: {
          url: 'https://{{env.TEST_HOST}}/api',
          method: 'GET' as const,
          headers: {
            Authorization: 'Bearer {{env.TEST_TOKEN}}',
          },
        },
        parameters: {
          type: 'object' as const,
          properties: {},
        },
        response: {},
      };

      const resolved = configManager.resolveEnvironmentVariables(config);

      expect(resolved.api.url).toBe('https://api.test.com/api');
      expect(resolved.api.headers?.Authorization).toBe('Bearer test-token');
    });

    it('应该保持未定义环境变量的原始值', () => {
      const config = {
        id: 'test',
        name: '测试',
        description: '测试工具',
        api: {
          url: 'https://{{env.UNDEFINED_VAR}}/api',
          method: 'GET' as const,
        },
        parameters: {
          type: 'object' as const,
          properties: {},
        },
        response: {},
      };

      const resolved = configManager.resolveEnvironmentVariables(config);

      expect(resolved.api.url).toBe('https://{{env.UNDEFINED_VAR}}/api');
    });
  });

  describe('getCurrentConfigPath', () => {
    it('应该返回当前配置文件路径', async () => {
      expect(configManager.getCurrentConfigPath()).toBeUndefined();

      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(config));
      await configManager.loadConfig(configPath);

      expect(configManager.getCurrentConfigPath()).toBe(configPath);
    });
  });

  describe('reloadConfig', () => {
    it('应该重新加载当前配置', async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-tool',
            name: '测试工具',
            description: '测试描述',
            api: { url: 'https://api.example.com', method: 'GET' },
            parameters: { type: 'object', properties: {} },
            response: {},
          },
        ],
      };

      await fs.writeFile(configPath, JSON.stringify(config));
      await configManager.loadConfig(configPath);

      const reloaded = await configManager.reloadConfig();

      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].id).toBe('test-tool');
    });

    it('应该在没有当前配置路径时抛出错误', async () => {
      await expect(configManager.reloadConfig()).rejects.toThrow(
        '没有当前配置文件路径，请先调用 loadConfig()',
      );
    });
  });

  describe('stopWatching', () => {
    it('应该停止文件监听', async () => {
      const config: ApiToolsConfig = {
        version: '1.0',
        tools: [],
      };

      await fs.writeFile(configPath, JSON.stringify(config));
      await configManager.loadConfig(configPath);

      const mockCallback = vi.fn();
      configManager.watchConfigFile(mockCallback);

      // 停止监听
      configManager.stopWatching();

      // 修改文件
      await fs.writeFile(
        configPath,
        JSON.stringify({ ...config, version: '2.0' }),
      );

      // 等待可能的文件系统事件
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 回调不应该被调用
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });
});
