#!/usr/bin/env node

/**
 * MCP Hub CLI 主入口文件
 * 处理命令行参数并启动MCP服务器
 */

import { CliConfigManager } from './config/cli-config-manager';
import type { ConfigTemplateType } from './config/config-template';
import { CliMcpServer } from './server/cli-mcp-server';
import type { CliError } from './types';

/**
 * 命令行选项接口
 */
interface CliOptions {
  configPath: string;
  verbose: boolean;
  help: boolean;
  version: boolean;
  generateConfig: boolean;
  templateType: ConfigTemplateType;
  validateConfig: boolean;
  listTemplates: boolean;
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    configPath: './mcp_service.json',
    verbose: false,
    help: false,
    version: false,
    generateConfig: false,
    templateType: 'basic',
    validateConfig: false,
    listTemplates: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '--version':
        options.version = true;
        break;
      case '-c':
      case '--config':
        if (i + 1 < args.length) {
          options.configPath = args[++i];
        } else {
          throw new Error('--config 选项需要指定配置文件路径');
        }
        break;
      case '--generate-config':
        options.generateConfig = true;
        break;
      case '--template':
        if (i + 1 < args.length) {
          const templateType = args[++i] as ConfigTemplateType;
          if (
            ['basic', 'advanced', 'development', 'production'].includes(
              templateType,
            )
          ) {
            options.templateType = templateType;
          } else {
            throw new Error(`无效的模板类型: ${templateType}`);
          }
        } else {
          throw new Error('--template 选项需要指定模板类型');
        }
        break;
      case '--validate':
        options.validateConfig = true;
        break;
      case '--list-templates':
        options.listTemplates = true;
        break;
      default:
        // 如果不是选项，则作为配置文件路径
        if (
          !arg.startsWith('-') &&
          options.configPath === './mcp_service.json'
        ) {
          options.configPath = arg;
        }
        break;
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
MCP Hub CLI - 聚合多个MCP服务的命令行界面

用法:
  mcp-hub [选项] [配置文件路径]

选项:
  -h, --help              显示帮助信息
  -v, --verbose           启用详细日志输出
  --version               显示版本信息
  -c, --config <path>     指定配置文件路径 (默认: ./mcp_service.json)
  --generate-config       生成配置文件模板
  --template <type>       指定配置模板类型 (basic, advanced, development, production)
  --validate              验证配置文件
  --list-templates        列出所有可用的配置模板

示例:
  mcp-hub                                    # 使用默认配置文件
  mcp-hub config.json                        # 使用指定配置文件
  mcp-hub -c config.json -v                  # 使用指定配置文件并启用详细日志
  mcp-hub --generate-config                  # 生成基础配置模板
  mcp-hub --generate-config --template advanced  # 生成高级配置模板
  mcp-hub --validate -c config.json          # 验证配置文件
  mcp-hub --list-templates                   # 列出所有模板类型

配置文件格式:
  {
    "servers": {
      "server_name": {
        "command": "node",
        "args": ["server.js"],
        "env": {},
        "disabled": false
      }
    },
    "logging": {
      "level": "info"
    },
    "transport": {
      "type": "stdio"
    }
  }
`);
}

/**
 * 显示版本信息
 */
function showVersion(): void {
  console.log('MCP Hub CLI v1.0.0');
}

/**
 * 生成配置文件模板
 */
async function generateConfig(templateType: ConfigTemplateType): Promise<void> {
  const configManager = new CliConfigManager();
  const template = configManager.getConfigTemplateWithComments(templateType);

  console.log(`# MCP Hub CLI 配置文件模板 (${templateType})`);
  console.log('# 将以下内容保存为 mcp_service.json');
  console.log('');
  console.log(template);
}

/**
 * 验证配置文件
 */
async function validateConfig(configPath: string): Promise<void> {
  const configManager = new CliConfigManager();

  try {
    console.log(`验证配置文件: ${configPath}`);

    // 加载配置
    const config = await configManager.loadConfig(configPath);

    // 详细验证
    const result = configManager.validateConfigDetailed(config);

    // 显示验证结果
    console.log('\n' + configManager.formatValidationResult(result));

    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    handleCliError(error);
    process.exit(1);
  }
}

/**
 * 列出所有可用的配置模板
 */
async function listTemplates(): Promise<void> {
  const configManager = new CliConfigManager();
  const templates = configManager.getAvailableTemplates();

  console.log('可用的配置模板:');
  console.log('');

  for (const template of templates) {
    console.log(`  ${template.type.padEnd(12)} - ${template.description}`);
  }

  console.log('');
  console.log('使用方法:');
  console.log('  mcp-hub --generate-config --template <type>');
}

/**
 * 设置日志级别
 */
function setupLogging(verbose: boolean): void {
  if (verbose) {
    // 在详细模式下显示调试信息
    const originalLog = console.log;
    const originalDebug = console.debug;

    console.debug = (...args: any[]) => {
      originalLog('[DEBUG]', ...args);
    };
  } else {
    // 在非详细模式下隐藏调试信息
    console.debug = () => {};
  }
}

/**
 * 处理CLI错误
 */
function handleCliError(error: unknown): void {
  if (isCliError(error)) {
    console.error(`错误 (${error.code}): ${error.message}`);

    if (error.details) {
      console.error('详细信息:', error.details);
    }

    // 根据错误类型提供帮助信息
    switch (error.code) {
      case 'CONFIG_FILE_NOT_FOUND':
        console.error('\n提示: 使用 --generate-config 生成配置文件模板');
        break;
      case 'INVALID_CONFIG_FORMAT':
        console.error('\n提示: 检查配置文件的JSON格式是否正确');
        break;
    }
  } else if (error instanceof Error) {
    console.error('错误:', error.message);
  } else {
    console.error('未知错误:', error);
  }
}

/**
 * 检查是否为CLI错误
 */
function isCliError(error: unknown): error is CliError {
  return error instanceof Error && 'code' in error;
}

/**
 * 主函数 - 启动CLI MCP服务器
 */
async function main() {
  try {
    // 解析命令行参数
    const options = parseArgs(process.argv.slice(2));

    // 设置日志级别
    setupLogging(options.verbose);

    // 处理特殊选项
    if (options.help) {
      showHelp();
      return;
    }

    if (options.version) {
      showVersion();
      return;
    }

    if (options.listTemplates) {
      await listTemplates();
      return;
    }

    if (options.generateConfig) {
      await generateConfig(options.templateType);
      return;
    }

    if (options.validateConfig) {
      await validateConfig(options.configPath);
      return;
    }

    console.log('启动MCP Hub CLI服务器...');
    console.log(`配置文件: ${options.configPath}`);

    // 创建配置管理器
    const configManager = new CliConfigManager();

    // 加载配置
    const config = await configManager.loadConfig(options.configPath);

    // 应用详细模式到配置
    if (options.verbose && config.logging.level === 'info') {
      config.logging.level = 'debug';
    }

    // 创建并启动CLI MCP服务器
    const server = new CliMcpServer();
    await server.initialize(config);
    await server.start();

    console.log('MCP Hub CLI服务器启动成功');
    console.log('等待MCP客户端连接...');

    // 处理优雅关闭
    const shutdown = async (signal: string) => {
      console.log(`\n收到 ${signal} 信号，正在关闭MCP Hub CLI服务器...`);
      try {
        await server.shutdown();
        console.log('MCP Hub CLI服务器已安全关闭');
        process.exit(0);
      } catch (error) {
        console.error('关闭服务器时出错:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('未捕获的异常:', error);
      shutdown('uncaughtException').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('未处理的Promise拒绝:', reason, 'at:', promise);
      shutdown('unhandledRejection').catch(() => process.exit(1));
    });
  } catch (error) {
    handleCliError(error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main().catch((error) => {
    handleCliError(error);
    process.exit(1);
  });
}
