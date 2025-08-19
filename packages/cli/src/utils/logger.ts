/**
 * CLI包日志系统
 * 基于统一的 logger 系统，提供 CLI 特有的功能
 */

import * as os from 'node:os';
import * as path from 'node:path';
import {
  CliLogger as BaseCliLogger,
  EnvironmentDetector,
  type LoggerConfig,
  LogLevel,
} from '@mcp-core/mcp-hub-share';

/**
 * CLI日志配置接口
 */
export interface CliLoggerConfig extends LoggerConfig {
  quiet?: boolean; // 静默模式
  verbose?: boolean; // 详细模式
  logDir?: string; // 日志目录
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
  quiet:
    EnvironmentDetector.isTestEnvironment() &&
    !EnvironmentDetector.isDebugMode(),
  verbose: false,
  logDir: path.join(os.homedir(), '.mcp-hub', 'logs'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3,
  enableRotation: true,
};

/**
 * CLI日志记录器
 * 扩展了基础的 CliLogger，添加了 CLI 特有的配置处理
 */
export class CliLogger extends BaseCliLogger {
  constructor(config: CliLoggerConfig = DEFAULT_CLI_LOGGER_CONFIG) {
    // 处理 CLI 特有的配置
    const adjustedConfig = { ...config };

    // 在测试环境中，如果没有明确设置 quiet，则自动启用静默模式
    if (EnvironmentDetector.isTestEnvironment() && config.quiet === undefined) {
      adjustedConfig.quiet = !EnvironmentDetector.isDebugMode();
    }

    // 处理 verbose 和 quiet 的优先级
    if (config.verbose) {
      adjustedConfig.level = LogLevel.DEBUG;
      adjustedConfig.quiet = false;
    } else if (adjustedConfig.quiet) {
      adjustedConfig.level = LogLevel.WARN;
      // 在测试环境的静默模式下禁用控制台输出
      if (
        EnvironmentDetector.isTestEnvironment() &&
        config.enableConsole !== true
      ) {
        adjustedConfig.enableConsole = false;
      }
    }

    // 设置文件路径
    if (config.enableFile && config.logDir) {
      adjustedConfig.filePath = path.join(config.logDir, 'mcp-hub-cli.log');
    }

    super(adjustedConfig);
  }
}

/**
 * 从命令行参数创建CLI日志记录器
 */
export function createCliLoggerFromOptions(
  options: {
    verbose?: boolean;
    quiet?: boolean;
    logFile?: string;
    noColor?: boolean;
    logLevel?: string;
  } = {},
): CliLogger {
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
