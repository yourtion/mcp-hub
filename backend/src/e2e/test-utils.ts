/**
 * 端到端测试工具函数
 * 提供端到端测试中常用的工具和配置
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';

import { ConsoleLogger, LogLevel } from '../utils/logger.js';

// 测试配置目录路径
let testConfigDir: string | null = null;

/**
 * 创建测试配置目录并写入测试配置文件
 * @param enableAuth 是否启用认证，默认为 true
 */
export function setupTestConfig(enableAuth: boolean = true): string {
  if (testConfigDir) {
    return testConfigDir; // 已经设置过了
  }

  // 创建临时配置目录
  testConfigDir = path.join(tmpdir(), `mcp-hub-e2e-test-${Date.now()}`);
  mkdirSync(testConfigDir, { recursive: true });

  // 设置环境变量（在创建文件前设置）
  process.env.CONFIG_PATH = testConfigDir;

  // 立即验证目录可写
  try {
    const testFile = path.join(testConfigDir, '.test-write');
    writeFileSync(testFile, 'test');
    rmSync(testFile);
  } catch (error) {
    throw new Error(
      `测试配置目录不可写: ${testConfigDir}. 错误: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 写入测试配置文件

  // 1. group.json - 测试组配置
  const groupConfig = {
    default: {
      id: 'default',
      name: '默认组',
      description: '默认测试组',
      servers: ['test-server-1'],
      tools: [],
    },
    'test-group-1': {
      id: 'test-group-1',
      name: '测试组 1',
      description: '第一个测试组',
      servers: ['test-server-1'],
      tools: [],
    },
    'test-group-2': {
      id: 'test-group-2',
      name: '测试组 2',
      description: '第二个测试组',
      servers: ['test-server-1', 'test-server-2'],
      tools: [],
    },
  };
  writeFileSync(path.join(testConfigDir, 'group.json'), JSON.stringify(groupConfig, null, 2));

  // 2. mcp_server.json - 测试 MCP 服务器配置
  const mcpServerConfig = {
    servers: {
      'test-server-1': {
        type: 'stdio',
        command: 'echo',
        args: ['test'],
        env: {},
      },
      'test-server-2': {
        type: 'stdio',
        command: 'echo',
        args: ['test2'],
        env: {},
      },
    },
  };
  writeFileSync(
    path.join(testConfigDir, 'mcp_server.json'),
    JSON.stringify(mcpServerConfig, null, 2),
  );

  // 2.5. api_tools.json - API工具配置（空文件用于测试）
  writeFileSync(
    path.join(testConfigDir, 'api_tools.json'),
    JSON.stringify({ configs: [] }, null, 2),
  );

  // 3. system.json - 基本系统配置
  const systemConfig = {
    server: {
      port: 3000,
      host: 'localhost',
    },
    apiToolsConfigPath: path.join(testConfigDir, 'api_tools.json'),
    auth: {
      jwt: {
        secret: 'test-secret-key-for-testing-only',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'mcp-hub-test',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15 minutes
        passwordMinLength: 6,
        requireStrongPassword: false,
      },
    },
    users: enableAuth
      ? {
          admin: {
            id: 'admin-user-id',
            username: 'admin',
            password: 'admin123',
            role: 'admin',
            groups: [],
            createdAt: new Date().toISOString(),
            enabled: true,
          },
        }
      : {},
    ui: {
      title: 'MCP Hub Test',
      theme: 'light',
      features: {
        apiToMcp: true,
        debugging: true,
        monitoring: true,
      },
    },
    monitoring: {
      metricsEnabled: true,
      logLevel: 'error',
      retentionDays: 7,
    },
  };
  writeFileSync(path.join(testConfigDir, 'system.json'), JSON.stringify(systemConfig, null, 2));

  return testConfigDir;
}

/**
 * 清理测试配置目录
 */
export function cleanupTestConfig(): void {
  if (testConfigDir && existsSync(testConfigDir)) {
    try {
      rmSync(testConfigDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理测试配置目录失败:', error);
    }
  }
  testConfigDir = null;
  delete process.env.CONFIG_PATH;
}

/**
 * 创建带认证的请求辅助函数
 * @param testApp 测试应用实例
 * @param authToken 认证token
 * @returns 带认证的请求函数
 */
// test utility for dynamic app type
export function createAuthenticatedRequest(
  testApp: { request: (path: string, init?: RequestInit) => Response | Promise<Response> },
  authToken: string,
) {
  return async (path: string, init?: RequestInit) => {
    const headers = {
      ...init?.headers,
      Authorization: `Bearer ${authToken}`,
    };
    return testApp.request(path, { ...init, headers });
  };
}

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- e2e test utility, dynamic JSON parsing
// biome-ignore lint/suspicious/noExplicitAny: dynamic JSON parsing
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
    tools: [createMockTool(`${id}_tool_1`, id), createMockTool(`${id}_tool_2`, id)],
  };
}

/**
 * 验证API响应的基本结构
 */
export function validateApiResponse(
  data: Record<string, unknown>,
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
export function generateTestReport(scenario: ReturnType<typeof createTestScenario>) {
  const totalDuration = Date.now() - scenario.startTime;
  const successCount = scenario.results.filter((r) => r.success).length;
  const failureCount = scenario.results.filter((r) => !r.success).length;

  return {
    scenarioName: scenario.name,
    totalSteps: scenario.results.length,
    successCount,
    failureCount,
    successRate: scenario.results.length > 0 ? (successCount / scenario.results.length) * 100 : 0,
    totalDuration,
    averageStepDuration:
      scenario.results.length > 0
        ? scenario.results.reduce((sum, r) => sum + r.duration, 0) / scenario.results.length
        : 0,
    steps: scenario.results,
  };
}

/**
 * 验证端到端测试结果
 */
export function validateE2EResult(
  result: Record<string, unknown>,
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
  const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
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
