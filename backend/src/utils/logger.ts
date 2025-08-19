/**
 * Backend 日志系统
 * 基于统一的 logger 系统，提供 MCP 操作特有的日志方法
 */

import {
  createMcpLogger,
  LogLevel,
  type McpLogger,
} from '@mcp-core/mcp-hub-share';

// 重新导出需要的类型和枚举，保持向后兼容
export { LogLevel } from '@mcp-core/mcp-hub-share';

/**
 * 日志条目接口（向后兼容）
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  serverId?: string;
  groupId?: string;
  toolName?: string;
  error?: Error;
}

/**
 * Logger 接口（向后兼容）
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;

  // MCP 专用方法
  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'failed',
    context?: Record<string, unknown>,
  ): void;
  logToolDiscovery(
    serverId: string,
    toolCount: number,
    context?: Record<string, unknown>,
  ): void;
  logToolExecution(
    toolName: string,
    groupId: string,
    status: 'started' | 'completed' | 'failed',
    context?: Record<string, unknown>,
  ): void;
  logConfigReload(changes: string[], context?: Record<string, unknown>): void;
}

/**
 * 控制台日志记录器（向后兼容）
 * 现在基于统一的 McpLogger
 */
export class ConsoleLogger implements Logger {
  private mcpLogger: McpLogger;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.mcpLogger = createMcpLogger({
      level: minLevel,
      component: 'Backend',
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.mcpLogger.debug(message, { context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.mcpLogger.info(message, { context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.mcpLogger.warn(message, { context });
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.mcpLogger.error(message, error, { context });
  }

  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    this.mcpLogger.logServerConnection(serverId, status, context);
  }

  logToolDiscovery(
    serverId: string,
    toolCount: number,
    context?: Record<string, unknown>,
  ): void {
    this.mcpLogger.logToolDiscovery(serverId, toolCount, context);
  }

  logToolExecution(
    toolName: string,
    groupId: string,
    status: 'started' | 'completed' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    this.mcpLogger.logToolExecution(toolName, groupId, status, context);
  }

  logConfigReload(changes: string[], context?: Record<string, unknown>): void {
    this.mcpLogger.logConfigReload(changes, context);
  }
}

// 默认 logger 实例
export const logger = new ConsoleLogger();
