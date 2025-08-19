/**
 * 工具注册表单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInfo, ToolResult } from '../../types';
import {
  DuplicateToolError,
  type ToolExecutionContext,
  ToolNotFoundError,
  ToolRegistry,
  ToolRegistryError,
  ToolValidationError,
} from './tool-registry';

// 模拟logger方法
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// 模拟createLogger函数
vi.mock('@mcp-core/mcp-hub-share', () => ({
  createLogger: vi.fn(() => mockLogger),
}));

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockTool1: ToolInfo;
  let mockTool2: ToolInfo;
  let mockTool3: ToolInfo;

  beforeEach(async () => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建模拟工具
    mockTool1 = {
      name: 'test_tool_1',
      description: '测试工具 1',
      category: 'test',
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: '字符串参数',
          required: true,
        },
        {
          name: 'param2',
          type: 'number',
          description: '数字参数',
          required: false,
          default: 42,
        },
      ],
    };

    mockTool2 = {
      name: 'test_tool_2',
      description: '测试工具 2',
      category: 'utility',
      deprecated: true,
      parameters: [
        {
          name: 'mode',
          type: 'string',
          description: '模式选择',
          required: true,
          enum: ['fast', 'slow', 'auto'],
        },
      ],
    };

    mockTool3 = {
      name: 'test_tool_3',
      description: '测试工具 3',
      parameters: [],
    };

    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
  });

  afterEach(() => {
    // 清理
    if (toolRegistry) {
      toolRegistry.cleanup();
    }
  });

  describe('初始化', () => {
    it('应该成功初始化工具注册表', async () => {
      const registry = new ToolRegistry();
      await registry.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('初始化工具注册表');
      expect(mockLogger.info).toHaveBeenCalledWith('工具注册表初始化完成');

      registry.cleanup();
    });

    it('应该跳过重复初始化', async () => {
      // 清除之前的日志调用
      mockLogger.warn.mockClear();

      // 尝试再次初始化
      await toolRegistry.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '工具注册表已初始化，跳过重复初始化',
      );
    });

    it('应该在未初始化时抛出错误', () => {
      const registry = new ToolRegistry();

      expect(() => registry.registerTool('server1', mockTool1)).toThrow(
        ToolRegistryError,
      );
    });
  });

  describe('工具注册', () => {
    it('应该成功注册单个工具', () => {
      toolRegistry.registerTool('server1', mockTool1);

      const tool = toolRegistry.getToolByName('test_tool_1', 'server1');
      expect(tool).toMatchObject({
        name: 'test_tool_1',
        description: '测试工具 1',
        serverId: 'server1',
        category: 'test',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('注册工具', {
        serverId: 'server1',
        toolName: 'test_tool_1',
      });
    });

    it('应该成功批量注册工具', () => {
      const tools = [mockTool1, mockTool2, mockTool3];
      toolRegistry.registerTools('server1', tools);

      const serverTools = toolRegistry.getToolsByServer('server1');
      expect(serverTools).toHaveLength(3);

      expect(mockLogger.info).toHaveBeenCalledWith('批量注册工具', {
        serverId: 'server1',
        context: {
          toolCount: 3,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '批量工具注册完成',
        expect.objectContaining({
          serverId: 'server1',
          context: expect.objectContaining({
            totalTools: 3,
            successCount: 3,
            errorCount: 0,
          }),
        }),
      );
    });

    it('应该处理批量注册中的错误', () => {
      const invalidTool = { name: '', description: '无效工具' } as ToolInfo;
      const tools = [mockTool1, invalidTool, mockTool2];

      toolRegistry.registerTools('server1', tools);

      const serverTools = toolRegistry.getToolsByServer('server1');
      expect(serverTools).toHaveLength(2); // 只有有效工具被注册

      expect(mockLogger.info).toHaveBeenCalledWith(
        '批量工具注册完成',
        expect.objectContaining({
          serverId: 'server1',
          context: expect.objectContaining({
            successCount: 2,
            errorCount: 1,
          }),
        }),
      );
    });

    it('应该覆盖已存在的工具', () => {
      toolRegistry.registerTool('server1', mockTool1);

      // 清除日志
      mockLogger.warn.mockClear();

      // 注册同名工具
      const updatedTool = { ...mockTool1, description: '更新的工具描述' };
      toolRegistry.registerTool('server1', updatedTool);

      expect(mockLogger.warn).toHaveBeenCalledWith('工具已存在，将覆盖', {
        serverId: 'server1',
        toolName: 'test_tool_1',
      });

      const tool = toolRegistry.getToolByName('test_tool_1', 'server1');
      expect(tool?.description).toBe('更新的工具描述');
    });

    it('应该验证工具信息', () => {
      const invalidTool1 = { name: '', description: '有效描述' } as ToolInfo;
      expect(() => toolRegistry.registerTool('server1', invalidTool1)).toThrow(
        ToolValidationError,
      );

      const invalidTool2 = { name: '有效名称', description: '' } as ToolInfo;
      expect(() => toolRegistry.registerTool('server1', invalidTool2)).toThrow(
        ToolValidationError,
      );

      const invalidTool3 = {
        name: '有效名称',
        description: '有效描述',
        parameters: [{ name: '', type: 'string' }],
      } as ToolInfo;
      expect(() => toolRegistry.registerTool('server1', invalidTool3)).toThrow(
        ToolValidationError,
      );
    });
  });

  describe('工具查询', () => {
    beforeEach(() => {
      toolRegistry.registerTool('server1', mockTool1);
      toolRegistry.registerTool('server1', mockTool2);
      toolRegistry.registerTool('server2', mockTool3);
    });

    it('应该获取所有工具', () => {
      const allTools = toolRegistry.getAllTools();
      expect(allTools).toHaveLength(3);

      const toolNames = allTools.map((t) => t.name);
      expect(toolNames).toContain('test_tool_1');
      expect(toolNames).toContain('test_tool_2');
      expect(toolNames).toContain('test_tool_3');
    });

    it('应该按过滤器获取工具', () => {
      // 按服务器过滤
      const server1Tools = toolRegistry.getAllTools({ serverIds: ['server1'] });
      expect(server1Tools).toHaveLength(2);

      // 按分类过滤
      const testTools = toolRegistry.getAllTools({ categories: ['test'] });
      expect(testTools).toHaveLength(1);
      expect(testTools[0].name).toBe('test_tool_1');

      // 排除已弃用工具
      const activeTools = toolRegistry.getAllTools({
        includeDeprecated: false,
      });
      expect(activeTools).toHaveLength(2);
      expect(activeTools.find((t) => t.name === 'test_tool_2')).toBeUndefined();

      // 按工具名称过滤
      const specificTools = toolRegistry.getAllTools({
        toolNames: ['test_tool_1', 'test_tool_3'],
      });
      expect(specificTools).toHaveLength(2);

      // 排除特定工具
      const excludedTools = toolRegistry.getAllTools({
        excludeToolNames: ['test_tool_2'],
      });
      expect(excludedTools).toHaveLength(2);
      expect(
        excludedTools.find((t) => t.name === 'test_tool_2'),
      ).toBeUndefined();
    });

    it('应该根据名称获取工具', () => {
      // 指定服务器
      const tool1 = toolRegistry.getToolByName('test_tool_1', 'server1');
      expect(tool1).toBeTruthy();
      expect(tool1?.serverId).toBe('server1');

      // 不指定服务器
      const tool2 = toolRegistry.getToolByName('test_tool_3');
      expect(tool2).toBeTruthy();
      expect(tool2?.serverId).toBe('server2');

      // 不存在的工具
      const nonExistent = toolRegistry.getToolByName('nonexistent');
      expect(nonExistent).toBeNull();
    });

    it('应该获取服务器的工具', () => {
      const server1Tools = toolRegistry.getToolsByServer('server1');
      expect(server1Tools).toHaveLength(2);

      const server2Tools = toolRegistry.getToolsByServer('server2');
      expect(server2Tools).toHaveLength(1);

      const nonExistentServerTools =
        toolRegistry.getToolsByServer('nonexistent');
      expect(nonExistentServerTools).toHaveLength(0);
    });

    it('应该查找工具所在的服务器', () => {
      const server1 = toolRegistry.findToolServer('test_tool_1');
      expect(server1).toBe('server1');

      const server2 = toolRegistry.findToolServer('test_tool_3');
      expect(server2).toBe('server2');

      const nonExistent = toolRegistry.findToolServer('nonexistent');
      expect(nonExistent).toBeUndefined();
    });

    it('应该检查工具可用性', () => {
      // 指定服务器
      expect(toolRegistry.isToolAvailable('test_tool_1', 'server1')).toBe(true);
      expect(toolRegistry.isToolAvailable('test_tool_1', 'server2')).toBe(
        false,
      );

      // 不指定服务器
      expect(toolRegistry.isToolAvailable('test_tool_1')).toBe(true);
      expect(toolRegistry.isToolAvailable('nonexistent')).toBe(false);
    });
  });

  describe('工具参数验证', () => {
    beforeEach(() => {
      toolRegistry.registerTool('server1', mockTool1);
      toolRegistry.registerTool('server1', mockTool2);
      toolRegistry.registerTool('server1', mockTool3);
    });

    it('应该验证必需参数', () => {
      // 缺少必需参数
      const result1 = toolRegistry.validateToolArgs('test_tool_1', {});
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('缺少必需参数: param1');

      // 必需参数为空
      const result2 = toolRegistry.validateToolArgs('test_tool_1', {
        param1: null,
      });
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain("必需参数 'param1' 不能为空");

      // 有效参数
      const result3 = toolRegistry.validateToolArgs('test_tool_1', {
        param1: 'test',
      });
      expect(result3.isValid).toBe(true);
    });

    it('应该验证参数类型', () => {
      // 错误的字符串类型
      const result1 = toolRegistry.validateToolArgs('test_tool_1', {
        param1: 123,
      });
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain("参数 'param1' 必须是字符串类型");

      // 错误的数字类型
      const result2 = toolRegistry.validateToolArgs('test_tool_1', {
        param1: 'test',
        param2: 'not_number',
      });
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain("参数 'param2' 必须是数字类型");

      // 正确的类型
      const result3 = toolRegistry.validateToolArgs('test_tool_1', {
        param1: 'test',
        param2: 42,
      });
      expect(result3.isValid).toBe(true);
    });

    it('应该验证枚举值', () => {
      // 无效的枚举值
      const result1 = toolRegistry.validateToolArgs('test_tool_2', {
        mode: 'invalid',
      });
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain(
        "参数 'mode' 必须是以下值之一: fast, slow, auto",
      );

      // 有效的枚举值
      const result2 = toolRegistry.validateToolArgs('test_tool_2', {
        mode: 'fast',
      });
      expect(result2.isValid).toBe(true);
    });

    it('应该处理未知参数', () => {
      const result = toolRegistry.validateToolArgs('test_tool_1', {
        param1: 'test',
        unknownParam: 'value',
      });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('未知参数: unknownParam');
    });

    it('应该处理无参数定义的工具', () => {
      const result = toolRegistry.validateToolArgs('test_tool_3', {
        anyParam: 'value',
      });
      expect(result.isValid).toBe(true);
    });

    it('应该处理不存在的工具', () => {
      const result = toolRegistry.validateToolArgs('nonexistent', {});
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("工具 'nonexistent' 未找到");
    });
  });

  describe('工具移除', () => {
    beforeEach(() => {
      toolRegistry.registerTool('server1', mockTool1);
      toolRegistry.registerTool('server1', mockTool2);
      toolRegistry.registerTool('server2', mockTool3);
    });

    it('应该移除单个工具', () => {
      toolRegistry.removeTool('server1', 'test_tool_1');

      const tool = toolRegistry.getToolByName('test_tool_1', 'server1');
      expect(tool).toBeNull();

      const server1Tools = toolRegistry.getToolsByServer('server1');
      expect(server1Tools).toHaveLength(1);
      expect(server1Tools[0].name).toBe('test_tool_2');

      expect(mockLogger.debug).toHaveBeenCalledWith('工具移除成功', {
        serverId: 'server1',
        toolName: 'test_tool_1',
      });
    });

    it('应该处理移除不存在的工具', () => {
      toolRegistry.removeTool('server1', 'nonexistent');

      expect(mockLogger.warn).toHaveBeenCalledWith('尝试移除不存在的工具', {
        serverId: 'server1',
        toolName: 'nonexistent',
      });
    });

    it('应该清空服务器的所有工具', () => {
      toolRegistry.clearServerTools('server1');

      const server1Tools = toolRegistry.getToolsByServer('server1');
      expect(server1Tools).toHaveLength(0);

      const server2Tools = toolRegistry.getToolsByServer('server2');
      expect(server2Tools).toHaveLength(1); // 不受影响

      expect(mockLogger.info).toHaveBeenCalledWith('服务器工具清空完成', {
        serverId: 'server1',
        context: {
          removedCount: 2,
        },
      });
    });

    it('应该处理清空不存在服务器的工具', () => {
      toolRegistry.clearServerTools('nonexistent');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '尝试清空不存在服务器的工具',
        { serverId: 'nonexistent' },
      );
    });
  });

  describe('工具统计', () => {
    beforeEach(() => {
      toolRegistry.registerTool('server1', mockTool1);
      toolRegistry.registerTool('server1', mockTool2);
      toolRegistry.registerTool('server2', mockTool3);
    });

    it('应该返回正确的工具统计信息', () => {
      const stats = toolRegistry.getToolStats();

      expect(stats).toMatchObject({
        totalTools: 3,
        toolsByServer: {
          server1: 2,
          server2: 1,
        },
        toolsByCategory: {
          test: 1,
          utility: 1,
          uncategorized: 1,
        },
        deprecatedTools: 1,
        executionCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
      });
    });

    it('应该记录工具执行', () => {
      const context: ToolExecutionContext = {
        toolName: 'test_tool_1',
        serverId: 'server1',
        args: { param1: 'test' },
        executionId: 'exec-123',
        timestamp: new Date(),
      };

      const result: ToolResult = {
        success: true,
        data: { result: 'success' },
        executionTime: 100,
      };

      toolRegistry.recordToolExecution(context, result);

      const stats = toolRegistry.getToolStats();
      expect(stats.executionCount).toBe(1);
      expect(stats.errorCount).toBe(0);
      expect(stats.averageExecutionTime).toBe(100);

      const history = toolRegistry.getToolExecutionHistory(
        'test_tool_1',
        'server1',
      );
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        toolName: 'test_tool_1',
        serverId: 'server1',
        executionId: 'exec-123',
      });
    });

    it('应该记录工具执行错误', () => {
      const context: ToolExecutionContext = {
        toolName: 'test_tool_1',
        serverId: 'server1',
        args: { param1: 'test' },
        executionId: 'exec-456',
        timestamp: new Date(),
      };

      const result: ToolResult = {
        success: false,
        data: null,
        error: '执行失败',
        executionTime: 50,
      };

      toolRegistry.recordToolExecution(context, result);

      const stats = toolRegistry.getToolStats();
      expect(stats.executionCount).toBe(1);
      expect(stats.errorCount).toBe(1);
      expect(stats.averageExecutionTime).toBe(50);
    });

    it('应该获取执行历史', () => {
      // 记录多个执行
      const contexts = [
        {
          toolName: 'test_tool_1',
          serverId: 'server1',
          args: {},
          executionId: 'exec-1',
          timestamp: new Date(Date.now() - 2000),
        },
        {
          toolName: 'test_tool_2',
          serverId: 'server1',
          args: {},
          executionId: 'exec-2',
          timestamp: new Date(Date.now() - 1000),
        },
        {
          toolName: 'test_tool_1',
          serverId: 'server1',
          args: {},
          executionId: 'exec-3',
          timestamp: new Date(),
        },
      ];

      const result: ToolResult = { success: true, data: null };

      contexts.forEach((context) => {
        toolRegistry.recordToolExecution(context, result);
      });

      // 获取特定工具的历史
      const tool1History = toolRegistry.getToolExecutionHistory(
        'test_tool_1',
        'server1',
      );
      expect(tool1History).toHaveLength(2);

      // 获取所有历史（按时间倒序）
      const allHistory = toolRegistry.getToolExecutionHistory();
      expect(allHistory).toHaveLength(3);
      expect(allHistory[0].executionId).toBe('exec-3'); // 最新的在前
    });
  });

  describe('清理', () => {
    beforeEach(() => {
      toolRegistry.registerTool('server1', mockTool1);
      toolRegistry.registerTool('server2', mockTool2);
    });

    it('应该清理所有数据', () => {
      toolRegistry.cleanup();

      expect(mockLogger.info).toHaveBeenCalledWith('清理工具注册表');
      expect(mockLogger.info).toHaveBeenCalledWith('工具注册表清理完成');

      // 验证数据已清理
      expect(() => toolRegistry.getAllTools()).toThrow(ToolRegistryError);
    });
  });

  describe('错误处理', () => {
    it('应该正确创建ToolRegistryError', () => {
      const error = new ToolRegistryError('测试错误', 'TEST_ERROR', {
        key: 'value',
      });

      expect(error.name).toBe('ToolRegistryError');
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('应该正确创建ToolNotFoundError', () => {
      const error1 = new ToolNotFoundError('test-tool');
      expect(error1).toBeInstanceOf(ToolRegistryError);
      expect(error1.code).toBe('TOOL_NOT_FOUND');
      expect(error1.message).toBe("工具 'test-tool' 未找到");

      const error2 = new ToolNotFoundError('test-tool', 'test-server');
      expect(error2.message).toBe(
        "工具 'test-tool' 未找到 在服务器 'test-server'",
      );
      expect(error2.context).toEqual({
        toolName: 'test-tool',
        serverId: 'test-server',
      });
    });

    it('应该正确创建ToolValidationError', () => {
      const error = new ToolValidationError('test-tool', '参数无效');
      expect(error).toBeInstanceOf(ToolRegistryError);
      expect(error.code).toBe('TOOL_VALIDATION_FAILED');
      expect(error.message).toBe("工具 'test-tool' 验证失败: 参数无效");
      expect(error.context).toEqual({
        toolName: 'test-tool',
        validationError: '参数无效',
      });
    });

    it('应该正确创建DuplicateToolError', () => {
      const error = new DuplicateToolError('test-tool', 'test-server');
      expect(error).toBeInstanceOf(ToolRegistryError);
      expect(error.code).toBe('DUPLICATE_TOOL');
      expect(error.message).toBe(
        "工具 'test-tool' 在服务器 'test-server' 上已存在",
      );
      expect(error.context).toEqual({
        toolName: 'test-tool',
        serverId: 'test-server',
      });
    });
  });
});
