/**
 * 配置处理器单元测试
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerConfig, ServerConfig } from '../types';
import {
  ConfigFileNotFoundError,
  ConfigParseError,
  ConfigProcessorError,
  type ConfigProcessorOptions,
  ConfigValidationError,
  SharedConfigProcessor,
} from './processor';

// 模拟文件系统
vi.mock('node:fs/promises');
const mockFs = vi.mocked(fs);

// 模拟控制台方法
const mockConsole = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// 替换全局console
vi.stubGlobal('console', mockConsole);

describe('SharedConfigProcessor', () => {
  let processor: SharedConfigProcessor;
  let mockConfig: McpServerConfig;
  let mockServerConfig: ServerConfig;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建模拟配置
    mockServerConfig = {
      command: 'node',
      args: ['server.js'],
      env: { NODE_ENV: 'production' },
      disabled: false,
      timeout: 5000,
      retry: {
        maxRetries: 3,
        delay: 1000,
        exponentialBackoff: true,
      },
    };

    mockConfig = {
      servers: {
        server1: mockServerConfig,
        server2: {
          command: 'python',
          args: ['server.py'],
          disabled: false,
        },
      },
      groups: {
        group1: {
          name: '测试组1',
          description: '测试组描述',
          servers: ['server1'],
          toolFilter: {
            include: ['tool1', 'tool2'],
            exclude: ['deprecated_tool'],
          },
          validation: {
            enabled: true,
            validationKey: 'test-key',
          },
        },
      },
      settings: {
        logLevel: 'info',
        connectionTimeout: 10000,
        maxConcurrentConnections: 5,
      },
    };

    processor = new SharedConfigProcessor();
  });

  afterEach(() => {
    // 清理
    vi.resetAllMocks();
  });

  describe('初始化', () => {
    it('应该成功初始化配置处理器', async () => {
      // 模拟目录访问成功
      mockFs.access.mockResolvedValue(undefined);

      await processor.initialize();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '初始化配置处理器',
        expect.objectContaining({
          strictMode: false,
          allowMissingFiles: true,
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith('配置处理器初始化完成');
    });

    it('应该创建不存在的配置目录', async () => {
      // 模拟目录不存在
      const accessError = new Error('ENOENT') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockFs.access.mockRejectedValue(accessError);
      mockFs.mkdir.mockResolvedValue(undefined);

      await processor.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
      });
    });

    it('应该跳过重复初始化', async () => {
      mockFs.access.mockResolvedValue(undefined);

      await processor.initialize();

      // 清除日志
      mockConsole.warn.mockClear();

      // 尝试再次初始化
      await processor.initialize();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '配置处理器已初始化，跳过重复初始化',
      );
    });

    it('应该处理初始化错误', async () => {
      const error = new Error('权限拒绝');
      mockFs.access.mockRejectedValue(error);
      mockFs.mkdir.mockRejectedValue(error);

      await expect(processor.initialize()).rejects.toThrow(
        ConfigProcessorError,
      );
    });

    it('应该接受初始化选项', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const options: ConfigProcessorOptions = {
        strictMode: true,
        defaultConfigDir: '/custom/config',
        allowMissingFiles: false,
        encoding: 'utf16le',
      };

      await processor.initialize(options);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '初始化配置处理器',
        expect.objectContaining({
          strictMode: true,
          defaultConfigDir: '/custom/config',
          allowMissingFiles: false,
        }),
      );
    });
  });

  describe('配置文件处理', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await processor.initialize();
    });

    it('应该成功处理MCP服务器配置', async () => {
      const configPath = '/test/config.json';
      const configContent = JSON.stringify(mockConfig);

      // 模拟文件存在和读取
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: configContent.length,
      } as Awaited<ReturnType<typeof mockFs.stat>>);
      mockFs.readFile.mockResolvedValue(configContent);

      const result = await processor.processMcpServerConfig(configPath);

      expect(result).toEqual(mockConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf8');
      expect(mockConsole.info).toHaveBeenCalledWith(
        'MCP服务器配置处理完成',
        expect.objectContaining({
          configPath,
          serverCount: 2,
          groupCount: 1,
        }),
      );
    });

    it('应该处理不存在的配置文件（允许缺失）', async () => {
      const configPath = '/test/nonexistent.json';

      // 模拟文件不存在
      const statError = new Error('ENOENT') as NodeJS.ErrnoException;
      statError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(statError);

      const result = await processor.processMcpServerConfig(configPath);

      expect(result).toEqual(processor.generateDefaultConfig());
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '配置文件不存在，使用默认配置',
        { configPath },
      );
    });

    it('应该在严格模式下抛出文件不存在错误', async () => {
      // 重新初始化为严格模式
      const strictProcessor = new SharedConfigProcessor({
        strictMode: true,
        allowMissingFiles: false,
      });
      mockFs.access.mockResolvedValue(undefined);
      await strictProcessor.initialize();

      const configPath = '/test/nonexistent.json';

      // 模拟文件不存在
      const statError = new Error('ENOENT') as NodeJS.ErrnoException;
      statError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(statError);

      await expect(
        strictProcessor.processMcpServerConfig(configPath),
      ).rejects.toThrow(ConfigFileNotFoundError);
    });

    it('应该处理JSON解析错误', async () => {
      const configPath = '/test/invalid.json';
      const invalidJson = '{ invalid json }';

      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: invalidJson.length,
      } as Awaited<ReturnType<typeof mockFs.stat>>);
      mockFs.readFile.mockResolvedValue(invalidJson);

      await expect(
        processor.processMcpServerConfig(configPath),
      ).rejects.toThrow(ConfigParseError);
    });

    it('应该处理配置验证错误（严格模式）', async () => {
      const strictProcessor = new SharedConfigProcessor({ strictMode: true });
      mockFs.access.mockResolvedValue(undefined);
      await strictProcessor.initialize();

      const configPath = '/test/invalid-config.json';
      const invalidConfig = {
        servers: {
          invalidServer: {
            // 缺少必需的 command 字段
            args: ['test'],
          },
        },
      };

      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      } as Parameters<typeof mockFs.stat>[0] extends (
        ...args: unknown[]
      ) => Promise<infer R>
        ? R
        : never);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(
        strictProcessor.processMcpServerConfig(configPath),
      ).rejects.toThrow(ConfigValidationError);
    });

    it('应该处理配置验证警告（非严格模式）', async () => {
      const configPath = '/test/warning-config.json';
      const warningConfig = {
        servers: {
          warningServer: {
            command: 'node',
            timeout: -1, // 无效的超时值
          },
        },
      };

      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 100,
      } as Parameters<typeof mockFs.stat>[0] extends (
        ...args: unknown[]
      ) => Promise<infer R>
        ? R
        : never);
      mockFs.readFile.mockResolvedValue(JSON.stringify(warningConfig));

      const result = await processor.processMcpServerConfig(configPath);

      expect(result).toBeDefined();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '配置验证警告',
        expect.objectContaining({
          configPath,
          errors: expect.arrayContaining([expect.stringContaining('超时时间')]),
        }),
      );
    });

    it('应该从多个路径加载配置', async () => {
      const configPaths = ['/test/config1.json', '/test/config2.json'];

      const config1 = {
        servers: { server1: mockServerConfig },
        groups: { group1: mockConfig.groups?.group1 },
      };

      const config2 = {
        servers: { server2: mockConfig.servers.server2 },
        settings: mockConfig.settings,
      };

      // 模拟第一个文件
      mockFs.stat.mockResolvedValueOnce({
        mtime: new Date(),
        size: 100,
      } as Awaited<ReturnType<typeof mockFs.stat>>);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(config1));

      // 模拟第二个文件
      mockFs.stat.mockResolvedValueOnce({
        mtime: new Date(),
        size: 100,
      } as Awaited<ReturnType<typeof mockFs.stat>>);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(config2));

      const result = await processor.loadConfigFromPaths(configPaths);

      expect(result.servers).toHaveProperty('server1');
      expect(result.servers).toHaveProperty('server2');
      expect(result.groups).toHaveProperty('group1');
      expect(result.settings).toEqual(mockConfig.settings);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '多路径配置加载完成',
        expect.objectContaining({
          totalPaths: 2,
          loadedCount: 2,
          serverCount: 2,
        }),
      );
    });

    it('应该处理多路径加载中的错误', async () => {
      const configPaths = ['/test/valid.json', '/test/invalid.json'];

      // 第一个文件有效
      mockFs.stat.mockResolvedValueOnce({
        mtime: new Date(),
        size: 100,
      } as Awaited<ReturnType<typeof mockFs.stat>>);
      mockFs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          servers: { server1: mockServerConfig },
        }),
      );

      // 第二个文件无效 - 使用不允许缺失文件的处理器
      const strictProcessor = new SharedConfigProcessor({
        allowMissingFiles: false,
      });
      mockFs.access.mockResolvedValue(undefined);
      await strictProcessor.initialize();

      const statError = new Error('ENOENT') as NodeJS.ErrnoException;
      statError.code = 'ENOENT';
      mockFs.stat.mockRejectedValueOnce(statError);

      const result = await strictProcessor.loadConfigFromPaths(configPaths);

      expect(result.servers).toHaveProperty('server1');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '配置文件加载失败，跳过',
        expect.objectContaining({
          configPath: '/test/invalid.json',
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '多路径配置加载完成',
        expect.objectContaining({
          totalPaths: 2,
          loadedCount: 1,
        }),
      );
    });
  });

  describe('配置验证', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await processor.initialize();
    });

    it('应该验证有效的服务器配置', () => {
      const result = processor.validateServerConfig(mockServerConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的服务器配置', () => {
      const invalidConfig = {
        // 缺少必需的 command
        args: ['test'],
        timeout: -1, // 无效的超时值
        retry: {
          maxRetries: -1, // 无效的重试次数
          delay: 'invalid' as unknown as number, // 无效的延迟类型
        },
      } as unknown as ServerConfig;

      const result = processor.validateServerConfig(invalidConfig);
      expect(result.valid).toBe(false);
      // 检查是否包含预期的错误消息
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('服务器命令'))).toBe(true);
      expect(result.errors.some((e) => e.includes('超时时间'))).toBe(true);
      expect(result.errors.some((e) => e.includes('最大重试次数'))).toBe(true);
    });

    it('应该验证完整的MCP服务器配置', () => {
      const result = processor.validateMcpServerConfig(mockConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的MCP服务器配置', () => {
      const invalidConfig = {
        servers: {
          invalidServer: {
            // 缺少必需的 command
            args: ['test'],
          },
        },
        groups: {
          invalidGroup: {
            // 缺少必需的 name
            servers: 'not-an-array', // 应该是数组
          },
        },
        settings: {
          logLevel: 'invalid-level', // 无效的日志级别
          connectionTimeout: -1, // 无效的超时值
        },
      } as McpServerConfig;

      const result = processor.validateMcpServerConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('服务器命令'))).toBe(true);
      expect(result.errors.some((e) => e.includes('组名称'))).toBe(true);
      expect(result.errors.some((e) => e.includes('日志级别'))).toBe(true);
    });
  });

  describe('配置合并', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await processor.initialize();
    });

    it('应该正确合并配置', () => {
      const baseConfig: McpServerConfig = {
        servers: {
          server1: mockServerConfig,
        },
        groups: {
          group1: mockConfig.groups?.group1 as GroupConfig,
        },
        settings: {
          logLevel: 'debug',
        },
      };

      const overrideConfig: Partial<McpServerConfig> = {
        servers: {
          server2: mockConfig.servers.server2,
        },
        settings: {
          connectionTimeout: 5000,
        },
      };

      const result = processor.mergeConfigs(baseConfig, overrideConfig);

      expect(result.servers).toHaveProperty('server1');
      expect(result.servers).toHaveProperty('server2');
      expect(result.groups).toHaveProperty('group1');
      expect(result.settings).toEqual({
        logLevel: 'debug',
        connectionTimeout: 5000,
      });

      expect(mockConsole.debug).toHaveBeenCalledWith(
        '配置合并完成',
        expect.objectContaining({
          totalServers: 2,
          totalGroups: 1,
        }),
      );
    });
  });

  describe('配置保存', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await processor.initialize();
    });

    it('应该成功保存配置', async () => {
      const configPath = '/test/save-config.json';

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await processor.saveConfig(mockConfig, configPath);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(mockConfig, null, 2),
        'utf8',
      );

      expect(mockConsole.info).toHaveBeenCalledWith('配置保存成功', {
        configPath,
      });
    });

    it('应该在保存前验证配置', async () => {
      const configPath = '/test/invalid-save.json';
      const invalidConfig = {
        servers: {
          invalidServer: {
            // 缺少必需的 command
          },
        },
      } as McpServerConfig;

      await expect(
        processor.saveConfig(invalidConfig, configPath),
      ).rejects.toThrow(ConfigValidationError);

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('应该创建不存在的目录', async () => {
      const configPath = '/test/new-dir/config.json';

      // 模拟目录不存在
      const accessError = new Error('ENOENT') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockFs.access.mockRejectedValueOnce(accessError);

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await processor.saveConfig(mockConfig, configPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(configPath), {
        recursive: true,
      });
    });
  });

  describe('工具方法', () => {
    beforeEach(async () => {
      mockFs.access.mockResolvedValue(undefined);
      await processor.initialize();
    });

    it('应该获取配置文件信息', async () => {
      const configPath = '/test/config.json';
      const mockStats = {
        mtime: new Date('2023-01-01'),
        size: 1024,
      };

      mockFs.stat.mockResolvedValue(
        mockStats as Awaited<ReturnType<typeof mockFs.stat>>,
      );

      const result = await processor.getConfigFileInfo(configPath);

      expect(result).toEqual({
        path: configPath,
        exists: true,
        lastModified: mockStats.mtime,
        size: mockStats.size,
      });
    });

    it('应该处理不存在的文件', async () => {
      const configPath = '/test/nonexistent.json';

      const statError = new Error('ENOENT') as NodeJS.ErrnoException;
      statError.code = 'ENOENT';
      mockFs.stat.mockRejectedValue(statError);

      const result = await processor.getConfigFileInfo(configPath);

      expect(result).toEqual({
        path: configPath,
        exists: false,
      });
    });

    it('应该生成默认配置', () => {
      const defaultConfig = processor.generateDefaultConfig();

      expect(defaultConfig).toEqual({
        servers: {},
        groups: {},
        settings: {
          logLevel: 'info',
          connectionTimeout: 10000,
          maxConcurrentConnections: 10,
        },
      });
    });

    it('应该规范化配置路径', () => {
      // 绝对路径应该保持不变
      const absolutePath = '/absolute/path/config.json';
      expect(processor.normalizeConfigPath(absolutePath)).toBe(absolutePath);

      // 相对路径应该相对于默认配置目录解析
      const relativePath = 'config.json';
      const normalized = processor.normalizeConfigPath(relativePath);
      expect(path.isAbsolute(normalized)).toBe(true);
      expect(normalized).toContain('config.json');
    });
  });

  describe('错误处理', () => {
    it('应该在未初始化时抛出错误', async () => {
      const uninitializedProcessor = new SharedConfigProcessor();

      await expect(
        uninitializedProcessor.processMcpServerConfig('/test/config.json'),
      ).rejects.toThrow(ConfigProcessorError);
    });

    it('应该正确创建ConfigProcessorError', () => {
      const error = new ConfigProcessorError('测试错误', 'TEST_ERROR', {
        key: 'value',
      });

      expect(error.name).toBe('ConfigProcessorError');
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('应该正确创建ConfigFileNotFoundError', () => {
      const error = new ConfigFileNotFoundError('/test/config.json');

      expect(error).toBeInstanceOf(ConfigProcessorError);
      expect(error.code).toBe('CONFIG_FILE_NOT_FOUND');
      expect(error.message).toContain('/test/config.json');
      expect(error.context).toEqual({ filePath: '/test/config.json' });
    });

    it('应该正确创建ConfigParseError', () => {
      const error = new ConfigParseError('/test/config.json', 'JSON语法错误');

      expect(error).toBeInstanceOf(ConfigProcessorError);
      expect(error.code).toBe('CONFIG_PARSE_ERROR');
      expect(error.message).toContain('JSON语法错误');
      expect(error.context).toEqual({
        filePath: '/test/config.json',
        parseError: 'JSON语法错误',
      });
    });

    it('应该正确创建ConfigValidationError', () => {
      const errors = ['错误1', '错误2'];
      const error = new ConfigValidationError(errors);

      expect(error).toBeInstanceOf(ConfigProcessorError);
      expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
      expect(error.message).toContain('错误1, 错误2');
      expect(error.context).toEqual({ errors });
    });
  });
});
