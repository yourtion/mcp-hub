import type {
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAllConfigs } from '../validation/config';

describe('服务初始化集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该能够处理完整的配置验证流程', async () => {
    // 模拟真实的配置数据
    const mcpConfig: McpConfig = {
      mcpServers: {
        'time-mcp': {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'time-mcp'],
          enabled: true,
        },
        fetch: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-fetch'],
          enabled: true,
        },
        'sse-server': {
          type: 'sse',
          url: 'http://localhost:3001/sse',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          enabled: false,
        },
      },
    };

    const groupConfig: GroupConfig = {
      default: {
        id: 'default-group',
        name: 'Default Group',
        description: 'Default group containing all available MCP servers',
        servers: ['time-mcp', 'fetch'],
        tools: [],
      },
      'time-tools': {
        id: 'time-tools-group',
        name: 'Time Tools',
        description: 'Group for time-related tools',
        servers: ['time-mcp'],
        tools: [],
      },
      'web-tools': {
        id: 'web-tools-group',
        name: 'Web Tools',
        description: 'Group for web and fetch-related tools',
        servers: ['fetch'],
        tools: [],
      },
      'sse-tools': {
        id: 'sse-tools-group',
        name: 'SSE Tools',
        description: 'Group for SSE-based tools',
        servers: ['sse-server'],
        tools: [],
      },
    };

    const systemConfig: SystemConfig = {
      users: {
        admin: {
          password: 'admin123',
          groups: ['default', 'time-tools', 'web-tools'],
        },
        'time-user': {
          password: 'time123',
          groups: ['time-tools'],
        },
        'web-user': {
          password: 'web123',
          groups: ['web-tools'],
        },
      },
    };

    // 执行配置验证
    const result = validateAllConfigs(mcpConfig, groupConfig, systemConfig);

    // 验证结果
    expect(result.success).toBe(true);

    if (result.success) {
      // 验证 MCP 配置
      expect(result.data.mcpConfig.mcpServers).toBeDefined();
      expect(Object.keys(result.data.mcpConfig.mcpServers)).toHaveLength(3);
      expect(result.data.mcpConfig.mcpServers['time-mcp'].type).toBe('stdio');
      expect(result.data.mcpConfig.mcpServers['sse-server'].type).toBe('sse');

      // 验证组配置
      expect(result.data.groupConfig).toBeDefined();
      expect(Object.keys(result.data.groupConfig)).toHaveLength(4);
      expect(result.data.groupConfig.default.servers).toContain('time-mcp');
      expect(result.data.groupConfig.default.servers).toContain('fetch');

      // 验证系统配置
      expect(result.data.systemConfig).toBeDefined();
      expect(result.data.systemConfig?.users.admin.groups).toContain('default');
      expect(result.data.systemConfig?.users['time-user'].groups).toEqual([
        'time-tools',
      ]);
    }
  });

  it('应该能够处理配置验证错误场景', async () => {
    // 创建包含多种错误的配置
    const invalidMcpConfig = {
      mcpServers: {
        'invalid-stdio': {
          type: 'stdio',
          command: '', // 错误：空命令
        },
        'invalid-sse': {
          type: 'sse',
          url: 'not-a-url', // 错误：无效URL
        },
      },
    };

    const invalidGroupConfig = {
      'empty-servers': {
        id: 'empty-servers',
        name: 'Empty Servers',
        servers: [], // 错误：空服务器列表
        tools: [],
      },
      'nonexistent-servers': {
        id: 'nonexistent-servers',
        name: '', // 错误：空名称
        servers: ['nonexistent-server'], // 错误：引用不存在的服务器
        tools: [],
      },
    };

    const invalidSystemConfig = {
      users: {
        'invalid-user': {
          password: '', // 错误：空密码
          groups: ['default'],
        },
      },
    };

    // 执行配置验证
    const result = validateAllConfigs(
      invalidMcpConfig,
      invalidGroupConfig,
      invalidSystemConfig,
    );

    // 验证错误结果
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);

      // 检查是否包含各种类型的错误
      const errorString = result.errors.join(' ');
      expect(errorString).toMatch(/MCP配置错误|组配置错误|系统配置错误/);
    }
  });

  it('应该能够处理边界情况', async () => {
    // 测试最小有效配置
    const minimalMcpConfig = {
      mcpServers: {
        'minimal-server': {
          type: 'stdio',
          command: 'echo',
          args: ['hello'],
        },
      },
    };

    const minimalGroupConfig = {
      'minimal-group': {
        id: 'minimal-group',
        name: 'Minimal Group',
        servers: ['minimal-server'],
        tools: [],
      },
    };

    const result = validateAllConfigs(minimalMcpConfig, minimalGroupConfig);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.mcpConfig.mcpServers)).toHaveLength(1);
      expect(Object.keys(result.data.groupConfig)).toHaveLength(1);
      expect(result.data.systemConfig).toBeUndefined();
    }
  });

  it('应该能够处理复杂的服务器和组关系', async () => {
    const complexMcpConfig = {
      mcpServers: {
        'server-a': { type: 'stdio', command: 'node', args: ['a.js'] },
        'server-b': { type: 'stdio', command: 'node', args: ['b.js'] },
        'server-c': { type: 'sse', url: 'http://localhost:3001/c' },
        'server-d': { type: 'sse', url: 'http://localhost:3002/d' },
      },
    };

    const complexGroupConfig = {
      'group-1': {
        id: 'group-1',
        name: 'Group 1',
        servers: ['server-a', 'server-b'],
        tools: ['tool-1', 'tool-2'],
      },
      'group-2': {
        id: 'group-2',
        name: 'Group 2',
        servers: ['server-c', 'server-d'],
        tools: ['tool-3'],
      },
      'group-mixed': {
        id: 'group-mixed',
        name: 'Mixed Group',
        servers: ['server-a', 'server-c'],
        tools: ['tool-1', 'tool-3'],
      },
      'group-all': {
        id: 'group-all',
        name: 'All Servers',
        servers: ['server-a', 'server-b', 'server-c', 'server-d'],
        tools: [],
      },
    };

    const result = validateAllConfigs(complexMcpConfig, complexGroupConfig);

    expect(result.success).toBe(true);
    if (result.success) {
      // 验证所有服务器都被正确配置
      expect(Object.keys(result.data.mcpConfig.mcpServers)).toHaveLength(4);

      // 验证所有组都被正确配置
      expect(Object.keys(result.data.groupConfig)).toHaveLength(4);

      // 验证混合组包含不同类型的服务器
      const mixedGroup = result.data.groupConfig['group-mixed'];
      expect(mixedGroup.servers).toContain('server-a'); // stdio
      expect(mixedGroup.servers).toContain('server-c'); // sse

      // 验证全服务器组包含所有服务器
      const allGroup = result.data.groupConfig['group-all'];
      expect(allGroup.servers).toHaveLength(4);
    }
  });
});
