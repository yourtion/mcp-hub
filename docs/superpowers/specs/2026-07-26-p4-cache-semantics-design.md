# Spec: P4 — `ttlMs`/`cacheScope` 缓存语义（协议层 cacheHint + resources 体系）

- **状态**: Draft（待实现）
- **日期**: 2026-07-26
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（总体跟踪，§P4 章节）
  - `docs/superpowers/specs/2026-07-25-p1-transport-upgrade-design.md`（P1 前置，已完成）

## 目的

采纳 MCP `2026-07-28` 的 `CacheableResult`（SEP-2549）协议层缓存语义，让 Hub 作为 MCP server 在 `tools/list` 结果与 `resources/read` 结果上提供有意义的 `ttlMs`/`cacheScope` 缓存提示，并补齐 `tools/list` 的确定性排序（2026-07-28 新增 SHOULD）。同时新增 resources 体系（Hub 当前零实现 `registerResource`），给协议层 cacheHint 提供完整落点。

**与已有缓存的区分**：项目已有 `CacheManager`（`packages/core/src/api-to-mcp/services/cache-manager.ts`），那是**工具调用结果缓存**（Hub 调外部 REST API 后缓存响应）。P4 是**协议级缓存语义**（MCP `tools/list`/`resources/read` 结果给客户端的缓存提示）。两者不同层面，P4 不替换已有缓存。

## 范围与边界

### 纳入范围

1. **`tools/list` 协议层 cacheHint**：`ttlMs: 60_000`（1 分钟）、`cacheScope: 'public'`，预留组配置入口。
2. **`tools/list` 确定性排序**：先 `serverId` 字典序、再 `toolName` 字典序。
3. **新增 resources 体系**（4 个 resource，每个带 cacheHint）：
   - `group://{groupId}/status`（组运行时状态）
   - `group://{groupId}/servers`（组服务器列表与连接状态）
   - `hub://config`（全局配置概要）
   - `hub://version`（版本信息）
4. **配置失效联动**：复用现有 `invalidateGroupMcpService`，无需新增失效代码。

### 显式排除（防止范围蔓延）

| 事项                                              | 决策       | 理由                                                                                                                                       |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `RedisCacheManager` 实现                          | ❌ 不在 P4 | 协议层 cacheHint 不依赖 Redis（客户端自己缓存）；Hub 侧 tools/list 响应缓存由 McpServer 实例缓存覆盖，无需额外存储层。归属仍为 P6/独立基建 |
| Hub 侧 `tools/list` 响应缓存（用 `CacheManager`） | ❌ 不在 P4 | McpServer 实例按 group 缓存（注册的工具存在内存），已是事实上的响应缓存；再套一层 CacheManager 是缓存已缓存的数据，价值低（方案 A 决策）   |
| 上游 MCP server resources 透传                    | ❌ 不在 P4 | 独立待办，未归属（见总览 spec 跨子项目共享待办）。需处理上游 resource 发现、URI 重写、聚合，复杂度高                                       |
| REST API 端点作为 resource                        | ❌ 不在 P4 | 属 api-to-mcp 子系统，与 P4 的 group-router 路径不同                                                                                       |
| `group://tools` resource                          | ❌ 不在 P4 | 与 `tools/list` 内容重叠，YAGNI                                                                                                            |
| 移除现有 `group_status`/`list_group_tools` 工具   | ❌ 不在 P4 | 保留以维持向后兼容；工具用于主动调用，resource 用于预读取/缓存，两者形态不同（文本 vs JSON）                                               |
| P2 OAuth 引入的按用户工具过滤                     | ❌ 不在 P4 | P4 保持 `cacheScope: public`；P2 落地后若引入按权限过滤，需复查 cacheScope（见 §3.1 follow-up）                                            |

### 前置条件

- **P1 已完成** ✅：`@modelcontextprotocol/server` v2 API（`McpServer`、`createMcpHandler`、`cacheHints`、`registerResource`）可用。

### DoD（完成标准）

| DoD 项                                  | 验证方式                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tools/list` 响应带 cacheHint           | 客户端（或 e2e 用 StreamableHTTPClientTransport）调用 `tools/list`，响应包含 `ttlMs: 60_000`、`cacheScope: 'public'` |
| `tools/list` 确定性排序                 | 连续两次 `tools/list`，工具顺序一致；顺序为先 `serverId` 后 `toolName` 字典序                                        |
| `resources/list` 返回 4 个 resource     | 客户端调用 `resources/list`，能看到 `group://.../status`、`group://.../servers`、`hub://config`、`hub://version`     |
| `resources/read` 返回内容且带 cacheHint | 读取任一 resource，返回 JSON 内容，响应带对应 `ttlMs`/`cacheScope`                                                   |
| 配置变更联动                            | PUT/DELETE 组或工具过滤变更后，`tools/list` 和 resources 内容更新（依赖现有 `invalidateGroupMcpService`）            |
| 组配置 cacheHints 入口生效              | 在组配置里设 `cacheHints.toolsListTtlMs: 120000`，`tools/list` 响应的 ttlMs 反映该值                                 |
| `pnpm typecheck && pnpm test` 全绿      | CI 验证                                                                                                              |

## 现状分析

### 关键代码挂载点

| 文件:行                                                | 现状                                                                                         | P4 改动                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `backend/src/api/mcp/group-service.ts:82`              | `new McpServer({name, version})` 不传 cacheHints（等于 SDK 默认 `ttlMs:0` 不缓存）           | 加 `cacheHints` 选项；构造时机调整（见 §2.1） |
| `backend/src/api/mcp/group-service.ts:91-122`          | `initialize()` 里 `loadGroupConfig → registerTools → registerDynamicTools`                   | 新增 `registerGroupResources()` 步骤          |
| `backend/src/api/mcp/group-service.ts:289-330`         | `registerGroupDynamicTools`：`getAllTools → filter → applyToolFilter → register`，**无排序** | 在 register 前加确定性排序                    |
| `backend/src/api/mcp/group-service.ts:140-165`         | `getStatus()` 返回 `GroupServiceStatus`                                                      | 复用为 `group://status` resource 内容源       |
| `backend/src/api/mcp/mcp-handler-factory.ts:177-244`   | `invalidateGroupMcpService` 配置变更时重建 service+handler                                   | 无需改（resources 随 McpServer 重建自动刷新） |
| `packages/share/src/config/schemas/group.schema.ts:29` | `GroupSchema`（zod）无 cacheHints 字段                                                       | 加可选 `cacheHints` 字段                      |

### 已验证的零实现项

- `grep -rn 'registerResource' backend/src packages --include='*.ts'` → 0 命中（项目零实现 resources）
- `grep -rn 'cacheHint\|ttlMs\|cacheScope' backend/src packages --include='*.ts'` → 0 命中（项目零实现协议层缓存）
- `grep -rn 'sort.*tool\|tool.*sort' backend/src packages/core/src --include='*.ts'` → 0 命中（`tools/list` 无排序）

### SDK v2 cacheHints 契约（已通过 context7 核实）

来自 `@modelcontextprotocol/typescript-sdk` 文档 `docs/clients/caching.md` 与 `docs/migration/support-2026-07-28.md`：

```ts
// ServerOptions.cacheHints：全局默认，按 operation 区分
const server = new McpServer(
  { name: 'catalog', version: '1.0.0' },
  {
    cacheHints: {
      'tools/list': { ttlMs: 60_000, cacheScope: 'public' },
      'resources/read': { ttlMs: 5_000, cacheScope: 'private' },
    },
  },
);
```

- SDK 默认保守值：`ttlMs: 0`（不缓存）、`cacheScope: 'private'`
- 优先级：`registerResource` 的 `cacheHint`（resource 级）> `ServerOptions.cacheHints['resources/read']`（全局级）
- 2025-era 响应不含这些 cache 字段（P1 已删除 legacy 路径，仅服务 modern 流量）

> **实现时核实项**：`registerResource` 的确切签名（callback 参数形态、metadata 字段名）在不同 beta 版本可能略有差异。实现第一步用 context7 二次确认 + 读 `node_modules/@modelcontextprotocol/server` 类型定义。本 spec §3.2 的代码示例基于 SDK 文档示例形式，实现时按实际签名调整。

## §1. tools/list 协议层 cacheHint + 确定性排序

### 1.1 McpServer 构造时序调整（关键）

**问题**：`cacheHints` 的取值需读组配置（支持组级覆盖），但现有代码在**构造函数**里 `new McpServer`，此时 `groupConfig` 还未加载（`loadGroupConfig()` 在 `initialize()` 里）。

**解决**：把 `new McpServer` 从构造函数挪到 `initialize()` 内部、`loadGroupConfig()` 之后：

```ts
export class GroupMcpService {
  private mcpServer!: McpServer; // definite assignment：initialize() 内赋值
  private groupCacheHints: { ttlMs: number; cacheScope: 'public' | 'private' };
  // ...

  constructor(groupId: string, coreServiceManager: McpServiceManagerInterface) {
    this.groupId = groupId;
    this.coreServiceManager = coreServiceManager;
    // 不再在此 new McpServer；延迟到 initialize()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      /* ... */ return;
    }
    await this.loadGroupConfig(); // 先加载配置
    this.buildMcpServer(); // 再构造 McpServer（带 cacheHints）
    await this.registerGroupManagementTools();
    await this.registerGroupDynamicTools();
    await this.registerGroupResources();
    this.isInitialized = true;
  }

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
        // 'resources/read' 不设全局默认，由各 registerResource 的 cacheHint 单独控制
      },
    );
  }
  // ...
}
```

**时序安全性**：

- `getMcpServer()`（`group-service.ts:127`）已有 `isInitialized` 检查，未初始化会抛 `ServiceError`。
- `mcp-handler-factory.ts:113` 的 `ensureGroupMcpService` 在 `await groupService.initialize()` 之后才让 handler factory 取 server。
- 因此把构造挪到 `initialize()` 内不影响任何调用方。

### 1.2 cacheHints 配置解析

默认值与组配置覆盖逻辑：

```ts
private resolveCacheHints(groupConfig: Group | null): { ttlMs: number; cacheScope: 'public' | 'private' } {
  const overrides = groupConfig?.cacheHints;
  return {
    ttlMs: overrides?.toolsListTtlMs ?? 60_000,           // 默认 1 分钟
    cacheScope: overrides?.toolsListCacheScope ?? 'public', // 默认 public（工具列表跨用户一致）
  };
}
```

### 1.3 Group 类型扩展（配置入口）

在 `packages/share/src/config/schemas/group.schema.ts:29` 的 `GroupSchema` 加可选字段：

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
  // P4 新增：协议层 cacheHint 组级覆盖
  cacheHints: z
    .object({
      toolsListTtlMs: z.number().int().nonnegative().optional(),
      toolsListCacheScope: z.enum(['public', 'private']).optional(),
    })
    .optional(),
});
```

`Group` 类型（`z.infer<typeof GroupSchema>`）自动获得 `cacheHints?` 字段，无需单独改 type 导出。

### 1.4 tools/list 确定性排序

在 `registerGroupDynamicTools`（`group-service.ts:289`）的 `applyToolFilter` 之后、`registerDynamicTool` 之前加排序：

```ts
private async registerGroupDynamicTools(): Promise<void> {
  // ...现有 filter 逻辑...
  const filteredTools = this.applyToolFilter(groupTools as GroupToolInfo[]);

  // P4: 确定性排序（先 serverId 后 toolName），保证 tools/list 顺序稳定，
  // 使客户端能稳定缓存 tools/list 结果、提升 LLM prompt cache 命中率。
  const sortedTools = [...filteredTools].sort((a, b) => {
    const byServer = (a.serverId ?? '').localeCompare(b.serverId ?? '');
    if (byServer !== 0) return byServer;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  for (const tool of sortedTools) {
    await this.registerDynamicTool(tool);
  }

  this.availableTools = sortedTools.map(/* ...现有... */);
  // ...
}
```

**排序键说明**：用 `tool.name`（原始工具名）而非注册名 `${serverId}_${name}`。因先按 serverId 排序，serverId 相同组内再按 name 排，与按注册名排序结果等价，但语义更清晰。

## §2. resources 体系

### 2.1 Resource 清单

| URI 模板                    | 内容来源                                      | cacheScope | ttlMs               | 说明                                   |
| --------------------------- | --------------------------------------------- | ---------- | ------------------- | -------------------------------------- |
| `group://{groupId}/status`  | `GroupMcpService.getStatus()`（复用现有逻辑） | `private`  | `5_000`（5s）       | 运行时状态（连接数、工具数），动态变化 |
| `group://{groupId}/servers` | 新逻辑：组 server 列表 + 连接状态             | `private`  | `5_000`（5s）       | 运行时连接状态                         |
| `hub://config`              | `getAllConfig()` 概要（版本、group 列表）     | `public`   | `300_000`（5min）   | 跨 group 共享、变更不频繁              |
| `hub://version`             | `package.json` 的 name/version                | `public`   | `86_400_000`（24h） | 几乎不变                               |

**cacheScope 分级理由**：

- `group://status`、`group://servers` 含运行时连接状态，可能因部署环境不同而异，且未来 P2 OAuth 后可能含敏感信息，用 `private`。
- `hub://config`、`hub://version` 是全局静态信息，跨用户一致，用 `public`。

**关于全局 resource（`hub://`）的注册位置**：`GroupMcpService` 按 group 实例化，但客户端连的是某个 group 的端点。全局 resource 需要在**每个 group 的 McpServer** 上都注册（内容一致）。这是可接受的冗余——读取成本低（内存 JSON），且 group 数量通常不大。如未来 group 数量大（>100），可考虑独立 hub-level McpServer，P4 不预埋。

### 2.2 注册落点

在 `GroupMcpService.initialize()` 里 `registerGroupDynamicTools()` 之后调用新方法 `registerGroupResources()`：

```ts
async initialize(): Promise<void> {
  // ...
  await this.loadGroupConfig();
  this.buildMcpServer();
  await this.registerGroupManagementTools();
  await this.registerGroupDynamicTools();
  await this.registerGroupResources();  // P4 新增
  this.isInitialized = true;
}
```

`registerGroupResources` 注册 4 个 resource（代码示例基于 SDK 文档形式，实现时按 `registerResource` 实际签名调整）：

```ts
private async registerGroupResources(): Promise<void> {
  const statusUri = `group://${this.groupId}/status`;
  this.mcpServer.registerResource(
    'group_status',
    statusUri,
    {
      description: `组 '${this.groupId}' 的运行时状态`,
      mimeType: 'application/json',
      cacheHint: { ttlMs: 5_000, cacheScope: 'private' },
    },
    async () => {
      const status = await this.getStatus();
      return {
        contents: [{
          uri: statusUri,
          mimeType: 'application/json',
          text: JSON.stringify(status, null, 2),
        }],
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
        contents: [{
          uri: serversUri,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        }],
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
        contents: [{
          uri: 'hub://config',
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        }],
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
      contents: [{
        uri: 'hub://version',
        mimeType: 'application/json',
        text: JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2),
      }],
    }),
  );

  logger.debug('组 resources 注册完成', { groupId: this.groupId, count: 4 });
}
```

### 2.3 `group://servers` 内容形态

新私有方法 `getGroupServersStatus()`，从 `coreServiceManager.getServerConnections()` 过滤当前 group 的 servers：

```ts
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
```

> 实现时根据 `ServerConnection` 类型的实际字段（`server_manager.ts` 中定义）补全更多字段（如 `transport`、`lastError` 等）。

### 2.4 与现有工具的关系

| 现有工具                                 | 新 resource                   | 关系                                             |
| ---------------------------------------- | ----------------------------- | ------------------------------------------------ |
| `group_status`（返回纯文本状态）         | `group://status`（返回 JSON） | 内容源相同（`getStatus()`），形态不同；两者并存  |
| `list_group_tools`（返回纯文本工具列表） | 无对应 resource               | 不新增 `group://tools`，避免与 `tools/list` 重叠 |

### 2.5 失效联动

无需新增失效代码。现有 `invalidateGroupMcpService`（`mcp-handler-factory.ts:177`）在配置变更时重建 `GroupMcpService` + McpServer，resources 随 McpServer 重建自动刷新。`hub://config` 内容通过 `getAllConfig()` 实时读取，无需额外失效。

## §3. 跨子项目影响与 follow-up

### 3.1 给 P2 留的复查钩子（重要）

> **P4-P2 耦合点**：P4 的 `tools/list` `cacheScope` 默认 `public`，基于"工具列表跨用户一致"的假设。当 P2 入站 OAuth 落地、且 Hub 实现了**按用户权限过滤工具**（如某些工具仅特定 scope 可见）时，`cacheScope` 必须改为 `private`，否则会泄露工具元数据给未授权用户。
>
> **P2 brainstorming 时必须复查此点**。调整路径：通过组配置 `cacheHints.toolsListCacheScope: 'private'` 入口，或 P2 引入默认 private 的全局策略。

### 3.2 不影响其他子项目

| 子项目                     | 是否受 P4 影响 | 说明                                                                                  |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------- |
| P2（入站 OAuth）           | ⚠️ 见 §3.1     | cacheScope 在 OAuth 后可能需改 private                                                |
| P3（出站 OAuth）           | ❌ 无          | 不同子系统（api-to-mcp vs group-router）                                              |
| P5（subscriptions/listen） | ❌ 无          | P5 推迟；未来 P5 的 `listChanged` 通知可与 P4 的 McpServer 重建机制协同，但 P4 不预埋 |
| P6（OTel/弃用清理）        | ❌ 无          | P4 不引入新的 console.\* 或弃用项                                                     |

### 3.3 总览 spec 更新（P4 完成后回写）

1. **子项目全景表**：P4 spec 状态改 ✅，详细 spec 列填本 spec 路径。
2. **实现进度跟踪表**：加 P4 分支、关键 commit、进度。
3. **跨子项目共享待办表**：`RedisCacheManager` 行的"现状"备注更新为"P4 评估后确认协议层 cacheHint 不依赖 Redis，Hub 侧缓存由 McpServer 实例缓存覆盖；归属仍为 P6/独立基建"。

## §4. 风险与缓解

| 风险                                                     | 缓解                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registerResource` 签名在 beta 版本不确定                | 实现第一步用 context7 + 读 `node_modules/@modelcontextprotocol/server` 类型定义核实；如签名不符，调整 §2.2 代码示例                              |
| McpServer 构造时序调整（§1.1）破坏 `getMcpServer()` 调用 | `getMcpServer()` 已有 `isInitialized` 检查（`group-service.ts:128`）；factory 在 `await initialize()` 后才调用，时序安全；增加针对此点的单元测试 |
| ttlMs=60s 导致客户端配置变更传播延迟                     | 组配置 `cacheHints.toolsListTtlMs` 允许组级覆盖；现有 `invalidateGroupMcpService` 保证 Hub 侧立即重建，客户端最长 60s 后拿到新列表（可接受）     |
| 全局 resource（`hub://`）在每个 group 注册造成冗余       | 读取成本低（内存 JSON）；group 数量大时（>100）可考虑独立 hub-level McpServer，P4 不预埋                                                         |
| resources 引入新的错误处理路径                           | `registerResource` 的 callback 内 try/catch，失败返回错误 JSON 而非抛出（与现有 `registerGroupManagementTools` 的错误处理风格一致）              |

## §5. 测试策略

### 单元测试

| 测试点                                      | 文件                         | 覆盖                                                                  |
| ------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `resolveCacheHints` 默认值                  | `group-service.unit.test.ts` | 不配 cacheHints 时返回 `ttlMs:60_000, cacheScope:'public'`            |
| `resolveCacheHints` 组级覆盖                | 同上                         | 配 `toolsListTtlMs:120000` 时返回 120000                              |
| McpServer 构造带 cacheHints                 | 同上                         | mock McpServer 构造函数，断言第二参数含 `cacheHints['tools/list']`    |
| `tools/list` 确定性排序                     | 同上                         | 构造乱序 tools，断言注册顺序为先 serverId 后 toolName                 |
| McpServer 构造时序                          | 同上                         | 构造函数不 new McpServer；`initialize()` 后 `getMcpServer()` 返回非空 |
| `registerGroupResources` 注册 4 个 resource | 同上                         | mock `mcpServer.registerResource`，断言被调 4 次，URI/cacheHint 正确  |
| `getGroupServersStatus` 过滤逻辑            | 同上                         | 给定 groupServers + serverConnections，断言过滤+status 字段           |

### e2e 测试

| 测试点                              | 文件                                      | 覆盖                                                                                                |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tools/list` 响应带 cacheHint       | `group-routing-enhanced.test.ts` 或新文件 | 用 `StreamableHTTPClientTransport` 连 `/:group/mcp`，调 `tools/list`，断言响应 `ttlMs`/`cacheScope` |
| `tools/list` 确定性排序             | 同上                                      | 连续两次 `tools/list`，断言顺序一致且符合排序键                                                     |
| `resources/list` 返回 4 个 resource | 同上                                      | 调 `resources/list`，断言返回 4 个 resource，URI 正确                                               |
| `resources/read` 返回内容           | 同上                                      | 读 `group://.../status`、`hub://version` 等，断言 JSON 内容可解析                                   |
| 配置变更后 tools/list 更新          | 同上                                      | 改组工具过滤，调 `tools/list`，断言反映变更（依赖 invalidateGroupMcpService）                       |

## 参考资料

- [MCP TypeScript SDK - Caching](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/clients/caching.md)
- [Adopting 2026-07-28 - Cache fields and cache hints](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)
- 总览 spec `2026-07-25-mcp-2026-07-28-adoption-overview.md` §P4
