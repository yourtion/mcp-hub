/**
 * 错误处理模块
 * 定义MCP Hub核心包的错误类型和处理逻辑
 */

/**
 * MCP Hub核心错误基类
 */
export class McpHubCoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'McpHubCoreError';
  }
}

/**
 * 配置错误
 */
export class ConfigError extends McpHubCoreError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends McpHubCoreError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

/**
 * 服务错误
 */
export class ServiceError extends McpHubCoreError {
  constructor(message: string, details?: unknown) {
    super(message, 'SERVICE_ERROR', details);
    this.name = 'ServiceError';
  }
}

/**
 * 工具执行错误
 */
export class ToolExecutionError extends McpHubCoreError {
  constructor(message: string, details?: unknown) {
    super(message, 'TOOL_EXECUTION_ERROR', details);
    this.name = 'ToolExecutionError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends McpHubCoreError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * 错误处理上下文
 */
export interface ErrorContext {
  operation: string;
  component: string;
  metadata?: Record<string, unknown>;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  /**
   * 处理错误
   */
  handleError(error: Error, context: ErrorContext): ErrorResponse;

  /**
   * 记录错误日志
   */
  logError(error: Error, context: ErrorContext): void;

  /**
   * 判断是否应该重试
   */
  shouldRetry(error: Error): boolean;
}

/**
 * 默认错误处理器实现
 */
export class DefaultErrorHandler implements ErrorHandler {
  handleError(error: Error, context: ErrorContext): ErrorResponse {
    this.logError(error, context);

    if (error instanceof McpHubCoreError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message || '未知错误',
      },
    };
  }

  logError(error: Error, context: ErrorContext): void {
    console.error(`[${context.component}] ${context.operation} 失败:`, {
      error: error.message,
      stack: error.stack,
      metadata: context.metadata,
    });
  }

  shouldRetry(error: Error): boolean {
    if (error instanceof ConnectionError) {
      return true;
    }
    if (error instanceof ServiceError) {
      return false;
    }
    return false;
  }
}

// 导出默认错误处理器实例
export const defaultErrorHandler = new DefaultErrorHandler();
