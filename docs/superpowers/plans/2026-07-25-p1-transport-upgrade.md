# P1: 传输层升级到 MCP 2026-07-28 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 mcp-hub 从 `@modelcontextprotocol/sdk@^1.16.0`（协议 2025-11-25）升级到 SDK v2（协议 2026-07-28），入站激进升级只支持新协议，出站保留兼容，删除 MCP 级 SSE 和 legacy `/mcp` 端点。

**Architecture:** 用官方 `@modelcontextprotocol/hono` 适配器的 `createMcpHandler` 替换手写 transport 层。先跑官方 codemod 完成 80% 机械迁移，再手动修复标记点、重写 transport 层、删除废弃端点、改写测试。

**Tech Stack:** TypeScript 5.8 / Hono 4 / `@modelcontextprotocol/{server,client,hono,core,node}@2.0.0-beta.5` / Vitest 4 / Node 20+

**关联 spec:** `docs/superpowers/specs/2026-07-25-p1-transport-upgrade-design.md`

---

## 文件结构总览

**新增：**
- `backend/src/api/mcp/mcp-handler-factory.ts` — 封装"按组构建 McpServer + createMcpHandler"逻辑

**重写（核心）：**
- `backend/src/api/mcp/group-router.ts` — 从手写 transport 降级为挂载 handler
- `backend/src/api/mcp/group-service.ts` — `.tool()` → `.registerTool()`，McpServer 实例化方式调整
- `packages/cli/src/transport/cli-transport.ts` — `StdioServerTransport` → `serveStdio()`

**改造（import + API 更新）：**
- `backend/src/services/server_manager.ts` — client import 路径 + 保留 SSEClientTransport
- `backend/src/app.ts` — 移除 mcp/sse 路由挂载
- `backend/src/legacy/*` — 删除
- 所有 `vi.mock('@modelcontextprotocol/sdk/...')` 的测试

**删除：**
- `backend/src/sse.ts` / `backend/src/sse.unit.test.ts` / `backend/src/utils/sse.ts`
- `backend/src/legacy/mcp-legacy.ts` + 连带清理
- `backend/src/services/mcp_service.ts`（若仅 legacy 使用）

**配置：**
- 各 `package.json`（依赖 + engines）
- `Dockerfile` / CI workflow（Node 版本）

---

## Task 1: 创建工作分支与环境准备

**Files:**
- 无文件改动，仅环境准备

- [ ] **Step 1: 确认当前分支状态干净**

Run: `git status`
Expected: clean working tree，当前在 `fix/p0-p1-architecture-cleanup` 分支

- [ ] **Step 2: 基于当前分支创建 P1 工作分支**

```bash
git checkout -b feat/p1-transport-upgrade-2026-07-28
```

- [ ] **Step 3: 确认 Node 版本（本地需有 Node 20+）**

Run: `node --version`
Expected: `v20.x.x` 或更高。若本地是 Node 18，先通过 nvm/fnm 切换：`nvm use 20`（或安装）。

- [ ] **Step 4: 确认基线测试通过（升级前的绿基线）**

Run: `pnpm test`
Expected: 全部通过。记录通过数作为回归对照。

- [ ] **Step 5: 提交基线（无代码改动，仅确认）**

无提交。此任务仅为环境就绪确认。

---

## Task 2: 升级 Node 运行时要求

**Files:**
- Modify: 根 `package.json`
- Modify: `packages/*/package.json`（若有 engines 字段）
- Modify: `.github/workflows/ci.yml`
- Modify: `Dockerfile`（若存在）

- [ ] **Step 1: 更新根 package.json 的 engines 字段**

将根 `package.json` 的 `engines.node` 从 `>=18` 改为 `>=20`：

```json
"engines": {
  "node": ">=20"
}
```

- [ ] **Step 2: 更新 CI workflow 的 node-version**

在 `.github/workflows/ci.yml` 中找到 `node-version` 配置（通常在 `setup-node` action），从 `18` 改为 `20`。若用的是矩阵（`matrix.node`），改为 `[20]`。

- [ ] **Step 3: 更新 Dockerfile 基础镜像（若存在）**

若项目根有 `Dockerfile`，找到 `FROM node:18` 改为 `FROM node:20-slim`（保持原有的 slim/alpine 变体偏好）。

- [ ] **Step 4: 验证 package.json engines 生效**

Run: `node --version`（确认本地是 20+）然后 `pnpm install`
Expected: 安装成功，无 engines 警告。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: 升级 Node 运行时要求 18 → 20（SDK v2 前置）"
```

---

## Task 3: 运行 SDK v1→v2 codemod

**Files:**
- Modify: 所有 import `@modelcontextprotocol/sdk` 的 `.ts` 文件
- Modify: 各 `package.json`（codemod 会改根 manifest，workspace member 需手动按输出调整）

- [ ] **Step 1: 在仓库根运行 codemod**

```bash
npx @modelcontextprotocol/codemod@beta v1-to-v2 .
```

注意：在仓库根（`.`）运行，不是 `./src`。codemod 会改写 `package.json`、import 路径、符号重命名、`.tool()`→`.registerTool()` 等。

- [ ] **Step 2: 检查 codemod 输出的 manifest summary**

codemod 运行结束会打印 manifest summary，说明每个 workspace member 需要哪些 v2 包。**记录这个输出**，下一步要用。

- [ ] **Step 3: 按输出调整各 workspace member 的 package.json**

codemod 只改根 manifest，workspace member（`packages/core`、`packages/cli`、`backend`）需手动按输出调整：
- 移除 `@modelcontextprotocol/sdk`
- 添加 member 实际 import 用到的 v2 包

预期变更（基于 spec §2）：
- `packages/core`：移除 `sdk`，加 `@modelcontextprotocol/client`
- `packages/cli`：移除 `sdk`，加 `@modelcontextprotocol/server` + `@modelcontextprotocol/node`
- `backend`：移除 `sdk`，加 `@modelcontextprotocol/server` + `@modelcontextprotocol/hono` + `@modelcontextprotocol/client` + `@modelcontextprotocol/core`

- [ ] **Step 4: 安装新依赖**

```bash
pnpm install
```

若出现 `hono` peer dependency 警告（来自 `@modelcontextprotocol/hono`），确认 `backend` 已声明 `hono` 依赖（项目已用 Hono 4，应已满足）。

- [ ] **Step 5: 查找并记录所有 codemod 标记点**

```bash
grep -rn '@mcp-codemod-error' . --include="*.ts"
```

**记录所有命中位置**，后续 Task 4 逐个处理。

- [ ] **Step 6: 暂不提交**

codemod 产出 + 手动修复标记点后一起提交（Task 4 末尾）。

---

## Task 4: 处理 codemod 标记点 + typecheck 修复

**Files:**
- 取决于 Task 3 Step 5 的 grep 结果

- [ ] **Step 1: 运行 typecheck，收集所有类型错误**

```bash
pnpm typecheck
```

（若项目用的是 `pnpm build` 或 `tsc --noEmit`，用对应命令。）**记录所有错误**，与 codemod 标记点合并成修复清单。

- [ ] **Step 2: 逐个修复 codemod 标记点**

对照迁移指南 `docs/migration/upgrade-to-v2.md` 的"Manual changes"章节，逐个处理 `@mcp-codemod-error` 标记。已知可能的标记类别（按迁移指南）：

1. **Header 读取**：`extra.requestInfo?.headers[…]` → `ctx.http?.req?.headers.get('…')`（bracket access 改 `.get()`）
2. **`ctx.mcpReq.send()` 的 schema 参数**：移除 schema 参数
3. **OAuth 错误类合并**：`instanceof InvalidGrantError` → `OAuthError` + `OAuthErrorCode`
4. **`SdkErrorCode` 分支选择**：`StreamableHTTPError` → `SdkHttpError`，决定 catch 匹配哪个 `SdkErrorCode`
5. **Namespace schema 访问**：`import * as t` + `t.XxxSchema.parse()` → 从 `@modelcontextprotocol/core` 按符号重新 import
6. **无 import 的注入式 SDK 接口**：grep `setRequestHandler(`、`ErrorCode.`、`extra.` 找到非 import 驱动的使用点，手动改

每个标记点修复后，删除 `@mcp-codemod-error` 注释。

- [ ] **Step 3: 修复剩余 typecheck 错误**

处理 Step 1 收集的、非 codemod 标记的类型错误。常见：
- `ErrorCode` → `ProtocolErrorCode`（codemod 应已改名，但混用 `instanceof` 守卫需手动）
- `RequestHandlerExtra` → `ServerContext`，`extra` → `ctx`
- `.tool()` → `.registerTool()` 的参数形状变化

- [ ] **Step 4: 验证零标记 + typecheck 通过**

```bash
grep -rn '@mcp-codemod-error' . --include="*.ts"
```
Expected: **零命中**。

```bash
pnpm typecheck
```
Expected: **零错误**。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: SDK v1→v2 codemod 迁移 + 手动修复标记点"
```

---

## Task 5: 重写 group-router 和 group-service（核心）

**Files:**
- Create: `backend/src/api/mcp/mcp-handler-factory.ts`
- Modify: `backend/src/api/mcp/group-router.ts`（几乎重写）
- Modify: `backend/src/api/mcp/group-service.ts`（`.registerTool` 适配，缓存逻辑调整）

- [ ] **Step 1: 先写 mcp-handler-factory 的失败测试**

Create: `backend/src/api/mcp/mcp-handler-factory.unit.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/server';

import { createGroupMcpHandler } from './mcp-handler-factory.js';

describe('createGroupMcpHandler', () => {
  it('调用 buildServer 时传入从路由参数解析的 groupId', async () => {
    const buildServer = vi.fn((_groupId: string) => new McpServer({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } }));
    const handler = createGroupMcpHandler(buildServer);

    // 模拟带 :group 参数的 Hono 请求
    // createMcpHandler 返回 Hono app，挂载后 POST /test-group/mcp 会触发
    // 这里验证 buildServer 被以正确 groupId 调用
    // （具体断言形态依赖 createMcpHandler 的返回结构，实现时调整）
    expect(handler).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run backend/src/api/mcp/mcp-handler-factory.unit.test.ts`
Expected: FAIL（`createGroupMcpHandler` 不存在）

- [ ] **Step 3: 实现 mcp-handler-factory.ts**

Create: `backend/src/api/mcp/mcp-handler-factory.ts`

```typescript
/**
 * MCP Handler 工厂
 * 封装 createMcpHandler，按组构建 McpServer 实例
 */

import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from '@modelcontextprotocol/hono';
import { Hono } from 'hono';

/**
 * 创建按组路由的 MCP handler
 *
 * @param buildServer 根据 groupId 构建已注册工具的 McpServer 的工厂函数
 * @returns 可挂载到 Hono 的路由（处理 /:group/mcp）
 */
export function createGroupMcpHandler(
  buildServer: (groupId: string) => McpServer,
): Hono {
  return createMcpHandler(
    (c) => {
      const groupId = c.req.param('group');
      return buildServer(groupId);
    },
    { legacy: 'reject' }, // 激进升级：拒绝 2025-era 握手
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run backend/src/api/mcp/mcp-handler-factory.unit.test.ts`
Expected: PASS

- [ ] **Step 5: 重写 group-router.ts**

重写 `backend/src/api/mcp/group-router.ts`。核心变化：
- 移除 `StreamableHTTPServerTransport`、`fetch-to-node` import
- 用 `createGroupMcpHandler` 替换手写 transport 处理
- 保留组验证中间件、`/status`、`/tools` 端点
- `groupServices` 缓存逻辑保留（缓存 `GroupMcpService`），但 POST handler 改为挂载 handler

重写后的结构（实现时按 codemod 后的 v2 API 精确调整）：

```typescript
/**
 * 组特定MCP路由处理器
 * 处理 /:group/mcp 路由，提供基于组的MCP服务访问
 */

import { Hono } from 'hono';

import { getCoreServiceManager } from '../../services/service-registry.js';
import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { createGroupMcpHandler } from './mcp-handler-factory.js';
import { GroupMcpService } from './group-service.js';

import type { Context } from 'hono';

export const groupMcpRouter = new Hono();

const groupServices: Map<string, GroupMcpService> = new Map();

async function getGroupMcpService(groupId: string): Promise<GroupMcpService> {
  const coreServiceManager = await getCoreServiceManager();
  let groupService = groupServices.get(groupId);
  if (groupService) {
    return groupService;
  }
  logger.info('为组创建MCP服务实例', { groupId });
  groupService = new GroupMcpService(groupId, coreServiceManager);
  await groupService.initialize();
  groupServices.set(groupId, groupService);
  return groupService;
}

async function validateGroupExists(groupId: string): Promise<boolean> {
  try {
    const config = await getAllConfig();
    return groupId in config.groups;
  } catch (error) {
    logger.error('验证组存在性时出错', error as Error, { groupId });
    return false;
  }
}

async function groupValidationMiddleware(c: Context, next: () => Promise<void>) {
  // （保持原有实现不变：组 ID 缺失/组不存在的错误响应）
  // ... 原有代码保留
}

// 挂载 MCP handler（替代原 POST /:group/mcp 的手写 transport）
groupMcpRouter.route(
  '/:group/mcp',
  createGroupMcpHandler(async (groupId) => {
    const groupService = await getGroupMcpService(groupId);
    return groupService.getMcpServer();
  }),
);

// 保留 /status 和 /tools 端点（原有实现不变）
groupMcpRouter.get('/:group/status', groupValidationMiddleware, /* ... */);
groupMcpRouter.get('/:group/tools', groupValidationMiddleware, /* ... */);

export async function shutdownGroupMcpRouter(): Promise<void> {
  // （保持原有实现）
}
```

注意：`groupValidationMiddleware` 的逻辑要整合进 handler 路径或前置。实现时验证 `createMcpHandler` 是否支持在工厂函数内做组存在性校验（若不支持，组校验改在 `getGroupMcpService` 内抛错）。

- [ ] **Step 6: 适配 group-service.ts 的工具注册 API**

`backend/src/api/mcp/group-service.ts` 中 `.tool()` 已被 codemod 改成 `.registerTool()`。检查并确认：
- `this.mcpServer.registerTool('group_status', { inputSchema: z.object({}) }, async (args, ctx) => {...})` 形态正确
- 所有 `.tool()` 调用点都已转换
- `McpServer` 构造参数符合 v2（`new McpServer({ name, version }, { capabilities: { tools: {} } })`）

- [ ] **Step 7: 运行相关单测**

Run: `pnpm vitest run backend/src/api/mcp/`
Expected: 通过（可能需修复因 API 变化失败的测试）

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "refactor: 用 createMcpHandler 重写 group-router/group-service（无状态）"
```

---

## Task 6: 删除 MCP 级 SSE 端点

**Files:**
- Delete: `backend/src/sse.ts`
- Delete: `backend/src/sse.unit.test.ts`
- Delete: `backend/src/utils/sse.ts`
- Modify: `backend/src/app.ts`（移除 `sse` 挂载）
- Modify: `backend/src/index.ts` 或启动文件（若引用）

- [ ] **Step 1: 删除 SSE 相关文件**

```bash
git rm backend/src/sse.ts backend/src/sse.unit.test.ts backend/src/utils/sse.ts
```

- [ ] **Step 2: 移除 app.ts 的 sse 挂载**

在 `backend/src/app.ts` 中：
- 删除 `import { sse } from './sse.js';`（原 L21）
- 删除 `app.route('/', sse);`（原 L80）

- [ ] **Step 3: 检查并清理其他 SSE 引用**

Run: `grep -rn "from.*['\"]\.\./.*sse\|from.*['\"]\./sse\|from.*['\"].*utils/sse" backend/src --include="*.ts" | grep -v node_modules | grep -v ".test."`
Expected: 零命中（或仅剩 Dashboard 的 `sse_event_manager`，那是业务 SSE，保留）

清理所有对已删除 SSE 模块的引用。

- [ ] **Step 4: 验证 typecheck**

Run: `pnpm typecheck`
Expected: 零错误

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: 删除 MCP 级 SSE 端点（2026-07-28 Deprecated）

保留 Dashboard 业务 SSE（sse_event_manager），与 MCP 协议无关。
出站方向的 SSEClientTransport 保留（server_manager 连接老式 SSE server）。"
```

---

## Task 7: 删除 legacy /mcp 端点

**Files:**
- Delete: `backend/src/legacy/mcp-legacy.ts`
- Modify: `backend/src/legacy/index.ts`（移除 re-export）
- Modify: `backend/src/app.ts`（移除 mcp 挂载）
- Possibly Delete: `backend/src/services/mcp_service.ts`（若仅 legacy 使用）

- [ ] **Step 1: 确认 mcp_service.ts 的使用范围**

Run: `grep -rn "from.*mcp_service\|initializeMcpService\|mcpServer" backend/src --include="*.ts" | grep -v node_modules | grep -v ".test."`
判断：若仅 `legacy/mcp-legacy.ts` 引用 `initializeMcpService`/`mcpServer`，则 `mcp_service.ts` 一并删除；若其他地方还用，保留。

- [ ] **Step 2: 删除 legacy mcp-legacy.ts（及 mcp_service.ts 若适用）**

```bash
git rm backend/src/legacy/mcp-legacy.ts
# 若 Step 1 判定 mcp_service.ts 仅 legacy 用：
git rm backend/src/services/mcp_service.ts
```

- [ ] **Step 3: 清理 legacy/index.ts 的 re-export**

在 `backend/src/legacy/index.ts` 中移除：
```typescript
export { mcp, shutdownMcpService } from './mcp-legacy.js';
```
若 `legacy/index.ts` 删空了所有内容，整个文件删除。

- [ ] **Step 4: 移除 app.ts 的 mcp 挂载**

在 `backend/src/app.ts` 中：
- 删除 `import { mcp } from './legacy/index.js';`（原 L15）
- 删除 `app.route('/', mcp);`（原 L79）

- [ ] **Step 5: 验证 typecheck + 测试**

Run: `pnpm typecheck && pnpm vitest run backend/src/app.unit.test.ts backend/src/index.unit.test.ts`
Expected: 通过（修复因移除产生的断言失败，如 app.unit.test.ts 里对 `/mcp` 路由的测试）

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor: 删除 legacy /mcp 端点（已 deprecated，激进升级下移除）"
```

---

## Task 8: 适配 CLI transport（serveStdio）

**Files:**
- Modify: `packages/cli/src/transport/cli-transport.ts`
- Modify: CLI 启动入口（找到 `server.connect(new StdioServerTransport())` 的地方）

- [ ] **Step 1: 查找 CLI server 启动入口**

Run: `grep -rn "StdioServerTransport\|server.connect\|\.connect(.*transport" packages/cli/src --include="*.ts" | grep -v ".test."`
定位 CLI 的 MCP server 启动代码。

- [ ] **Step 2: 改用 serveStdio**

`cli-transport.ts` 的 `StdioServerTransport` 来自 v2 的 `@modelcontextprotocol/node` 的 `serveStdio`。按迁移指南 `support-2026-07-28.md`：

```typescript
// 旧：
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// const transport = new StdioServerTransport();
// await server.connect(transport);

// 新：
import { serveStdio } from '@modelcontextprotocol/node';

// serveStdio 接收 server 工厂，内部处理 stdio 传输
// 激进升级：拒绝旧协议
serveStdio(() => buildServer(), { legacy: 'reject' });
```

`CliTransport` 类的职责需重新评估：v2 的 `serveStdio` 封装了传输管理，`CliTransport` 原有的 `initialize`/`start`/`sendMessage`/事件处理器可能不再需要。实现时判断：
- 若 `serveStdio` 完全覆盖 CLI 需求，`CliTransport` 可大幅简化或删除。
- 若 CLI 有额外需求（如消息计数、自定义日志），保留薄封装。

- [ ] **Step 3: 更新 CLI transport 测试**

Run: `pnpm vitest run packages/cli/`
修复因 API 变化失败的测试。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "refactor: CLI transport 改用 serveStdio（无状态）"
```

---

## Task 9: 验证 server_manager 出站兼容性

**Files:**
- Modify: `backend/src/services/server_manager.ts`（确认 import + 版本协商）

- [ ] **Step 1: 确认 client import 已被 codemod 正确改写**

Run: `grep -n "from '@modelcontextprotocol" backend/src/services/server_manager.ts`
Expected:
- `Client` 来自 `@modelcontextprotocol/client`
- `SSEClientTransport`、`StdioClientTransport`、`StreamableHTTPClientTransport` 来自 `@modelcontextprotocol/client` 的子路径

- [ ] **Step 2: 确认 SSEClientTransport 保留**

Run: `grep -n "SSEClientTransport" backend/src/services/server_manager.ts`
Expected: 仍有命中（出站保留 SSE 连接能力）。

- [ ] **Step 3: 设置 client 版本协商为 auto**

在 `server_manager.ts` 创建 `Client` 实例的地方，确认 `ClientOptions.versionNegotiation` 设为 `{ mode: 'auto' }`。若 codemod 后没有显式设置，添加：

```typescript
const client = new Client(
  { name: 'mcp-hub', version: pkg.version },
  { versionNegotiation: { mode: 'auto' } },
);
```

（具体构造参数形态按 v2 API 调整）

- [ ] **Step 4: 运行 server_manager 测试**

Run: `pnpm vitest run backend/src/services/server_manager.unit.test.ts backend/src/services/integration.test.ts`
Expected: 通过（修复 mock 路径导致的失败）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: server_manager 出站 client 升级（auto 版本协商，保留 SSE）"
```

---

## Task 10: McpServer 缓存失效钩子

**Files:**
- Modify: `backend/src/api/mcp/group-router.ts`（暴露缓存失效函数）
- Modify: `backend/src/services/mcp_hub_service.ts` 或配置变更事件源头（接失效钩子）
- Test: `backend/src/api/mcp/group-router.unit.test.ts`（新增缓存失效测试）

**背景**：spec §3 方案 C——McpServer 按 group 缓存，组/工具配置变更时主动清除缓存。Task 5 保留了现有 `groupServices` 缓存，但未接失效钩子。本任务补上。

- [ ] **Step 1: 先写缓存失效的失败测试**

在 `backend/src/api/mcp/group-router.unit.test.ts` 新增：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invalidateGroupMcpService } from './group-router.js';

describe('McpServer 缓存失效', () => {
  beforeEach(async () => {
    // 预热：让某 groupId 的 GroupMcpService 进入缓存
  });

  it('invalidateGroupMcpService 清除指定组的缓存', async () => {
    const groupId = 'test-group';
    // 确认缓存命中
    // 调用 invalidateGroupMcpService(groupId)
    // 确认下次 getGroupMcpService 重建实例
  });

  it('invalidateAllGroupMcpServices 清除所有缓存', async () => {
    // 预热多个组
    // 调用 invalidateAllGroupMcpServices()
    // 确认全部清除
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run backend/src/api/mcp/group-router.unit.test.ts`
Expected: FAIL（`invalidateGroupMcpService` 未导出）

- [ ] **Step 3: 在 group-router.ts 实现失效函数**

在 `backend/src/api/mcp/group-router.ts` 中新增并导出：

```typescript
/**
 * 使指定组的 McpServer 缓存失效（配置变更时调用）
 */
export async function invalidateGroupMcpService(groupId: string): Promise<void> {
  const service = groupServices.get(groupId);
  if (service) {
    logger.info('使组MCP服务缓存失效', { groupId });
    await service.shutdown();
    groupServices.delete(groupId);
  }
}

/**
 * 使所有组的 McpServer 缓存失效
 */
export async function invalidateAllGroupMcpServices(): Promise<void> {
  logger.info('使所有组MCP服务缓存失效');
  const promises = Array.from(groupServices.keys()).map((id) => invalidateGroupMcpService(id));
  await Promise.allSettled(promises);
}
```

- [ ] **Step 4: 将失效钩子接到配置变更事件**

找到配置变更的事件源（`group_manager` / `tool_manager` / `sse_event_manager` 监听的配置变更事件）。在配置变更时调用 `invalidateGroupMcpService(affectedGroupId)` 或 `invalidateAllGroupMcpServices()`。

Run: `grep -rn "onConfigChange\|configChanged\|emit.*config\|listChanged" backend/src/services --include="*.ts" | grep -v ".test."`
定位事件源，接入失效钩子。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run backend/src/api/mcp/group-router.unit.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: McpServer 缓存失效钩子（配置变更时主动清除）"
```

---

## Task 11: isError 检查点逐个验证

**Files:**
- 检查并可能修改 spec §4.1 列出的所有 `isError` 检查点

- [ ] **Step 1: 生成完整的 isError 检查点清单**

Run: `grep -rn "isError" backend/src packages --include="*.ts" | grep -v node_modules | grep -v ".test." > /tmp/isError-points.txt && cat /tmp/isError-points.txt`

将输出与 spec §4.1 的清单对照，确认无遗漏。

- [ ] **Step 2: 逐个验证每个点**

对清单中每一行，判断：
- **类别 A（工具执行结果记录）**：v2 后工具执行失败仍返回 `isError:true`，这些点**无需改**。但调用工具的地方需加 try/catch 处理 unknown-tool 的 rejection（`-32602`）。
- **类别 B（Zod 的 `result.error.issues`）**：与 MCP 无关，不改。

逐个标注处置（在代码注释或单独文档记录），不留模糊。已知检查点（按 spec §4.1）：

| 文件 | 行 | 处置（实现时填） |
|---|---|---|
| `types/mcp-hub.ts:90` | 类型定义 | ☐ 已验证无需改 |
| `api/tools/index.ts:289,300,318,325` | 执行结果记录 | ☐ 验证 + 调用处加 try/catch |
| `api/tools-admin/index.ts:22,87,201,297-298,342,373,450,582-583,615` | 历史统计 | ☐ 验证 |
| `api/debug/index.ts:99` | 调试检查 | ☐ 验证 |
| `services/api_tool_integration_service.ts:97,114,120` | API 工具集成 | ☐ 验证 |
| `services/server_manager.ts:249,328` | server 管理 | ☐ 验证 + 调用处加 try/catch |
| `services/tool-result-transform.ts:62,73,77` | 结果转换 | ☐ 验证 |

- [ ] **Step 3: 对需要的点加 try/catch**

对调用工具的地方（`api/tools/index.ts`、`server_manager.ts` 等），把 unknown-tool 的 rejection 也记为 error：

```typescript
try {
  const result = await callTool(...);
  // 原有 isError 判断逻辑保留
} catch (error) {
  // v2: 未知工具抛 -32602，这里捕获并记为 error
  // 转成 Hub 的错误体系（不泄漏 SDK 错误类型）
  throw new McpHubCoreError(ErrorCode.TOOL_NOT_FOUND, `工具不存在: ${toolName}`);
}
```

- [ ] **Step 4: 运行相关测试**

Run: `pnpm vitest run backend/src/api/tools/ backend/src/api/tools-admin/ backend/src/api/debug/ backend/src/services/tool-result-transform.unit.test.ts`
Expected: 通过（更新断言以匹配 v2 行为）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: isError 检查点适配 v2（unknown-tool 改为抛错）"
```

---

## Task 12: 改写 e2e 协议测试

**Files:**
- Modify: `backend/src/e2e/mcp-protocol/mcp-test-config.ts`
- Modify: `backend/src/e2e/mcp-protocol/mcp-basic.test.ts`
- Modify: `backend/src/e2e/mcp-protocol/hub-aggregation.test.ts`
- Modify: `backend/src/e2e/mcp-protocol/mcp-http-api.test.ts`
- Modify: `backend/src/e2e/mock-mcp-server.ts`

- [ ] **Step 1: 改写 mcp-test-config.ts（测试客户端换 StreamableHTTPClientTransport）**

将测试客户端从 `SSEClientTransport` 换成 `StreamableHTTPClientTransport`（v2）：

```typescript
// 旧：
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// 新：
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export function createTestClient(url: URL) {
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  return { client, transport };
}
```

- [ ] **Step 2: 改写 mcp-basic.test.ts**

更新断言验证新协议特性：
- `server/discover` 返回正确能力声明（替代原 initialize 握手断言）
- 不带 `Mcp-Method` 头的请求被拒
- 无 `Mcp-Session-Id` 依赖

- [ ] **Step 3: 改写 hub-aggregation.test.ts**

用新 client 验证聚合仍工作。保留原有的"多 server 工具聚合到一个组"断言。

- [ ] **Step 4: 改写 mcp-http-api.test.ts**

同上，更新 client 和断言。

- [ ] **Step 5: 运行 e2e 测试**

Run: `pnpm vitest run backend/src/e2e/mcp-protocol/`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "test: e2e 协议测试改用 StreamableHTTPClientTransport"
```

---

## Task 13: 新增协议合规 e2e 用例

**Files:**
- Create: `backend/src/e2e/mcp-protocol/protocol-compliance.test.ts`
- Possibly Modify: `backend/src/e2e/mock-mcp-server.ts`（支持 SSE mock）

- [ ] **Step 1: 写用例 1（协议合规）**

验证 `server/discover` 返回正确能力声明；不带 `Mcp-Method` 头的请求被拒：

```typescript
import { describe, it, expect } from 'vitest';
// ... setup

describe('协议合规', () => {
  it('server/discover 返回能力声明', async () => {
    // 调用 server/discover，断言返回 capabilities
  });

  it('缺少 Mcp-Method 头的请求被拒绝', async () => {
    // 发送不带 Mcp-Method 头的 POST，断言返回错误
  });
});
```

- [ ] **Step 2: 写用例 2（激进升级生效）**

验证发送 2025-era `initialize` 请求被拒（`legacy: 'reject'`）：

```typescript
describe('激进升级', () => {
  it('2025-era initialize 请求被拒绝', async () => {
    // 发送 initialize 请求，断言被拒
  });
});
```

- [ ] **Step 3: 写用例 3（协议转换）**

Hub 用 StreamableHTTP 暴露，背后连一个老式 SSE mock server，验证桥接：

```typescript
describe('协议转换', () => {
  it('Hub 桥接老式 SSE server 到 Streamable HTTP 客户端', async () => {
    // 配置一个 SSE mock server 作为上游
    // 通过 Hub 的 StreamableHTTP client 调用工具
    // 断言成功（验证 SSEClientTransport 出站仍工作）
  });
});
```

需确认 `mock-mcp-server.ts` 能模拟 SSE 形态。

- [ ] **Step 4: 写用例 4（无状态性）**

验证连续两个无关联请求独立处理：

```typescript
describe('无状态性', () => {
  it('连续请求不依赖 session', async () => {
    // 发送请求 A，不保存 session
    // 发送请求 B，断言独立成功
  });
});
```

- [ ] **Step 5: 运行新增用例**

Run: `pnpm vitest run backend/src/e2e/mcp-protocol/protocol-compliance.test.ts`
Expected: 4 个用例全部通过

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "test: 新增协议合规/激进升级/协议转换/无状态性 e2e 用例"
```

---

## Task 14: 文档更新

**Files:**
- Modify: `README.md`（Node 版本、协议版本）
- Modify: `docs/DEPLOYMENT.md`（Node 20 要求）
- Modify: `docs/RELEASE_NOTES.md`（breaking change 说明）
- Modify: `docs/MIGRATION.md`（若有，端点变更）

- [ ] **Step 1: 更新 README 的 Node 版本和协议版本**

在 `README.md` 的环境要求/前置条件部分，将 Node 18 改为 Node 20，说明支持 MCP 2026-07-28 协议。

- [ ] **Step 2: 更新 DEPLOYMENT.md**

部署文档的 Node 版本要求改为 20+，Docker 基础镜像改为 `node:20`。

- [ ] **Step 3: 更新 RELEASE_NOTES.md**

新增版本条目，标注 breaking change：
- 移除 `/sse` MCP 端点（迁移到 `/:group/mcp` Streamable HTTP）
- 移除 legacy `/mcp` 端点
- 协议升级到 2026-07-28，不再支持 2025-era 客户端握手
- Node 18 → 20

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "docs: 更新 Node 20 要求和 2026-07-28 协议说明"
```

---

## Task 15: 最终验证（Definition of Done）

**Files:** 无（仅验证）

- [ ] **Step 1: v1 包零命中**

Run: `grep -rn '@modelcontextprotocol/sdk' . --include="*.ts" --include="*.json" | grep -v node_modules | grep -v ".changeset"`
Expected: **零命中**

- [ ] **Step 2: codemod 标记零命中**

Run: `grep -rn '@mcp-codemod-error' . --include="*.ts"`
Expected: **零命中**

- [ ] **Step 3: typecheck 通过**

Run: `pnpm typecheck`
Expected: **零错误**

- [ ] **Step 4: 全量测试通过**

Run: `pnpm test`
Expected: **全绿**（含 e2e）

- [ ] **Step 5: Node 18 失败验证（确认 engines 生效）**

若有 nvm/fnm，切换到 Node 18 运行 `pnpm install`：
Expected: engines 检查失败或警告（确认 `>=20` 生效）。验证后切回 Node 20。

- [ ] **Step 6: 手动冒烟测试**

启动服务，用一个 MCP 客户端（或测试脚本）连接 `/:group/mcp`：
- 验证 `server/discover` 正常
- 验证工具列表返回
- 验证工具调用成功

- [ ] **Step 7: 最终提交（若有文档/清理遗漏）**

```bash
git add -A
git commit -m "chore: P1 最终验证通过" --allow-empty
```

- [ ] **Step 8: 更新总体 spec 状态**

在 `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md` 的子项目全景表中，将 P1 状态从"✅ spec 完成"更新为"✅ 实现完成"，添加实现 PR/commit 链接。

---

## 风险提示（实现时注意）

1. **codemod 产出不可预知**：Task 3-4 的具体工作量取决于 codemod 输出。若标记点过多（>20 个），考虑分批提交。
2. **`createMcpHandler` API 可能与 spec 示例有出入**：beta 阶段 API 可能微调。实现 Task 5 时以实际安装的 `@modelcontextprotocol/hono` 的类型定义为准，不照搬 spec 示例代码。
3. **`groupValidationMiddleware` 与 handler 的整合**：`createMcpHandler` 的工厂函数在路由匹配后执行，组校验可能需要移到工厂函数内部（抛错）或用 Hono 中间件前置。Task 5 Step 5 时验证。
4. **e2e 测试可能暴露协议合规问题**：若用例 2（激进升级被拒）失败，说明 `legacy: 'reject'` 未正确传递，检查 `createMcpHandler` 的选项传递。
5. **mock-mcp-server 可能不支持 SSE 形态**：Task 13 用例 3 依赖 SSE mock，若 `mock-mcp-server.ts` 不支持，需先扩展它。
