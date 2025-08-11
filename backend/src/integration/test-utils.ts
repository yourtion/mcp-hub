/**
 * 集成测试工具函数
 * 提供测试中常用的工具和配置
 */

import { ConsoleLogger, LogLevel } from '../utils/logger.js';

/**
 * 创建测试专用的静默logger
 */
export function createTestLogger() {
  return new ConsoleLogger(LogLevel.ERROR); // 只显示错误日志
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
  } catch (error) {
    console.warn('JSON解析失败，返回原始文本:', await response.text());
    return { error: 'JSON_PARSE_ERROR', rawText: await response.text() };
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
  let lastError: Error;

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

  throw lastError!;
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
}

/**
 * 创建测试用的模拟服务器数据
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
  data: any,
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
