/**
 * Core 包日志系统
 * 基于统一的 logger 系统，提供向后兼容的接口
 */

import {
  type LogEntry as BaseLogEntry,
  type LoggerConfig as BaseLoggerConfig,
  createLogger as createUnifiedLogger,
  EnvironmentDetector,
  LogLevel,
  type UnifiedLogger,
} from '@mcp-core/mcp-hub-share';

// 重新导出统一的类型和枚举
export {
  ConsoleWriter,
  JsonFormatter,
  LOG_LEVEL_NAMES,
  type LogFormatter,
  LogLevel,
  type LogWriter,
  TextFormatter,
} from '@mcp-core/mcp-hub-share';

/**
 * 日志条目接口（向后兼容）
 */
export interface LogEntry extends BaseLogEntry {
  // 保持与原有接口的兼容性
}

/**
 * 日志配置接口（向后兼容）
 */
export interface LoggerConfig extends BaseLoggerConfig {
  // 保持与原有接口的兼容性
}

/**
 * 默认日志配置（向后兼容）
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: EnvironmentDetector.getEnvironmentLogLevel(LogLevel.INFO),
  enableConsole: EnvironmentDetector.getEnvironmentConsoleEnabled(true),
  enableFile: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableRotation: true,
  format: 'json',
  enableColors: true,
  enableTimestamp: true,
};

/**
 * 结构化日志记录器（向后兼容）
 * 现在基于统一的 UnifiedLogger
 */
export class StructuredLogger {
  private unifiedLogger: UnifiedLogger;
  private requestIdCounter = 0;

  constructor(config: LoggerConfig = DEFAULT_LOGGER_CONFIG) {
    this.unifiedLogger = createUnifiedLogger({
      ...config,
      component: config.component || 'Core',
    });
  }

  /**
   * 检查是否应该记录此级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.unifiedLogger.getLevel();
  }

  /**
   * 调试日志
   */
  debug(message: string, context?: Partial<LogEntry>): void {
    this.unifiedLogger.debug(message, context);
  }

  /**
   * 信息日志
   */
  info(message: string, context?: Partial<LogEntry>): void {
    this.unifiedLogger.info(message, context);
  }

  /**
   * 警告日志
   */
  warn(message: string, context?: Partial<LogEntry>): void {
    this.unifiedLogger.warn(message, context);
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error, context?: Partial<LogEntry>): void {
    this.unifiedLogger.error(message, error, context);
  }

  /**
   * 致命错误日志
   */
  fatal(message: string, error?: Error, context?: Partial<LogEntry>): void {
    this.unifiedLogger.fatal(message, error, context);
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.unifiedLogger.getLevel();
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.unifiedLogger.setLevel(level);
  }

  /**
   * 记录服务器连接事件
   */
  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'error',
    context?: Partial<LogEntry>,
  ): void {
    const level = status === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Server ${serverId} ${status}`;

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, { serverId, ...context });
    } else {
      this.info(message, { serverId, ...context });
    }
  }

  /**
   * 记录工具发现事件
   */
  logToolDiscovery(
    serverId: string,
    toolCount: number,
    context?: Partial<LogEntry>,
  ): void {
    this.info(`Discovered ${toolCount} tools from server ${serverId}`, {
      serverId,
      context: { toolCount, ...context?.context },
      ...context,
    });
  }

  /**
   * 记录工具执行事件
   */
  logToolExecution(
    toolName: string,
    serverId: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    context?: Partial<LogEntry>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Tool ${toolName} execution ${status}`;

    const logContext = {
      toolName,
      serverId,
      duration,
      ...context,
    };

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, logContext);
    } else {
      this.info(message, logContext);
    }
  }

  /**
   * 记录配置重载事件
   */
  logConfigReload(context?: Partial<LogEntry>): void {
    this.info('Configuration reloaded', context);
  }

  /**
   * 开始操作记录
   */
  startOperation(
    operation: string,
    component: string,
    context?: Partial<LogEntry>,
  ): string {
    const requestId = this.generateRequestId();
    this.info(`Starting ${operation}`, {
      operation,
      component,
      context: { requestId, ...context?.context },
      ...context,
    });
    return requestId;
  }

  /**
   * 结束操作记录
   */
  endOperation(
    operation: string,
    component: string,
    requestId: string,
    startTime: number,
    context?: Partial<LogEntry>,
  ): void {
    const duration = Date.now() - startTime;
    this.info(`Completed ${operation}`, {
      operation,
      component,
      duration,
      context: { requestId, ...context?.context },
      ...context,
    });
  }

  /**
   * 操作失败记录
   */
  failOperation(
    operation: string,
    component: string,
    requestId: string,
    error: Error,
    startTime: number,
    context?: Partial<LogEntry>,
  ): void {
    const duration = Date.now() - startTime;
    this.error(`Failed ${operation}`, error, {
      operation,
      component,
      duration,
      context: { requestId, ...context?.context },
      ...context,
    });
  }

  /**
   * 关闭日志记录器
   */
  close(): void {
    this.unifiedLogger.close();
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 创建日志记录器
 */
export function createLogger(config?: Partial<LoggerConfig>): StructuredLogger {
  const finalConfig = { ...DEFAULT_LOGGER_CONFIG, ...config };
  return new StructuredLogger(finalConfig);
}

/**
 * 默认日志记录器实例
 */
export const logger = createLogger({
  level: process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel] ||
      LogLevel.INFO
    : EnvironmentDetector.getEnvironmentLogLevel(LogLevel.INFO),
  enableConsole: EnvironmentDetector.getEnvironmentConsoleEnabled(true),
  enableFile: !!process.env.LOG_FILE,
  filePath: process.env.LOG_FILE,
});
