# 代码债收尾：①错误体系统一 + ②拆 groups 上帝文件

- **状态**: Draft
- **日期**: 2026-07-30
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-11-project-audit-report.md`（产品/架构审计，本文修正其滞后论断）
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（P1-P6 协议跟进，已完成）

## 目的

还清两项经核实仍真实存在的代码债：

1. **①错误体系**：`packages/core/src/api-to-mcp` 子系统的 42 处裸 `throw new Error()` 统一为结构化错误（`McpHubCoreError` 子类）。
2. **②拆上帝文件**：`backend/src/api/groups/index.ts`（1945 行 / 17 端点）按职责域拆为路由注册 + 3 个纯函数 service 模块。

## 审计报告论断修正（重要前置）

`2026-07-11-project-audit-report.md` 对错误体系的 P0 论断**多数已失效**（写于 P1-P6 重构之前）。本节记录核实结果，避免后续重复评估：

| 审计论断                                  | 核实结果（2026-07-30）                                                                                                                                | 处置                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| "73 处裸 Error 导致分类信息全丢失"        | backend 生产代码裸 Error 已清零；剩余 42 处全在 core/api-to-mcp，被 executor 边界统一 catch，是有意内部契约                                           | 本 spec ①仍统一它们（用户决策：为一致性） |
| "裸 Error 一律落入 500 兜底"              | ❌ 已修：`errorResponse()`（`backend/src/utils/api-response.ts:57-58`）已接入 `getHttpStatusForError()`，`McpHubCoreError` 自动推导正确状态码         | 无需处理                                  |
| "ErrorCode→httpStatus 映射未建"           | ❌ 已建：`ERROR_HTTP_STATUS`（`packages/core/src/errors/index.ts:225`）+ `getHttpStatusForError()` 完整存在                                           | 无需处理                                  |
| "`groups/index.ts` 2378 行含硬编码弱密钥" | 已拆出 crypto/key-policy/validation；弱密钥默认值已移除（grep 无命中）；但 index.ts 仍 1945 行                                                        | 本 spec ②拆分                             |
| "统计数据硬编码 100/0"                    | ❌ 已不成立：`performance-monitor.ts` 有真实采集（recordMetric/recordToolExecution），已接入 groups/dashboard/performance API，successRate 有除零保护 | 无需处理                                  |
| "`RedisCacheManager` no-op 占位"          | 🟡 仍 no-op（5 处 TODO）                                                                                                                              | **本 spec 显式排除**，决策另起            |

## 显式排除（非本 spec 范围）

- backend 生产代码裸 Error（已清零）。
- core/api-to-mcp 的 `mock-api-server.ts`、`integration/` 测试夹具里的裸 Error（测试代码）。
- ③统计假数据（已不成立）、④Redis 占位（决策另起）。
- 审计报告中"映射未建/一律500"等已失效论断。

---

## 阶段一：①错误体系统一

### 现状

`packages/core/src/api-to-mcp` 子系统 10 个生产文件共 42 处 `throw new Error()`：

| 文件                                     | 数量 | 性质                                                   |
| ---------------------------------------- | ---- | ------------------------------------------------------ |
| `services/cache-key-manager.ts`          | 9    | 内部不变量断言                                         |
| `services/authentication.ts`             | 8    | 前置条件/配置校验（"Bearer 策略收到非 bearer 配置"等） |
| `services/api-to-mcp-service-manager.ts` | 7    | 状态/配置校验（"配置文件路径未设置"等）                |
| `utils/http-request-builder.ts`          | 6    | 模板渲染失败（URL/查询参数/请求头/请求体）             |
| `services/api-executor.ts`               | 4    | 参数验证/请求构建失败                                  |
| `services/api-config-manager.ts`         | 3    | 配置加载/校验                                          |
| `services/cache-manager.ts`              | 2    | 缓存策略不变量                                         |
| `services/api-tool-generator.ts`         | 1    | 工具定义生成失败                                       |
| `services/response-processor.ts`         | 1    | 响应处理失败                                           |
| `services/http-client.ts`                | 1    | HTTP 客户端错误                                        |

### 设计

#### ErrorCode 扩展（粗粒度，新增 4 个码）

core/api-to-mcp 子系统目前无自己的错误码段。新增 **7000-7499 api-to-mcp 子系统错误**段，4 个粗粒度码：

| ErrorCode                     | 值   | 覆盖                                                               | httpStatus | severity |
| ----------------------------- | ---- | ------------------------------------------------------------------ | ---------- | -------- |
| `API_TO_MCP_CONFIG_ERROR`     | 7001 | 配置路径未设置/配置无效/认证策略不匹配/认证配置无效                | 500        | HIGH     |
| `API_TO_MCP_BUILD_FAILED`     | 7002 | URL/参数/请求头/请求体模板渲染失败、请求构建失败、参数验证失败     | 400        | MEDIUM   |
| `API_TO_MCP_EXECUTION_FAILED` | 7003 | API 调用执行失败、HTTP 客户端错误、响应处理失败                    | 502        | MEDIUM   |
| `API_TO_MCP_INTERNAL`         | 7004 | cache-key 不变量、service-manager 状态违反、工具生成失败等内部错误 | 500        | HIGH     |

映射规则（每处裸 Error 归类）：

- 配置/认证校验类（authentication、service-manager "配置文件路径未设置"、api-config-manager）→ `API_TO_MCP_CONFIG_ERROR`
- 模板渲染/请求构建/参数验证类（http-request-builder、api-executor 构建阶段）→ `API_TO_MCP_BUILD_FAILED`
- 执行/HTTP/响应类（http-client、response-processor、api-executor 执行阶段）→ `API_TO_MCP_EXECUTION_FAILED`
- 内部不变量类（cache-key-manager、cache-manager、api-tool-generator、service-manager 状态）→ `API_TO_MCP_INTERNAL`

三张映射表（`ERROR_MESSAGES` / `ERROR_SEVERITY` / `ERROR_HTTP_STATUS`）用 `Record<ErrorCode, ...>` 强制全覆盖，编译期保证不漏配。`getCategory()` 的码段判断增加 7000-7499 → `ErrorCategory.RUNTIME`（api-to-mcp 子系统错误属运行时范畴）。

#### 错误类选择

复用现有 core 错误体系（`packages/core/src/errors/index.ts`）：

- 4 个码段统一用 `ServiceError`（已有子类，构造签名 `(code, message?, details?, context?)`），不新增错误子类。
- 不使用 `ConfigError`（语义上 api-to-mcp 错误都是服务侧运行时错误，ServiceError 更贴切）。

#### 关键约束：不破坏 executor 边界

`api-executor.execute()` 的 catch 块（`api-executor.ts:155-174`）当前逻辑：

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // ... 记录日志 ...
  return { raw: undefined, data: null, success: false, error: errorMessage };
}
```

把内部裸 Error 换成 `ServiceError`（`extends McpHubCoreError extends Error`）后：

- `.message` 仍在，catch 提取逻辑不变 ✅
- **行为不变**：executor 仍然 catch 一切并转成 `{success:false, error}`，不让结构化错误逃逸到 MCP 协议层（避免内部错误码泄露给 MCP 客户端）
- 这是纯内部类型升级，外部（MCP 客户端、API 调用方）行为零变化。

`api-executor.ts` 内部自身的 4 处裸 Error 也升级为 ServiceError，但它们在 execute() 内 throw 后会被自身 catch 转成结果对象——同样不逃逸。

#### 轨道 B 清理

`backend/src/services/mcp_hub_service.ts:19-67` 定义了 `McpHubError` + 4 个子类（`ServiceNotInitializedError`/`GroupNotFoundError`/`ToolNotFoundError`/`ServiceInitializationError`）。

核实结论：

- 4 个子类**全仓无 `throw new` 调用**（grep 确认）——它们从未被实例化抛出。
- `instanceof McpHubError` 有 3 处活跃引用（`mcp_hub_service.ts:368, 441, 841`），模式均为 `if (error instanceof McpHubError || error instanceof ServiceError) throw error; else 包装成 ServiceError`。
- 因为子类从未被 throw，这 3 个 `instanceof McpHubError` 分支**永远不会命中**。

清理操作：

1. 删除 `mcp_hub_service.ts:19-67` 的 5 个错误类定义。
2. 3 处 `instanceof McpHubError || error instanceof ServiceError` → 移除 `McpHubError` 判断，保留 `instanceof ServiceError`。行为不变（移除的是死分支）。
3. 删除相关 import。

### 阶段一交付物

- `packages/core/src/errors/index.ts`：新增 7000-7499 段（4 码 + 三表 + getCategory 更新）。
- 10 个 core/api-to-mcp 生产文件：42 处裸 Error → `throw new ServiceError(ErrorCode.XXX, msg, details, ctx)`。
- `api-executor.ts`：验证 catch 边界行为不变（预期无需改代码，加测试确认）。
- `backend/src/services/mcp_hub_service.ts`：删除轨道 B 死代码 + 修正 3 处 instanceof。
- 测试：core 现有单测更新 `expect.toThrow` 断言（错误类型从 `Error` 改为 `ServiceError`）；新增 executor 边界专项测试。

### 阶段一 DoD 锚点

| DoD 项                               | 验证命令                                                                                                                   | 目标                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| core/api-to-mcp 生产代码裸 Error = 0 | `grep -rn "throw new Error(" packages/core/src/api-to-mcp --include="*.ts" \| grep -vE "test\|mock\|integration" \| wc -l` | 0                                               |
| 轨道 B 类定义 = 0                    | `grep -rn "class McpHubError\|extends McpHubError" backend/src --include="*.ts"`                                           | 0 命中                                          |
| `instanceof McpHubError` = 0         | `grep -rn "instanceof McpHubError" backend/src`                                                                            | 0 命中                                          |
| executor 边界行为不变                | executor 边界专项测试                                                                                                      | 结构化错误被 catch 转 `{success:false}`，不逃逸 |
| 三表全覆盖                           | `pnpm --filter @mcp-core/mcp-hub-core build`（tsc 利用 Record 约束）                                                       | 编译通过                                        |
| 全量测试                             | `pnpm test`                                                                                                                | ≥ 1820 passed / 0 failed                        |
| lint                                 | `pnpm check:ci`                                                                                                            | oxlint 0 errors                                 |

---

## 阶段二：②拆 groups 上帝文件

### 现状

`backend/src/api/groups/index.ts`：1945 行，17 个路由 handler + 1 个 `shutdownGroupsApi`，handler 内联大量业务逻辑。crypto/key-policy/validation 已拆出（不动）。

### 目标结构

```
backend/src/api/groups/
├── index.ts                    ← 仅路由注册 + shutdown（目标 < 500 行）
├── crypto.ts                   ← 已存在（不动）
├── key-policy.ts               ← 已存在（不动）
├── validation.ts               ← 已存在（不动）
├── group-service.ts            ← 新：组 CRUD + health + servers（~500 行）
├── tool-access-service.ts      ← 新：tools + available-tools + validate-tool-access（~400 行）
└── validation-key-service.ts   ← 新：validation-key 的 5 个端点业务逻辑（~500 行）
```

### 端点归属

| service                    | 端点（index.ts 行号）                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **group-service**          | GET / (L56)、GET /:groupId (L227)、GET /:groupId/health (L361)、GET /:groupId/servers (L553)、POST / (L645)、PUT /:groupId (L779)、DELETE /:groupId (L919)                                                |
| **tool-access-service**    | GET /:groupId/tools (L464)、POST /:groupId/tools (L1008)、GET /:groupId/available-tools (L1183)、POST /:groupId/validate-tool-access (L1312)                                                              |
| **validation-key-service** | POST /:groupId/validation-key (L1455)、GET /:groupId/validation-key (L1565)、POST /:groupId/validate-key (L1630)、DELETE /:groupId/validation-key (L1755)、POST /:groupId/generate-validation-key (L1829) |

### service 形态：纯函数模块

与现有 `crypto.ts`/`validation.ts` 风格一致。每个 service 导出一组纯函数，**不持有 Hono Context**，接收业务参数、返回数据或抛结构化错误。index.ts 的 handler 只做：解析请求 → 调 service 函数 → 用 `successResponse`/`errorResponse` 构造响应。

示例（`validation-key-service.ts`）：

```typescript
export async function createValidationKey(
  groupId: string,
  opts: { algorithm?: string },
): Promise<{ key: string }>;
export async function getValidationKey(
  groupId: string,
): Promise<{ key?: string; createdAt?: string } | null>;
export async function validateKey(groupId: string, key: string): Promise<{ valid: boolean }>;
export async function deleteValidationKey(groupId: string): Promise<void>;
export async function generateValidationKey(groupId: string): Promise<{ key: string }>;
```

依赖注入：service 函数按现状 import 方式获取 `getAllConfig`/`saveConfig`/`performanceMonitor`/crypto 工具（不通过参数注入，避免过度设计）。

### 关键约束：纯重构，行为不变

1. 所有端点的请求/响应 JSON 格式、HTTP 状态码、错误消息**逐字保持**。
2. `groups.unit.test.ts`（323 行）作为**黄金校验集，不改断言**——拆分前后都全绿即证明行为不变。
3. `shutdownGroupsApi` 留在 index.ts（管路由级资源）。

### 阶段二 DoD 锚点

| DoD 项                | 验证命令                                              | 目标                     |
| --------------------- | ----------------------------------------------------- | ------------------------ |
| index.ts 行数         | `wc -l backend/src/api/groups/index.ts`               | < 500                    |
| 3 个 service 文件存在 | `ls backend/src/api/groups/*-service.ts`              | 3 个                     |
| 黄金校验集全绿        | `npx vitest --run src/api/groups/groups.unit.test.ts` | 全 passed，断言未改      |
| 全量测试              | `pnpm test`                                           | ≥ 1820 passed / 0 failed |

---

## 风险与缓解

| 风险                                                      | 缓解                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 阶段一改 executor throw 类型，意外让错误逃逸到 MCP 协议层 | executor catch 用 `unknown` catch-all 不改行为；新增专项测试验证结构化错误被转成 `{success:false}` |
| 新增 ErrorCode 漏配三表映射                               | `Record<ErrorCode, ...>` 编译期强制全覆盖                                                          |
| 阶段二拆分引入微妙行为差异（字段顺序、错误措辞）          | 黄金校验集不改断言；逐端点对比                                                                     |
| 轨道 B 删除后有隐藏 instanceof 依赖                       | 已全仓核实：仅 3 处且为死分支（子类从未被 throw），详见阶段一                                      |

## 实施顺序

**串行**：阶段一（①错误体系）全绿 → 阶段二（②拆文件）。每阶段独立可验证、可回滚。

## 测试与验证

- 每阶段结束：`pnpm test`（≥ 1820 passed）+ `pnpm check` + `pnpm check:ci`（oxlint 0 errors）。
- 回归基线：当前 1820 passed / 1 skipped，完成后不低于此。
