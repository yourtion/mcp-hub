/**
 * 错误处理器
 * 统一处理API转MCP服务中的各种错误
 */

/**
 * API转MCP错误代码
 */
export enum ApiToMcpErrorCode {
  // 配置相关错误
  CONFIG_FILE_NOT_FOUND = 'CONFIG_FILE_NOT_FOUND',
  INVALID_CONFIG_FORMAT = 'INVALID_CONFIG_FORMAT',
  INVALID_JSONATA_EXPRESSION = 'INVALID_JSONATA_EXPRESSION',

  // API调用错误
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  API_TIMEOUT = 'API_TIMEOUT',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',

  // 参数验证错误
  INVALID_TOOL_PARAMETERS = 'INVALID_TOOL_PARAMETERS',
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',

  // 响应处理错误
  RESPONSE_PROCESSING_FAILED = 'RESPONSE_PROCESSING_FAILED',
  JSONATA_EXECUTION_ERROR = 'JSONATA_EXECUTION_ERROR',

  // 安全相关错误
  DOMAIN_NOT_ALLOWED = 'DOMAIN_NOT_ALLOWED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * API转MCP错误类
 */
export class ApiToMcpError extends Error {
  public readonly code: ApiToMcpErrorCode;
  public readonly details?: Record<string, any>;
  public readonly cause?: Error;

  constructor(
    code: ApiToMcpErrorCode,
    message: string,
    details?: Record<string, any>,
    cause?: Error,
  ) {
    super(message);
    this.name = 'ApiToMcpError';
    this.code = code;
    this.details = details;
    this.cause = cause;
  }

  /**
   * 转换为JSON格式
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

/**
 * 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
  /**
   * 判断是否可以重试
   * @param error 错误对象
   */
  canRetry(error: ApiToMcpError): boolean;

  /**
   * 计算重试延迟
   * @param attempt 重试次数
   */
  calculateRetryDelay(attempt: number): number;

  /**
   * 执行降级处理
   * @param error 错误对象
   * @param context 上下文信息
   */
  fallback(error: ApiToMcpError, context: any): Promise<any>;
}

/**
 * 默认错误恢复策略
 */
export class DefaultErrorRecoveryStrategy implements ErrorRecoveryStrategy {
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1秒

  canRetry(error: ApiToMcpError): boolean {
    // 可重试的错误类型
    const retryableErrors = [
      ApiToMcpErrorCode.API_TIMEOUT,
      ApiToMcpErrorCode.API_REQUEST_FAILED,
      ApiToMcpErrorCode.SERVICE_UNAVAILABLE,
    ];

    return retryableErrors.includes(error.code);
  }

  calculateRetryDelay(attempt: number): number {
    // 指数退避策略
    return this.baseDelay * 2 ** (attempt - 1);
  }

  async fallback(error: ApiToMcpError, context: any): Promise<any> {
    // 默认降级处理：返回错误信息
    return {
      error: true,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  private recoveryStrategy: ErrorRecoveryStrategy;

  constructor(recoveryStrategy?: ErrorRecoveryStrategy) {
    this.recoveryStrategy =
      recoveryStrategy || new DefaultErrorRecoveryStrategy();
  }

  /**
   * 处理错误并尝试恢复
   * @param error 错误对象
   * @param context 上下文信息
   * @param attempt 当前重试次数
   */
  async handleError(
    error: Error | ApiToMcpError,
    context: any = {},
    attempt = 1,
  ): Promise<any> {
    const apiError = this.normalizeError(error);

    // 记录错误
    console.error('API转MCP服务错误:', apiError.toJSON());

    // 检查是否可以重试
    if (this.recoveryStrategy.canRetry(apiError) && attempt <= 3) {
      const delay = this.recoveryStrategy.calculateRetryDelay(attempt);
      console.log(`${delay}ms后进行第${attempt}次重试...`);

      await this.sleep(delay);
      // 这里应该重新执行原始操作，但需要调用者处理
      throw new ApiToMcpError(ApiToMcpErrorCode.INTERNAL_ERROR, '需要重试', {
        attempt,
        delay,
      });
    }

    // 执行降级处理
    return this.recoveryStrategy.fallback(apiError, context);
  }

  /**
   * 将普通错误转换为API转MCP错误
   * @param error 原始错误
   */
  private normalizeError(error: Error | ApiToMcpError): ApiToMcpError {
    if (error instanceof ApiToMcpError) {
      return error;
    }

    // 根据错误消息推断错误类型
    let code = ApiToMcpErrorCode.INTERNAL_ERROR;

    if (error.message.includes('timeout')) {
      code = ApiToMcpErrorCode.API_TIMEOUT;
    } else if (
      error.message.includes('network') ||
      error.message.includes('fetch')
    ) {
      code = ApiToMcpErrorCode.API_REQUEST_FAILED;
    } else if (error.message.includes('auth')) {
      code = ApiToMcpErrorCode.API_AUTHENTICATION_FAILED;
    }

    return new ApiToMcpError(code, error.message, undefined, error);
  }

  /**
   * 睡眠指定毫秒数
   * @param ms 毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
