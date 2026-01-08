/**
 * 错误处理器测试
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigError,
  ConnectionError,
  DEFAULT_RETRY_CONFIG,
  ErrorCategory,
  ErrorCode,
  type ErrorContext,
  ErrorFactory,
  ErrorSeverity,
  type FallbackStrategy,
  McpHubCoreError,
  UnifiedErrorHandler,
} from './index';

describe('UnifiedErrorHandler', () => {
  let errorHandler: UnifiedErrorHandler;
  let mockLogger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogger = vi.fn();
    errorHandler = new UnifiedErrorHandler(mockLogger);
  });

  describe('handleError', () => {
    it('应该正确处理 McpHubCoreError', () => {
      const error = new McpHubCoreError(
        ErrorCode.TOOL_NOT_FOUND,
        '工具未找到',
        { toolName: 'test-tool' },
        { serverId: 'server1' },
      );
      const context: ErrorContext = {
        operation: 'callTool',
        component: 'ToolManager',
      };

      const response = errorHandler.handleError(error, context);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
      expect(response.error.message).toBe('工具未找到');
      expect(response.error.category).toBe(ErrorCategory.RUNTIME);
      expect(response.error.severity).toBe(ErrorSeverity.LOW);
      expect(mockLogger).toHaveBeenCalled();
    });

    it('应该正确处理普通 Error', () => {
      const error = new Error('普通错误');
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };

      const response = errorHandler.handleError(error, context);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(response.error.message).toBe('普通错误');
      expect(response.error.category).toBe(ErrorCategory.SYSTEM);
      expect(response.error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('shouldRetry', () => {
    it('应该对可重试错误返回 true', () => {
      const error = new ConnectionError(ErrorCode.CONNECTION_TIMEOUT);
      expect(errorHandler.shouldRetry(error)).toBe(true);
    });

    it('应该对不可重试错误返回 false', () => {
      const error = new ConfigError(ErrorCode.INVALID_SERVER_CONFIG);
      expect(errorHandler.shouldRetry(error)).toBe(false);
    });

    it('应该对普通错误返回 false', () => {
      const error = new Error('普通错误');
      expect(errorHandler.shouldRetry(error)).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('应该在第一次成功时直接返回结果', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };

      const result = await errorHandler.executeWithRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('应该在可重试错误时进行重试', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(
          new ConnectionError(ErrorCode.CONNECTION_TIMEOUT),
        )
        .mockRejectedValueOnce(
          new ConnectionError(ErrorCode.CONNECTION_TIMEOUT),
        )
        .mockResolvedValue('success');

      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };

      const result = await errorHandler.executeWithRetry(operation, context, {
        maxAttempts: 3,
        baseDelay: 10, // 减少测试时间
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const error = new ConnectionError(ErrorCode.CONNECTION_TIMEOUT);
      const operation = vi.fn().mockRejectedValue(error);
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };

      await expect(
        errorHandler.executeWithRetry(operation, context, {
          maxAttempts: 2,
          baseDelay: 10,
        }),
      ).rejects.toThrow(error);

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('应该在不可重试错误时立即抛出', async () => {
      const error = new ConfigError(ErrorCode.INVALID_SERVER_CONFIG);
      const operation = vi.fn().mockRejectedValue(error);
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };

      await expect(
        errorHandler.executeWithRetry(operation, context),
      ).rejects.toThrow(error);

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeWithFallback', () => {
    it('应该在操作成功时返回结果', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };
      const fallbackStrategy: FallbackStrategy = {
        enabled: true,
        fallbackValue: 'fallback',
      };

      const result = await errorHandler.executeWithFallback(
        operation,
        context,
        fallbackStrategy,
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('应该在操作失败且启用降级时返回降级值', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };
      const fallbackStrategy: FallbackStrategy = {
        enabled: true,
        fallbackValue: 'fallback',
      };

      const result = await errorHandler.executeWithFallback(
        operation,
        context,
        fallbackStrategy,
      );

      expect(result).toBe('fallback');
      expect(mockLogger).toHaveBeenCalled();
    });

    it('应该在操作失败且启用降级函数时调用降级函数', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('操作失败'));
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };
      const fallbackFunction = vi.fn().mockReturnValue('function-fallback');
      const fallbackStrategy: FallbackStrategy = {
        enabled: true,
        fallbackFunction,
      };

      const result = await errorHandler.executeWithFallback(
        operation,
        context,
        fallbackStrategy,
      );

      expect(result).toBe('function-fallback');
      expect(fallbackFunction).toHaveBeenCalled();
    });

    it('应该在操作失败且未启用降级时抛出错误', async () => {
      const error = new Error('操作失败');
      const operation = vi.fn().mockRejectedValue(error);
      const context: ErrorContext = {
        operation: 'test',
        component: 'TestComponent',
      };
      const fallbackStrategy: FallbackStrategy = {
        enabled: false,
      };

      await expect(
        errorHandler.executeWithFallback(operation, context, fallbackStrategy),
      ).rejects.toThrow(error);
    });
  });

  describe('formatSuccessResponse', () => {
    it('应该正确格式化成功响应', () => {
      const data = { result: 'test' };
      const response = errorHandler.formatSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
    });
  });
});

describe('ErrorFactory', () => {
  it('应该创建配置错误', () => {
    const error = ErrorFactory.createConfigError(
      ErrorCode.INVALID_SERVER_CONFIG,
      '自定义消息',
      { detail: 'test' },
      { context: 'test' },
    );

    expect(error).toBeInstanceOf(ConfigError);
    expect(error.code).toBe(ErrorCode.INVALID_SERVER_CONFIG);
    expect(error.message).toBe('自定义消息');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error.context).toEqual({ context: 'test' });
  });

  it('应该创建连接错误', () => {
    const error = ErrorFactory.createConnectionError(
      ErrorCode.CONNECTION_TIMEOUT,
    );

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.code).toBe(ErrorCode.CONNECTION_TIMEOUT);
    expect(error.message).toBe('连接超时');
  });

  it('应该创建服务错误', () => {
    const error = ErrorFactory.createServiceError(
      ErrorCode.SERVICE_UNAVAILABLE,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('应该创建工具执行错误', () => {
    const error = ErrorFactory.createToolExecutionError(
      ErrorCode.TOOL_EXECUTION_FAILED,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.TOOL_EXECUTION_FAILED);
  });

  it('应该创建验证错误', () => {
    const error = ErrorFactory.createValidationError(
      ErrorCode.INVALID_REQUEST_FORMAT,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.INVALID_REQUEST_FORMAT);
  });
});

describe('McpHubCoreError', () => {
  it('应该正确设置错误属性', () => {
    const error = new McpHubCoreError(
      ErrorCode.TOOL_NOT_FOUND,
      '自定义消息',
      { toolName: 'test' },
      { serverId: 'server1' },
    );

    expect(error.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(error.message).toBe('自定义消息');
    expect(error.category).toBe(ErrorCategory.RUNTIME);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.details).toEqual({ toolName: 'test' });
    expect(error.context).toEqual({ serverId: 'server1' });
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('应该使用默认错误消息', () => {
    const error = new McpHubCoreError(ErrorCode.TOOL_NOT_FOUND);

    expect(error.message).toBe('工具未找到');
  });

  it('应该正确转换为JSON', () => {
    const error = new McpHubCoreError(
      ErrorCode.TOOL_NOT_FOUND,
      '自定义消息',
      { toolName: 'test' },
      { serverId: 'server1' },
    );

    const json = error.toJSON();

    expect(json.name).toBe('McpHubCoreError');
    expect(json.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(json.message).toBe('自定义消息');
    expect(json.category).toBe(ErrorCategory.RUNTIME);
    expect(json.severity).toBe(ErrorSeverity.LOW);
    expect(json.details).toEqual({ toolName: 'test' });
    expect(json.context).toEqual({ serverId: 'server1' });
    expect(json.timestamp).toBeDefined();
    expect(json.stack).toBeDefined();
  });
});
