/**
 * 端到端测试配置
 * 定义端到端测试的全局配置和设置
 */

import { expect } from 'vitest';

export interface E2ETestConfig {
  // 测试超时设置
  timeout: {
    default: number;
    long: number;
    short: number;
  };

  // 重试配置
  retry: {
    maxAttempts: number;
    delay: number;
  };

  // 性能基准
  performance: {
    maxResponseTime: number;
    maxMemoryIncrease: number;
    concurrentRequestLimit: number;
  };

  // 测试数据
  testData: {
    mockGroupCount: number;
    mockToolCount: number;
    testRequestCount: number;
  };
}

export const defaultE2EConfig: E2ETestConfig = {
  timeout: {
    default: 10000, // 10秒
    long: 30000, // 30秒
    short: 5000, // 5秒
  },

  retry: {
    maxAttempts: 3,
    delay: 1000, // 1秒
  },

  performance: {
    maxResponseTime: 5000, // 5秒
    maxMemoryIncrease: 100 * 1024 * 1024, // 100MB
    concurrentRequestLimit: 10,
  },

  testData: {
    mockGroupCount: 5,
    mockToolCount: 10,
    testRequestCount: 20,
  },
};

/**
 * 测试场景定义
 */
export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  timeout?: number;
  retryable?: boolean;
}

export interface TestStep {
  name: string;
  action: () => Promise<unknown>;
  validation: (result: unknown) => void;
  timeout?: number;
}

/**
 * 预定义的测试场景
 */
export const testScenarios: TestScenario[] = [
  {
    name: 'new-user-onboarding',
    description: '新用户首次使用完整流程',
    steps: [
      {
        name: 'check-system-status',
        action: async () => ({ status: 'healthy' }),
        validation: (result) => {
          const typedResult = result as { status: string };
          expect(typedResult.status).toBe('healthy');
        },
      },
      {
        name: 'discover-groups',
        action: async () => ({ groups: [] }),
        validation: (result) => {
          const typedResult = result as { groups: unknown[] };
          expect(Array.isArray(typedResult.groups)).toBe(true);
        },
      },
    ],
  },
  {
    name: 'admin-monitoring',
    description: '管理员监控和诊断流程',
    steps: [
      {
        name: 'system-health-check',
        action: async () => ({ healthy: true }),
        validation: (result) => {
          const typedResult = result as { healthy: boolean };
          expect(typedResult.healthy).toBe(true);
        },
      },
    ],
  },
];

/**
 * 测试环境配置
 */
export interface TestEnvironment {
  name: string;
  baseUrl: string;
  timeout: number;
  retries: number;
}

export const testEnvironments: Record<string, TestEnvironment> = {
  local: {
    name: 'Local Development',
    baseUrl: 'http://localhost:3000',
    timeout: 10000,
    retries: 3,
  },
  ci: {
    name: 'CI Environment',
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
    retries: 5,
  },
};

/**
 * 获取当前测试环境配置
 */
export function getCurrentTestEnvironment(): TestEnvironment {
  const envName = process.env.TEST_ENV || 'local';
  return testEnvironments[envName] || testEnvironments.local;
}

/**
 * 测试数据生成器函数
 */
export function generateMockGroup(id: string) {
  return {
    id,
    name: `测试组 ${id}`,
    description: `这是测试组 ${id} 的描述`,
    enabled: true,
    toolCount: Math.floor(Math.random() * 5) + 1,
    serverCount: Math.floor(Math.random() * 3) + 1,
    lastUpdated: new Date().toISOString(),
  };
}

export function generateMockTool(name: string, groupId: string) {
  return {
    name,
    description: `测试工具 ${name}`,
    groupId,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: '输入参数' },
      },
      required: ['input'],
    },
    category: 'test',
    version: '1.0.0',
  };
}

export function generateMockServer(id: string) {
  return {
    id,
    name: `测试服务器 ${id}`,
    type: Math.random() > 0.5 ? 'stdio' : 'sse',
    status: Math.random() > 0.2 ? 'connected' : 'disconnected',
    lastConnected: new Date().toISOString(),
    toolCount: Math.floor(Math.random() * 10) + 1,
  };
}

/**
 * 测试结果收集器
 */
export class TestResultCollector {
  private results: Array<{
    scenario: string;
    step: string;
    success: boolean;
    duration: number;
    error?: string;
    timestamp: number;
  }> = [];

  recordResult(
    scenario: string,
    step: string,
    success: boolean,
    duration: number,
    error?: string,
  ) {
    this.results.push({
      scenario,
      step,
      success,
      duration,
      error,
      timestamp: Date.now(),
    });
  }

  getResults() {
    return [...this.results];
  }

  getSummary() {
    const total = this.results.length;
    const successful = this.results.filter((r) => r.success).length;
    const failed = total - successful;
    const averageDuration =
      total > 0
        ? this.results.reduce((sum, r) => sum + r.duration, 0) / total
        : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration,
    };
  }

  clear() {
    this.results = [];
  }
}
