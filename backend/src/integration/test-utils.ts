/**
 * 集成测试工具函数
 * 提供测试中常用的工具和配置
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
  testConfigDir = path.join(tmpdir(), `mcp-knot-test-${Date.now()}`);
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
      { cause: error },
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

  // 3. system.json - 基本系统配置
  const systemConfig = {
    server: {
      port: 3000,
      host: 'localhost',
    },
    auth: {
      jwt: {
        secret: 'test-secret-key',
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'mcp-knot-test',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
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
      title: 'MCP Knot Test',
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
export async function safeJsonParse(response: Response): Promise<unknown> {
  let text: string | null = null;

  try {
    // 只读取一次body
    text = await response.text();

    if (!text.trim()) {
      return null;
    }

    return JSON.parse(text);
  } catch (error) {
    // 返回错误信息，使用已读取的文本（如果可用）
    console.warn('JSON解析失败:', error instanceof Error ? error.message : 'Unknown error');

    return {
      error: 'JSON_PARSE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      status: response.status,
      // 如果已经读取了文本，包含它；否则只返回错误信息
      ...(text && { rawText: text }),
    };
  }
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 重试函数，用于处理可能失败的异步操作
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

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

  throw lastError ?? new Error('All retry attempts failed');
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
