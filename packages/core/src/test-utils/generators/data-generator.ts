/**
 * 测试数据生成器
 * 生成各种测试场景所需的数据
 */

import type { ToolInfo } from '../../types/tool.js';
import type { ServerConfig } from '@mcp-core/mcp-hub-share';

/**
 * 测试数据生成器
 */
export class TestDataGenerator {
  /**
   * 生成多个服务器配置
   */
  static generateManyServers(
    count: number,
    type: 'stdio' | 'sse' = 'stdio',
  ): Record<string, ServerConfig> {
    const servers: Record<string, ServerConfig> = {};

    for (let i = 0; i < count; i++) {
      const serverId = `server-${i + 1}`;

      if (type === 'stdio') {
        servers[serverId] = {
          type: 'stdio',
          command: `server-${i + 1}`,
          args: [`--port=${3000 + i}`],
          env: {
            SERVER_ID: serverId,
            LOG_LEVEL: 'info',
          },
          enabled: true,
        };
      } else {
        servers[serverId] = {
          type: 'sse',
          url: `http://localhost:${3000 + i}/sse`,
          headers: {
            'X-Server-Id': serverId,
          },
          env: {
            SERVER_ID: serverId,
          },
          enabled: true,
        };
      }
    }

    return servers;
  }

  /**
   * 生成多个工具
   */
  static generateManyTools(count: number, serverId: string = 'server1'): ToolInfo[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `tool_${i + 1}`,
      description: `Auto-generated tool ${i + 1}`,
      serverId,
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: `Parameter 1 for tool ${i + 1}`,
          required: true,
        },
        {
          name: 'param2',
          type: 'number',
          description: `Parameter 2 for tool ${i + 1}`,
          required: false,
        },
      ],
    }));
  }

  /**
   * 生成极端参数
   */
  static generateExtremeParams() {
    return {
      // 空参数
      empty: {},

      // 大量参数
      manyParams: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`param${i + 1}`, `value${i + 1}`]),
      ),

      // 深度嵌套参数
      deeplyNested: {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep',
                },
              },
            },
          },
        },
      },

      // 特殊字符参数
      specialChars: {
        emoji: '😀🎉🚀',
        unicode: '你好世界🌍',
        mixed: 'Hello 世界 🌍 123',
      },

      // 大字符串参数
      largeString: 'x'.repeat(10000),

      // 数组参数
      arrayParam: Array.from({ length: 100 }, (_, i) => `item${i + 1}`),

      // 数字边界
      numberBoundaries: {
        max: Number.MAX_SAFE_INTEGER,
        min: Number.MIN_SAFE_INTEGER,
        zero: 0,
        negative: -999999,
      },

      // 布尔组合
      booleanCombos: {
        true: true,
        false: false,
        null: null,
      },
    };
  }

  /**
   * 生成随机字符串
   */
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  }

  /**
   * 生成随机 ID
   */
  static randomId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 生成随机工具
   */
  static randomTool(serverId?: string): ToolInfo {
    const name = `random_${TestDataGenerator.randomString(8)}`;
    return {
      name,
      description: `Randomly generated tool ${name}`,
      serverId: serverId || `server-${Math.floor(Math.random() * 10)}`,
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: 'Random parameter',
          required: false,
        },
      ],
    };
  }

  /**
   * 生成性能测试数据
   */
  static generatePerformanceTestData() {
    return {
      // 少量工具（快速）
      small: {
        serverCount: 2,
        toolsPerServer: 5,
        expectedTime: 'fast',
      },

      // 中等工具（中等）
      medium: {
        serverCount: 5,
        toolsPerServer: 20,
        expectedTime: 'medium',
      },

      // 大量工具（慢）
      large: {
        serverCount: 10,
        toolsPerServer: 50,
        expectedTime: 'slow',
      },

      // 极限测试
      extreme: {
        serverCount: 20,
        toolsPerServer: 100,
        expectedTime: 'very-slow',
      },
    };
  }

  /**
   * 生成错误场景数据
   */
  static generateErrorScenarios() {
    return {
      // 连接错误
      connectionError: {
        message: 'Connection refused',
        code: 'ECONNREFUSED',
      },

      // 超时错误
      timeoutError: {
        message: 'Operation timeout',
        code: 'ETIMEDOUT',
      },

      // 协议错误
      protocolError: {
        message: 'Invalid protocol message',
        code: 'EPROTOCOL',
      },

      // 认证错误
      authError: {
        message: 'Authentication failed',
        code: 'EAUTH',
      },

      // 工具不存在
      toolNotFound: {
        message: 'Tool not found',
        code: 'ETOOLNOTFOUND',
      },

      // 参数验证失败
      validationError: {
        message: 'Parameter validation failed',
        code: 'EVALIDATION',
      },

      // 服务器不可用
      serverUnavailable: {
        message: 'Server unavailable',
        code: 'EUNAVAILABLE',
      },
    };
  }

  /**
   * 生成并发测试数据
   */
  static generateConcurrencyTestData() {
    return {
      // 低并发
      low: {
        operations: 10,
        concurrency: 2,
        expectedBehavior: 'sequential',
      },

      // 中等并发
      medium: {
        operations: 50,
        concurrency: 10,
        expectedBehavior: 'concurrent',
      },

      // 高并发
      high: {
        operations: 100,
        concurrency: 50,
        expectedBehavior: 'highly-concurrent',
      },

      // 极限并发
      extreme: {
        operations: 200,
        concurrency: 100,
        expectedBehavior: 'stress-test',
      },
    };
  }

  /**
   * 生成边界条件测试数据
   */
  static generateBoundaryTestData() {
    return {
      // 空场景
      empty: {
        servers: {},
        tools: [],
        groups: {},
      },

      // 单个元素
      single: {
        servers: { server1: { type: 'stdio', command: 'test', args: [] } },
        tools: [
          {
            name: 'tool1',
            description: 'Single tool',
            serverId: 'server1',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        groups: {
          group1: {
            id: 'group1',
            name: 'Single Group',
            servers: ['server1'],
            tools: [],
          },
        },
      },

      // 最大限制
      max: {
        servers: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `server${i + 1}`,
            { type: 'stdio' as const, command: `server${i + 1}`, args: [] },
          ]),
        ),
        tools: Array.from({ length: 1000 }, (_, i) => ({
          name: `tool${i + 1}`,
          description: `Tool ${i + 1}`,
          serverId: `server${(i % 100) + 1}`,
          inputSchema: { type: 'object', properties: {} },
        })),
      },
    };
  }

  /**
   * 生成网络条件测试数据
   */
  static generateNetworkConditions() {
    return {
      // 正常网络
      normal: {
        latency: 50,
        bandwidth: 1000,
        packetLoss: 0,
      },

      // 慢速网络
      slow: {
        latency: 500,
        bandwidth: 100,
        packetLoss: 0.01,
      },

      // 不稳定网络
      unstable: {
        latency: 200,
        bandwidth: 500,
        packetLoss: 0.05,
      },

      // 极差网络
      poor: {
        latency: 1000,
        bandwidth: 50,
        packetLoss: 0.1,
      },
    };
  }

  /**
   * 生成负载测试数据
   */
  static generateLoadTestData() {
    return {
      // 轻负载
      light: {
        requestsPerSecond: 10,
        duration: 10,
        totalRequests: 100,
      },

      // 中等负载
      medium: {
        requestsPerSecond: 50,
        duration: 20,
        totalRequests: 1000,
      },

      // 重负载
      heavy: {
        requestsPerSecond: 100,
        duration: 30,
        totalRequests: 3000,
      },

      // 压力测试
      stress: {
        requestsPerSecond: 500,
        duration: 60,
        totalRequests: 30000,
      },
    };
  }
}
