/**
 * GroupMcpService 构造时序单测
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
  McpServer: vi.fn(function (this: unknown, serverInfo: unknown, options?: unknown) {
    constructorCalls.push({ serverInfo, options });
    this.registerTool = vi.fn();
    this.registerResource = vi.fn();
    this.close = vi.fn();
  }),
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

import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { GroupMcpService } from './group-service.js';

import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';

function makeCoreManagerMock(): McpServiceManagerInterface {
  return {
    getAllTools: vi.fn().mockResolvedValue([]),
    getServerTools: vi.fn().mockResolvedValue([]),
    getServerConnections: vi.fn().mockReturnValue(new Map()),
    getServiceStatus: vi.fn().mockReturnValue(new Map()),
    executeToolCall: vi.fn(),
  } as unknown as McpServiceManagerInterface;
}

// getAllConfig 可在测试中被 spy/override（默认返回无 cacheHints 的最小 group）
// 注意：真实结构为 { mcps: { servers }, groups, system }（servers 嵌在 mcps 下），
// 见 backend/src/utils/config.ts getAllConfig()。这样 hub_config resource 的
// config.mcps?.servers 内容路径才能被真正覆盖。
const getAllConfigMock = vi.fn().mockResolvedValue({
  mcps: {
    servers: {},
  },
  groups: {
    testgroup: {
      id: 'testgroup',
      name: 'Test Group',
      servers: ['srv1'],
      tools: [],
    },
  },
});

vi.mock('../../utils/config.js', () => ({
  getAllConfig: (...args: unknown[]) => getAllConfigMock(...args),
}));

describe('GroupMcpService - 构造时序', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
    getAllConfigMock.mockReset();
    getAllConfigMock.mockResolvedValue({
      mcps: {
        servers: {},
      },
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['srv1'],
          tools: [],
        },
      },
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

  it('getMcpServer() 在 initialize 前抛 ServiceError (SERVICE_UNAVAILABLE)', () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    try {
      svc.getMcpServer();
      fail('getMcpServer 应在 initialize 前抛错');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    }
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
      mcps: {
        servers: {},
      },
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

  it('单字段覆盖：仅设 toolsListTtlMs 时，cacheScope 回落默认 public', async () => {
    getAllConfigMock.mockResolvedValue({
      mcps: {
        servers: {},
      },
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['srv1'],
          tools: [],
          cacheHints: {
            toolsListTtlMs: 5_000,
          },
        },
      },
    });

    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();

    expect(constructorCalls).toHaveLength(1);
    const { options } = constructorCalls[0]!;
    expect(options).toMatchObject({
      cacheHints: {
        'tools/list': {
          ttlMs: 5_000,
          cacheScope: 'public',
        },
      },
    });
  });
});

describe('GroupMcpService - tools/list 确定性排序', () => {
  beforeEach(() => {
    // 重置默认配置
    getAllConfigMock.mockReset();
    getAllConfigMock.mockResolvedValue({
      mcps: {
        servers: {},
      },
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'T',
          servers: ['zServer', 'aServer'],
          tools: [],
        },
      },
    });
  });

  it('工具按 先 serverId 后 toolName 排序', async () => {
    // 模拟乱序工具：zServer/a、aServer/b、aServer/a
    const cm = makeCoreManagerMock();
    (cm.getAllTools as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'a', serverId: 'zServer', inputSchema: { type: 'object', properties: {} } },
      { name: 'b', serverId: 'aServer', inputSchema: { type: 'object', properties: {} } },
      { name: 'a', serverId: 'aServer', inputSchema: { type: 'object', properties: {} } },
    ]);

    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    // 注册顺序由 getMcpServer().registerTool 调用顺序决定
    const registerToolCalls = (
      svc.getMcpServer() as unknown as {
        registerTool: ReturnType<typeof vi.fn>;
      }
    ).registerTool.mock.calls;

    // 排除 group_status / list_group_tools 两个管理工具（前两个），后面是动态工具
    const dynamicNames = registerToolCalls.slice(2).map((c: unknown[]) => c[0] as string);
    // 注册名 = ${serverId}_${toolName}
    expect(dynamicNames).toEqual(['aServer_a', 'aServer_b', 'zServer_a']);
  });
});

describe('GroupMcpService - registerGroupResources', () => {
  // 把 testgroup 配置成含 ['srv1','srv2']，便于覆盖 servers resource 过滤。
  // 注意 mcps.servers 与 group.servers 的区别：
  //   - mcps.servers: 全局上游 MCP server 配置（key 为 serverId）
  //   - group.servers: 本组订阅的 serverId 列表（数组）
  // 这里 mcps.servers 放 srv1/srv2 两条，用于覆盖 hub_config 的
  // config.mcps?.servers 内容路径（使其 serverCount 为非零值）。
  function resetConfig(): void {
    getAllConfigMock.mockReset();
    getAllConfigMock.mockResolvedValue({
      mcps: {
        servers: {
          srv1: { id: 'srv1' },
          srv2: { id: 'srv2' },
        },
      },
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['srv1', 'srv2'],
          tools: [],
        },
      },
    });
  }

  beforeEach(() => {
    resetConfig();
  });

  it('注册 4 个 resource，URI 与 cacheHint 正确', async () => {
    const cm = makeCoreManagerMock();
    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    const registerResourceCalls = (
      svc.getMcpServer() as unknown as {
        registerResource: ReturnType<typeof vi.fn>;
      }
    ).registerResource.mock.calls;

    // 4 个 resource
    expect(registerResourceCalls).toHaveLength(4);

    // 抽取每个调用的 [name, uri, config.cacheHint]
    const entries = registerResourceCalls.map(
      (c: unknown[]) =>
        [
          c[0] as string,
          c[1] as string,
          (c[2] as { cacheHint?: { ttlMs?: number; cacheScope?: string } }).cacheHint,
        ] as const,
    );

    // status: 运行时状态，短 ttl 私有缓存
    expect(entries).toContainEqual([
      'group_status_resource',
      'group://testgroup/status',
      { ttlMs: 5_000, cacheScope: 'private' },
    ]);
    // servers: 服务器列表与连接状态，短 ttl 私有缓存
    expect(entries).toContainEqual([
      'group_servers',
      'group://testgroup/servers',
      { ttlMs: 5_000, cacheScope: 'private' },
    ]);
    // config: 全局配置概要，长 ttl 公共缓存
    expect(entries).toContainEqual([
      'hub_config',
      'hub://config',
      { ttlMs: 300_000, cacheScope: 'public' },
    ]);
    // version: 版本信息，极长 ttl 公共缓存
    expect(entries).toContainEqual([
      'hub_version',
      'hub://version',
      { ttlMs: 86_400_000, cacheScope: 'public' },
    ]);
  });

  it('group://servers resource 的 callback 返回过滤后的服务器列表', async () => {
    // 准备 serverConnections：srv1(connected), srv2(disconnected), other(connected)
    // 其中 other 不属于 testgroup，断言里不应出现
    const connections = new Map([
      ['srv1', { id: 'srv1', status: 'connected' }],
      ['srv2', { id: 'srv2', status: 'disconnected' }],
      ['other', { id: 'other', status: 'connected' }],
    ]);

    const cm = makeCoreManagerMock();
    (cm.getServerConnections as ReturnType<typeof vi.fn>).mockReturnValue(connections);

    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    const registerResourceCalls = (
      svc.getMcpServer() as unknown as {
        registerResource: ReturnType<typeof vi.fn>;
      }
    ).registerResource.mock.calls;

    // 找到 group_servers 的注册项（第 4 个参数是 callback）
    const serversEntry = registerResourceCalls.find(
      (c: unknown[]) => c[0] === 'group_servers',
    ) as unknown as [
      string,
      string,
      unknown,
      (uri: URL) => Promise<{ contents: Array<{ uri: string; text?: string }> }>,
    ];
    expect(serversEntry).toBeDefined();

    const callback = serversEntry[3]!;
    const result = await callback(new URL('group://testgroup/servers'));
    const parsed = JSON.parse(result.contents[0]!.text!);

    // 只含 testgroup 配置的 srv1/srv2，不含 other
    const ids = (parsed.servers as Array<{ id: string; status: string }>).map((s) => s.id);
    expect(ids).toEqual(['srv1', 'srv2']);
    const byId = new Map(
      (parsed.servers as Array<{ id: string; status: string }>).map((s) => [s.id, s.status]),
    );
    expect(byId.get('srv1')).toBe('connected');
    expect(byId.get('srv2')).toBe('disconnected');
    expect(parsed.groupId).toBe('testgroup');
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('hub://config resource 的 callback 返回非零 serverCount（覆盖 config.mcps.servers 路径）', async () => {
    // resetConfig() 已在 beforeEach 注入 mcps.servers = { srv1, srv2 }，共 2 条。
    // 此前测试 mock 用顶层 servers（无 mcps 包装），导致 config.mcps 恒为 undefined、
    // serverCount 恒为 0，hub_config 内容路径从未被真正覆盖。本用例补齐该覆盖。
    const cm = makeCoreManagerMock();
    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    const registerResourceCalls = (
      svc.getMcpServer() as unknown as {
        registerResource: ReturnType<typeof vi.fn>;
      }
    ).registerResource.mock.calls;

    const configEntry = registerResourceCalls.find(
      (c: unknown[]) => c[0] === 'hub_config',
    ) as unknown as [
      string,
      string,
      unknown,
      (uri: URL) => Promise<{ contents: Array<{ uri: string; text?: string }> }>,
    ];
    expect(configEntry).toBeDefined();

    const callback = configEntry[3]!;
    const result = await callback(new URL('hub://config'));
    const parsed = JSON.parse(result.contents[0]!.text!) as {
      version: string;
      groups: string[];
      serverCount: number;
    };

    // 与 resetConfig() 注入的 mcps.servers（srv1 + srv2）一致
    expect(parsed.serverCount).toBe(2);
    expect(parsed.serverCount).toBeGreaterThan(0);
    expect(parsed.groups).toEqual(['testgroup']);
    expect(typeof parsed.version).toBe('string');
  });
});

describe('GroupMcpService.refreshTools（P5）', () => {
  // refreshTools 只重新注册指定 server 的工具，不动其他 server。
  // registerTool 返回带 remove() 的 RegisteredTool 句柄，refreshTools 借此注销旧工具。
  beforeEach(() => {
    getAllConfigMock.mockReset();
    getAllConfigMock.mockResolvedValue({
      mcps: {
        servers: {},
      },
      groups: {
        testgroup: {
          id: 'testgroup',
          name: 'Test Group',
          servers: ['s1', 's2'],
          tools: [],
        },
      },
    });
  });

  it('只重新注册指定 server 的工具，不动其他 server', async () => {
    const cm = makeCoreManagerMock();
    // 初始：s1 有 t1/t2，s2 有 t3
    const initialTools = [
      { name: 't1', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
      { name: 't2', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
      { name: 't3', serverId: 's2', inputSchema: { type: 'object', properties: {} } },
    ];
    (cm.getAllTools as ReturnType<typeof vi.fn>).mockResolvedValue(initialTools);
    // 初始 getServerTools 也返回同样工具集，供 refreshTools 重灌时读取
    (cm.getServerTools as ReturnType<typeof vi.fn>).mockImplementation(async (serverId: string) =>
      initialTools.filter((t) => t.serverId === serverId),
    );

    const svc = new GroupMcpService('testgroup', cm);

    // 先用默认 mock 完成初始化（management tools + resource 注册），捕获 mcpServer
    await svc.initialize();
    const mcpServer = svc.getMcpServer() as unknown as {
      registerTool: ReturnType<typeof vi.fn>;
    };

    // 让 registerTool 返回带 remove() 的句柄，记录每个被 remove 的工具。
    // 在 refreshTools 前覆盖 mock，并手动「重灌」初始工具句柄，
    // 模拟初始注册时即拿到句柄（refreshTools 依赖 registeredToolHandles）。
    const removedTools: string[] = [];
    (mcpServer.registerTool as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      const handle = {
        name,
        remove: () => {
          removedTools.push(name);
        },
        enable: vi.fn(),
        disable: vi.fn(),
        update: vi.fn(),
      };
      return handle;
    });
    // 重灌初始动态工具（s1_t1, s1_t2, s2_t3），使 registeredToolHandles 填充句柄
    await svc.refreshTools('s1');
    await svc.refreshTools('s2');
    removedTools.length = 0; // 清掉重灌期间的 remove 记录

    // 上游变更：s1 工具集变为 [t1,t4]（t2 消失、t4 新增）
    (cm.getServerTools as ReturnType<typeof vi.fn>).mockImplementation(
      async (serverId: string) => {
        if (serverId === 's1') {
          return [
            { name: 't1', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
            { name: 't4', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
          ];
        }
        return [{ name: 't3', serverId: 's2', inputSchema: { type: 'object', properties: {} } }];
      },
    );

    const registerCallsBefore = mcpServer.registerTool.mock.calls.length;
    await svc.refreshTools('s1');

    // 断言：s1 的旧工具（s1_t1, s1_t2）被 remove
    expect(removedTools).toContain('s1_t1');
    expect(removedTools).toContain('s1_t2');
    // s2 的工具未被 remove
    expect(removedTools).not.toContain('s2_t3');

    // 断言：s1 的新工具被重新注册（含 s1_t4）
    const newRegisterCalls = mcpServer.registerTool.mock.calls.slice(registerCallsBefore);
    const newNames = newRegisterCalls.map((c: unknown[]) => c[0] as string);
    expect(newNames).toContain('s1_t1');
    expect(newNames).toContain('s1_t4');
    // s2 的工具未被重复注册
    expect(newNames).not.toContain('s2_t3');
  });

  it('availableTools 在 refresh 后反映新工具集', async () => {
    const cm = makeCoreManagerMock();
    (cm.getAllTools as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 't1', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
    ]);

    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    const mcpServer = svc.getMcpServer() as unknown as {
      registerTool: ReturnType<typeof vi.fn>;
    };
    (mcpServer.registerTool as ReturnType<typeof vi.fn>).mockImplementation((name: string) => ({
      name,
      remove: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      update: vi.fn(),
    }));

    (cm.getServerTools as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 't1', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
      { name: 't2', serverId: 's1', inputSchema: { type: 'object', properties: {} } },
    ]);

    await svc.refreshTools('s1');
    const tools = await svc.getAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('t1');
    expect(names).toContain('t2');
  });
});
