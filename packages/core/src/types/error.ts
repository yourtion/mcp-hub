/**
 * 错误相关类型定义
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 配置错误
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',

  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // 服务器错误
  SERVER_NOT_FOUND = 'SERVER_NOT_FOUND',
  SERVER_UNAVAILABLE = 'SERVER_UNAVAILABLE',
  SERVER_ERROR = 'SERVER_ERROR',

  // 工具错误
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_INVALID_ARGS = 'TOOL_INVALID_ARGS',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * 核心错误类
 */
export class CoreError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'CoreError';
  }
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  /** 服务器ID */
  serverId?: string;
  /** 工具名称 */
  toolName?: string;
  /** 请求ID */
  requestId?: string;
  /** 用户ID */
  userId?: string;
  /** 时间戳 */
  timestamp: Date;
  /** 额外数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  /** 错误代码 */
  code: ErrorCode;
  /** 错误消息 */
  message: string;
  /** 详细信息 */
  details?: unknown;
  /** 时间戳 */
  timestamp: Date;
  /** 请求ID */
  requestId?: string;
}
