/**
 * 端到端测试工具函数
 * 提供端到端测试中常用的工具和配置
 */

import { expect } from 'vitest';
import { ConsoleLogger, LogLevel } from '../utils/logger.js';

/**
 * 创建测试专用的静默logger
 */
export function createTestLogger() {
  return new ConsoleLogger(LogLevel.ERROR);
}

/**
 * 完全静默的logger，用于测试环境
 */
export class SilentLogger {
  debug() {}
  info() {}
  warn() {}
  error() {}
  logServerConnection() {}
  logToolDiscovery() {}
  logToolExecution() {}
  logConfigReload() {}
}

/**
 * 安全地解析JSON响应，处理可能的解析错误
 */
export async function safeJsonParse(response: Response): Promise<any> {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    return JSON.parse(text);
  } catch (_error) {
    // 如果JSON解析失败，返回错误信息和原始文本
    return { error: 'JSON_PARSE_ERROR', rawText: 'Unable to parse response' };
  }
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数，用于处理可能失败的异步操作
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 验证响应是否为有效的JSON
 */
export function isValidJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json') ?? false;
}

/**
 * 创建测试用的模拟工具数据
 */
export function createMockTool(name: string, serverId: string) {
  return {
    name,
    description: `测试工具 ${name}`,
    serverId,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: '输入参数' },
      },
      required: ['input'],
    },
    category: 'test',
    version: '1.0.0',
    deprecated: false,
  };
} /**
 * 创
建测试用的模拟服务器数据
 */
export function createMockServer(id: string, status: string = 'connected') {
  return {
    id,
    status,
    lastConnected: new Date().toISOString(),
    toolCount: 2,
    isHealthy: status === 'connected',
    tools: [
      createMockTool(`${id}_tool_1`, id),
      createMockTool(`${id}_tool_2`, id),
    ],
  };
}

/**
 * 验证API响应的基本结构
 */
export function validateApiResponse(
  data: Record<string, any>,
  requiredFields: string[],
): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return requiredFields.every((field) => Object.hasOwn(data, field));
}

/**
 * 测试环境变量设置
 */
export function setupTestEnvironment() {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'ERROR';

  // 禁用不必要的输出
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;

  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};

  return () => {
    // 恢复原始console方法
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
  };
}

/**
 * 清理测试环境
 */
export function cleanupTestEnvironment() {
  // 清理环境变量
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
}

/**
 * 创建测试场景数据
 */
export function createTestScenario(name: string, steps: string[]) {
  return {
    name,
    steps,
    startTime: Date.now(),
    results: [] as Array<{
      step: string;
      success: boolean;
      duration: number;
      error?: string;
    }>,
  };
}

/**
 * 执行测试场景步骤
 */
export async function executeScenarioStep<T>(
  scenario: ReturnType<typeof createTestScenario>,
  stepName: string,
  stepFunction: () => Promise<T>,
): Promise<T> {
  const stepStartTime = Date.now();

  try {
    const result = await stepFunction();
    const duration = Date.now() - stepStartTime;

    scenario.results.push({
      step: stepName,
      success: true,
      duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - stepStartTime;

    scenario.results.push({
      step: stepName,
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * 生成测试报告
 */
export function generateTestReport(
  scenario: ReturnType<typeof createTestScenario>,
) {
  const totalDuration = Date.now() - scenario.startTime;
  const successCount = scenario.results.filter((r) => r.success).length;
  const failureCount = scenario.results.filter((r) => !r.success).length;

  return {
    scenarioName: scenario.name,
    totalSteps: scenario.results.length,
    successCount,
    failureCount,
    successRate:
      scenario.results.length > 0
        ? (successCount / scenario.results.length) * 100
        : 0,
    totalDuration,
    averageStepDuration:
      scenario.results.length > 0
        ? scenario.results.reduce((sum, r) => sum + r.duration, 0) /
          scenario.results.length
        : 0,
    steps: scenario.results,
  };
}

/**
 * 验证端到端测试结果
 */
export function validateE2EResult(
  result: any,
  expectedStatus: number,
  requiredFields?: string[],
) {
  expect(result.status).toBe(expectedStatus);

  if (requiredFields && result.status === 200) {
    const data = result.data || result;
    for (const field of requiredFields) {
      expect(data).toHaveProperty(field);
    }
  }

  return result;
}

/**
 * 创建性能测试基准
 */
export function createPerformanceBenchmark(name: string) {
  return {
    name,
    startTime: Date.now(),
    measurements: [] as Array<{
      operation: string;
      duration: number;
      timestamp: number;
    }>,
  };
}

/**
 * 记录性能测量
 */
export function recordPerformanceMeasurement(
  benchmark: ReturnType<typeof createPerformanceBenchmark>,
  operation: string,
  duration: number,
) {
  benchmark.measurements.push({
    operation,
    duration,
    timestamp: Date.now(),
  });
}

/**
 * 生成性能报告
 */
export function generatePerformanceReport(
  benchmark: ReturnType<typeof createPerformanceBenchmark>,
) {
  const totalDuration = Date.now() - benchmark.startTime;
  const measurements = benchmark.measurements;

  if (measurements.length === 0) {
    return {
      benchmarkName: benchmark.name,
      totalDuration,
      measurementCount: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
    };
  }

  const durations = measurements.map((m) => m.duration);
  const averageDuration =
    durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  return {
    benchmarkName: benchmark.name,
    totalDuration,
    measurementCount: measurements.length,
    averageDuration,
    minDuration,
    maxDuration,
    measurements,
  };
}
