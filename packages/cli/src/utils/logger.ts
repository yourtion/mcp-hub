/**
 * CLI包日志系统
 * 为CLI提供可配置的日志级别和输出格式
 */

import * as os from 'node:os';
import * as path from 'node:path';
import {
  createLogger,
  type LogEntry,
  type LoggerConfig,
  LogLevel,
  StructuredLogger,
} from '@mcp-core/mcp-hub-core';

/**
 * CLI日志配置接口
 */
export interface CliLoggerConfig extends LoggerConfig {
  quiet?: boolean; // 静默模式
  verbose?: boolean; // 详细模式
  logDir?: string; // 日志目录
  enableTimestamp?: boolean; // 是否显示时间戳
}

/**
 * CLI默认日志配置
 */
export const DEFAULT_CLI_LOGGER_CONFIG: CliLoggerConfig = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
  format: 'text',
  enableColors: true,
  enableTimestamp: true,
  quiet: false,
  verbose: false,
  logDir: path.join(os.homedir(), '.mcp-hub', 'logs'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3,
  enableRotation: true,
};

/**
 * CLI专用文本格式化器
 */
export class CliTextFormatter {
  constructor(
    private enableColors: boolean = true,
    private enableTimestamp: boolean = true,
    private quiet: boolean = false,
  ) {}

  format(entry: LogEntry): string {
    if (this.quiet && entry.level < LogLevel.WARN) {
      return '';
    }

    const parts: string[] = [];

    // 时间戳
    if (this.enableTimestamp) {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      parts.push(this.colorize(timestamp, '\x1b[90m')); // 灰色
    }

    // 日志级别
    const levelColor = this.getLevelColor(entry.level);
    const levelName = this.quiet ? '' : `[${entry.levelName}]`;
    if (levelName) {
      parts.push(this.colorize(levelName, levelColor));
    }

    // 组件信息（仅在详细模式下显示）
    if (!this.quiet && entry.component !== 'Unknown') {
      parts.push(this.colorize(`[${entry.component}]`, '\x1b[36m')); // 青色
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
      parts.push(this.colorize(`错误: ${entry.error.message}`, '\x1b[31m')); // 红色
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

    return contextParts.length > 0 ? `[${contextParts.join(', ')}]` : '';
  }
}

/**
 * CLI日志记录器
 */
export class CliLogger extends StructuredLogger {
  private cliFormatter: CliTextFormatter;

  constructor(config: CliLoggerConfig = DEFAULT_CLI_LOGGER_CONFIG) {
    // 根据CLI特定配置调整日志级别
    const adjustedConfig = { ...config };

    if (config.quiet) {
      adjustedConfig.level = LogLevel.WARN;
    } else if (config.verbose) {
      adjustedConfig.level = LogLevel.DEBUG;
    }

    // 设置文件路径
    if (config.enableFile && config.logDir) {
      adjustedConfig.filePath = path.join(config.logDir, 'mcp-hub-cli.log');
    }

    super(adjustedConfig);

    this.cliFormatter = new CliTextFormatter(
      config.enableColors,
      config.enableTimestamp,
      config.quiet,
    );
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
    for (const [key, value] of Object.entries(config)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  /**
   * 显示服务器列表
   */
  showServers(
    servers: Array<{ id: string; status: string; tools: number }>,
  ): void {
    this.info('已配置的服务器:');
    for (const server of servers) {
      const statusIcon = server.status === 'connected' ? '🟢' : '🔴';
      console.log(`  ${statusIcon} ${server.id} (${server.tools} 个工具)`);
    }
  }

  /**
   * 显示工具列表
   */
  showTools(
    tools: Array<{ name: string; description?: string; serverId: string }>,
  ): void {
    this.info('可用工具:');
    for (const tool of tools) {
      const description = tool.description ? ` - ${tool.description}` : '';
      console.log(`  🔧 ${tool.name} [${tool.serverId}]${description}`);
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp(commands: Array<{ name: string; description: string }>): void {
    console.log('\n可用命令:');
    for (const cmd of commands) {
      console.log(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
    }
    console.log('');
  }
}

/**
 * 从命令行参数创建CLI日志记录器
 */
export function createCliLogger(options: {
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
  noColor?: boolean;
  logLevel?: string;
}): CliLogger {
  const config: CliLoggerConfig = {
    ...DEFAULT_CLI_LOGGER_CONFIG,
    verbose: options.verbose || false,
    quiet: options.quiet || false,
    enableColors: !options.noColor,
    enableFile: !!options.logFile,
  };

  // 设置日志级别
  if (options.logLevel) {
    const level =
      LogLevel[options.logLevel.toUpperCase() as keyof typeof LogLevel];
    if (level !== undefined) {
      config.level = level;
    }
  }

  // 设置日志文件路径
  if (options.logFile) {
    config.filePath = options.logFile;
  }

  return new CliLogger(config);
}

/**
 * 默认CLI日志记录器
 */
export const cliLogger = new CliLogger();
