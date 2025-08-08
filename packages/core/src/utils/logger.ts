/**
 * 核心包日志系统
 * 提供结构化日志记录、日志级别控制和日志轮转功能
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * 日志级别名称映射
 */
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  component: string;
  operation?: string;
  serverId?: string;
  groupId?: string;
  toolName?: string;
  userId?: string;
  requestId?: string;
  duration?: number; // 操作持续时间（毫秒）
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number; // 最大文件大小（字节）
  maxFiles?: number; // 最大文件数量
  enableRotation: boolean;
  format?: 'json' | 'text';
  enableColors?: boolean;
}

/**
 * 默认日志配置
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableRotation: true,
  format: 'json',
  enableColors: true,
};

/**
 * 日志格式化器接口
 */
export interface LogFormatter {
  format(entry: LogEntry): string;
}

/**
 * JSON格式化器
 */
export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * 文本格式化器
 */
export class TextFormatter implements LogFormatter {
  constructor(private enableColors: boolean = true) {}

  format(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = this.colorizeLevel(entry.levelName, entry.level);
    const component = `[${entry.component}]`;
    const operation = entry.operation ? ` ${entry.operation}` : '';
    const context = this.formatContext(entry);
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    const error = entry.error ? ` - ${entry.error.message}` : '';

    return `${timestamp} ${level} ${component}${operation}: ${entry.message}${context}${duration}${error}`;
  }

  private colorizeLevel(levelName: string, level: LogLevel): string {
    if (!this.enableColors) return levelName;

    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // 青色
      [LogLevel.INFO]: '\x1b[32m', // 绿色
      [LogLevel.WARN]: '\x1b[33m', // 黄色
      [LogLevel.ERROR]: '\x1b[31m', // 红色
      [LogLevel.FATAL]: '\x1b[35m', // 紫色
    };
    const reset = '\x1b[0m';

    return `${colors[level]}${levelName}${reset}`;
  }

  private formatContext(entry: LogEntry): string {
    const contextParts: string[] = [];

    if (entry.serverId) contextParts.push(`server:${entry.serverId}`);
    if (entry.groupId) contextParts.push(`group:${entry.groupId}`);
    if (entry.toolName) contextParts.push(`tool:${entry.toolName}`);
    if (entry.userId) contextParts.push(`user:${entry.userId}`);
    if (entry.requestId) contextParts.push(`req:${entry.requestId}`);

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      contextParts.push(`meta:${JSON.stringify(entry.metadata)}`);
    }

    return contextParts.length > 0 ? ` [${contextParts.join(', ')}]` : '';
  }
}

/**
 * 日志写入器接口
 */
export interface LogWriter {
  write(formattedLog: string): Promise<void>;
  close?(): Promise<void>;
}

/**
 * 控制台写入器
 */
export class ConsoleWriter implements LogWriter {
  async write(formattedLog: string): Promise<void> {
    console.log(formattedLog);
  }
}

/**
 * 文件写入器（支持日志轮转）
 */
export class FileWriter implements LogWriter {
  private currentFileSize = 0;
  private fileHandle?: fs.promises.FileHandle;

  constructor(
    private filePath: string,
    private maxFileSize: number,
    private maxFiles: number,
    private enableRotation: boolean,
  ) {}

  async write(formattedLog: string): Promise<void> {
    await this.ensureFileHandle();

    const logLine = formattedLog + '\n';
    const logSize = Buffer.byteLength(logLine, 'utf8');

    // 检查是否需要轮转
    if (
      this.enableRotation &&
      this.currentFileSize + logSize > this.maxFileSize
    ) {
      await this.rotateFile();
    }

    if (this.fileHandle) {
      await this.fileHandle.write(logLine);
      this.currentFileSize += logSize;
    }
  }

  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = undefined;
    }
  }

  private async ensureFileHandle(): Promise<void> {
    if (!this.fileHandle) {
      // 确保目录存在
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      // 获取当前文件大小
      try {
        const stats = await fs.promises.stat(this.filePath);
        this.currentFileSize = stats.size;
      } catch {
        this.currentFileSize = 0;
      }

      this.fileHandle = await fs.promises.open(this.filePath, 'a');
    }
  }

  private async rotateFile(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = undefined;
    }

    // 轮转文件
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldFile = i === 1 ? this.filePath : `${this.filePath}.${i - 1}`;
      const newFile = `${this.filePath}.${i}`;

      try {
        await fs.promises.access(oldFile);
        await fs.promises.rename(oldFile, newFile);
      } catch {
        // 文件不存在，忽略
      }
    }

    this.currentFileSize = 0;
  }
}

/**
 * 结构化日志记录器
 */
export class StructuredLogger {
  private formatter: LogFormatter;
  private writers: LogWriter[] = [];

  constructor(private config: LoggerConfig = DEFAULT_LOGGER_CONFIG) {
    this.formatter =
      config.format === 'json'
        ? new JsonFormatter()
        : new TextFormatter(config.enableColors);

    this.initializeWriters();
  }

  private initializeWriters(): void {
    if (this.config.enableConsole) {
      this.writers.push(new ConsoleWriter());
    }

    if (this.config.enableFile && this.config.filePath) {
      this.writers.push(
        new FileWriter(
          this.config.filePath,
          this.config.maxFileSize || DEFAULT_LOGGER_CONFIG.maxFileSize!,
          this.config.maxFiles || DEFAULT_LOGGER_CONFIG.maxFiles!,
          this.config.enableRotation,
        ),
      );
    }
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorInfo = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        }
      : undefined;

    this.log(LogLevel.ERROR, message, { ...context, error: errorInfo });
  }

  /**
   * 记录致命错误日志
   */
  fatal(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorInfo = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        }
      : undefined;

    this.log(LogLevel.FATAL, message, { ...context, error: errorInfo });
  }

  /**
   * 记录操作开始
   */
  startOperation(
    operation: string,
    component: string,
    context?: Partial<LogEntry>,
  ): string {
    const requestId = context?.requestId || this.generateRequestId();
    this.info(`开始执行 ${operation}`, {
      ...context,
      component,
      operation,
      requestId,
    });
    return requestId;
  }

  /**
   * 记录操作完成
   */
  endOperation(
    operation: string,
    component: string,
    requestId: string,
    startTime: number,
    context?: Partial<LogEntry>,
  ): void {
    const duration = Date.now() - startTime;
    this.info(`完成执行 ${operation}`, {
      ...context,
      component,
      operation,
      requestId,
      duration,
    });
  }

  /**
   * 记录操作失败
   */
  failOperation(
    operation: string,
    component: string,
    requestId: string,
    startTime: number,
    error: Error,
    context?: Partial<LogEntry>,
  ): void {
    const duration = Date.now() - startTime;
    this.error(`执行 ${operation} 失败`, error, {
      ...context,
      component,
      operation,
      requestId,
      duration,
    });
  }

  /**
   * 记录服务器连接事件
   */
  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'failed',
    context?: Partial<LogEntry>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `服务器${status === 'connected' ? '已连接' : status === 'disconnected' ? '已断开' : '连接失败'}`;

    this.log(level, message, {
      ...context,
      component: 'ServerManager',
      serverId,
    });
  }

  /**
   * 记录工具发现事件
   */
  logToolDiscovery(
    serverId: string,
    toolCount: number,
    context?: Partial<LogEntry>,
  ): void {
    this.info(`发现 ${toolCount} 个工具`, {
      ...context,
      component: 'ToolRegistry',
      serverId,
      metadata: { toolCount },
    });
  }

  /**
   * 记录工具执行事件
   */
  logToolExecution(
    toolName: string,
    status: 'started' | 'completed' | 'failed',
    context?: Partial<LogEntry>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `工具执行${status === 'started' ? '开始' : status === 'completed' ? '完成' : '失败'}`;

    this.log(level, message, {
      ...context,
      component: 'ToolManager',
      toolName,
    });
  }

  /**
   * 记录配置重载事件
   */
  logConfigReload(changes: string[], context?: Partial<LogEntry>): void {
    this.info(`配置已重载`, {
      ...context,
      component: 'ConfigManager',
      metadata: { changes },
    });
  }

  /**
   * 更新日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * 关闭日志记录器
   */
  async close(): Promise<void> {
    await Promise.all(this.writers.map((writer) => writer.close?.()));
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Partial<LogEntry>,
  ): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      message,
      component: context?.component || 'Unknown',
      operation: context?.operation,
      serverId: context?.serverId,
      groupId: context?.groupId,
      toolName: context?.toolName,
      userId: context?.userId,
      requestId: context?.requestId,
      duration: context?.duration,
      metadata: context?.metadata,
      error: context?.error,
    };

    const formattedLog = this.formatter.format(entry);

    // 异步写入所有写入器
    Promise.all(
      this.writers.map((writer) =>
        writer.write(formattedLog).catch((err) => {
          console.error('日志写入失败:', err);
        }),
      ),
    ).catch(() => {
      // 忽略写入错误，避免影响主流程
    });
  }

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
    : LogLevel.INFO,
  enableFile: process.env.LOG_FILE ? true : false,
  filePath: process.env.LOG_FILE,
});
