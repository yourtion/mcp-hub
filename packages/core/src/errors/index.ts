/**
 * 错误处理模块
 * 定义MCP Hub核心包的错误类型和处理逻辑
 */

/**
 * 错误类别枚举
 */
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  CONNECTION = 'connection',
  RUNTIME = 'runtime',
  VALIDATION = 'validation',
  SYSTEM = 'system',
}

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 配置错误 (1000-1999)
  INVALID_SERVER_CONFIG = 1001,
  MISSING_GROUP_REFERENCE = 1002,
  SCHEMA_VALIDATION_FAILED = 1003,
  CONFIG_FILE_NOT_FOUND = 1004,
  INVALID_CONFIG_FORMAT = 1005,

  // 连接错误 (2000-2999)
  SERVER_STARTUP_FAILED = 2001,
  NETWORK_CONNECTIVITY_FAILED = 2002,
  AUTHENTICATION_FAILED = 2003,
  SERVER_UNAVAILABLE = 2004,
  CONNECTION_TIMEOUT = 2005,
  CONNECTION_REFUSED = 2006,

  // 运行时错误 (3000-3999)
  TOOL_EXECUTION_FAILED = 3001,
  SERVER_DISCONNECTED = 3002,
  INVALID_TOOL_ARGUMENTS = 3003,
  TOOL_NOT_FOUND = 3004,
  GROUP_NOT_FOUND = 3005,
  TOOL_ACCESS_DENIED = 3006,
  SERVICE_UNAVAILABLE = 3007,

  // 验证错误 (4000-4999)
  INVALID_REQUEST_FORMAT = 4001,
  MISSING_REQUIRED_PARAMETER = 4002,
  PARAMETER_TYPE_MISMATCH = 4003,
  INVALID_PARAMETER_VALUE = 4004,

  // 系统错误 (5000-5999)
  INTERNAL_SERVER_ERROR = 5001,
  MEMORY_LIMIT_EXCEEDED = 5002,
  TIMEOUT_ERROR = 5003,
  UNKNOWN_ERROR = 5999,
}

/**
 * 中文错误信息映射
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 配置错误
  [ErrorCode.INVALID_SERVER_CONFIG]: '服务器配置无效',
  [ErrorCode.MISSING_GROUP_REFERENCE]: '缺少组引用',
  [ErrorCode.SCHEMA_VALIDATION_FAILED]: '配置架构验证失败',
  [ErrorCode.CONFIG_FILE_NOT_FOUND]: '配置文件未找到',
  [ErrorCode.INVALID_CONFIG_FORMAT]: '配置文件格式无效',

  // 连接错误
  [ErrorCode.SERVER_STARTUP_FAILED]: '服务器启动失败',
  [ErrorCode.NETWORK_CONNECTIVITY_FAILED]: '网络连接失败',
  [ErrorCode.AUTHENTICATION_FAILED]: '身份验证失败',
  [ErrorCode.SERVER_UNAVAILABLE]: '服务器不可用',
  [ErrorCode.CONNECTION_TIMEOUT]: '连接超时',
  [ErrorCode.CONNECTION_REFUSED]: '连接被拒绝',

  // 运行时错误
  [ErrorCode.TOOL_EXECUTION_FAILED]: '工具执行失败',
  [ErrorCode.SERVER_DISCONNECTED]: '服务器连接断开',
  [ErrorCode.INVALID_TOOL_ARGUMENTS]: '工具参数无效',
  [ErrorCode.TOOL_NOT_FOUND]: '工具未找到',
  [ErrorCode.GROUP_NOT_FOUND]: '组未找到',
  [ErrorCode.TOOL_ACCESS_DENIED]: '工具访问被拒绝',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务不可用',

  // 验证错误
  [ErrorCode.INVALID_REQUEST_FORMAT]: '请求格式无效',
  [ErrorCode.MISSING_REQUIRED_PARAMETER]: '缺少必需参数',
  [ErrorCode.PARAMETER_TYPE_MISMATCH]: '参数类型不匹配',
  [ErrorCode.INVALID_PARAMETER_VALUE]: '参数值无效',

  // 系统错误
  [ErrorCode.INTERNAL_SERVER_ERROR]: '内部服务器错误',
  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: '内存限制超出',
  [ErrorCode.TIMEOUT_ERROR]: '操作超时',
  [ErrorCode.UNKNOWN_ERROR]: '未知错误',
};

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 错误严重程度映射
 */
export const ERROR_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  // 配置错误 - 通常是高严重程度
  [ErrorCode.INVALID_SERVER_CONFIG]: ErrorSeverity.HIGH,
  [ErrorCode.MISSING_GROUP_REFERENCE]: ErrorSeverity.MEDIUM,
  [ErrorCode.SCHEMA_VALIDATION_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.CONFIG_FILE_NOT_FOUND]: ErrorSeverity.HIGH,
  [ErrorCode.INVALID_CONFIG_FORMAT]: ErrorSeverity.HIGH,

  // 连接错误 - 中等到高严重程度
  [ErrorCode.SERVER_STARTUP_FAILED]: ErrorSeverity.CRITICAL,
  [ErrorCode.NETWORK_CONNECTIVITY_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.AUTHENTICATION_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.SERVER_UNAVAILABLE]: ErrorSeverity.MEDIUM,
  [ErrorCode.CONNECTION_TIMEOUT]: ErrorSeverity.MEDIUM,
  [ErrorCode.CONNECTION_REFUSED]: ErrorSeverity.MEDIUM,

  // 运行时错误 - 低到中等严重程度
  [ErrorCode.TOOL_EXECUTION_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.SERVER_DISCONNECTED]: ErrorSeverity.MEDIUM,
  [ErrorCode.INVALID_TOOL_ARGUMENTS]: ErrorSeverity.LOW,
  [ErrorCode.TOOL_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.GROUP_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.TOOL_ACCESS_DENIED]: ErrorSeverity.LOW,
  [ErrorCode.SERVICE_UNAVAILABLE]: ErrorSeverity.MEDIUM,

  // 验证错误 - 低严重程度
  [ErrorCode.INVALID_REQUEST_FORMAT]: ErrorSeverity.LOW,
  [ErrorCode.MISSING_REQUIRED_PARAMETER]: ErrorSeverity.LOW,
  [ErrorCode.PARAMETER_TYPE_MISMATCH]: ErrorSeverity.LOW,
  [ErrorCode.INVALID_PARAMETER_VALUE]: ErrorSeverity.LOW,

  // 系统错误 - 高到关键严重程度
  [ErrorCode.INTERNAL_SERVER_ERROR]: ErrorSeverity.CRITICAL,
  [ErrorCode.MEMORY_LIMIT_EXCEEDED]: ErrorSeverity.CRITICAL,
  [ErrorCode.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCode.UNKNOWN_ERROR]: ErrorSeverity.HIGH,
};

/**
 * MCP Hub核心错误基类
 */
export class McpHubCoreError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;

  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
    public readonly context?: Record<string, unknown>,
  ) {
    const errorMessage = message || ERROR_MESSAGES[code] || '未知错误';
    super(errorMessage);
    this.name = 'McpHubCoreError';
    this.category = this.getCategory(code);
    this.severity = ERROR_SEVERITY[code] || ErrorSeverity.MEDIUM;
    this.timestamp = new Date();
  }

  private getCategory(code: ErrorCode): ErrorCategory {
    if (code >= 1000 && code < 2000) return ErrorCategory.CONFIGURATION;
    if (code >= 2000 && code < 3000) return ErrorCategory.CONNECTION;
    if (code >= 3000 && code < 4000) return ErrorCategory.RUNTIME;
    if (code >= 4000 && code < 5000) return ErrorCategory.VALIDATION;
    return ErrorCategory.SYSTEM;
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * 配置错误
 */
export class ConfigError extends McpHubCoreError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(code, message, details, context);
    this.name = 'ConfigError';
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends McpHubCoreError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(code, message, details, context);
    this.name = 'ConnectionError';
  }
}

/**
 * 服务错误
 */
export class ServiceError extends McpHubCoreError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(code, message, details, context);
    this.name = 'ServiceError';
  }
}

/**
 * 工具执行错误
 */
export class ToolExecutionError extends McpHubCoreError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(code, message, details, context);
    this.name = 'ToolExecutionError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends McpHubCoreError {
  constructor(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(code, message, details, context);
    this.name = 'ValidationError';
  }
}

/**
 * 错误处理上下文
 */
export interface ErrorContext {
  operation: string;
  component: string;
  serverId?: string;
  groupId?: string;
  toolName?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // 基础延迟时间（毫秒）
  maxDelay: number; // 最大延迟时间（毫秒）
  backoffMultiplier: number; // 退避倍数
  retryableErrors: ErrorCode[]; // 可重试的错误代码
}

/**
 * 降级策略
 */
export interface FallbackStrategy {
  enabled: boolean;
  fallbackValue?: unknown;
  fallbackFunction?: (error: McpHubCoreError, context: ErrorContext) => unknown;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: string;
    details?: unknown;
    context?: Record<string, unknown>;
  };
}

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * API响应类型
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

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

  /**
   * 执行重试逻辑
   */
  executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig?: Partial<RetryConfig>,
  ): Promise<T>;

  /**
   * 执行带降级的操作
   */
  executeWithFallback<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackStrategy: FallbackStrategy,
  ): Promise<T>;

  /**
   * 格式化错误响应
   */
  formatErrorResponse(error: Error, context?: ErrorContext): ErrorResponse;

  /**
   * 格式化成功响应
   */
  formatSuccessResponse<T>(data: T): SuccessResponse<T>;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCode.NETWORK_CONNECTIVITY_FAILED,
    ErrorCode.SERVER_UNAVAILABLE,
    ErrorCode.CONNECTION_TIMEOUT,
    ErrorCode.CONNECTION_REFUSED,
    ErrorCode.SERVER_DISCONNECTED,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.TIMEOUT_ERROR,
  ],
};

/**
 * 统一错误处理器实现
 */
export class UnifiedErrorHandler implements ErrorHandler {
  private logger?: (message: string, data?: unknown) => void;

  constructor(logger?: (message: string, data?: unknown) => void) {
    this.logger = logger;
  }

  handleError(error: Error, context: ErrorContext): ErrorResponse {
    this.logError(error, context);
    return this.formatErrorResponse(error, context);
  }

  logError(error: Error, context: ErrorContext): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    if (this.logger) {
      this.logger(`[${context.component}] ${context.operation} 失败`, logData);
    } else {
      console.error(
        `[${context.component}] ${context.operation} 失败:`,
        logData,
      );
    }
  }

  shouldRetry(error: Error): boolean {
    if (error instanceof McpHubCoreError) {
      return DEFAULT_RETRY_CONFIG.retryableErrors.includes(error.code);
    }
    return false;
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig: Partial<RetryConfig> = {},
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(lastError) || attempt === config.maxAttempts) {
          throw lastError;
        }

        // 计算延迟时间（指数退避）
        const delay = Math.min(
          config.baseDelay * config.backoffMultiplier ** (attempt - 1),
          config.maxDelay,
        );

        this.logError(
          new Error(`重试第 ${attempt} 次失败，${delay}ms 后重试`),
          { ...context, metadata: { ...context.metadata, attempt, delay } },
        );

        await this.sleep(delay);
      }
    }

    // 这里lastError一定不为undefined，因为如果没有错误就会在try中return
    throw lastError!;
  }

  async executeWithFallback<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackStrategy: FallbackStrategy,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!fallbackStrategy.enabled) {
        throw error;
      }

      this.logError(new Error('操作失败，使用降级策略'), {
        ...context,
        metadata: { ...context.metadata, originalError: error },
      });

      if (fallbackStrategy.fallbackFunction) {
        return fallbackStrategy.fallbackFunction(
          error as McpHubCoreError,
          context,
        ) as T;
      }

      return fallbackStrategy.fallbackValue as T;
    }
  }

  formatErrorResponse(error: Error, context?: ErrorContext): ErrorResponse {
    if (error instanceof McpHubCoreError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          severity: error.severity,
          timestamp: error.timestamp.toISOString(),
          details: error.details,
          context: error.context,
        },
      };
    }

    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error.message || '未知错误',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        timestamp: new Date().toISOString(),
        details: { originalError: error.name },
        context: context
          ? { operation: context.operation, component: context.component }
          : undefined,
      },
    };
  }

  formatSuccessResponse<T>(data: T): SuccessResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 错误工厂函数 - 用于创建标准化错误
 */
export const ErrorFactory = {
  /**
   * 创建配置错误
   */
  createConfigError(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ): ConfigError {
    return new ConfigError(code, message, details, context);
  },

  /**
   * 创建连接错误
   */
  createConnectionError(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ): ConnectionError {
    return new ConnectionError(code, message, details, context);
  },

  /**
   * 创建服务错误
   */
  createServiceError(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ): ServiceError {
    return new ServiceError(code, message, details, context);
  },

  /**
   * 创建工具执行错误
   */
  createToolExecutionError(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ): ToolExecutionError {
    return new ToolExecutionError(code, message, details, context);
  },

  /**
   * 创建验证错误
   */
  createValidationError(
    code: ErrorCode,
    message?: string,
    details?: unknown,
    context?: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError(code, message, details, context);
  },
};

// 导出默认错误处理器实例
export const defaultErrorHandler = new UnifiedErrorHandler();
