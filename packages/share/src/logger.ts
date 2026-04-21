/**
 * 统一的日志系统
 * 为所有模块提供一致的日志功能
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
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableRotation?: boolean;
  format: 'json' | 'text';
  enableColors?: boolean;
  enableTimestamp?: boolean;
  component?: string;
}

/**
 * 环境检测工具函数
 */
export const EnvironmentDetector = {
  /**
   * 检查是否在测试环境中
   */
  isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || !!process.env.VITEST;
  },

  /**
   * 检查是否启用调试模式
   */
  isDebugMode(): boolean {
    return process.env.VITEST_DEBUG === 'true' || process.env.DEBUG === 'true';
  },

  /**
   * 获取环境适配的日志级别
   */
  getEnvironmentLogLevel(defaultLevel: LogLevel = LogLevel.INFO): LogLevel {
    // 如果设置了 LOG_LEVEL 环境变量，优先使用
    if (process.env.LOG_LEVEL) {
      const envLevel = LogLevel[process.env.LOG_LEVEL.toUpperCase() as keyof typeof LogLevel];
      if (envLevel !== undefined) {
        return envLevel;
      }
    }

    // 测试环境中，如果没有启用调试模式，则使用 WARN 级别
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
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
      parts.push(this.colorize(timestamp, '\x1b[90m')); // 灰色
    }

    // 日志级别
    const levelColor = this.getLevelColor(entry.level);
    parts.push(this.colorize(entry.levelName, levelColor));

    // 组件信息
    if (entry.component && entry.component !== 'Unknown') {
      parts.push(this.colorize(`[${entry.component}]`, '\x1b[36m')); // 青色
    }

    // 操作信息
    if (entry.operation) {
      parts.push(this.colorize(`{${entry.operation}}`, '\x1b[35m')); // 紫色
    }

    // 主要消息
    parts.push(entry.message);

    // 上下文信息
    const context = this.formatContext(entry);
    if (context) {
      parts.push(this.colorize(context, '\x1b[90m')); // 灰色
    }

    // 持续时间
    if (entry.duration) {
      parts.push(this.colorize(`(${entry.duration}ms)`, '\x1b[90m'));
    }

    // 错误信息
    if (entry.error) {
      parts.push(this.colorize(`- ${entry.error.message}`, '\x1b[31m')); // 红色
    }

    return parts.filter(Boolean).join(' ');
  }

  private colorize(text: string, color: string): string {
    if (!this.enableColors) return text;
    return `${color}${text}\x1b[0m`;
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // 青色
      [LogLevel.INFO]: '\x1b[32m', // 绿色
      [LogLevel.WARN]: '\x1b[33m', // 黄色
      [LogLevel.ERROR]: '\x1b[31m', // 红色
      [LogLevel.FATAL]: '\x1b[35m', // 紫色
    };
    return colors[level] || '\x1b[0m';
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
  write(formattedMessage: string): void;
  close?(): void;
}

/**
 * 控制台写入器
 */
export class ConsoleWriter implements LogWriter {
  write(formattedMessage: string): void {
    console.log(formattedMessage);
  }
}

/**
 * 默认日志配置
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: EnvironmentDetector.getEnvironmentLogLevel(LogLevel.INFO),
  enableConsole: EnvironmentDetector.getEnvironmentConsoleEnabled(true),
  enableFile: false,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableRotation: true,
  format: 'text',
  enableColors: true,
  enableTimestamp: true,
};

/**
 * 统一的结构化日志记录器
 */
export class UnifiedLogger {
  private config: LoggerConfig;
  private formatter: LogFormatter;
  private writers: LogWriter[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };

    // 创建格式化器
    this.formatter =
      this.config.format === 'json'
        ? new JsonFormatter()
        : new TextFormatter(this.config.enableColors, this.config.enableTimestamp);

    // 创建写入器
    if (this.config.enableConsole) {
      this.writers.push(new ConsoleWriter());
    }

    // TODO: 文件写入器可以后续添加
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
  private log(level: LogLevel, message: string, context?: Partial<LogEntry>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      levelName: LOG_LEVEL_NAMES[level],
      message,
      component: this.config.component || context?.component || 'Unknown',
      ...context,
    };

    const formattedMessage = this.formatter.format(entry);

    for (const writer of this.writers) {
      writer.write(formattedMessage);
    }
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
 * CLI 专用的日志记录器
 * 提供 CLI 特有的显示方法
 */
export class CliLogger extends UnifiedLogger {
  constructor(config: Partial<LoggerConfig> = {}) {
    super({
      ...config,
      component: 'CLI',
    });
  }

  /**
   * CLI专用的成功消息
   */
  success(message: string, context?: Partial<LogEntry>): void {
    this.info(`✅ ${message}`, context);
  }

  /**
   * CLI专用的警告消息
   */
  warning(message: string, context?: Partial<LogEntry>): void {
    this.warn(`⚠️  ${message}`, context);
  }

  /**
   * CLI专用的错误消息
   */
  failure(message: string, error?: Error, context?: Partial<LogEntry>): void {
    this.error(`❌ ${message}`, error, context);
  }

  /**
   * CLI专用的进度消息
   */
  progress(message: string, context?: Partial<LogEntry>): void {
    this.info(`🔄 ${message}`, context);
  }

  /**
   * 显示启动横幅
   */
  showBanner(version: string): void {
    // 在测试环境的静默模式下不显示横幅
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
      return;
    }

    const banner = [
      '',
      '╭─────────────────────────────────────╮',
      '│           MCP Hub CLI               │',
      `│           版本 ${version.padEnd(20)} │`,
      '╰─────────────────────────────────────╯',
      '',
    ].join('\n');

    console.log(this.colorize(banner, '\x1b[36m')); // 青色
  }

  /**
   * 颜色化文本
   */
  private colorize(text: string, color: string): string {
    return `${color}${text}\x1b[0m`;
  }

  /**
   * 显示配置信息
   */
  showConfig(config: Record<string, unknown>): void {
    this.info('当前配置:');
    // 在测试环境的静默模式下不直接使用 console.log
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
      return;
    }
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  /**
   * 显示服务器列表
   */
  showServers(servers: Array<{ id: string; status: string; tools: number }>): void {
    this.info('已配置的服务器:');
    // 在测试环境的静默模式下不直接使用 console.log
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
      return;
    }
    for (const server of servers) {
      const statusIcon = server.status === 'connected' ? '🟢' : '🔴';
      console.log(`  ${statusIcon} ${server.id} (${server.tools} 个工具)`);
    }
  }

  /**
   * 显示工具列表
   */
  showTools(tools: Array<{ name: string; description?: string; serverId: string }>): void {
    this.info('可用工具:');
    // 在测试环境的静默模式下不直接使用 console.log
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
      return;
    }
    for (const tool of tools) {
      const description = tool.description ? ` - ${tool.description}` : '';
      console.log(`  🔧 ${tool.name} [${tool.serverId}]${description}`);
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp(commands: Array<{ name: string; description: string }>): void {
    // 在测试环境的静默模式下不直接使用 console.log
    if (EnvironmentDetector.isTestEnvironment() && !EnvironmentDetector.isDebugMode()) {
      return;
    }
    console.log('\n可用命令:');
    for (const cmd of commands) {
      console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
    }
    console.log('');
  }
}

/**
 * MCP 专用的日志记录器
 * 提供 MCP 操作特有的日志方法
 */
export class McpLogger extends UnifiedLogger {
  constructor(config: Partial<LoggerConfig> = {}) {
    super({
      ...config,
      component: config.component || 'MCP',
    });
  }

  /**
   * 记录服务器连接事件
   */
  logServerConnection(
    serverId: string,
    status: 'connected' | 'disconnected' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Server ${status}`;

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, { serverId, ...context });
    } else {
      this.info(message, { serverId, ...context });
    }
  }

  /**
   * 记录工具发现事件
   */
  logToolDiscovery(serverId: string, toolCount: number, context?: Record<string, unknown>): void {
    const message = `Discovered ${toolCount} tools`;
    this.info(message, { serverId, ...context });
  }

  /**
   * 记录工具执行事件
   */
  logToolExecution(
    toolName: string,
    groupId: string,
    status: 'started' | 'completed' | 'failed',
    context?: Record<string, unknown>,
  ): void {
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Tool execution ${status}`;

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, { toolName, groupId, ...context });
    } else {
      this.info(message, { toolName, groupId, ...context });
    }
  }

  /**
   * 记录配置重载事件
   */
  logConfigReload(changes: string[], context?: Record<string, unknown>): void {
    const message = `Configuration reloaded with changes: ${changes.join(', ')}`;
    this.info(message, context);
  }
}

/**
 * 创建统一日志记录器的工厂函数
 */
export function createLogger(config?: Partial<LoggerConfig>): UnifiedLogger {
  return new UnifiedLogger(config);
}

/**
 * 创建 CLI 日志记录器的工厂函数
 */
export function createCliLogger(config?: Partial<LoggerConfig>): CliLogger {
  return new CliLogger(config);
}

/**
 * 创建 MCP 日志记录器的工厂函数
 */
export function createMcpLogger(config?: Partial<LoggerConfig>): McpLogger {
  return new McpLogger(config);
}

/**
 * 默认日志记录器实例
 */
export const logger = createLogger();
