/**
 * API工具注册表测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiToolConfig } from '../types/api-config.js';
import type { McpTool } from '../types/api-tool.js';
import { ApiToolRegistry } from './api-tool-registry.js';

describe('ApiToolRegistry', () => {
  let registry: ApiToolRegistry;
  let mockTool: McpTool;
  let mockConfig: ApiToolConfig;

  beforeEach(() => {
    registry = new ApiToolRegistry();

    mockTool = {
      name: 'test-tool',
      description: '测试工具',
      inputSchema: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: '参数1',
          },
        },
        required: ['param1'],
      },
    };

    mockConfig = {
      id: 'test-tool',
      name: '测试工具',
      description: '这是一个测试工具',
      api: {
        url: 'https://api.example.com/test',
        method: 'GET',
      },
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: '参数1',
          },
        },
        required: ['param1'],
      },
      response: {},
    };
  });

  describe('registerTool', () => {
    it('应该成功注册有效的工具', () => {
      const result = registry.registerTool(mockTool, mockConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(registry.hasTool('test-tool')).toBe(true);
      expect(registry.getToolCount()).toBe(1);
    });

    it('应该拒绝无效的工具', () => {
      const invalidTool = {
        name: '',
        description: '',
        inputSchema: {
          type: 'string' as 'object',
        },
      };

      const result = registry.registerTool(invalidTool, mockConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(registry.getToolCount()).toBe(0);
    });

    it('应该更新已存在的工具', () => {
      // 首次注册
      registry.registerTool(mockTool, mockConfig);
      expect(registry.getToolCount()).toBe(1);

      // 更新工具
      const updatedTool = {
        ...mockTool,
        description: '更新后的测试工具',
      };
      const result = registry.registerTool(updatedTool, mockConfig);

      expect(result.valid).toBe(true);
      expect(registry.getToolCount()).toBe(1);
      expect(registry.getTool('test-tool')?.description).toBe(
        '更新后的测试工具',
      );
    });

    it('应该触发注册事件', () => {
      const eventListener = vi.fn();
      registry.addEventListener(eventListener);

      registry.registerTool(mockTool, mockConfig);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'added',
          toolId: 'test-tool',
          tool: mockTool,
        }),
      );
    });

    it('应该触发更新事件', () => {
      const eventListener = vi.fn();

      // 首次注册
      registry.registerTool(mockTool, mockConfig);

      // 添加监听器
      registry.addEventListener(eventListener);

      // 更新工具
      const updatedTool = { ...mockTool, description: '更新后的工具' };
      registry.registerTool(updatedTool, mockConfig);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
          toolId: 'test-tool',
          tool: updatedTool,
        }),
      );
    });
  });

  describe('registerTools', () => {
    it('应该批量注册多个工具', () => {
      const tool2: McpTool = {
        name: 'test-tool-2',
        description: '第二个测试工具',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const config2: ApiToolConfig = {
        ...mockConfig,
        id: 'test-tool-2',
        name: '第二个测试工具',
      };

      const result = registry.registerTools([
        { tool: mockTool, config: mockConfig },
        { tool: tool2, config: config2 },
      ]);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(registry.getToolCount()).toBe(2);
    });

    it('应该处理部分失败的批量注册', () => {
      const invalidTool: McpTool = {
        name: '',
        description: '',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const result = registry.registerTools([
        { tool: mockTool, config: mockConfig },
        { tool: invalidTool, config: mockConfig },
      ]);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(registry.getToolCount()).toBe(1);
    });
  });

  describe('unregisterTool', () => {
    beforeEach(() => {
      registry.registerTool(mockTool, mockConfig);
    });

    it('应该成功注销存在的工具', () => {
      const result = registry.unregisterTool('test-tool');

      expect(result).toBe(true);
      expect(registry.hasTool('test-tool')).toBe(false);
      expect(registry.getToolCount()).toBe(0);
    });

    it('应该处理注销不存在的工具', () => {
      const result = registry.unregisterTool('non-existent-tool');

      expect(result).toBe(false);
      expect(registry.getToolCount()).toBe(1);
    });

    it('应该触发移除事件', () => {
      const eventListener = vi.fn();
      registry.addEventListener(eventListener);

      registry.unregisterTool('test-tool');

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'removed',
          toolId: 'test-tool',
          tool: mockTool,
        }),
      );
    });
  });

  describe('getTool', () => {
    beforeEach(() => {
      registry.registerTool(mockTool, mockConfig);
    });

    it('应该返回存在的工具', () => {
      const tool = registry.getTool('test-tool');

      expect(tool).toEqual(mockTool);
    });

    it('应该返回undefined对于不存在的工具', () => {
      const tool = registry.getTool('non-existent-tool');

      expect(tool).toBeUndefined();
    });
  });

  describe('getToolConfig', () => {
    beforeEach(() => {
      registry.registerTool(mockTool, mockConfig);
    });

    it('应该返回存在工具的配置', () => {
      const config = registry.getToolConfig('test-tool');

      expect(config).toEqual(mockConfig);
    });

    it('应该返回undefined对于不存在工具的配置', () => {
      const config = registry.getToolConfig('non-existent-tool');

      expect(config).toBeUndefined();
    });
  });

  describe('getAllTools', () => {
    it('应该返回空数组当没有工具时', () => {
      const tools = registry.getAllTools();

      expect(tools).toEqual([]);
    });

    it('应该返回所有注册的工具', () => {
      const tool2: McpTool = {
        name: 'test-tool-2',
        description: '第二个测试工具',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      registry.registerTool(mockTool, mockConfig);
      registry.registerTool(tool2, { ...mockConfig, id: 'test-tool-2' });

      const tools = registry.getAllTools();

      expect(tools).toHaveLength(2);
      expect(tools).toContainEqual(mockTool);
      expect(tools).toContainEqual(tool2);
    });
  });

  describe('getAllToolIds', () => {
    it('应该返回空数组当没有工具时', () => {
      const toolIds = registry.getAllToolIds();

      expect(toolIds).toEqual([]);
    });

    it('应该返回所有工具ID', () => {
      const tool2: McpTool = {
        name: 'test-tool-2',
        description: '第二个测试工具',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      registry.registerTool(mockTool, mockConfig);
      registry.registerTool(tool2, { ...mockConfig, id: 'test-tool-2' });

      const toolIds = registry.getAllToolIds();

      expect(toolIds).toHaveLength(2);
      expect(toolIds).toContain('test-tool');
      expect(toolIds).toContain('test-tool-2');
    });
  });

  describe('filterTools', () => {
    beforeEach(() => {
      const tool2: McpTool = {
        name: 'weather-api',
        description: '获取天气信息的API工具',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      registry.registerTool(mockTool, mockConfig);
      registry.registerTool(tool2, { ...mockConfig, id: 'weather-api' });
    });

    it('应该按名称精确过滤工具', () => {
      const tools = registry.filterTools({ name: 'test-tool' });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('应该按名称模糊过滤工具', () => {
      const tools = registry.filterTools({ name: 'test', fuzzy: true });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('应该按描述模糊过滤工具', () => {
      const tools = registry.filterTools({ description: '天气', fuzzy: true });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('weather-api');
    });

    it('应该返回空数组当没有匹配的工具', () => {
      const tools = registry.filterTools({ name: 'non-existent' });

      expect(tools).toHaveLength(0);
    });
  });

  describe('searchTools', () => {
    beforeEach(() => {
      const tool2: McpTool = {
        name: 'weather-api',
        description: '获取天气信息的API工具',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      registry.registerTool(mockTool, mockConfig);
      registry.registerTool(tool2, { ...mockConfig, id: 'weather-api' });
    });

    it('应该按名称搜索工具', () => {
      const tools = registry.searchTools('test');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
    });

    it('应该按描述搜索工具', () => {
      const tools = registry.searchTools('天气');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('weather-api');
    });

    it('应该返回空数组当没有匹配的工具', () => {
      const tools = registry.searchTools('不存在的关键词');

      expect(tools).toHaveLength(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.registerTool(mockTool, mockConfig);
    });

    it('应该清空所有工具', () => {
      expect(registry.getToolCount()).toBe(1);

      registry.clear();

      expect(registry.getToolCount()).toBe(0);
      expect(registry.getAllTools()).toEqual([]);
    });

    it('应该触发清空事件', () => {
      const eventListener = vi.fn();
      registry.addEventListener(eventListener);

      registry.clear();

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cleared',
          toolId: '*',
        }),
      );
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const tool2: McpTool = {
        name: 'weather-api',
        description: '天气API',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const config2: ApiToolConfig = {
        ...mockConfig,
        id: 'weather-api',
        api: {
          url: 'https://weather.example.com/api',
          method: 'GET',
        },
      };

      registry.registerTool(mockTool, mockConfig);
      registry.registerTool(tool2, config2);

      const stats = registry.getStats();

      expect(stats.totalTools).toBe(2);
      expect(stats.toolsBySource['api.example.com']).toBe(1);
      expect(stats.toolsBySource['weather.example.com']).toBe(1);
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('应该处理无效URL的统计', () => {
      const invalidConfig: ApiToolConfig = {
        ...mockConfig,
        api: {
          url: 'invalid-url',
          method: 'GET',
        },
      };

      registry.registerTool(mockTool, invalidConfig);

      const stats = registry.getStats();

      expect(stats.totalTools).toBe(1);
      expect(stats.toolsBySource.unknown).toBe(1);
    });
  });

  describe('事件监听器', () => {
    it('应该添加和移除事件监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      registry.addEventListener(listener1);
      registry.addEventListener(listener2);

      registry.registerTool(mockTool, mockConfig);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // 重置mock
      listener1.mockClear();
      listener2.mockClear();

      // 移除一个监听器
      registry.removeEventListener(listener1);

      registry.unregisterTool('test-tool');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('应该移除所有事件监听器', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      registry.addEventListener(listener1);
      registry.addEventListener(listener2);

      registry.removeAllEventListeners();

      registry.registerTool(mockTool, mockConfig);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('应该处理监听器执行错误', () => {
      const errorListener = vi.fn(() => {
        throw new Error('监听器错误');
      });
      const normalListener = vi.fn();

      registry.addEventListener(errorListener);
      registry.addEventListener(normalListener);

      // 不应该抛出错误
      expect(() => {
        registry.registerTool(mockTool, mockConfig);
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });
});
