/**
 * API工具集成服务测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiToolIntegrationService } from './api_tool_integration_service.js';

// Mock the core module
vi.mock('@mcp-core/mcp-hub-core/api-to-mcp', () => ({
  ApiToMcpServiceManagerImpl: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getApiTools: vi.fn(),
    executeApiTool: vi.fn(),
    getToolDefinition: vi.fn(),
    reloadConfig: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

describe('ApiToolIntegrationService', () => {
  let service: ApiToolIntegrationService;
  let mockApiServiceManager: any;

  beforeEach(() => {
    service = new ApiToolIntegrationService();
    // Get the mocked service manager
    mockApiServiceManager = (service as any).apiServiceManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('应该成功初始化API工具集成服务', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);

      await service.initialize(configPath);

      expect(mockApiServiceManager.initialize).toHaveBeenCalledWith(configPath);
    });

    it('应该跳过初始化当未提供配置文件路径时', async () => {
      await service.initialize();

      expect(mockApiServiceManager.initialize).not.toHaveBeenCalled();
    });

    it('应该处理初始化错误', async () => {
      const configPath = '/path/to/config.json';
      const error = new Error('初始化失败');
      mockApiServiceManager.initialize.mockRejectedValue(error);

      await expect(service.initialize(configPath)).rejects.toThrow(
        'API工具集成服务初始化失败: 初始化失败',
      );
    });

    it('应该跳过重复初始化', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);

      await service.initialize(configPath);
      await service.initialize(configPath);

      expect(mockApiServiceManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('getApiTools', () => {
    it('应该返回空数组当服务未初始化时', async () => {
      const tools = await service.getApiTools();

      expect(tools).toEqual([]);
      expect(mockApiServiceManager.getApiTools).not.toHaveBeenCalled();
    });

    it('应该返回转换后的API工具列表', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getApiTools.mockResolvedValue([
        {
          name: 'test-tool',
          description: '测试工具',
          inputSchema: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
            },
          },
        },
      ]);

      await service.initialize(configPath);
      const tools = await service.getApiTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'test-tool',
        description: '测试工具',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
        },
        serverId: 'api-tools',
      });
    });

    it('应该处理获取工具列表时的错误', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getApiTools.mockRejectedValue(
        new Error('获取失败'),
      );

      await service.initialize(configPath);
      const tools = await service.getApiTools();

      expect(tools).toEqual([]);
    });
  });

  describe('executeApiTool', () => {
    it('应该返回错误当服务未初始化时', async () => {
      const result = await service.executeApiTool('test-tool', {
        param1: 'value',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('API工具集成服务未初始化');
    });

    it('应该成功执行API工具', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.executeApiTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: '执行成功' }],
      });

      await service.initialize(configPath);
      const result = await service.executeApiTool('test-tool', {
        param1: 'value',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('执行成功');
      expect(mockApiServiceManager.executeApiTool).toHaveBeenCalledWith(
        'test-tool',
        { param1: 'value' },
      );
    });

    it('应该处理工具执行错误', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.executeApiTool.mockRejectedValue(
        new Error('执行失败'),
      );

      await service.initialize(configPath);
      const result = await service.executeApiTool('test-tool', {
        param1: 'value',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('API工具执行失败: 执行失败');
    });
  });

  describe('isApiTool', () => {
    it('应该返回false当服务未初始化时', () => {
      const result = service.isApiTool('test-tool');

      expect(result).toBe(false);
    });

    it('应该检查工具是否为API工具', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getToolDefinition.mockReturnValue({
        name: 'test-tool',
        description: '测试工具',
        inputSchema: { type: 'object' },
      });

      await service.initialize(configPath);
      const result = service.isApiTool('test-tool');

      expect(result).toBe(true);
      expect(mockApiServiceManager.getToolDefinition).toHaveBeenCalledWith(
        'test-tool',
      );
    });

    it('应该返回false当工具不存在时', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getToolDefinition.mockReturnValue(undefined);

      await service.initialize(configPath);
      const result = service.isApiTool('non-existent-tool');

      expect(result).toBe(false);
    });
  });

  describe('getApiToolDefinition', () => {
    it('应该返回undefined当服务未初始化时', () => {
      const result = service.getApiToolDefinition('test-tool');

      expect(result).toBeUndefined();
    });

    it('应该返回转换后的工具定义', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getToolDefinition.mockReturnValue({
        name: 'test-tool',
        description: '测试工具',
        inputSchema: { type: 'object' },
      });

      await service.initialize(configPath);
      const result = service.getApiToolDefinition('test-tool');

      expect(result).toEqual({
        name: 'test-tool',
        description: '测试工具',
        inputSchema: { type: 'object' },
        serverId: 'api-tools',
      });
    });

    it('应该返回undefined当工具不存在时', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getToolDefinition.mockReturnValue(undefined);

      await service.initialize(configPath);
      const result = service.getApiToolDefinition('non-existent-tool');

      expect(result).toBeUndefined();
    });
  });

  describe('reloadConfig', () => {
    it('应该处理未初始化的情况', async () => {
      // 不应该抛出错误
      await expect(service.reloadConfig()).resolves.toBeUndefined();
      expect(mockApiServiceManager.reloadConfig).not.toHaveBeenCalled();
    });

    it('应该重新加载配置', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.reloadConfig.mockResolvedValue(undefined);

      await service.initialize(configPath);
      await service.reloadConfig();

      expect(mockApiServiceManager.reloadConfig).toHaveBeenCalled();
    });

    it('应该处理重新加载配置时的错误', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.reloadConfig.mockRejectedValue(
        new Error('重新加载失败'),
      );

      await service.initialize(configPath);

      await expect(service.reloadConfig()).rejects.toThrow('重新加载失败');
    });
  });

  describe('getStats', () => {
    it('应该返回未初始化状态的统计信息', async () => {
      const stats = await service.getStats();

      expect(stats).toEqual({
        totalApiTools: 0,
        initialized: false,
      });
    });

    it('应该返回正确的统计信息', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getApiTools.mockResolvedValue([
        { name: 'tool1' },
        { name: 'tool2' },
      ]);

      await service.initialize(configPath);
      const stats = await service.getStats();

      expect(stats).toEqual({
        totalApiTools: 2,
        initialized: true,
      });
    });

    it('应该处理获取统计信息时的错误', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.getApiTools.mockRejectedValue(
        new Error('获取失败'),
      );

      await service.initialize(configPath);
      const stats = await service.getStats();

      expect(stats).toEqual({
        totalApiTools: 0,
        initialized: true,
      });
    });
  });

  describe('shutdown', () => {
    it('应该处理未初始化的情况', async () => {
      // 不应该抛出错误
      await expect(service.shutdown()).resolves.toBeUndefined();
      expect(mockApiServiceManager.shutdown).not.toHaveBeenCalled();
    });

    it('应该成功关闭服务', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.shutdown.mockResolvedValue(undefined);

      await service.initialize(configPath);
      await service.shutdown();

      expect(mockApiServiceManager.shutdown).toHaveBeenCalled();
    });

    it('应该处理关闭时的错误', async () => {
      const configPath = '/path/to/config.json';
      mockApiServiceManager.initialize.mockResolvedValue(undefined);
      mockApiServiceManager.shutdown.mockRejectedValue(new Error('关闭失败'));

      await service.initialize(configPath);

      await expect(service.shutdown()).rejects.toThrow('关闭失败');
    });
  });
});
