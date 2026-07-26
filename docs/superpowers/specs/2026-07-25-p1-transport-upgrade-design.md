# P1: 传输层升级到 MCP 2026-07-28

- **状态**: Draft
- **日期**: 2026-07-25
- **作者**: yourtion
- **关联**: `docs/superpowers/specs/2026-07-11-project-audit-report.md`

## 背景

当前 mcp-hub 基于 MCP 协议 `2025-11-25` 实现，SDK 锁定在 `@modelcontextprotocol/sdk@^1.16.0`（v1 最后版本）。MCP 协议已于 2026-07-28 发布 Release Candidate，是一次"大重写"级别更新，核心是**传输层无状态化**与**协议能力扩展**。同时官方 TypeScript SDK 已发布 `2.0.0-beta.5`，包结构整个重构，提供了 Hono 适配器和迁移 codemod。

本次迭代的目标是**全量跟进 MCP 协议最新进展**，但因其范围庞大，拆分为 6 个独立子项目分阶段交付。本 spec 是第一个子项目 **P1（传输层升级）**，它是后续所有新能力的地基。

## 子项目全景（P1-P6）

"全量跟进协议最新进展"被分解为 6 个相对独立、各自独立 spec 的子项目：

| # | 子项目 | 复杂度 | 依赖 | 优先级 |
|---|---|---|---|---|
| **P1** | 传输层升级到 2026-07-28 无状态 | 中高 | 无 | ⭐⭐⭐ **本 spec** |
| P2 | 入站 OAuth 2.1（Protected Resource） | 高 | 弱依赖 P1 | ⭐⭐⭐ |
| P3 | 出站 OAuth（AuthenticationStrategy） | 中 | 无 | ⭐⭐ |
| P4 | `ttlMs`/`cacheScope` 缓存语义 | 中 | 弱依赖 P1 | ⭐⭐⭐ |
| P5 | `subscriptions/listen` + MRTR | 中高 | 依赖 P1 | ⭐ |
| P6 | OTel trace context + 弃用项清理 | 低 | 无 | ⭐ |

**推荐主线顺序**：P1 → P4 → P2 → P3 → P6 → P5

P5 建议推迟，因为客户端侧（Claude Desktop 等）对 `subscriptions/listen` 和 MRTR 的支持还在早期，网关先做意义不大。

## 范围（P1）

### 目标

1. 升级到 `@modelcontextprotocol/sdk` v2（`2.0.0-beta.5`，待 GA 后升正式版），采纳 MCP `2026-07-28` 协议。
2. 入站方向（Hub 对 MCP 客户端）**激进升级**，只支持新协议，拒绝 2025-era 握手。
3. 出站方向（Hub 连外部 MCP server）**保留兼容**，新老协议都能连，Hub 充当协议转换层。
4. 删除 MCP 协议级 SSE（`/sse` 端点），保留 Dashboard 业务 SSE（`sse_event_manager`）。
5. 删除已 deprecated 的全局 `/mcp` legacy 端点。

### 非目标（留给后续子项目）

- 入站/出站 OAuth 实现（P2、P3）。
- `ttlMs`/`cacheScope` 缓存语义的业务应用（P4）。
- `subscriptions/listen`、MRTR（P5）。
- OTel trace context 接入（P6）。
- 修复 `simple-auth.ts` 假认证、`RedisCacheManager` no-op（留给独立的安全债清理）。

### 关键决策（已在 brainstorming 中确认）

| 决策 | 选择 | 理由 |
|---|---|---|
| 兼容性策略 | 激进升级，入站只支持 2026-07-28 | 项目还在 0.0.1，趁早切干净比双轨维护省事 |
| MCP 级 SSE | 直接删除 | 2026-07-28 已重分类为 Deprecated；激进升级下不保留 |
| legacy `/mcp` 端点 | 直接删除 | 已有 deprecation 标记（Sunset 2026-10-01），与激进升级一致 |
| 出站方向 | `{ mode: 'auto' }` 保留兼容 | 外部 server 生态参差不齐，网关价值在于能连各种 server |
| 出站 SSE 连接 | 保留 | Hub 充当协议转换层（老 SSE server → 新 Streamable HTTP 客户端） |
| McpServer 生命周期 | 按 group 缓存 + 失效钩子 | 复用现有配置变更事件机制，兼顾性能与一致性 |

## 设计

### §1 整体架构与模块边界

**核心思路**：用官方 `@modelcontextprotocol/hono` 适配器替换手写 transport 层，把 Hub 从"自己管 Streamable HTTP 细节"降级为"在 Hono 路由里挂 MCP handler"。

**模块变更**：

```
backend/src/api/mcp/
├── group-router.ts         # 改造：用 createMcpHandler 替换手写 transport
├── group-service.ts        # 改造：McpServer 实例化方式调整
└── mcp-handler-factory.ts  # 新增：封装"按组构建 McpServer + handler"逻辑（从 group-router 抽出，便于测试）

backend/src/services/
└── server_manager.ts       # 改造：client import 从 sdk/client/* 改 @modelcontextprotocol/client

backend/src/legacy/
└── mcp-legacy.ts           # 删除（连带清理 index.ts re-export、app.ts 挂载、mcp_service.ts 若仅 legacy 使用）

packages/cli/src/transport/
└── cli-transport.ts        # 改造：serveStdio() 替换 StdioServerTransport

删除：
├── backend/src/sse.ts              # MCP 级 /sse 端点（入站）
├── backend/src/sse.unit.test.ts    # 对应测试
└── backend/src/utils/sse.ts        # 本地 SSETransport 实现（仅服务于入站 /sse 端点）

保留：
├── backend/src/services/sse_event_manager.ts  # Dashboard 业务 SSE，与 MCP 协议无关
└── server_manager.ts 里的 SSEClientTransport   # 出站用，来自 SDK 的 client 包，与本地 utils/sse.ts 无关
```

### §2 依赖与运行时升级

**依赖变更（按 workspace 成员）**：

| 包 | 移除 | 新增 |
|---|---|---|
| `packages/core` | `@modelcontextprotocol/sdk@^1.0.4` | `@modelcontextprotocol/client` |
| `packages/cli` | `@modelcontextprotocol/sdk@^1.0.4` | `@modelcontextprotocol/server` + `@modelcontextprotocol/node`（`serveStdio`） |
| `backend` | `@modelcontextprotocol/sdk@^1.16.0` | `@modelcontextprotocol/server` + `@modelcontextprotocol/hono` + `@modelcontextprotocol/client` + `@modelcontextprotocol/core` |
| `backend` | `fetch-to-node` | （移除，`createMcpHandler` 内部已处理 Hono↔Node 转换） |

**运行时**：
- Node 18 → **Node 20+**（v2 硬性要求）。
- 影响：`package.json` 的 `engines`、CI `node-version`、Dockerfile 基础镜像、README/DEPLOYMENT 文档。
- ESM 不变（v2 同时出 ESM + CJS，项目本来就是 ESM）。

**版本钉法**：
- 不手钉，**跑 codemod 后采纳其打印的 manifest summary**（codemod 根据实际 import 计算每个 member 需要的包）。
- 当前用 `2.0.0-beta.5`。**待 2.0.0 GA 后**，在 changeset 里升正式版。
- **TODO**：跟踪 2.0.0 GA 发布时间，发布前升正式版。

**`@modelcontextprotocol/hono` 的 peer dependency**：声明 `hono` 为 peer dep，需在 `backend` 显式声明（项目已用 Hono 4，已满足）。

### §3 Transport 层重写（核心）

**当前形态**（`backend/src/api/mcp/group-router.ts:124`）：
```typescript
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await mcpServer.connect(transport);
await transport.handleRequest(req, res, body);  // req/res 来自 fetch-to-node 转换
```
手写 transport + 手动 session 管理 + fetch-to-node 桥接，每请求 new transport。

**目标形态**：
```typescript
// backend/src/api/mcp/mcp-handler-factory.ts (新增)
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from '@modelcontextprotocol/hono';

export function createGroupMcpHandler(buildServer: (groupId: string) => McpServer) {
  return createMcpHandler(
    (c) => {
      const groupId = c.req.param('group');
      return buildServer(groupId);
    },
    { legacy: 'reject' }  // 激进升级：拒绝 2025-era 握手
  );
}
```

**`createMcpHandler` 自动处理**（不再手写）：
- `server/discover` RPC
- `Mcp-Method` / `Mcp-Name` 头校验（头/体不一致 → 拒绝）
- `_meta` 里 `protocolVersion` / `clientCapabilities` / `serverInfo` 读写
- 无状态化（无 `initialize` 握手、无 `Mcp-Session-Id`）
- Hono `Context` ↔ MCP 请求适配（替代 `fetch-to-node`）
- `resultType` 字段 stamp

**`group-router.ts` 改造后**：
```typescript
import { Hono } from 'hono';
import { createGroupMcpHandler } from './mcp-handler-factory.js';
import { buildGroupServer } from './group-service.js';

export const groupMcpRoutes = new Hono();
groupMcpRoutes.route('/:group/mcp', createGroupMcpHandler(buildGroupServer));
```
职责收敛为：路由声明 + 把 groupId 传给 handler factory。

**McpServer 生命周期（方案 C：按 group 缓存 + 失效钩子）**：
- 用 `Map<groupId, McpServer>` 缓存配好工具的 server 实例。
- 在组/工具配置变更时（复用现有 `sse_event_manager` 监听的配置变更事件）主动清除对应 group 的缓存。
- handler factory 从缓存取，未命中则从 `ToolRegistry` 构建并缓存。

**`server_manager.ts`（client 侧）改造**：
- import 从 `@modelcontextprotocol/sdk/client/*` 改 `@modelcontextprotocol/client`。
- `StreamableHTTPClientTransport`、`StdioClientTransport` import 路径更新。
- **保留 `SSEClientTransport`**：Hub 仍能连老式 SSE MCP server，充当协议转换层（老 SSE server → 新 Streamable HTTP 客户端）。
- 版本协商：`ClientOptions.versionNegotiation` 设 `{ mode: 'auto' }`（出站保留兼容）。

### §4 错误处理与行为适配

**4.1 未知工具/资源错误码变化**

v2 行为：
- 未知工具调用 → JSON-RPC `-32602`（InvalidParams），**抛错而非返回 `isError:true`**。
- 未知资源 → `-32002`（ResourceNotFound）。

**所有 `isError` 检查点逐个过一遍**（不依赖"大部分不用改"的判断）。已知检查点清单：

| 文件 | 行 | 用途 | 处置 |
|---|---|---|---|
| `types/mcp-hub.ts` | 90 | 类型定义 `isError?: boolean` | 保留（工具内部失败仍返回此字段） |
| `api/tools/index.ts` | 289, 300, 318, 325 | 工具执行结果记录 | 验证：工具执行失败仍返回 `isError:true`，无需改；但调用处加 try/catch 处理 unknown-tool rejection |
| `api/tools-admin/index.ts` | 22, 87, 201, 297-298, 342, 373, 450, 582-583, 615 | 执行历史统计 | 验证：读取的是历史记录字段，不受新错误码影响 |
| `api/debug/index.ts` | 99 | 调试工具检查 `isError` | 验证 |
| `services/api_tool_integration_service.ts` | 97, 114, 120 | API 工具集成结果 | 验证 |
| `services/server_manager.ts` | 249, 328 | server 管理结果 | 验证 |
| `services/tool-result-transform.ts` | 62, 73, 77 | 工具结果转换 | 验证 |

每个点的处置在实现时显式标注"已验证无需改"或"需改成 try/catch"，不留模糊。

**4.2 错误体系对齐**

当前分支已建立结构化错误体系（`McpHubCoreError` + `ErrorCode` 枚举）。v2 的错误变化对接：

| v2 变化 | 处理 |
|---|---|
| `ErrorCode` → `ProtocolErrorCode` | codemod 自动改名；本地成员移到 `SdkErrorCode` |
| `StreamableHTTPError` → `SdkHttpError` | codemod 改名，构造参数变了需 review |
| 新增 `ResourceNotFound`（`-32002`）、`HeaderMismatch`（`-32020`）等 | 在 `packages/core/src/errors/` 的 `ErrorCode` 枚举里补映射 |

**边界策略**：MCP SDK 抛的 `ProtocolError`/`SdkError` 在边界处捕获，转成 Hub 的 `McpHubCoreError`，**不泄漏 SDK 错误类型到上层**。

**4.3 legacy `/mcp` 端点删除的连带清理**

- `backend/src/legacy/index.ts` 的 re-export。
- `backend/src/app.ts` 里挂载 `/mcp` 路由的地方。
- `initializeMcpService` / `mcpServer`（`services/mcp_service.ts`）如果只被 legacy 用，一并删除。
- 检查用户文档/迁移指南对 `/mcp` 端点的引用。

**4.4 未知工具的兜底**

激进升级后客户端调了组里不存在的工具：v2 SDK 自动返回 `-32602`。Hub 额外在审计日志（`message-audit-service.ts`）记录这次失败调用。当前用户归因硬编码 `'admin'` 的问题，P1 不修，留到 P2 OAuth 时解决。

### §5 测试策略

**5.1 单元测试**

| 类别 | 处置 |
|---|---|
| `sse.unit.test.ts` | **删除**（对应删除的 `backend/src/sse.ts`） |
| `vi.mock('@modelcontextprotocol/sdk/...')` 的 7 个文件 | **codemod 改写 mock 路径**，跑完验证 |
| 所有 `isError` 相关测试 | **逐个过一遍**，断言行为是否符合 v2 新语义 |
| `mcp-handler-factory.ts` | **新增单测**：验证 `legacy: 'reject'` 生效、按 groupId 构建 server、缓存命中/失效 |

受影响的 `vi.mock` 文件清单：
- `backend/src/mcp.unit.test.ts`
- `backend/src/services/server_manager.unit.test.ts`
- `backend/src/services/integration.test.ts`
- `packages/cli/src/transport/cli-transport.unit.test.ts`
- `packages/cli/src/integration/cli-core-enhanced.test.ts`
- `packages/cli/src/server/cli-mcp-server.unit.test.ts`
- `packages/cli/src/e2e/cli-e2e.test.ts`

**5.2 集成测试**

- 涉及 SSE 启动的测试（`integration/service_initialization.test.ts`、`app.unit.test.ts` 等）：移除 SSE 相关断言，保留其余。
- **McpServer 生命周期缓存失效测试**（新增）：验证"组配置变更 → 缓存失效 → 下次请求重建 server"。

**5.3 e2e 协议测试**

`backend/src/e2e/mcp-protocol/` 的 3 个 e2e 是协议合规核心保障。测试客户端**统一换成 `StreamableHTTPClientTransport`**（不再用 `SSEClientTransport` 作为测试驱动）。

| 文件 | 处置 |
|---|---|
| `mcp-test-config.ts` | 改写：测试客户端换成 `StreamableHTTPClientTransport` |
| `mcp-basic.test.ts` | 改写：验证 `server/discover`、无 `initialize` 握手、`Mcp-Method`/`Mcp-Name` 头 |
| `hub-aggregation.test.ts` | 改写：用新 client 验证聚合仍工作 |
| `mcp-http-api.test.ts` | 改写 |

**新增 e2e 用例**：
1. **协议合规**：`server/discover` 返回正确能力声明；不带 `Mcp-Method` 头的请求被拒。
2. **激进升级生效**：发送 2025-era `initialize` 请求 → 被拒（`legacy: 'reject'`）。
3. **协议转换**：Hub 用 `StreamableHTTPClientTransport` 暴露，背后连一个老式 SSE mock server，验证桥接（对应 §3 出站保留 SSE 连接能力）。
4. **无状态性**：连续两个无关联请求独立处理（不依赖 session）。

**5.4 测试基础设施**

- `TestContext`（项目自研资源管理器）：检查有无创建 SSE transport 的逻辑，有则移除。
- `backend/src/e2e/mock-mcp-server.ts`：确认能同时模拟 Streamable HTTP 和 SSE 两种形态（供用例 3 用）。

### §6 Definition of Done

P1 完成的判据：

- `grep -rn '@modelcontextprotocol/sdk' .`（排除 node_modules）**零命中** —— v1 包完全移除。
- `grep -rn '@mcp-codemod-error' .` **零命中** —— 所有标记已处理。
- `pnpm typecheck` 通过。
- `pnpm test` 全绿（含改写后的 e2e）。
- 4 个新增 e2e 用例通过。
- Node 18 下安装/运行失败（确认 engines 生效），Node 20 下正常。
- 所有 `isError` 检查点清单逐个标注完毕。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| codemod 不能处理的边界情况多 | 逐个处理 `@mcp-codemod-error` 标记；迁移指南列出所有需人工处理的类别 |
| 2.0.0 还在 beta，可能有 breaking change | 跟踪 GA 发布；版本钉法用 codemod 输出而非手钉，便于升级 |
| 删除 `/sse` 和 legacy `/mcp` 端点影响现有用户 | 项目 0.0.1，用户量有限；在 RELEASE_NOTES 明确标注 breaking change 和迁移路径 |
| 出站方向保留 SSE 连接增加维护负担 | 这是网关产品定位的必要代价；后续外部 server 生态升级后可再评估移除 |
| McpServer 缓存失效逻辑与配置变更事件耦合 | 复用现有 `sse_event_manager` 事件机制；新增专门测试覆盖失效路径 |

## 参考资料

- [MCP 2026-07-28 Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [MCP Draft Changelog](https://modelcontextprotocol.io/specification/draft/changelog)
- [MCP 2025-11-25 Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [SDK v1→v2 Migration Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)
- [Adopting 2026-07-28 Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)
- [SDK Releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)
- [WorkOS: MCP 2026 spec agent authentication](https://workos.com/blog/mcp-2026-spec-agent-authentication)
