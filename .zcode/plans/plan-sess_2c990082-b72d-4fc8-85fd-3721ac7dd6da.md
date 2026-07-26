# 架构债务清理（第二轮）：裸 Error 替换 + tool_manager 拆分 + 类型断言消除

在 `fix/p0-p1-architecture-cleanup` 分支上继续（PR #5 之后追加 commit），或新起分支取决于 PR 是否已合并。当前先在现有分支上继续。

---

## 任务 A：裸 throw new Error 分批替换（64 处 → 按价值分 4 批）

### A-1. 第 1 批：高价值——会经 errorResponse 的 service 层替换（~18 处）

这些替换会直接受益于阶段 4 建立的 ErrorCode→httpStatus 自动推导：

| 文件                                 | 行号       | 替换为                                       |
| ------------------------------------ | ---------- | -------------------------------------------- |
| `services/config_service.ts`         | L98, L923  | `ConfigError(INVALID_CONFIG_FORMAT)`         |
| `services/config_service.ts`         | L437       | `ConfigError(CONFIG_FILE_NOT_FOUND)`         |
| `services/server_manager.ts`         | L258, L323 | `ServiceError(SERVER_UNAVAILABLE)` → 404/503 |
| `services/server_manager.ts`         | L262       | `ConnectionError(SERVER_DISCONNECTED)` → 503 |
| `services/api-to-mcp-web-service.ts` | L98, L330  | `McpHubCoreError(INTERNAL_SERVER_ERROR)`     |
| `services/sse_event_manager.ts`      | L54        | `ServiceError(SERVICE_UNAVAILABLE)`          |
| `api/groups/crypto.ts`               | L19        | `ConfigError(INVALID_SERVER_CONFIG)`         |

### A-2. 第 2 批：auth.ts 全量替换 + 同步改写 api/auth/index.ts（16+4 处）

**这是最复杂的一批**——auth.ts 的 16 处 throw 当前被 api/auth/index.ts 的 catch 用 `errorMessage.includes(...)` 字符串匹配解析。替换为 AuthError 后，必须同步将 api/auth/index.ts 的 catch 改为 `error instanceof AuthError` + `error.code` 判断。

替换映射：

- `Invalid username or password` → `AuthError(AUTH_INVALID_CREDENTIALS)`
- `Account temporarily locked` → `AuthError(AUTH_ACCOUNT_LOCKED)`
- `Invalid refresh token` / `Token has been revoked` / `Invalid token type` → `AuthError(AUTH_TOKEN_INVALID)`
- `Invalid or expired token` → `AuthError(AUTH_TOKEN_EXPIRED)`
- `Auth service not initialized` → `ServiceError(SERVICE_UNAVAILABLE)`
- `User not found` → `AuthError(AUTH_INVALID_CREDENTIALS)`
- `Password hash not found` → `AuthError(AUTHENTICATION_FAILED)`

api/auth/index.ts 改写：3 个 catch 块（login/refresh/verify）从字符串匹配改为 instanceof 判断，保留现有的自定义错误码返回格式。

### A-3. 第 3 批：内部吞掉、低优先级（~21 处）

这些 throw 被调用方内部 catch 吞掉，不会到达 errorResponse，替换价值主要是代码一致性：

- `mcp_service.ts`（6 处 `Hub service not initialized`）
- `group_manager.ts`（2 处验证错误）
- `api-to-mcp-web-service.ts`（9 处配置路径未设置/校验错误）
- `config_service.ts`（1 处 L132 validateConfig 内部 catch）

统一替换为对应的 ConfigError/ValidationError/ServiceError。

### A-4. 第 4 批：启动期/协议期（~10 处，最低优先级）

- `index.ts`（启动验证）
- `service-registry.ts`（2 处注册期）
- `utils/sse.ts`（5 处 MCP Transport 协议路径）
- `api/mcp/group-service.ts`（2 处 MCP 协议）
- `utils/config.ts`（1 处）
- `auth.ts` L56（启动 loadConfig）

**策略**：A-1 和 A-2 在本轮做（核心价值），A-3 和 A-4 在后续 PR 做或注释标注 TODO。

---

## 任务 B：tool_manager.ts 拆分（1128 行 → 提取 ~335 行）

### B-1. 提取 `tool-result-transform.ts`（~135 行）

抽取两个**纯函数**（零 `this` 依赖）：

- `transformToolResult(result: unknown): ToolResult`（L669-L777）
- `formatError(error: unknown): string`（L779-L806）

文件位置：`backend/src/services/tool-result-transform.ts`

`ToolManager` 类中改为 `import { transformToolResult, formatError }` 并删除私有方法。调用点仅 1 处（`executeToolWithRetry` L280 调 `transformToolResult`，内部调 `formatError`）。

### B-2. 提取 `tool-arg-validator.ts`（~200 行）

抽取参数校验逻辑：

- `validateToolArgsWithSchema(tool, args)`（L428-L534）
- `validateArgumentType(argName, argValue, propSchema)`（L536-L613）

文件位置：`backend/src/services/tool-arg-validator.ts`

这两个函数只依赖 `Tool` 类型和 `logger`，不需要 `serverManager`/`groupManager`。`validateToolArgs` 公共方法保留在 `ToolManager` 中（它需要 `findToolDefinition`），但委托给提取出的函数。

### B-3. 拆分后效果

- `tool_manager.ts`：从 1128 行降至 ~800 行，保留编排逻辑
- `tool-result-transform.ts`：~135 行纯函数
- `tool-arg-validator.ts`：~200 行纯函数
- 新增独立的单元测试覆盖 `transformToolResult` 的多分支逻辑（当前只通过 `executeTool` 间接测试）

---

## 任务 C：消除 `as unknown as` 类型断言（19 处，按根因分组）

### C-1. DeepReadonly 边界问题（核心，~6 处）

**根因**：`getAllConfig()` 返回 `DeepReadonly<T>`，但 core 的 `initializeFromConfig` 形参要求可变 `McpServerConfig`。

**方案**：让 core 的 `McpServerConfig` 和 `initializeFromConfig` 形参接受 `Readonly` 版本。

具体改动：

- `packages/core/src/types/config.ts`：`McpServerConfig` 的 `servers`/`groups` 字段加 `Readonly` 前缀
- `packages/core/src/services/mcp/service-manager.ts`：`initializeFromConfig(config: Readonly<McpServerConfig>)`
- `backend/src/services/service-registry.ts`：移除 `as never`（L94-95）
- `backend/src/types/config-helpers.ts`：移除 `as McpServerConfig` 或用 `satisfies`
- `backend/src/utils/config.ts`：`asMutable` 函数评估是否仍需要

### C-2. McpContentItem 内容类型断言（6 处，mcp_service.ts）

**根因**：`{ type: 'text' as const, text: ... }` 的字面量类型与 `McpContentItem` union 的精确匹配问题。

**方案**：利用已有的 `normalizeMcpContent()` 函数包装，让类型推导自然完成。或定义一个 helper `createTextContent(text: string): McpContentItem`。

### C-3. 配置校验入口断言（3 处，config_service.ts L224/660/754）

**根因**：`Record<string, unknown>` 直接断言为 `McpConfig`/`SystemConfig`。

**方案**：改用 share 包的 `McpConfigSchema.parse(config)` / `SystemConfigSchema.parse(config)` 做 schema 校验后获得推导类型，而非断言。

### C-4. 非配置类局部断言（4 处）

- `tools/index.ts` L299/L324：`result.content as unknown as Record<string, unknown>` — 改用类型守卫
- `group-service.ts` L357/L378：JSONSchema/CallToolResult 断言 — 改用 schema 解析或类型守卫

### C-5. 不可消除的合理断言（5 处，标注后保留）

- `dashboard/index.ts` L124：mock 构造，合理
- `frontend-logger.ts` L87/L109：浏览器环境探测，合理
- `cli-mcp-server.ts` L241：绕过 SDK 类型限制，合理
- `api-executor.ts` L165：错误响应 undefined 字段，用可选字段改善

---

## 实施顺序

1. **任务 B**（tool_manager 拆分）— 最独立，不影响其他改动
2. **任务 A-1**（高价值 Error 替换）+ **A-2**（auth 全量）— 需要同步改 api 层
3. **任务 C-1**（DeepReadonly 边界）— 改 core 包形参，影响面广
4. **任务 C-2/C-3**（内容类型 + 配置校验断言）
5. **A-3/A-4** 和 **C-4** 作为可选收尾

每步完成后 `pnpm test + check + build` 验证，单独 commit。

## 分支策略

继续在 `fix/p0-p1-architecture-cleanup` 分支上追加 commit（PR #5 尚未合并）。如果 PR 已合并则新起分支。
