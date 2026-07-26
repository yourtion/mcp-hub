# P4 缓存语义（协议层 cacheHint + resources 体系）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Hub 作为 MCP server 在 `tools/list` 与 `resources/read` 结果上提供 `ttlMs`/`cacheScope` 协议层缓存提示，补齐 `tools/list` 确定性排序，并新增 4 个 Hub 自身元数据 resource（每个带 cacheHint）。

**Architecture:** 方案 A（复用现有缓存层）。改动集中在 `GroupMcpService`：把 `new McpServer` 从构造函数挪到 `initialize()` 以支持配置驱动的 `cacheHints`；在工具注册前加确定性排序；新增 `registerGroupResources()` 注册 4 个 resource。配置失效复用现有 `invalidateGroupMcpService`，无需新增失效代码。

**Tech Stack:** `@modelcontextprotocol/server@2.0.0-beta.5`（`McpServer.cacheHints`、`registerResource(name, uri, {cacheHint}, readCallback)`）、Hono、zod/v4、vitest。

**关联 spec:** `docs/superpowers/specs/2026-07-26-p4-cache-semantics-design.md`

---

## SDK 签名备忘（已从 `node_modules` 类型定义核实，实现时以此为准）

```ts
// CacheHint
interface CacheHint { ttlMs?: number; cacheScope?: 'public' | 'private'; }

// ServerOptions.cacheHints（构造时全局）
cacheHints?: Partial<Record<CacheableResultMethod, CacheHint>>;
// CacheableResultMethod = "tools/list" | "prompts/list" | "resources/list" | "resources/templates/list" | "resources/read" | "server/discover"

// registerResource（静态 URI 版）
registerResource(
  name: string,
  uriOrTemplate: string,
  config: ResourceMetadata & { cacheHint?: CacheHint },
  readCallback: (uri: URL, ctx: ServerContext) => ReadResourceResult | Promise<ReadResourceResult>
): RegisteredResource;

// ReadResourceResult 形态（来自 core 的 ReadResourceResultSchema）
{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }
```

**关键点**：`readCallback` 第一个参数是 **`URL` 类型**（不是 string），返回的 `contents[].uri` 是 **string**。

## 文件结构

| 文件                                                                    | 操作           | 责任                                                                                        |
| ----------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `packages/share/src/config/schemas/group.schema.ts`                     | Modify         | `GroupSchema` 加 `cacheHints?` 字段（配置入口）                                             |
| `backend/src/api/mcp/group-service.ts`                                  | Modify         | McpServer 构造时序调整 + cacheHints + 排序 + registerGroupResources + getGroupServersStatus |
| `backend/src/api/mcp/group-service.unit.test.ts`                        | Create         | 单元测试：resolveCacheHints、排序、resource 注册、构造时序                                  |
| `backend/src/e2e/mcp-protocol/cache-semantics.test.ts`                  | Create         | e2e：tools/list cacheHint、排序确定性、resources/list+read                                  |
| `docs/superpowers/specs/2026-07-26-p4-cache-semantics-design.md`        | 已存在         | 实现时核实项回填（如 registerResource 签名）                                                |
| `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md` | Modify（最后） | P4 完成后回写状态                                                                           |

---

## Task 1: Group 配置加 cacheHints 字段

**Files:**

- Modify: `packages/share/src/config/schemas/group.schema.ts:29-39`

- [ ] **Step 1: 写 schema 失败测试**

新建测试文件 `packages/share/src/config/schemas/group.schema.unit.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { GroupSchema } from './group.schema.js';

describe('GroupSchema - cacheHints (P4)', () => {
  it('应接受带 cacheHints 的合法配置', () => {
    const valid = {
      id: 'g1',
      name: 'Group 1',
      servers: ['srv1'],
      tools: [],
      cacheHints: {
        toolsListTtlMs: 120000,
        toolsListCacheScope: 'private',
      },
    };
    const parsed = GroupSchema.parse(valid);
    expect(parsed.cacheHints).toEqual({
      toolsListTtlMs: 120000,
      toolsListCacheScope: 'private',
    });
  });

  it('cacheHints 可选，不填也能通过', () => {
    const parsed = GroupSchema.parse({
      id: 'g1',
      name: 'Group 1',
      servers: ['srv1'],
      tools: [],
    });
    expect(parsed.cacheHints).toBeUndefined();
  });

  it('toolsListTtlMs 拒绝负数', () => {
    const result = GroupSchema.safeParse({
      id: 'g1',
      name: 'G1',
      servers: ['s1'],
      tools: [],
      cacheHints: { toolsListTtlMs: -100 },
    });
    expect(result.success).toBe(false);
  });

  it('toolsListCacheScope 拒绝非法枚举值', () => {
    const result = GroupSchema.safeParse({
      id: 'g1',
      name: 'G1',
      servers: ['s1'],
      tools: [],
      cacheHints: { toolsListCacheScope: 'shared' },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm --filter @mcp-core/mcp-hub-share exec vitest run src/config/schemas/group.schema.unit.test.ts`
Expected: FAIL（cacheHints 字段未定义，parse 出来 cacheHints 为 undefined 或被 strip）

- [ ] **Step 3: 修改 GroupSchema 加 cacheHints**

修改 `packages/share/src/config/schemas/group.schema.ts`，在 `GroupSchema` 的 `validation` 字段后加：

```ts
export const GroupSchema = z.object({
  id: z.string().min(1, { error: '组ID不能为空' }),
  name: z.string().min(1, { error: '组名称不能为空' }),
  description: z.string().optional(),
  servers: z
    .array(z.string().min(1, { error: '服务器名称不能为空' }))
    .min(1, { error: '每个组至少需要包含一个服务器' }),
  tools: z.array(z.string()),
  toolFilter: ToolFilterSchema.optional(),
  validation: GroupValidationSchema.optional(),
  // P4: 协议层 cacheHint 组级覆盖
  cacheHints: z
    .object({
      toolsListTtlMs: z.number().int().nonnegative().optional(),
      toolsListCacheScope: z.enum(['public', 'private']).optional(),
    })
    .optional(),
});
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm --filter @mcp-core/mcp-hub-share exec vitest run src/config/schemas/group.schema.unit.test.ts`
Expected: PASS（4 个测试全过）

- [ ] **Step 5: 提交**

```bash
git add packages/share/src/config/schemas/group.schema.ts packages/share/src/config/schemas/group.schema.unit.test.ts
git commit -m "feat(share): GroupSchema 加 cacheHints 可选字段（P4 协议层缓存配置入口）"
```

---

## Task 2: GroupMcpService McpServer 构造时序调整 + resolveCacheHints

**Files:**

- Modify: `backend/src/api/mcp/group-service.ts:71-135`
- Test: `backend/src/api/mcp/group-service.unit.test.ts`（新建）

**背景**：当前 `new McpServer` 在构造函数里（`group-service.ts:82`），但 cacheHints 需读组配置。Task 2 把构造挪到 `initialize()` 内，并加 `resolveCacheHints` 方法（暂不接 cacheHints，下一步接）。Task 2 的目标是**安全完成时序迁移**，保持现有行为不变（仍不带 cacheHints），用测试锁住"构造函数不 new McpServer / initialize 后 getMcpServer 可用"。

- [ ] **Step 1: 写构造时序的失败测试**

新建 `backend/src/api/mcp/group-service.unit.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock McpServer 以便断言构造时机与参数
const McpServerMock = vi.fn();
vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation((...args: unknown[]) => {
    McpServerMock(...args);
    return {
      registerTool: vi.fn(),
      registerResource: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

import { GroupMcpService } from './group-service.js';
import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';

function makeCoreManagerMock(): McpServiceManagerInterface {
  return {
    getAllTools: vi.fn().mockResolvedValue([]),
    getServerConnections: vi.fn().mockReturnValue(new Map()),
    getServiceStatus: vi.fn().mockReturnValue(new Map()),
    executeToolCall: vi.fn(),
  } as unknown as McpServiceManagerInterface;
}

// Mock getAllConfig 返回一个最小 group
vi.mock('../../utils/config.js', () => ({
  getAllConfig: vi.fn().mockResolvedValue({
    groups: {
      testgroup: {
        id: 'testgroup',
        name: 'Test Group',
        servers: ['srv1'],
        tools: [],
      },
    },
    servers: {},
  }),
}));

describe('GroupMcpService - 构造时序 (P4)', () => {
  beforeEach(() => {
    McpServerMock.mockClear();
  });

  it('构造函数不应创建 McpServer（延迟到 initialize）', () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    expect(McpServerMock).not.toHaveBeenCalled();
  });

  it('initialize() 后 McpServer 已创建且 getMcpServer 可用', async () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();
    expect(McpServerMock).toHaveBeenCalledTimes(1);
    expect(() => svc.getMcpServer()).not.toThrow();
  });

  it('getMcpServer() 在 initialize 前抛 ServiceError', () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    expect(() => svc.getMcpServer()).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts`
Expected: FAIL（当前构造函数里 `new McpServer`，第一个测试 "构造函数不应创建 McpServer" 会失败）

- [ ] **Step 3: 调整构造时序（保持现有行为，暂不加 cacheHints）**

修改 `backend/src/api/mcp/group-service.ts`：

3a. 把 `private mcpServer: McpServer;` 改为 definite assignment：

```ts
export class GroupMcpService {
  private mcpServer!: McpServer;
  private isInitialized = false;
  private groupConfig: Group | null = null;
  private availableTools: GroupToolInfo[] = [];
  /** P4: 解析后的组级 cacheHints（initialize 内赋值） */
  private groupCacheHints: { ttlMs: number; cacheScope: 'public' | 'private' } = {
    ttlMs: 60_000,
    cacheScope: 'public',
  };

  constructor(
    private groupId: string,
    private coreServiceManager: McpServiceManagerInterface,
  ) {
    // P4: McpServer 构造延迟到 initialize()，以便读取组配置里的 cacheHints
  }
```

3b. 在 `initialize()` 的 `loadGroupConfig()` 之后加 `buildMcpServer()` 调用，并新增 `buildMcpServer` / `resolveCacheHints` 方法：

```ts
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('组MCP服务已初始化，跳过重复初始化', { groupId: this.groupId });
      return;
    }

    try {
      logger.info('初始化组MCP服务', { groupId: this.groupId });

      await this.loadGroupConfig();
      this.buildMcpServer(); // P4: 读配置后构造 McpServer
      await this.registerGroupManagementTools();
      await this.registerGroupDynamicTools();
      this.isInitialized = true;
      logger.info('组MCP服务初始化完成', {
        groupId: this.groupId,
        toolCount: this.availableTools.length,
      });
    } catch (error) {
      logger.error('组MCP服务初始化失败', error as Error, { groupId: this.groupId });
      throw error;
    }
  }

  /**
   * 构造 McpServer 并应用组级 cacheHints（P4）。
   * 必须在 loadGroupConfig 之后调用。
   */
  private buildMcpServer(): void {
    this.groupCacheHints = this.resolveCacheHints(this.groupConfig);
    this.mcpServer = new McpServer(
      { name: `${pkg.name}-group-${this.groupId}`, version: pkg.version },
      {
        cacheHints: {
          'tools/list': {
            ttlMs: this.groupCacheHints.ttlMs,
            cacheScope: this.groupCacheHints.cacheScope,
          },
        },
      },
    );
  }

  /**
   * 解析组级 cacheHints，应用默认值（P4）。
   * 默认：ttlMs=60_000（1 分钟），cacheScope='public'（工具列表跨用户一致）。
   */
  private resolveCacheHints(groupConfig: Group | null): {
    ttlMs: number;
    cacheScope: 'public' | 'private';
  } {
    const overrides = groupConfig?.cacheHints;
    return {
      ttlMs: overrides?.toolsListTtlMs ?? 60_000,
      cacheScope: overrides?.toolsListCacheScope ?? 'public',
    };
  }
```

> 注：此步已把 cacheHints 接入（比 spec 的分步更紧凑，因为 resolveCacheHints 与构造时序强耦合，分开做会多一次无意义中间状态）。

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts`
Expected: PASS（3 个测试全过）

- [ ] **Step 5: 提交**

```bash
git add backend/src/api/mcp/group-service.ts backend/src/api/mcp/group-service.unit.test.ts
git commit -m "refactor(group-service): McpServer 构造延迟到 initialize 并接入 cacheHints (P4)"
```

---

## Task 3: resolveCacheHints 配置覆盖测试

**Files:**

- Test: `backend/src/api/mcp/group-service.unit.test.ts`（追加）

**目的**：单独验证默认值与组级覆盖。Task 2 的 mock 用了固定 config，这里改 mock 让不同组带不同 cacheHints 配置。

- [ ] **Step 1: 追加 resolveCacheHints 测试**

在 `group-service.unit.test.ts` 顶部再加一个带 cacheHints 配置的 mock 场景。由于 `vi.mock` 是模块级、全文件共享，改用**在测试内动态 mock**的方式。把现有 `vi.mock('../../utils/config.js', ...)` 移除，改为 `vi.mockImport` 或在每个测试里用 `vi.mocked(getAllConfig).mockResolvedValue(...)`。

重构测试文件头部：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const McpServerMock = vi.fn();
vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation((...args: unknown[]) => {
    McpServerMock(...args);
    return {
      registerTool: vi.fn(),
      registerResource: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

import { GroupMcpService } from './group-service.js';
import { getAllConfig } from '../../utils/config.js';
import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';

function makeCoreManagerMock(): McpServiceManagerInterface {
  return {
    getAllTools: vi.fn().mockResolvedValue([]),
    getServerConnections: vi.fn().mockReturnValue(new Map()),
    getServiceStatus: vi.fn().mockReturnValue(new Map()),
    executeToolCall: vi.fn(),
  } as unknown as McpServiceManagerInterface;
}

function setConfig(groups: Record<string, unknown>): void {
  vi.mocked(getAllConfig).mockResolvedValue({
    groups,
    servers: {},
  } as unknown as Awaited<ReturnType<typeof getAllConfig>>);
}
```

构造时序测试保持（用 `setConfig({ testgroup: {...} })` 在 beforeEach 里设默认）。

在文件末尾新增 describe：

```ts
describe('GroupMcpService - resolveCacheHints (P4)', () => {
  beforeEach(() => {
    McpServerMock.mockClear();
    setConfig({
      testgroup: {
        id: 'testgroup',
        name: 'Test Group',
        servers: ['srv1'],
        tools: [],
      },
    });
  });

  it('默认值：ttlMs=60000, cacheScope=public', async () => {
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();
    // McpServerMock 第 2 参数是 options
    const optionsArg = McpServerMock.mock.calls[0][1] as {
      cacheHints: { 'tools/list': { ttlMs: number; cacheScope: string } };
    };
    expect(optionsArg.cacheHints['tools/list'].ttlMs).toBe(60_000);
    expect(optionsArg.cacheHints['tools/list'].cacheScope).toBe('public');
  });

  it('组级覆盖：toolsListTtlMs=120000 生效', async () => {
    setConfig({
      testgroup: {
        id: 'testgroup',
        name: 'Test Group',
        servers: ['srv1'],
        tools: [],
        cacheHints: { toolsListTtlMs: 120000 },
      },
    });
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();
    const optionsArg = McpServerMock.mock.calls[0][1] as {
      cacheHints: { 'tools/list': { ttlMs: number } };
    };
    expect(optionsArg.cacheHints['tools/list'].ttlMs).toBe(120_000);
  });

  it('组级覆盖：toolsListCacheScope=private 生效', async () => {
    setConfig({
      testgroup: {
        id: 'testgroup',
        name: 'Test Group',
        servers: ['srv1'],
        tools: [],
        cacheHints: { toolsListCacheScope: 'private' },
      },
    });
    const svc = new GroupMcpService('testgroup', makeCoreManagerMock());
    await svc.initialize();
    const optionsArg = McpServerMock.mock.calls[0][1] as {
      cacheHints: { 'tools/list': { cacheScope: string } };
    };
    expect(optionsArg.cacheHints['tools/list'].cacheScope).toBe('private');
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts`
Expected: PASS（构造时序 3 个 + resolveCacheHints 3 个，共 6 个全过）

> 这一步测试应直接通过（Task 2 已实现 resolveCacheHints），是验证性测试。如果失败说明 Task 2 实现有问题。

- [ ] **Step 3: 提交**

```bash
git add backend/src/api/mcp/group-service.unit.test.ts
git commit -m "test(group-service): resolveCacheHints 默认值与组级覆盖用例 (P4)"
```

---

## Task 4: tools/list 确定性排序

**Files:**

- Modify: `backend/src/api/mcp/group-service.ts:289-330`（`registerGroupDynamicTools`）
- Test: `backend/src/api/mcp/group-service.unit.test.ts`（追加）

- [ ] **Step 1: 写排序失败测试**

在 `group-service.unit.test.ts` 新增 describe：

```ts
describe('GroupMcpService - tools/list 确定性排序 (P4)', () => {
  beforeEach(() => {
    McpServerMock.mockClear();
  });

  it('工具按 先 serverId 后 toolName 排序', async () => {
    // 模拟乱序工具：zServer/a、aServer/b、aServer/a
    const cm = makeCoreManagerMock();
    (cm.getAllTools as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'a', serverId: 'zServer', inputSchema: { type: 'object', properties: {} } },
      { name: 'b', serverId: 'aServer', inputSchema: { type: 'object', properties: {} } },
      { name: 'a', serverId: 'aServer', inputSchema: { type: 'object', properties: {} } },
    ]);
    setConfig({
      testgroup: { id: 'testgroup', name: 'T', servers: ['zServer', 'aServer'], tools: [] },
    });

    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    // 注册顺序由 getMcpServer().registerTool 调用顺序决定
    const registerToolCalls = (
      McpServerMock.mock.results[0].value as { registerTool: ReturnType<typeof vi.fn> }
    ).registerTool.mock.calls;

    // 排除 group_status / list_group_tools 两个管理工具（前两个），后面是动态工具
    const dynamicNames = registerToolCalls.slice(2).map((c: unknown[]) => c[0] as string);
    // 注册名 = ${serverId}_${toolName}
    expect(dynamicNames).toEqual(['aServer_a', 'aServer_b', 'zServer_a']);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts -t "确定性排序"`
Expected: FAIL（当前无排序，顺序由 getAllTools 返回顺序决定，会是 `['zServer_a', 'aServer_b', 'aServer_a']`）

- [ ] **Step 3: 实现排序**

修改 `backend/src/api/mcp/group-service.ts` 的 `registerGroupDynamicTools`。找到这两行：

```ts
      // 应用组工具过滤规则
      const filteredTools = this.applyToolFilter(groupTools as GroupToolInfo[]);

      // 注册每个工具
      for (const tool of filteredTools) {
        await this.registerDynamicTool(tool);
      }

      this.availableTools = filteredTools.map((tool) => ({
```

改为：

```ts
      // 应用组工具过滤规则
      const filteredTools = this.applyToolFilter(groupTools as GroupToolInfo[]);

      // P4: 确定性排序（先 serverId 后 toolName 字典序），保证 tools/list 顺序稳定，
      // 使客户端能稳定缓存 tools/list 结果、提升 LLM prompt cache 命中率（2026-07-28 SHOULD）。
      const sortedTools = [...filteredTools].sort((a, b) => {
        const byServer = (a.serverId ?? '').localeCompare(b.serverId ?? '');
        if (byServer !== 0) return byServer;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      // 注册每个工具
      for (const tool of sortedTools) {
        await this.registerDynamicTool(tool);
      }

      this.availableTools = sortedTools.map((tool) => ({
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts`
Expected: PASS（所有测试，含排序测试）

- [ ] **Step 5: 提交**

```bash
git add backend/src/api/mcp/group-service.ts backend/src/api/mcp/group-service.unit.test.ts
git commit -m "feat(group-service): tools/list 确定性排序（先 serverId 后 toolName）(P4)"
```

---

## Task 5: 新增 getGroupServersStatus + registerGroupResources

**Files:**

- Modify: `backend/src/api/mcp/group-service.ts`
- Test: `backend/src/api/mcp/group-service.unit.test.ts`（追加）

**注意**：`registerResource` 的 callback 第一个参数是 `URL`。resource 的 `contents[].uri` 用 string。

- [ ] **Step 1: 写 resources 注册失败测试**

在 `group-service.unit.test.ts` 新增 describe：

```ts
describe('GroupMcpService - registerGroupResources (P4)', () => {
  beforeEach(() => {
    McpServerMock.mockClear();
    setConfig({
      testgroup: { id: 'testgroup', name: 'T', servers: ['srv1', 'srv2'], tools: [] },
    });
  });

  it('注册 4 个 resource，URI 与 cacheHint 正确', async () => {
    const cm = makeCoreManagerMock();
    (cm.getServerConnections as ReturnType<typeof vi.fn>).mockReturnValue(
      new Map([
        ['srv1', { id: 'srv1', status: 'connected' }],
        ['srv2', { id: 'srv2', status: 'disconnected' }],
      ]),
    );
    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    const registerResourceCalls = (
      McpServerMock.mock.results[0].value as { registerResource: ReturnType<typeof vi.fn> }
    ).registerResource.mock.calls;

    expect(registerResourceCalls).toHaveLength(4);

    // 每个调用: [name, uri, config, callback]
    const resources = registerResourceCalls.map((c: unknown[]) => ({
      name: c[0] as string,
      uri: c[1] as string,
      cacheHint: (c[2] as { cacheHint?: { ttlMs?: number; cacheScope?: string } }).cacheHint,
    }));

    // group://status（resource name 是 group_status_resource，避开现有工具 group_status）
    const status = resources.find((r) => r.name === 'group_status_resource')!;
    expect(status.uri).toBe('group://testgroup/status');
    expect(status.cacheHint).toEqual({ ttlMs: 5_000, cacheScope: 'private' });

    // group://servers
    const servers = resources.find((r) => r.name === 'group_servers')!;
    expect(servers.uri).toBe('group://testgroup/servers');
    expect(servers.cacheHint).toEqual({ ttlMs: 5_000, cacheScope: 'private' });

    // hub://config
    const config = resources.find((r) => r.name === 'hub_config')!;
    expect(config.uri).toBe('hub://config');
    expect(config.cacheHint).toEqual({ ttlMs: 300_000, cacheScope: 'public' });

    // hub://version
    const version = resources.find((r) => r.name === 'hub_version')!;
    expect(version.uri).toBe('hub://version');
    expect(version.cacheHint).toEqual({ ttlMs: 86_400_000, cacheScope: 'public' });
  });

  it('getGroupServersStatus 过滤当前组的服务器', async () => {
    const cm = makeCoreManagerMock();
    (cm.getServerConnections as ReturnType<typeof vi.fn>).mockReturnValue(
      new Map([
        ['srv1', { id: 'srv1', status: 'connected' }],
        ['srv2', { id: 'srv2', status: 'disconnected' }],
        ['other', { id: 'other', status: 'connected' }], // 不属于本组
      ]),
    );
    const svc = new GroupMcpService('testgroup', cm);
    await svc.initialize();

    // 通过 group://servers resource 的 callback 间接验证
    const registerResourceCalls = (
      McpServerMock.mock.results[0].value as { registerResource: ReturnType<typeof vi.fn> }
    ).registerResource.mock.calls;
    const serversCall = registerResourceCalls.find((c: unknown[]) => c[0] === 'group_servers') as [
      string,
      string,
      unknown,
      (uri: URL) => Promise<unknown>,
    ];
    const result = (await serversCall[3](new URL('group://testgroup/servers'))) as {
      contents: { text: string }[];
    };
    const payload = JSON.parse(result.contents[0].text);
    expect(payload.servers).toEqual([
      { id: 'srv1', status: 'connected' },
      { id: 'srv2', status: 'disconnected' },
    ]);
    expect(payload.servers.find((s: { id: string }) => s.id === 'other')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts -t "registerGroupResources"`
Expected: FAIL（`registerResource` 未被调用，0 个 resource）

- [ ] **Step 3: 实现 getGroupServersStatus 与 registerGroupResources**

修改 `backend/src/api/mcp/group-service.ts`：

3a. 在 `initialize()` 的 `registerGroupDynamicTools()` 之后加 `registerGroupResources()` 调用：

```ts
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('组MCP服务已初始化，跳过重复初始化', { groupId: this.groupId });
      return;
    }

    try {
      logger.info('初始化组MCP服务', { groupId: this.groupId });

      await this.loadGroupConfig();
      this.buildMcpServer();
      await this.registerGroupManagementTools();
      await this.registerGroupDynamicTools();
      await this.registerGroupResources(); // P4: 注册 Hub 元数据 resources
      this.isInitialized = true;
      logger.info('组MCP服务初始化完成', {
        groupId: this.groupId,
        toolCount: this.availableTools.length,
      });
    } catch (error) {
      logger.error('组MCP服务初始化失败', error as Error, { groupId: this.groupId });
      throw error;
    }
  }
```

3b. 在 `registerGroupDynamicTools` 方法之后、`applyToolFilter` 之前，新增两个方法：

```ts
  /**
   * 获取组的服务器列表与连接状态（P4：group://servers resource 内容源）。
   */
  private async getGroupServersStatus(): Promise<{
    groupId: string;
    servers: Array<{ id: string; status: string }>;
    timestamp: string;
  }> {
    const groupServers = this.groupConfig?.servers ?? [];
    const serverConnections = this.coreServiceManager.getServerConnections();
    return {
      groupId: this.groupId,
      servers: groupServers.map((id) => ({
        id,
        status: serverConnections.get(id)?.status ?? 'disconnected',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 注册 Hub 自身元数据 resources（P4：协议层 cacheHint 在 resources/read 的落点）。
   *
   * 注册 4 个 resource：
   *   - group://{groupId}/status  —— 运行时状态（短 ttl, private）
   *   - group://{groupId}/servers —— 服务器列表与连接状态（短 ttl, private）
   *   - hub://config              —— 全局配置概要（长 ttl, public，每个 group 都注册）
   *   - hub://version             —— 版本信息（极长 ttl, public）
   */
  private async registerGroupResources(): Promise<void> {
    const statusUri = `group://${this.groupId}/status`;
    this.mcpServer.registerResource(
      'group_status_resource',
      statusUri,
      {
        description: `组 '${this.groupId}' 的运行时状态`,
        mimeType: 'application/json',
        cacheHint: { ttlMs: 5_000, cacheScope: 'private' },
      },
      async () => {
        const status = await this.getStatus();
        return {
          contents: [
            { uri: statusUri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) },
          ],
        };
      },
    );

    const serversUri = `group://${this.groupId}/servers`;
    this.mcpServer.registerResource(
      'group_servers',
      serversUri,
      {
        description: `组 '${this.groupId}' 的服务器列表与连接状态`,
        mimeType: 'application/json',
        cacheHint: { ttlMs: 5_000, cacheScope: 'private' },
      },
      async () => {
        const payload = await this.getGroupServersStatus();
        return {
          contents: [
            { uri: serversUri, mimeType: 'application/json', text: JSON.stringify(payload, null, 2) },
          ],
        };
      },
    );

    // hub://config（全局，每个 group 都注册）
    this.mcpServer.registerResource(
      'hub_config',
      'hub://config',
      {
        description: 'Hub 全局配置概要',
        mimeType: 'application/json',
        cacheHint: { ttlMs: 300_000, cacheScope: 'public' },
      },
      async () => {
        const config = await getAllConfig();
        const payload = {
          version: pkg.version,
          groups: Object.keys(config.groups ?? {}),
          serverCount: Object.keys(config.servers ?? {}).length,
        };
        return {
          contents: [
            { uri: 'hub://config', mimeType: 'application/json', text: JSON.stringify(payload, null, 2) },
          ],
        };
      },
    );

    // hub://version（全局，几乎不变）
    this.mcpServer.registerResource(
      'hub_version',
      'hub://version',
      {
        description: 'Hub 版本信息',
        mimeType: 'application/json',
        cacheHint: { ttlMs: 86_400_000, cacheScope: 'public' },
      },
      async () => ({
        contents: [
          {
            uri: 'hub://version',
            mimeType: 'application/json',
            text: JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2),
          },
        ],
      }),
    );

    logger.debug('组 resources 注册完成', { groupId: this.groupId, count: 4 });
  }
```

> **注意 resource name 冲突**：`group_status_resource`（不是 `group_status`），因为现有工具已叫 `group_status`。SDK 的 resource name 与 tool name 空间是否冲突需核实——若 SDK 报错，改为不冲突的名字。实现时先跑测试，若报 name 冲突再调整。

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm --filter @mcp-core/mcp-hub-api exec vitest run src/api/mcp/group-service.unit.test.ts`
Expected: PASS（所有单元测试，含 resources 测试）

- [ ] **Step 5: 提交**

```bash
git add backend/src/api/mcp/group-service.ts backend/src/api/mcp/group-service.unit.test.ts
git commit -m "feat(group-service): 注册 4 个 Hub 元数据 resources（带协议层 cacheHint）(P4)"
```

---

## Task 6: e2e 测试 — tools/list cacheHint + 排序

**Files:**

- Create: `backend/src/e2e/mcp-protocol/cache-semantics.test.ts`

**背景**：e2e 连 `/:group/mcp` 端点（`mcp-test-config.ts` 的 `createResilientMcpClient`）。`listTools()` 返回的 `ListToolsResult` 在 wire 层带 `ttlMs`/`cacheScope`，但 TS 类型可能不显式声明——用 `(result as { ttlMs?: number })` 读取。

- [ ] **Step 1: 写 e2e 测试**

新建 `backend/src/e2e/mcp-protocol/cache-semantics.test.ts`：

```ts
/**
 * P4 缓存语义 e2e 测试
 * 验证 tools/list 响应的 ttlMs/cacheScope、确定性排序，以及 resources/list + resources/read。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupTestEnvironment, setupTestEnvironment, sleep } from '../test-utils.js';
import {
  cleanupMcpTestConfig,
  closeMcpClient,
  createResilientMcpClient,
  ensureTestServerRunning,
} from './mcp-test-config.js';
import type { Client } from '@modelcontextprotocol/client';

describe('P4 缓存语义 e2e', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning();
    if (serverReady) {
      await sleep(2000);
    }
  });

  afterAll(async () => {
    cleanupMcpTestConfig();
    cleanupTestEnvironment();
    restoreConsole();
  });

  it('tools/list 响应带 ttlMs 与 cacheScope', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('cache-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = (await client.listTools()) as {
        ttlMs?: number;
        cacheScope?: string;
        tools: { name: string }[];
      };
      // Hub 默认配置：ttlMs=60000, cacheScope=public（SDK 默认 private，Hub 显式覆盖为 public）
      expect(result.ttlMs).toBe(60_000);
      expect(result.cacheScope).toBe('public');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('tools/list 确定性排序（连续两次顺序一致）', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('sort-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const r1 = await client.listTools();
      const r2 = await client.listTools();
      const names1 = r1.tools.map((t) => t.name);
      const names2 = r2.tools.map((t) => t.name);
      expect(names1).toEqual(names2);
      // 验证是字典序（按注册名 ${serverId}_${toolName}，等价于先 serverId 后 toolName）
      const sorted = [...names1].sort();
      expect(names1).toEqual(sorted);
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);
});
```

- [ ] **Step 2: 运行 e2e 验证**

Run: `pnpm test:e2e -- cache-semantics`
Expected: 2 个测试通过

> 若 `result.ttlMs` 读不到（undefined），说明 SDK 在 client 侧把 cache 字段放在 `_meta` 或被 strip。此时改为读取 `result._meta?.ttlMs` 或在 transport 层拦截原始响应。先按顶层读取，跑失败再调整。

- [ ] **Step 3: 提交**

```bash
git add backend/src/e2e/mcp-protocol/cache-semantics.test.ts
git commit -m "test(e2e): tools/list cacheHint 与确定性排序验证 (P4)"
```

---

## Task 7: e2e 测试 — resources/list + resources/read

**Files:**

- Modify: `backend/src/e2e/mcp-protocol/cache-semantics.test.ts`（追加）

- [ ] **Step 1: 追加 resources e2e 测试**

在 `cache-semantics.test.ts` 加 describe：

```ts
describe('P4 resources e2e', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning();
    if (serverReady) await sleep(2000);
  });

  afterAll(async () => {
    cleanupMcpTestConfig();
    cleanupTestEnvironment();
    restoreConsole();
  });

  it('resources/list 返回 4 个 resource', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('res-list-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.listResources();
      const uris = result.resources.map((r) => r.uri);
      // 默认组 'default'：应有 group://default/status、group://default/servers、hub://config、hub://version
      expect(uris).toContain('group://default/status');
      expect(uris).toContain('group://default/servers');
      expect(uris).toContain('hub://config');
      expect(uris).toContain('hub://version');
      expect(result.resources.length).toBeGreaterThanOrEqual(4);
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('resources/read hub://version 返回版本 JSON', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('res-read-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.readResource({ uri: 'hub://version' });
      expect(result.contents.length).toBeGreaterThan(0);
      const text = (result.contents[0] as { text?: string }).text;
      const parsed = JSON.parse(text ?? '{}');
      expect(parsed).toHaveProperty('version');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('resources/read group://default/status 返回状态 JSON', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('res-status-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.readResource({ uri: 'group://default/status' });
      const text = (result.contents[0] as { text?: string }).text;
      const parsed = JSON.parse(text ?? '{}');
      expect(parsed).toHaveProperty('groupId', 'default');
      expect(parsed).toHaveProperty('availableTools');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);
});
```

- [ ] **Step 2: 运行 e2e 验证**

Run: `pnpm test:e2e -- cache-semantics`
Expected: 5 个测试全过（tools/list 2 个 + resources 3 个）

- [ ] **Step 3: 提交**

```bash
git add backend/src/e2e/mcp-protocol/cache-semantics.test.ts
git commit -m "test(e2e): resources/list 与 resources/read 验证 (P4)"
```

---

## Task 8: 全量验证 + 文档更新

**Files:**

- Modify: `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`

- [ ] **Step 1: 全量 typecheck + 测试**

Run: `pnpm typecheck`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿（含新单元测试与 e2e）

- [ ] **Step 2: 修复任何回归**

如果有现有测试因 McpServer 构造时序调整或排序变化而失败，逐个修复。常见风险点：

- `group-routing-enhanced.test.ts` 或其他依赖 `GroupMcpService` 的测试，可能假设构造函数即创建 McpServer
- e2e 的 `hub-aggregation.test.ts` 如果断言了工具顺序，需更新为排序后的顺序

- [ ] **Step 3: 更新总览 spec**

修改 `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`：

3a. 子项目全景表 P4 行：

```markdown
| **P4** | `ttlMs`/`cacheScope` 缓存语义 | ✅ 完成 | ✅ **实现完成** | `2026-07-26-p4-cache-semantics-design.md` |
```

3b. "各子项目实现进度"表加 P4 行（分支、关键 commit、进度按实际情况填）。

3c. "跨子项目共享待办"表 `RedisCacheManager` 行的"现状"列追加备注：

```markdown
| `RedisCacheManager`（当前 no-op，`cache-manager.ts:338-377`） | P6（候选）或独立基建 | P3/P4 多实例前必须实现 | 🟡 no-op 占位；**P4 评估确认协议层 cacheHint 不依赖 Redis** | ... |
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md
git commit -m "docs: P4 实现完成，回写总体 spec 状态"
```

---

## Self-Review

**Spec 覆盖检查**：

- ✅ §1.1 McpServer 构造时序 → Task 2
- ✅ §1.2 resolveCacheHints 配置解析 → Task 2（实现）+ Task 3（测试）
- ✅ §1.3 Group 类型 cacheHints 字段 → Task 1
- ✅ §1.4 tools/list 确定性排序 → Task 4
- ✅ §2.1 4 个 resource 清单 → Task 5
- ✅ §2.2 registerGroupResources 注册 → Task 5
- ✅ §2.3 getGroupServersStatus → Task 5
- ✅ DoD: tools/list cacheHint → Task 6 e2e
- ✅ DoD: 确定性排序 → Task 4 单元 + Task 6 e2e
- ✅ DoD: resources/list 4 个 → Task 7 e2e
- ✅ DoD: resources/read → Task 7 e2e
- ✅ DoD: 组配置 cacheHints 入口 → Task 1 schema + Task 3 单元
- ✅ DoD: typecheck+test 全绿 → Task 8
- ✅ §3.3 总览 spec 更新 → Task 8

**Placeholder 扫描**：无 TBD/TODO；每个步骤含完整代码或命令。

**类型一致性检查**：

- `resolveCacheHints` 返回 `{ ttlMs: number; cacheScope: 'public' | 'private' }` —— Task 2 定义，Task 3 测试一致
- `getGroupServersStatus` 返回 `{ groupId, servers: Array<{id, status}>, timestamp }` —— Task 5 定义与测试一致
- resource name：`group_status_resource`（避开现有工具 `group_status`）—— Task 5 实现与测试一致（测试用 name 查找时注意：测试里找 `group_status`，但实现用 `group_status_resource`，需对齐）

**发现的对齐问题（已修正）**：Task 5 status resource 的 name 在实现与测试里都用 `group_status_resource`（避开现有工具 `group_status` 的命名空间）。`group_servers`/`hub_config`/`hub_version` 三个 name 不与现有工具冲突，保持简短。

**风险提示**：

1. `registerResource` 的 callback 参数是 `URL` 类型，但测试 mock 没用这个参数（直接调 callback）。实现时 callback 签名是 `(uri: URL) => ...`，但 body 里不读 uri（用闭包的 statusUri 字符串），类型上需接收 URL 参数。
2. e2e 读 `result.ttlMs` 若失败，回退读 `_meta` 或 transport 拦截（Task 6 Step 2 备注）。
3. SDK resource name 与 tool name 若共享命名空间会冲突，Task 5 已用 `group_status_resource` 规避。
