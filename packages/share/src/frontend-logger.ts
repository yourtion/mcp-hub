/**
 * 前端日志系统
 * 为浏览器环境提供一致的日志功能
 */

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
  component?: string;
  operation?: string;
  serverId?: string;
  groupId?: string;
  toolName?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  // 常用的日志属性
  messageId?: string | number;
  method?: string;
  totalMessages?: number;
  serverCount?: number;
  totalServers?: number;
  initializationTimeMs?: number;
  totalTools?: number;
  status?: string;
  executionId?: string;
  args?: unknown;
  connectedServers?: number;
  failedServers?: number;
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  format: 'json' | 'text';
  enableColors?: boolean;
  enableTimestamp?: boolean;
  component?: string;
}

/**
 * 环境检测工具函数（浏览器环境）
 */
export const EnvironmentDetector = {
  /**
   * 检查是否在测试环境中
   */
  isTestEnvironment(): boolean {
    // 在浏览器环境中检查常见的测试环境变量
    try {
      return (
        (typeof process !== 'undefined' &&
          (process.env.NODE_ENV === 'test' || !!process.env.VITEST)) ||
        (typeof window !== 'undefined' &&
          (window as any).__vitest_environment__ === true)
      );
    } catch {
      return false;
    }
  },

  /**
   * 检查是否启用调试模式
   */
  isDebugMode(): boolean {
    // 在浏览器环境中检查调试模式
    try {
      return (
        (typeof process !== 'undefined' &&
          (process.env.VITEST_DEBUG === 'true' ||
            process.env.DEBUG === 'true')) ||
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem('DEBUG') === 'true' ||
            localStorage.getItem('VITEST_DEBUG') === 'true'))
      );
    } catch {
      return false;
    }
  },

  /**
   * 获取环境适配的日志级别
   */
  getEnvironmentLogLevel(defaultLevel: LogLevel = LogLevel.INFO): LogLevel {
    // 如果设置了 LOG_LEVEL 环境变量，优先使用
    try {
      if (typeof process !== 'undefined' && process.env.LOG_LEVEL) {
        const envLevel =
          LogLevel[
            process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel
          ];
        if (envLevel !== undefined) {
          return envLevel;
        }
      }

      // 检查 localStorage 中的设置
      if (typeof localStorage !== 'undefined') {
        const logLevelStr = localStorage.getItem('LOG_LEVEL');
        if (logLevelStr) {
          const envLevel =
            LogLevel[logLevelStr.toUpperCase() as keyof typeof LogLevel];
          if (envLevel !== undefined) {
            return envLevel;
          }
        }
      }
    } catch {
      // Ignore errors when accessing environment variables
    }

    // 如果启用了调试模式，则使用 DEBUG 级别
    if (EnvironmentDetector.isDebugMode()) {
      return LogLevel.DEBUG;
    }

    // 测试环境中，如果没有启用调试模式，则使用 WARN 级别
    if (EnvironmentDetector.isTestEnvironment()) {
      return LogLevel.WARN;
    }

    return defaultLevel;
  },

  /**
   * 获取环境适配的控制台输出设置
   */
  getEnvironmentConsoleEnabled(defaultEnabled: boolean = true): boolean {
    // 测试环境中，只有在调试模式下才启用控制台输出
    if (EnvironmentDetector.isTestEnvironment()) {
      return EnvironmentDetector.isDebugMode();
    }

    // 在浏览器环境中，默认启用控制台输出
    return defaultEnabled;
  },
};

/**
 * 日志格式化器接口
 */
export interface LogFormatter {
  format(entry: LogEntry): string;
}

/**
 * JSON 格式化器
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
  constructor(
    private enableColors: boolean = true,
    private enableTimestamp: boolean = true,
  ) {}

  format(entry: LogEntry): string {
    const parts: string[] = [];

    // 时间戳
    if (this.enableTimestamp) {
      const timestamp = new Date(entry.timestamp).toISOString();
      parts.push(this.colorize(timestamp, 'color: gray;')); // 灰色
    }

    // 日志级别
    const levelColor = this.getLevelColor(entry.level);
    parts.push(this.colorize(entry.levelName, levelColor));

    // 组件信息
    if (entry.component && entry.component !== 'Unknown') {
      parts.push(this.colorize(`[${entry.component}]`, 'color: teal;')); // 青色
    }

    // 操作信息
    if (entry.operation) {
      parts.push(this.colorize(`{${entry.operation}}`, 'color: purple;')); // 紫色
    }

    // 主要消息
    parts.push(entry.message);

    // 上下文信息
    const context = this.formatContext(entry);
    if (context) {
      parts.push(this.colorize(context, 'color: gray;')); // 灰色
    }

    // 持续时间
    if (entry.duration) {
      parts.push(this.colorize(`(${entry.duration}ms)`, 'color: gray;'));
    }

    // 错误信息
    if (entry.error) {
      parts.push(this.colorize(`- ${entry.error.message}`, 'color: red;')); // 红色
    }

    return parts.filter(Boolean).join(' ');
  }

  private colorize(text: string, style: string): string {
    if (!this.enableColors) return text;
    // 在浏览器环境中使用 console styling
    return `%c${text}`;
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: 'color: teal;', // 青色
      [LogLevel.INFO]: 'color: green;', // 绿色
      [LogLevel.WARN]: 'color: orange;', // 橙色
      [LogLevel.ERROR]: 'color: red;', // 红色
      [LogLevel.FATAL]: 'color: purple;', // 紫色
    };
    return colors[level] || '';
  }

  private formatContext(entry: LogEntry): string {
    const contextParts: string[] = [];

    if (entry.serverId) contextParts.push(`server:${entry.serverId}`);
    if (entry.groupId) contextParts.push(`group:${entry.groupId}`);
    if (entry.toolName) contextParts.push(`tool:${entry.toolName}`);

    // 添加自定义上下文
    if (entry.context) {
      const contextObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry.context)) {
        contextObj[key] = value;
      }
      if (Object.keys(contextObj).length > 0) {
        return `[meta:${JSON.stringify(contextObj)}]`;
      }
    }

    return contextParts.length > 0 ? `[${contextParts.join(', ')}]` : '';
  }
}

/**
 * 日志写入器接口
 */
export interface LogWriter {
  write(formattedMessage: string, ...args: any[]): void;
  close?(): void;
}

/**
 * 控制台写入器（浏览器环境）
 */
export class ConsoleWriter implements LogWriter {
  write(formattedMessage: string, ...args: any[]): void {
    // 在浏览器环境中使用 console.log
    if (args.length > 0) {
      console.log(formattedMessage, ...args);
    } else {
      console.log(formattedMessage);
    }
  }
}

/**
 * 默认日志配置
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: EnvironmentDetector.getEnvironmentLogLevel(LogLevel.INFO),
  enableConsole: EnvironmentDetector.getEnvironmentConsoleEnabled(true),
  format: 'text',
  enableColors: true,
  enableTimestamp: true,
};

/**
 * 前端结构化日志记录器
 */
export class FrontendLogger {
  private config: LoggerConfig;
  private formatter: LogFormatter;
  private writers: LogWriter[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };

    // 创建格式化器
    this.formatter =
      this.config.format === 'json'
        ? new JsonFormatter()
        : new TextFormatter(
            this.config.enableColors,
            this.config.enableTimestamp,
          );

    // 创建写入器
    if (this.config.enableConsole) {
      this.writers.push(new ConsoleWriter());
    }
  }

  /**
   * 检查是否应该记录此级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * 记录日志
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Partial<LogEntry>,
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      message,
      component: this.config.component || context?.component || 'Unknown',
      ...context,
    };

    if (this.config.format === 'json') {
      const formattedMessage = this.formatter.format(entry);
      for (const writer of this.writers) {
        writer.write(formattedMessage);
      }
    } else {
      // 对于文本格式，在浏览器环境中使用 console styling
      const textFormatter = this.formatter as TextFormatter;
      const parts: string[] = [];

      // 时间戳
      if (this.config.enableTimestamp) {
        const timestamp = new Date(entry.timestamp).toISOString();
        parts.push(`%c${timestamp}`, 'color: gray;');
      }

      // 日志级别
      const levelColor = this.getLevelColor(entry.level);
      parts.push(`%c${entry.levelName}`, levelColor);

      // 组件信息
      if (entry.component && entry.component !== 'Unknown') {
        parts.push(`%c[${entry.component}]`, 'color: teal;');
      }

      // 操作信息
      if (entry.operation) {
        parts.push(`%c{${entry.operation}}`, 'color: purple;');
      }

      // 主要消息
      parts.push(entry.message);

      // 上下文信息
      const contextStr = this.formatContext(entry);
      if (contextStr) {
        parts.push(`%c${contextStr}`, 'color: gray;');
      }

      // 持续时间
      if (entry.duration) {
        parts.push(`%c(${entry.duration}ms)`, 'color: gray;');
      }

      // 错误信息
      if (entry.error) {
        parts.push(`%c- ${entry.error.message}`, 'color: red;');
      }

      // 输出到控制台
      for (const writer of this.writers) {
        writer.write(parts[0], ...parts.slice(1));
      }
    }
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: 'color: teal;', // 青色
      [LogLevel.INFO]: 'color: green;', // 绿色
      [LogLevel.WARN]: 'color: orange;', // 橙色
      [LogLevel.ERROR]: 'color: red;', // 红色
      [LogLevel.FATAL]: 'color: purple;', // 紫色
    };
    return colors[level] || '';
  }

  private formatContext(entry: LogEntry): string {
    const contextParts: string[] = [];

    if (entry.serverId) contextParts.push(`server:${entry.serverId}`);
    if (entry.groupId) contextParts.push(`group:${entry.groupId}`);
    if (entry.toolName) contextParts.push(`tool:${entry.toolName}`);

    // 添加自定义上下文
    if (entry.context) {
      const contextObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry.context)) {
        contextObj[key] = value;
      }
      if (Object.keys(contextObj).length > 0) {
        return `[meta:${JSON.stringify(contextObj)}]`;
      }
    }

    return contextParts.length > 0 ? `[${contextParts.join(', ')}]` : '';
  }

  /**
   * 调试日志
   */
  debug(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 信息日志
   */
  info(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 警告日志
   */
  warn(message: string, context?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorInfo = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    this.log(LogLevel.ERROR, message, {
      ...context,
      error: errorInfo,
    });
  }

  /**
   * 致命错误日志
   */
  fatal(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorInfo = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    this.log(LogLevel.FATAL, message, {
      ...context,
      error: errorInfo,
    });
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 关闭日志记录器
   */
  close(): void {
    for (const writer of this.writers) {
      if (writer.close) {
        writer.close();
      }
    }
  }
}

/**
 * 创建前端日志记录器的工厂函数
 */
export function createFrontendLogger(
  config?: Partial<LoggerConfig>,
): FrontendLogger {
  return new FrontendLogger(config);
}

/**
 * 默认前端日志记录器实例
 */
export const frontendLogger = createFrontendLogger();
