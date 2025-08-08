/**
 * CLI包的类型定义
 */

import type { ServerConfig } from '@mcp-core/mcp-hub-core';

/**
 * CLI配置接口
 */
export interface CliConfig {
  /** MCP服务器配置 */
  servers: Record<string, ServerConfig>;
  /** 日志配置 */
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
  /** 传输层配置 */
  transport: {
    type: 'stdio';
    options?: {
      sessionIdGenerator?: () => string;
    };
  };
}

/**
 * CLI工具执行结果
 */
export interface CliToolResult {
  success: boolean;
  data: unknown;
  metadata: {
    executionTime: number;
    serverId: string;
    toolName: string;
  };
  errors?: string[];
}

/**
 * CLI错误代码枚举
 */
export enum CliErrorCode {
  CONFIG_FILE_NOT_FOUND = 'CONFIG_FILE_NOT_FOUND',
  INVALID_CONFIG_FORMAT = 'INVALID_CONFIG_FORMAT',
  SERVER_CONNECTION_FAILED = 'SERVER_CONNECTION_FAILED',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
}

/**
 * CLI错误接口
 */
export interface CliError extends Error {
  code: CliErrorCode;
  details?: unknown;
}
