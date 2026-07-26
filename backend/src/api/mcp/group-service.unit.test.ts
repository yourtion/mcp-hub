/**
 * GroupMcpService 构造时序单测 (P4)
 *
 * 验证：
 * - 构造函数不再创建 McpServer（延迟到 initialize()，以便读取组配置里的 cacheHints）
 * - initialize() 后 McpServer 已创建且 getMcpServer 可用
 * - getMcpServer() 在 initialize 前抛 ServiceError
 * - cacheHints（含组级覆盖）被正确传入 McpServer 构造参数
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 捕获 McpServer 构造调用，记录入参用于断言构造时机与 cacheHints 接入
// 用普通 function 表达式以便可作为构造函数（new）调用
const constructorCalls: Array<{ serverInfo: unknown; options: unknown }> = [];
vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn(
    function (this: unknown, serverInfo: unknown, options?: unknown) {
      constructorCalls.push({ serverInfo, options });
      this.registerTool = vi.fn();
      this.registerResource = vi.fn();
      this.close = vi.fn();
    },
  ),
}));

// getCoreServiceManager 不应在 group-service 路径中触发
vi.mock('../../services/service-registry.js', () => ({
  getCoreServiceManager: vi.fn(() => {
    throw new Error('getCoreServiceManager 不应在本测试中被调用');
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';

import { GroupMcpService } from './group-service.js';

function makeCoreManagerMock(): McpServiceManagerInterface {
  return {
    getAllTools: vi.fn().mockResolvedValue([]),
    getServerConnections: vi.fn().mockReturnValue(new Map()),
    getServiceStatus: vi.fn().mockReturnValue(new Map()),
    executeToolCall: vi.fn(),
  } as unknown as McpServiceManagerInterface;
}

// getAllConfig 可在测试中被 spy/override（默认返回无 cacheHints 的最小 group）
const getAllConfigMock = vi.fn().mockResolvedValue({
  groups: {
    testgroup: {
      id: 'testgroup',
      name: 'Test Group',
      servers: ['srv1'],
      tools: [],
    },
  },
  servers: {},
});

vi.mock('../../utils/config.js', () => ({
  getAllConfig: (...args: unknown[]) => getAllConfigMock(...args),
}));

describe('GroupMcpService - 构造时序 (P4)', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
    getAllConfigMock.mockReset();
    getAllConfigMock.mockResolvedValue({
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['srv1'],
          tools: [],
        },
      },
      servers: {},
    });
  });

  it('构造函数不应创建 McpServer（延迟到 initialize）', () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    expect(constructorCalls).toHaveLength(0);
    void svc; // 引用避免 lint 报未使用
  });

  it('initialize() 后 McpServer 已创建且 getMcpServer 可用', async () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();
    expect(constructorCalls).toHaveLength(1);
    expect(() => svc.getMcpServer()).not.toThrow();
  });

  it('getMcpServer() 在 initialize 前抛 ServiceError', () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    expect(() => svc.getMcpServer()).toThrow();
  });

  it('cacheHints 默认值（ttlMs=60000, cacheScope=public）被传入 McpServer', async () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();

    expect(constructorCalls).toHaveLength(1);
    const { options } = constructorCalls[0]!;
    expect(options).toMatchObject({
      cacheHints: {
        'tools/list': {
          ttlMs: 60_000,
          cacheScope: 'public',
        },
      },
    });
  });

  it('组级 cacheHints 覆盖被正确解析并传入 McpServer', async () => {
    getAllConfigMock.mockResolvedValue({
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['srv1'],
          tools: [],
          cacheHints: {
            toolsListTtlMs: 5_000,
            toolsListCacheScope: 'private',
          },
        },
      },
      servers: {},
    });

    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();

    expect(constructorCalls).toHaveLength(1);
    const { options } = constructorCalls[0]!;
    expect(options).toMatchObject({
      cacheHints: {
        'tools/list': {
          ttlMs: 5_000,
          cacheScope: 'private',
        },
      },
    });
  });
});
