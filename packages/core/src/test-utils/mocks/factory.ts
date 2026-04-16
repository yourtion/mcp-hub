/**
 * Mock 工厂
 * 提供便捷的 Mock 对象创建方法
 */

import type {
  GroupConfig,
  McpConfig,
  ServerConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import type { ToolInfo } from '../../types/tool.js';

/**
 * Mock 客户端接口类型，避免 vi.fn() 返回类型引用 @vitest/spy
 */
interface MockClientMethods {
  connect: (transport?: unknown) => Promise<void>;
  close: () => Promise<void>;
  listTools: () => Promise<{ tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> }>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
  isConnected: () => boolean;
  getStatus: () => string;
}

/**
 * Mock 配置工厂
 */
export class MockConfigFactory {
  /**
   * 创建服务器配置
   */
  static createServerConfig(overrides?: Partial<ServerConfig>): {
    id: string;
    config: ServerConfig;
  } {
    const id = 'mock-server';

    // 明确创建 stdio 类型的配置
    const baseConfig: ServerConfig = {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    };

    // 如果提供了 overrides，合并配置
    const config: ServerConfig = overrides
      ? ({ ...baseConfig, ...overrides } as ServerConfig)
      : baseConfig;

    return { id, config };
  }

  /**
   * 创建多个服务器配置
   */
  static createMcpServerConfig(
    serverCount: number,
  ): Record<string, ServerConfig> {
    const servers: Record<string, ServerConfig> = {};

    for (let i = 1; i <= serverCount; i++) {
      const { config } = MockConfigFactory.createServerConfig({
        command: `node server${i}.js`,
        args: [`--port=${3000 + i}`],
      });

      servers[`server${i}`] = config;
    }

    return servers;
  }

  /**
   * 创建 MCP 配置
   */
  static createMcpConfig(serverCount: number = 3): McpConfig {
    return {
      servers: MockConfigFactory.createMcpServerConfig(serverCount),
    };
  }

  /**
   * 创建组配置
   */
  static createGroupConfig(
    groupCount: number = 2,
    serversPerGroup: number = 2,
  ): GroupConfig {
    const groups: GroupConfig = {};

    for (let i = 1; i <= groupCount; i++) {
      const servers = Array.from(
        { length: serversPerGroup },
        (_, j) => `server${i * 10 + j}`,
      );

      groups[`group${i}`] = {
        id: `group${i}`,
        name: `Group ${i}`,
        description: `Test group ${i}`,
        servers,
        tools: [],
      };
    }

    return groups;
  }

  /**
   *创建系统配置
   */
  static createSystemConfig(overrides?: Partial<SystemConfig>): SystemConfig {
    return {
      server: {
        port: 3000,
        host: 'localhost',
      },
      auth: {
        jwt: {
          secret: 'test-secret',
          expiresIn: '15m',
          refreshExpiresIn: '7d',
          issuer: 'mcp-hub',
        },
        security: {
          maxLoginAttempts: 5,
          lockoutDuration: 900000,
          passwordMinLength: 6,
          requireStrongPassword: false,
        },
      },
      users: {},
      ui: {
        title: 'MCP Hub',
        theme: 'light',
        features: {
          apiToMcp: true,
          debugging: true,
          monitoring: true,
        },
      },
      monitoring: {
        metricsEnabled: true,
        logLevel: 'info',
        retentionDays: 30,
      },
      ...overrides,
    };
  }
}

/**
 * Mock 工具工厂
 */
export class MockToolFactory {
  /**
   * 创建单个工具
   */
  static createTool(overrides?: Partial<ToolInfo>): ToolInfo {
    return {
      name: 'test_tool',
      description: 'A test tool',
      serverId: 'server1',
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: 'First parameter',
          required: false,
        },
      ],
      ...overrides,
    };
  }

  /**
   * 创建多个工具
   */
  static createTools(count: number, serverId: string = 'server1'): ToolInfo[] {
    return Array.from({ length: count }, (_, i) => ({
      ...MockToolFactory.createTool({
        name: `tool${i + 1}`,
        description: `Test tool ${i + 1}`,
        serverId,
      }),
    }));
  }

  /**
   * 创建带复杂参数的工具
   */
  static createComplexTool(overrides?: Partial<ToolInfo>): ToolInfo {
    return {
      name: 'complex_tool',
      description: 'A tool with complex parameters',
      serverId: 'server1',
      parameters: [
        {
          name: 'stringParam',
          type: 'string',
          description: 'String parameter',
          required: true,
        },
        {
          name: 'numberParam',
          type: 'number',
          description: 'Number parameter',
          required: true,
        },
        {
          name: 'objectParam',
          type: 'object',
          description: 'Object parameter',
          required: false,
        },
        {
          name: 'arrayParam',
          type: 'array',
          description: 'Array parameter',
          required: false,
        },
      ],
      ...overrides,
    };
  }
}

/**
 * Mock MCP 客户端工厂
 */
export class MockMcpClientFactory {
  /**
   * 创建已连接的客户端
   */
  static createConnectedClient(): MockClientMethods {
    const client: MockClientMethods = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'tool1',
            description: 'Test tool 1',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'tool2',
            description: 'Test tool 2',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      }),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      }),
      isConnected: vi.fn().mockReturnValue(true),
      getStatus: vi.fn().mockReturnValue('connected'),
    };

    return client;
  }

  /**
   * 创建会失败的客户端
   */
  static createFailingClient(): MockClientMethods {
    const client: MockClientMethods = {
      connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockRejectedValue(new Error('Failed to list tools')),
      callTool: vi.fn().mockRejectedValue(new Error('Tool execution failed')),
      isConnected: vi.fn().mockReturnValue(false),
      getStatus: vi.fn().mockReturnValue('error'),
    };

    return client;
  }

  /**
   * 创建超时客户端
   */
  static createTimeoutClient(): MockClientMethods {
    const client: MockClientMethods = {
      connect: vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Connection timeout')),
              100,
            );
            timer.unref?.();
          }),
      ),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('List tools timeout')),
              100,
            );
            timer.unref?.();
          }),
      ),
      callTool: vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Call tool timeout')),
              100,
            );
            timer.unref?.();
          }),
      ),
      isConnected: vi.fn().mockReturnValue(false),
      getStatus: vi.fn().mockReturnValue('timeout'),
    };

    return client;
  }

  /**
   * 创建可配置的客户端
   */
  static createConfigurableClient(config: {
    tools?: Array<{ name: string; description: string }>;
    toolResult?: unknown;
    delay?: number;
    shouldFail?: boolean;
  }): MockClientMethods {
    const tools =
      config.tools ||
      [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' },
      ].map((t) => ({
        ...t,
        inputSchema: { type: 'object', properties: {} },
      }));

    const client: MockClientMethods = {
      connect: vi.fn().mockImplementation(async () => {
        if (config.delay) {
          await new Promise((resolve) => setTimeout(resolve, config.delay));
        }
        if (config.shouldFail) {
          throw new Error('Connection failed');
        }
      }),
      close: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockImplementation(async () => {
        if (config.delay) {
          await new Promise((resolve) => setTimeout(resolve, config.delay));
        }
        if (config.shouldFail) {
          throw new Error('List tools failed');
        }
        return { tools };
      }),
      callTool: vi.fn().mockImplementation(async () => {
        if (config.delay) {
          await new Promise((resolve) => setTimeout(resolve, config.delay));
        }
        if (config.shouldFail) {
          throw new Error('Tool call failed');
        }
        return (
          config.toolResult || {
            content: [{ type: 'text', text: 'Success' }],
          }
        );
      }),
      isConnected: vi.fn().mockReturnValue(!config.shouldFail),
      getStatus: vi
        .fn()
        .mockReturnValue(config.shouldFail ? 'error' : 'connected'),
    };

    return client;
  }
}

/**
 * Mock 组工厂
 */
export class MockGroupFactory {
  /**
   * 创建单个组
   */
  static createGroup(overrides?: {
    id?: string;
    name?: string;
    servers?: string[];
    tools?: string[];
  }) {
    return {
      id: overrides?.id || 'group1',
      name: overrides?.name || 'Group 1',
      description: 'Test group',
      servers: overrides?.servers || ['server1', 'server2'],
      tools: overrides?.tools || [],
    };
  }

  /**
   * 创建多个组
   */
  static createGroups(count: number, serversPerGroup: number = 2) {
    return Array.from({ length: count }, (_, i) => {
      const servers = Array.from(
        { length: serversPerGroup },
        (_, j) => `server${i * serversPerGroup + j + 1}`,
      );

      return MockGroupFactory.createGroup({
        id: `group${i + 1}`,
        name: `Group ${i + 1}`,
        servers,
      });
    });
  }
}
