# 工作区验证改动收尾提交 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把工作区已验证全绿（1820 passed / 0 failed）的一批改动按 4 个独立 commit 规范化提交，处理暴露的仓库卫生问题，使工作区归零、main 测试全绿。

**Architecture:** 工作区 12 个改动文件经实测是 4 件独立的事（A e2e 救火 / B production 启动链 / C tools 接口语义 / D 前端 bug），不是半成品。本计划不做任何代码修改，只做：格式化 → 分 4 次 commit → 卫生处理 → 全量回归验证。所有改动内容已存在于工作区，直接 `git add <指定文件>` 分组提交即可。

**Tech Stack:** git、oxfmt、oxlint、vitest、pnpm。

## Global Constraints

- **不修改任何业务代码**：所有改动已验证可用，只做分组提交与格式化。
- **验证标准**（用户确认）：每个 commit 后跑相关测试，最后跑全量 `pnpm test` + `pnpm check` + `pnpm check:ci` 全绿。
- **提交粒度**（用户确认）：拆 4 个 commit，对应 A/B/C/D 四件事。
- **commit message 风格**：conventional commits（`feat(...)` / `fix(...)` / `chore(...)`），中英混用，参考 `git log --oneline -15`。
- **Node >=20**，pnpm 10.6.4。
- **当前分支**：main（项目主开发分支，历史提交均直接在 main 上；本计划沿用此惯例，不另开分支）。

## 前置事实（已实测，2026-07-29 22:45）

以下命令已在计划编写前执行并确认通过，作为 baseline：

- `npx vitest --run`：119 文件 / 1820 passed / 1 skipped / 0 failed
- `pnpm check`（typecheck + per-package oxlint/oxfmt）：5 workspace 全绿
- `pnpm check:ci`：oxlint 0 errors；oxfmt --check 报 **7 个文件格式问题**（其中 `backend/config/.backups/*`、`.history/*` 是运行时产物不该进 git，`docs/verification/issues.md` 将删除，`.zcode/plans/*` 不在提交范围）。

## 文件分组（4 个 commit 的边界）

| Commit | 事项                                       | 涉及文件（`git diff --stat HEAD` 核对）                                                                                                                               |
| ------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**  | e2e 救火：TestServer 初始化 HubService     | `backend/src/e2e/test-server.ts`                                                                                                                                      |
| **B**  | production 启动链：apiToMcpWebService 接入 | `backend/src/index.ts`、`backend/src/types/web-api.ts`（AuthConfig re-export，属 B1 类型修复，与启动链同属"让生产功能可用"）、`README.md`（如有 P1 相关说明）         |
| **C**  | tools 接口语义修正（前后端配套）           | `backend/src/api/tools/index.ts`、`frontend/src/types/tool.ts`、`frontend/src/stores/tool.ts`                                                                         |
| **D**  | 前端零散 bug                               | `frontend/src/components/groups/GroupFormDialog.vue`、`frontend/src/components/layout/AppHeader.vue`、`frontend/src/views/Groups.vue`、`frontend/src/views/Tools.vue` |

> 说明：`docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md` 的改动是文档进度回填，归入对应代码 commit 或单独 docs commit（见 Task 5）。

---

### Task 1: 格式化所有待提交文件（消除 oxfmt 格式债）

**Files:**

- Modify（格式化，不改逻辑）: 工作区所有已改动文件 + 删除 `docs/verification/issues.md`

**Interfaces:** 无（纯格式化）。

- [ ] **Step 1: 删除未跟踪的验证报告**

```bash
rm docs/verification/issues.md
```

理由：用户确认删除（其价值已被提取到修复中，保留增加维护负担）。

- [ ] **Step 2: 格式化工作区改动文件**

```bash
pnpm exec oxfmt backend/src/e2e/test-server.ts backend/src/index.ts backend/src/types/web-api.ts backend/src/api/tools/index.ts frontend/src/types/tool.ts frontend/src/stores/tool.ts frontend/src/components/groups/GroupFormDialog.vue frontend/src/components/layout/AppHeader.vue frontend/src/views/Groups.vue frontend/src/views/Tools.vue README.md docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md
```

预期：若文件已是规范格式则无输出；否则原地修正格式（仅空白/换行/引号风格，不改逻辑）。

- [ ] **Step 3: 确认格式化后测试仍全绿（防 oxfmt 误伤）**

Run: `npx vitest --run --project api-unit --project frontend 2>&1 | tail -5`
Expected: 全部 passed（oxfmt 不改逻辑，但保险起见跑 unit + frontend）。

- [ ] **Step 4: 不单独提交（格式化随各 commit 一起进）**

本 Task 不产生独立 commit，格式化内容包含在后续 Task 2-5 的 `git add` 中。

---

### Task 2: Commit A — e2e 救火（TestServer 初始化 HubService）

**Files:**

- Modify: `backend/src/e2e/test-server.ts`

**Interfaces:**

- 消费：`createHubService`/`setHubService`/`shutdownHubService`（`service-registry.ts`）、`initializeDashboardServices`/`shutdownDashboardServices`（`api/dashboard/index.ts`）、`getAllConfig`（`utils/config.ts`）。
- 产出：MCP 端点 e2e（protocol-compliance/oauth/validation-key）从"守卫跳过的假绿"变为真实断言通过。

**背景**：WIP plan（`.zcode/plans/plan-sess_efa6a8f7`）诊断的根因——`TestServer.start()` 只 `serve()` 监听端口，从不初始化 HubService，导致 10 个 e2e 抛 500。修复内容已写好（`initializeServices()` 复用 production 初始化原语 + 幂等保护 + stop 对应 shutdown）。

- [ ] **Step 1: 确认该文件改动内容正确**

Run: `git diff HEAD -- backend/src/e2e/test-server.ts`
Expected: 看到 `initializeServices()` 私有方法（读 CONFIG_PATH → createHubService → initialize → setHubService → initializeDashboardServices，带 `servicesInitialized` 幂等标志位）+ `start()` 开头调用它 + `stop()` 末尾 `shutdownDashboardServices`/`shutdownHubService`。

- [ ] **Step 2: 仅暂存此文件**

```bash
git add backend/src/e2e/test-server.ts
```

- [ ] **Step 3: 确认暂存内容只有这一个文件**

Run: `git diff --cached --stat`
Expected: 仅 `backend/src/e2e/test-server.ts` 一行。

- [ ] **Step 4: 验证 e2e 全绿（commit 前确认）**

Run: `pnpm test:e2e && npx vitest --run --project api-e2e-oauth --project api-e2e-validation --project api-e2e-outbound 2>&1 | tail -5`
Expected: api-e2e 31 passed / 1 skipped；其余 3 project 全 passed。

- [ ] **Step 5: 提交**

```bash
git commit -m "fix(e2e): TestServer.start() 初始化 HubService，修复 10 个 e2e 失败

根因：TestServer 只挂载 Hono app 监听端口，从不调用
createHubService/setHubService/initialize，导致所有走 MCP 端点→tools/list
的 e2e 因 getHubService() 返回 null 抛 500 'HubService not initialized'。

修复：复用 production 初始化原语（getAllConfig → createHubService →
initialize → setHubService → initializeDashboardServices），幂等保护；
stop() 增加对应 shutdown。

效果：10 failed → 0 failed，e2e 从'守卫跳过的假绿'变为'真实断言的真绿'。"
```

---

### Task 3: Commit B — production 启动链（apiToMcpWebService 接入 + AuthConfig 类型修正）

**Files:**

- Modify: `backend/src/index.ts`、`backend/src/types/web-api.ts`、`README.md`

**Interfaces:**

- 消费：`apiToMcpWebService`（`app.ts` 导出的单例）、`@mcp-core/mcp-hub-core/api-to-mcp` 的 `AuthConfig`/`SecurityConfig` 类型。
- 产出：生产环境 `/api/api-to-mcp/*` 管理路由可用（之前只为 e2e 激活）；backend build 不再 TS2322。

**背景**：两个相关问题——①`app.ts:28` 模块级 `new ApiToMcpWebService()` 但生产 `startServer` 从不 `initialize()`，导致 API-to-MCP 管理（项目核心卖点）生产完全不可用（issues.md P1）；②`web-api.ts` 重复定义 `AuthConfig`/`SecurityConfig`（简化版，无 oauth 分支），与 core 的 discriminated union 不兼容，导致 build TS2322（issues.md B1）。修复均已写好。

- [ ] **Step 1: 确认 index.ts 改动正确**

Run: `git diff HEAD -- backend/src/index.ts`
Expected: 看到 ①`validateConfigurations` 透传 `apiToolsConfigPath`（验证结果会丢弃该字段）；②`startServer` 在 `initializeHubService` 后新增 `apiToMcpWebService.initialize(apiToolsConfigPath)`（try/catch 容错，失败用 `logger.error` 不阻塞启动）；③`cleanupResources` 新增 `apiToMcpWebService.shutdown()`。

- [ ] **Step 2: 确认 web-api.ts 改动正确**

Run: `git diff HEAD -- backend/src/types/web-api.ts`
Expected: 看到 `export type { AuthConfig, SecurityConfig } from '@mcp-core/mcp-hub-core/api-to-mcp'`，删除本地重复定义的 `AuthConfig`/`SecurityConfig` interface。

- [ ] **Step 3: 确认 README 改动合理**

Run: `git diff HEAD -- README.md | head -60`
Expected: 与 production 功能/部署相关说明（如 SPA 架构、versionNegotiation 等），无无关改动。

- [ ] **Step 4: 暂存并提交**

```bash
git add backend/src/index.ts backend/src/types/web-api.ts README.md
git commit -m "fix: 生产启动链接入 apiToMcpWebService + AuthConfig 复用 core 类型

P1: app.ts 模块级 new ApiToMcpWebService() 但生产 startServer 从不
initialize()，导致 /api/api-to-mcp/* 管理（项目核心卖点）生产完全不可用。
startServer 增加 initialize（容错不阻塞），cleanupResources 增加 shutdown。
validateConfigurations 透传 apiToolsConfigPath（验证结果会丢弃该字段）。

B1: web-api.ts 重复定义 AuthConfig/SecurityConfig（无 oauth 分支），与 core
discriminated union 不兼容导致 build TS2322。改为 re-export core 定义。"
```

- [ ] **Step 5: 验证 backend build + typecheck**

Run: `pnpm --filter @mcp-core/mcp-hub-api build 2>&1 | tail -5 && pnpm --filter @mcp-core/mcp-hub-api check 2>&1 | tail -5`
Expected: build Done，check 0 errors（确认 TS2322 已消除）。

---

### Task 4: Commit C — tools 接口语义修正（前后端配套）

**Files:**

- Modify: `backend/src/api/tools/index.ts`、`frontend/src/types/tool.ts`、`frontend/src/stores/tool.ts`

**Interfaces:**

- 消费：后端工具详情/执行接口、前端 `ToolHistoryResponse` 类型。
- 产出：①工具详情 `status` 与列表口径一致（issues.md P7）；②工具执行失败时前端能显示错误（issues.md P6）；③执行历史字段名匹配后端（issues.md P8 之一）。

**背景**：三个前后端配套 bug——①`GET /:toolName` 缺 `status` 字段，详情页恒显示"不可用"；②`POST /:toolName/execute` 的 `success: !result.isError` 导致工具业务失败时被前端当接口错误丢弃，错误不显示；③前端 `response.executions` 但后端返回 `history` 字段。修复均已写好。

- [ ] **Step 1: 确认 tools/index.ts 改动正确**

Run: `git diff HEAD -- backend/src/api/tools/index.ts`
Expected: 看到 ①详情接口 `GET /:toolName` 响应新增 `status: serverStatus === 'connected' ? 'available' : 'unavailable'`；②execute 接口 `success: true`（业务成败由 `data.isError` 表达），带注释说明语义。

- [ ] **Step 2: 确认前端 tool.ts 改动正确**

Run: `git diff HEAD -- frontend/src/types/tool.ts`
Expected: `ToolHistoryResponse.executions` → `history`（与后端字段对齐）。

- [ ] **Step 3: 确认前端 store 改动正确**

Run: `git diff HEAD -- frontend/src/stores/tool.ts`
Expected: `executionHistory.value = response.executions` → `response.history`。

- [ ] **Step 4: 暂存并提交**

```bash
git add backend/src/api/tools/index.ts frontend/src/types/tool.ts frontend/src/stores/tool.ts
git commit -m "fix(tools): 接口语义修正——详情 status / 执行 success / history 字段名

P7: GET /:toolName 详情缺 status 字段，详情页恒显示'不可用'。新增 status
（基于 serverStatus 推导），与列表口径一致。

P6: POST /:toolName/execute 的 success: !result.isError 导致工具业务失败
（isError:true）被前端当接口错误丢弃，错误不显示。改 success: true，业务
成败由 data.isError 表达，让前端能拿到 data.result 错误文本并展示。

P8: 前端 response.executions 但后端返回 history 字段，执行历史永远空。
types/tool.ts + stores/tool.ts 统一为 history。"
```

- [ ] **Step 5: 验证 tools 相关测试**

Run: `npx vitest --run --project api-unit --project frontend 2>&1 | tail -5`
Expected: 全 passed。

---

### Task 5: Commit D — 前端零散 bug + docs 进度回填

**Files:**

- Modify: `frontend/src/components/groups/GroupFormDialog.vue`、`frontend/src/components/layout/AppHeader.vue`、`frontend/src/views/Groups.vue`、`frontend/src/views/Tools.vue`、`docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`

**Interfaces:** 无（纯前端 UI + 文档）。

**背景**：四个独立前端 bug + 文档进度——①退出登录 icon 渲染 `[object Object]`（issues.md P4，`prefixIcon` 应为 TNode 渲染函数非组件对象）；②创建组对话框服务器/工具选项为空（P9，Groups.vue 未 fetch、GroupFormDialog toolOptions 数据源错）；③执行历史 tab 不加载（P8 之二，Tools.vue 切 tab 触发 fetch）；④adoption-overview 文档进度回填。

- [ ] **Step 1: 确认四个前端文件改动正确**

逐个核对 diff：

- `AppHeader.vue`：`prefixIcon: PoweroffIcon` → `prefixIcon: () => h(PoweroffIcon)`（+ import `h`）。
- `GroupFormDialog.vue`：`toolOptions` 从 `groupStore.groupList.*.tools` 聚合改为从 `toolStore.toolList` 取工具名（+ import `useToolStore`）。
- `Groups.vue`：`onMounted` 增加 `serverStore.fetchServers()` + `toolStore.fetchTools()`（+ import 两个 store）。
- `Tools.vue`：`<t-tabs>` 加 `@change="handleTabChange"`，新增 `handleTabChange`（切 history tab 时 `fetchExecutionHistory`）。

- [ ] **Step 2: 确认 adoption-overview 改动是进度回填**

Run: `git diff HEAD -- docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md | head -40`
Expected：P6 相关状态/进度更新（与本轮工作区改动无直接关系，属历史文档回填，归入此 docs commit）。

- [ ] **Step 3: 暂存并提交**

```bash
git add frontend/src/components/groups/GroupFormDialog.vue frontend/src/components/layout/AppHeader.vue frontend/src/views/Groups.vue frontend/src/views/Tools.vue docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md
git commit -m "fix(frontend): 4 个 UI bug + adoption-overview 进度回填

P4: AppHeader 退出登录 prefixIcon 传组件对象被字符串化为 [object Object]，
改为 () => h(PoweroffIcon) 渲染函数。

P9: GroupFormDialog 服务器/工具选项为空——Groups.vue onMounted 未 fetch
servers/tools；toolOptions 错误地从 groupList.tools（白名单语义）聚合，
改为从 toolStore.toolList 取工具名。

P8: Tools.vue 执行历史 tab 切换时不加载，增加 handleTabChange 触发
fetchExecutionHistory。

docs: adoption-overview 进度回填。"
```

- [ ] **Step 4: 验证前端测试**

Run: `npx vitest --run --project frontend 2>&1 | tail -5`
Expected: 全 passed。

---

### Task 6: 卫生处理 — backend/config 全部 ignore + 提供示例

**Files:**

- Modify: `.gitignore`、`backend/config/`（新增 `.example` 样例，现有 json 不进 git）

**Interfaces:** 无。

**背景**：`backend/config/` 未被 `.gitignore` 覆盖，含运行时产物 `.backups/`、`.history/`（格式检查报错），以及环境相关的 `*.json` 配置（不同部署不一样，不该进仓库）。用户确认：config 全部 ignore + 提供示例文件。

- [ ] **Step 1: 先把现有 config 内容存为示例（在 ignore 之前保存）**

```bash
cp backend/config/mcp_server.json backend/config/mcp_server.json.example
cp backend/config/group.json backend/config/group.json.example
cp backend/config/system.json backend/config/system.json.example
cp backend/config/api-tools.json backend/config/api-tools.json.example
```

- [ ] **Step 2: 清理运行时产物**

```bash
rm -rf backend/config/.backups backend/config/.history
```

- [ ] **Step 3: 更新 .gitignore，忽略 backend/config 下的运行时数据但保留 .example**

在 `.gitignore` 追加（用 Edit 工具，在文件末尾 `# Claude Code` 段之前插入）：

```
# Backend runtime config (env-specific, never commit real values)
backend/config/*
!backend/config/*.example
```

- [ ] **Step 4: 确认 git 不再跟踪运行时 json，但跟踪 .example**

Run: `git check-ignore backend/config/mcp_server.json && echo "ignored OK"`
Expected: 输出该路径，确认被忽略。
Run: `git check-ignore backend/config/mcp_server.json.example || echo "tracked OK"`
Expected: `tracked OK`（example 不被忽略）。

- [ ] **Step 5: 暂存并提交**

```bash
git add .gitignore backend/config/*.example
git commit -m "chore: backend/config 运行时配置加入 .gitignore，提供 .example 样例

backend/config/*.json 是环境相关运行时数据（含 server/group/api-tools 配置），
.backups/.history 是运行时产物，不该进仓库。全部 ignore，仅保留 .example 样例
供新部署参考。"
```

---

### Task 7: 全量回归验证

**Files:** 无（纯验证）。

**Interfaces:** 无。

- [ ] **Step 1: 确认工作区已归零（只剩 .zcode/plans 本计划文件等无关项）**

Run: `git status --short`
Expected: 无业务文件未提交（可能有 `.zcode/plans/2026-07-29-*.md` 本计划，可单独提交或保留）。

- [ ] **Step 2: 全量测试**

Run: `npx vitest --run 2>&1 | tail -5`
Expected: `Test Files  119 passed (119)` / `Tests  1820 passed | 1 skipped`（与 baseline 一致）。

- [ ] **Step 3: 全量 typecheck + per-package lint**

Run: `pnpm check 2>&1 | tail -10`
Expected: 5 workspace 全 Done，0 errors。

- [ ] **Step 4: 全仓库 lint + 格式检查**

Run: `pnpm check:ci 2>&1 | tail -10`
Expected: oxlint 0 errors；oxfmt --check **不再报 backend/config 相关文件**（仅可能剩 `.zcode/plans/*`、`docs/superpowers/*` 等非本次范围的既有格式问题，属可接受）。

- [ ] **Step 5: 查看本次新增的 commit 历史**

Run: `git log --oneline -5`
Expected: 看到本计划的 5 个新 commit：`fix(e2e)` / `fix`(production) / `fix(tools)` / `fix(frontend)`(含 docs 回填) / `chore`(config ignore)。

- [ ] **Step 6: 报告结果**

如实汇报：5 个 commit 是否全部成功、全量测试是否 1820 passed、check:ci 是否干净。若有任何步骤失败，如实说明失败点和输出，不宣称成功。

---

## 执行后

- 工作区归零，main 测试全绿。
- 本计划（`docs/superpowers/plans/2026-07-29-commit-verified-working-tree.md`）可选择单独提交为 docs commit，或保留为工作记录不提交（取决于用户）。
- 接下来按既定顺序进入第 2 项：**代码债收尾**（错误体系 / 上帝文件 / 假数据 / Redis 占位），届时另起一轮 brainstorming。
