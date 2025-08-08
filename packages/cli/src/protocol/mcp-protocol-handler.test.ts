/**
 * MCP协议处理器单元测试
 */

import type { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpErrorCode, McpProtocolHandler } from './mcp-protocol-handler';

// Mock核心服务管理器
const mockCoreService = {
  getAllTools: vi.fn(),
  isToolAvailable: vi.fn(),
  executeToolCall: vi.fn(),
  getServiceStatus: vi.fn(),
} as unknown as McpServiceManager;

describe('McpProtocolHandler', () => {
  let handler: McpProtocolHandler;

  beforeEach(() => {
    handler = new McpProtocolHandler(mockCoreService);
    vi.clearAllMocks();
  });

  describe('handleListTools', () => {
    it('应该成功返回工具列表', async () => {
      const mockTools = [
        {
          name: 'test_tool_1',
          description: '测试工具1',
          serverId: 'server1',
        },
        {
          name: 'test_tool_2',
          description: '测试工具2',
          serverId: 'server2',
        },
      ];

      vi.mocked(mockCoreService.getAllTools).mockResolvedValue(mockTools);

      const result = await handler.handleListTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools[0]).toEqual({
        name: 'test_tool_1',
        description: '测试工具1',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
      });
      expect(result.tools[1]).toEqual({
        name: 'test_tool_2',
        description: '测试工具2',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
      });
    });

    it('应该为没有描述的工具生成默认描述', async () => {
      const mockTools = [
        {
          name: 'test_tool',
          description: '',
          serverId: 'server1',
        },
      ];

      vi.mocked(mockCoreService.getAllTools).mockResolvedValue(mockTools);

      const result = await handler.handleListTools();

      expect(result.tools[0].description).toBe('来自服务器 server1 的工具');
    });

    it('应该在获取工具失败时抛出MCP错误', async () => {
      vi.mocked(mockCoreService.getAllTools).mockRejectedValue(
        new Error('获取失败'),
      );

      await expect(handler.handleListTools()).rejects.toThrow(
        '获取工具列表失败',
      );
    });
  });

  describe('handleCallTool', () => {
    it('应该成功执行工具调用', async () => {
      const toolName = 'test_tool';
      const args = { param1: 'value1' };
      const mockResult = {
        success: true,
        data: { result: 'success' },
        executionTime: 100,
      };

      vi.mocked(mockCoreService.isToolAvailable).mockResolvedValue(true);
      vi.mocked(mockCoreService.executeToolCall).mockResolvedValue(mockResult);

      const result = await handler.handleCallTool(toolName, args);

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('success');
    });

    it('应该在工具不存在时抛出TOOL_NOT_FOUND错误', async () => {
      const toolName = 'nonexistent_tool';
      const args = {};

      vi.mocked(mockCoreService.isToolAvailable).mockResolvedValue(false);

      await expect(handler.handleCallTool(toolName, args)).rejects.toThrow(
        "工具 'nonexistent_tool' 未找到",
      );
    });

    it('应该处理工具执行失败的情况', async () => {
      const toolName = 'test_tool';
      const args = {};
      const mockResult = {
        success: false,
        error: '执行失败',
        data: null,
      };

      vi.mocked(mockCoreService.isToolAvailable).mockResolvedValue(true);
      vi.mocked(mockCoreService.executeToolCall).mockResolvedValue(mockResult);

      const result = await handler.handleCallTool(toolName, args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('执行失败');
    });

    it('应该处理工具执行异常', async () => {
      const toolName = 'test_tool';
      const args = {};

      vi.mocked(mockCoreService.isToolAvailable).mockResolvedValue(true);
      vi.mocked(mockCoreService.executeToolCall).mockRejectedValue(
        new Error('执行异常'),
      );

      await expect(handler.handleCallTool(toolName, args)).rejects.toThrow(
        '工具执行失败',
      );
    });
  });

  describe('handleProtocolError', () => {
    it('应该处理MCP错误', () => {
      const error = new Error('测试错误') as Error & { code: McpErrorCode };
      error.code = McpErrorCode.TOOL_NOT_FOUND;

      const result = handler.handleProtocolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('协议错误');
      expect(result.content[0].text).toContain(
        McpErrorCode.TOOL_NOT_FOUND.toString(),
      );
    });

    it('应该处理普通错误', () => {
      const error = new Error('普通错误');

      const result = handler.handleProtocolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('普通错误');
    });

    it('应该处理未知错误', () => {
      const error = 'string error';

      const result = handler.handleProtocolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('未知错误');
    });
  });

  describe('validateCallToolParams', () => {
    it('应该验证有效的参数', () => {
      const params = {
        name: 'test_tool',
        arguments: { param1: 'value1' },
      };

      const result = handler.validateCallToolParams(params);

      expect(result.toolName).toBe('test_tool');
      expect(result.args).toEqual({ param1: 'value1' });
    });

    it('应该在参数不是对象时抛出错误', () => {
      expect(() => handler.validateCallToolParams(null)).toThrow(
        '请求参数无效：参数必须是对象',
      );
      expect(() => handler.validateCallToolParams('string')).toThrow(
        '请求参数无效：参数必须是对象',
      );
    });

    it('应该在缺少工具名称时抛出错误', () => {
      const params = { arguments: {} };

      expect(() => handler.validateCallToolParams(params)).toThrow(
        '请求参数无效：缺少工具名称或工具名称不是字符串',
      );
    });

    it('应该在工具名称不是字符串时抛出错误', () => {
      const params = { name: 123, arguments: {} };

      expect(() => handler.validateCallToolParams(params)).toThrow(
        '请求参数无效：缺少工具名称或工具名称不是字符串',
      );
    });
  });

  describe('getStatus', () => {
    it('应该返回协议处理器状态', () => {
      const mockServiceStatus = {
        initialized: true,
        serverCount: 2,
        activeConnections: 2,
      };

      vi.mocked(mockCoreService.getServiceStatus).mockReturnValue(
        mockServiceStatus,
      );

      const status = handler.getStatus();

      expect(status.coreServiceStatus).toEqual(mockServiceStatus);
      expect(status.supportedMethods).toEqual(['tools/list', 'tools/call']);
      expect(status.errorCodes).toContain(McpErrorCode.TOOL_NOT_FOUND);
    });
  });
});
