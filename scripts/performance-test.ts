#!/usr/bin/env tsx

/**
 * 性能测试脚本
 * 验证系统性能指标是否满足要求
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

interface PerformanceResult {
  test: string;
  duration: number;
  success: boolean;
  error?: string;
}

interface PerformanceReport {
  timestamp: string;
  results: PerformanceResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
  };
}

/**
 * 执行命令并测量性能
 */
async function measureCommand(
  command: string,
  args: string[],
  timeout = 30000,
): Promise<PerformanceResult> {
  const testName = `${command} ${args.join(' ')}`;
  const startTime = performance.now();

  try {
    const child = spawn(command, args, {
      stdio: 'pipe',
      timeout,
    });

    const result = await new Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // 设置超时
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`命令执行超时: ${testName}`));
      }, timeout);
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      test: testName,
      duration,
      success: result.code === 0,
      error: result.code !== 0 ? result.stderr : undefined,
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      test: testName,
      duration,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 运行性能测试套件
 */
async function runPerformanceTests(): Promise<PerformanceReport> {
  console.log('🚀 开始性能测试...\n');

  const tests = [
    // 核心包构建性能测试
    {
      name: '核心包构建',
      command: 'pnpm',
      args: ['--filter', '@mcp-core/mcp-knot-core', 'build'],
      expectedMaxDuration: 10000, // 10秒
    },
    // CLI包构建性能测试
    {
      name: 'CLI包构建',
      command: 'pnpm',
      args: ['--filter', '@mcp-core/mcp-knot-cli', 'build'],
      expectedMaxDuration: 10000, // 10秒
    },
    // 后端构建性能测试
    {
      name: '后端构建',
      command: 'pnpm',
      args: ['--filter', '@mcp-core/mcp-knot-api', 'build'],
      expectedMaxDuration: 15000, // 15秒
    },
    // 核心包测试性能
    {
      name: '核心包测试',
      command: 'pnpm',
      args: ['--filter', '@mcp-core/mcp-knot-core', 'test'],
      expectedMaxDuration: 20000, // 20秒
    },
    // 后端测试性能
    {
      name: '后端测试',
      command: 'pnpm',
      args: ['--filter', '@mcp-core/mcp-knot-api', 'test'],
      expectedMaxDuration: 30000, // 30秒
    },
  ];

  const results: PerformanceResult[] = [];

  for (const test of tests) {
    console.log(`⏱️  测试: ${test.name}`);
    const result = await measureCommand(test.command, test.args, test.expectedMaxDuration + 5000);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    const duration = `${Math.round(result.duration)}ms`;
    const expected = `(期望 < ${test.expectedMaxDuration}ms)`;

    console.log(`   ${status} ${duration} ${expected}`);

    if (!result.success) {
      console.log(`   错误: ${result.error}`);
    }

    if (result.duration > test.expectedMaxDuration) {
      console.log(`   ⚠️  性能警告: 执行时间超过预期`);
    }

    console.log('');
  }

  // 计算汇总统计
  const durations = results.map((r) => r.duration);
  const summary = {
    totalTests: results.length,
    passedTests: results.filter((r) => r.success).length,
    failedTests: results.filter((r) => !r.success).length,
    averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
  };

  return {
    timestamp: new Date().toISOString(),
    results,
    summary,
  };
}

/**
 * 生成性能报告
 */
function generateReport(report: PerformanceReport): void {
  console.log('📊 性能测试报告');
  console.log('='.repeat(50));
  console.log(`测试时间: ${report.timestamp}`);
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`通过测试: ${report.summary.passedTests}`);
  console.log(`失败测试: ${report.summary.failedTests}`);
  console.log(`平均耗时: ${Math.round(report.summary.averageDuration)}ms`);
  console.log(`最大耗时: ${Math.round(report.summary.maxDuration)}ms`);
  console.log(`最小耗时: ${Math.round(report.summary.minDuration)}ms`);
  console.log('');

  // 性能评估
  const performanceScore = calculatePerformanceScore(report);
  console.log(`性能评分: ${performanceScore}/100`);

  if (performanceScore >= 80) {
    console.log('🎉 性能表现优秀！');
  } else if (performanceScore >= 60) {
    console.log('👍 性能表现良好');
  } else {
    console.log('⚠️  性能需要优化');
  }

  console.log('');
  console.log('详细结果:');
  console.log('-'.repeat(50));

  report.results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = `${Math.round(result.duration)}ms`;
    console.log(`${index + 1}. ${status} ${result.test} - ${duration}`);

    if (result.error) {
      console.log(`   错误: ${result.error.slice(0, 100)}...`);
    }
  });
}

/**
 * 计算性能评分
 */
function calculatePerformanceScore(report: PerformanceReport): number {
  let score = 100;

  // 失败测试扣分
  score -= report.summary.failedTests * 20;

  // 平均耗时评分
  const avgDuration = report.summary.averageDuration;
  if (avgDuration > 20000) {
    score -= 20;
  } else if (avgDuration > 15000) {
    score -= 15;
  } else if (avgDuration > 10000) {
    score -= 10;
  } else if (avgDuration > 5000) {
    score -= 5;
  }

  // 最大耗时评分
  const maxDuration = report.summary.maxDuration;
  if (maxDuration > 30000) {
    score -= 15;
  } else if (maxDuration > 20000) {
    score -= 10;
  } else if (maxDuration > 15000) {
    score -= 5;
  }

  return Math.max(0, score);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const report = await runPerformanceTests();
    generateReport(report);

    // 如果有失败的测试，退出码为1
    if (report.summary.failedTests > 0) {
      process.exit(1);
    }

    // 如果性能评分过低，退出码为2
    const score = calculatePerformanceScore(report);
    if (score < 60) {
      console.log('\n❌ 性能测试未达到最低要求 (60分)');
      process.exit(2);
    }

    console.log('\n✅ 性能测试通过！');
  } catch (error) {
    console.error('❌ 性能测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}
