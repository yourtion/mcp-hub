// Logging Levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Log Entry Interface
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

// Logger Interface
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;

  // Specialized logging methods for MCP operations
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

// Console Logger Implementation
export class ConsoleLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = LogLevel[entry.level];
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const serverInfo = entry.serverId ? ` [server:${entry.serverId}]` : '';
    const groupInfo = entry.groupId ? ` [group:${entry.groupId}]` : '';
    const toolInfo = entry.toolName ? ` [tool:${entry.toolName}]` : '';
    const errorInfo = entry.error ? ` Error: ${entry.error.message}` : '';

    return `[${timestamp}] ${level}${serverInfo}${groupInfo}${toolInfo}: ${entry.message}${context}${errorInfo}`;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    serverId?: string,
    groupId?: string,
    toolName?: string,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      serverId,
      groupId,
      toolName,
    };

    const formattedMessage = this.formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Server ${status}`;
    this.log(level, message, context, undefined, serverId);
  }

  logToolDiscovery(
    serverId: string,
    toolCount: number,
    context?: Record<string, unknown>,
  ): void {
    const message = `Discovered ${toolCount} tools`;
    this.log(LogLevel.INFO, message, context, undefined, serverId);
  }

  logToolExecution(
    toolName: string,
    groupId: string,
    status: 'started' | 'completed' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Tool execution ${status}`;
    this.log(level, message, context, undefined, undefined, groupId, toolName);
  }

  logConfigReload(changes: string[], context?: Record<string, unknown>): void {
    const message = `Configuration reloaded with changes: ${changes.join(', ')}`;
    this.log(LogLevel.INFO, message, context);
  }
}

/**
 * 检查是否在测试环境中
 */
function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || !!process.env.VITEST;
}

/**
 * 检查是否启用调试模式
 */
function isDebugMode(): boolean {
  return process.env.VITEST_DEBUG === 'true' || process.env.DEBUG === 'true';
}

// Default logger instance
export const logger = new ConsoleLogger(
  process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ||
        LogLevel.INFO
    : isTestEnvironment() && !isDebugMode()
      ? LogLevel.WARN
      : LogLevel.INFO,
);
