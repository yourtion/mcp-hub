#!/usr/bin/env tsx
/**
 * 端到端测试运行脚本
 * 提供独立的端到端测试执行环境
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestOptions {
  pattern?: string;
  timeout?: number;
  verbose?: boolean;
  coverage?: boolean;
  bail?: boolean;
}

class E2ETestRunner {
  private readonly projectRoot: string;
  private readonly backendDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.backendDir = this.projectRoot; // 当前目录就是backend目录
  }

  async runTests(options: TestOptions = {}) {
    console.log('🚀 启动端到端测试...\n');

    // 验证环境
    if (!this.validateEnvironment()) {
      process.exit(1);
    }

    // 设置测试环境变量
    this.setupTestEnvironment();

    // 构建测试命令
    const command = this.buildTestCommand(options);

    console.log(`执行命令: ${command.join(' ')}\n`);

    // 运行测试
    const success = await this.executeTests(command);

    if (success) {
      console.log('\n✅ 端到端测试完成');
      process.exit(0);
    } else {
      console.log('\n❌ 端到端测试失败');
      process.exit(1);
    }
  }

  private validateEnvironment(): boolean {
    console.log('🔍 验证测试环境...');

    // 检查必要文件
    const requiredFiles = ['package.json', 'vitest.config.ts', 'src/e2e/index.test.ts'];

    for (const file of requiredFiles) {
      const filePath = join(this.backendDir, file);
      if (!existsSync(filePath)) {
        console.error(`❌ 缺少必要文件: ${file}`);
        return false;
      }
    }

    console.log('✅ 环境验证通过');
    return true;
  }

  private setupTestEnvironment() {
    console.log('⚙️  设置测试环境变量...');

    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.TEST_ENV = 'e2e';
    process.env.LOG_LEVEL = 'ERROR';

    // 禁用不必要的输出
    process.env.VITEST_REPORTER = 'verbose';

    console.log('✅ 环境变量设置完成');
  }

  private buildTestCommand(options: TestOptions): string[] {
    const command = ['npx', 'vitest'];

    // 测试模式
    command.push('run');

    // 测试文件模式
    if (options.pattern) {
      command.push(options.pattern);
    } else {
      // 明确指定要运行的端到端测试文件
      command.push(
        'src/e2e/index.test.ts',
        'src/e2e/stable-tests.test.ts',
        'src/e2e/quick-scenarios.test.ts',
      );
    }

    // 超时设置
    if (options.timeout) {
      command.push('--testTimeout', options.timeout.toString());
    }

    // 详细输出
    if (options.verbose) {
      command.push('--reporter=verbose');
    }

    // 覆盖率
    if (options.coverage) {
      command.push('--coverage');
    }

    // 快速失败
    if (options.bail) {
      command.push('--bail');
    }

    // 其他配置
    command.push('--config', 'vitest.config.ts');

    return command;
  }

  private executeTests(command: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: this.backendDir,
        stdio: 'inherit',
        env: { ...process.env },
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', (error) => {
        console.error('测试执行错误:', error);
        resolve(false);
      });
    });
  }
}

// 命令行参数解析
function parseArguments(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--pattern':
      case '-p':
        options.pattern = args[++i];
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i], 10);
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--bail':
      case '-b':
        options.bail = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
端到端测试运行器

用法: tsx run-e2e-tests.ts [选项]

选项:
  -p, --pattern <pattern>    测试文件模式 (默认: src/e2e/**/*.test.ts)
  -t, --timeout <ms>         测试超时时间 (毫秒)
  -v, --verbose              详细输出
  -c, --coverage             生成覆盖率报告
  -b, --bail                 遇到失败时立即停止
  -h, --help                 显示帮助信息

示例:
  tsx run-e2e-tests.ts                           # 运行所有端到端测试
  tsx run-e2e-tests.ts -p "**/*user*.test.ts"   # 运行用户相关测试
  tsx run-e2e-tests.ts -v -c                     # 详细输出并生成覆盖率
  tsx run-e2e-tests.ts -t 60000                  # 设置60秒超时
`);
}

// 主函数
async function main() {
  try {
    const options = parseArguments();
    const runner = new E2ETestRunner();
    await runner.runTests(options);
  } catch (error) {
    console.error('运行端到端测试时发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}

export { E2ETestRunner, type TestOptions };
