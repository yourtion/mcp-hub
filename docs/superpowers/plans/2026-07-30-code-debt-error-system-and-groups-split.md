# 代码债收尾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 还清两项代码债——① core/api-to-mcp 的 42 处裸 Error 统一为 ServiceError；② groups/index.ts（1945 行）按职责域拆为路由 + 3 个纯函数 service。

**Architecture:** 串行两阶段。阶段一扩展 core 错误码段（7000-7499，4 个粗粒度码），把 10 个文件的 42 处裸 Error 替换为 `ServiceError`，保留 executor 边界 catch 行为不变，并删除 backend 轨道 B 死代码。阶段二把 groups/index.ts 的 17 个端点业务逻辑按职责域抽到 3 个纯函数 service 模块，index.ts 仅留路由注册，行为零变化（黄金校验集不改断言）。

**Tech Stack:** TypeScript、Hono、Vitest、oxlint/oxfmt、pnpm workspace（packages/core + backend）。

## Global Constraints

- **回归基线**：当前 `pnpm test` = 119 文件 / 1820 passed / 1 skipped / 0 failed。每阶段完成后不得低于此。
- **错误类**：统一用 core 的 `ServiceError`（`packages/core/src/errors/index.ts`），构造签名 `(code: ErrorCode, message?: string, details?: unknown, context?: Record<string, unknown>)`。不新增错误子类。
- **ErrorCode 新增段**：7000-7499，4 个码——`API_TO_MCP_CONFIG_ERROR=7001`、`API_TO_MCP_BUILD_FAILED=7002`、`API_TO_MCP_EXECUTION_FAILED=7003`、`API_TO_MCP_INTERNAL=7004`。
- **三表强制全覆盖**：`ERROR_MESSAGES` / `ERROR_SEVERITY` / `ERROR_HTTP_STATUS` 都是 `Record<ErrorCode, ...>`，新增码必须同步配齐三表，否则 tsc 编译失败。
- **executor 边界不可破**：`api-executor.execute()` 的 catch（L155-174）必须继续把所有错误转成 `{success:false, error}`，不让结构化错误逃逸到 MCP 协议层。
- **原 `{ cause: error }` 语义保留**：ServiceError 无 cause 字段，改用 `context: { cause: (error as Error).message }` 携带原始错误信息。
- **阶段二纯重构**：`groups.unit.test.ts` 是黄金校验集，**不改任何断言**；所有端点的请求/响应格式、HTTP 状态码、错误消息逐字保持。
- **Node >=20**，pnpm 10.6.4。直接在 main 分支工作（沿用项目惯例）。
- **commit 风格**：conventional commits，参考 `git log --oneline -10`。

---

# 阶段一：错误体系统一

## Task 1: 扩展 ErrorCode（新增 7000 段 4 码 + 三表）

**Files:**

- Modify: `packages/core/src/errors/index.ts`（ErrorCode enum L24-82、ERROR_MESSAGES L87、ERROR_SEVERITY L160、ERROR_HTTP_STATUS L225、getCategory L314）
- Test: `packages/core/src/errors/index.unit.test.ts`

**Interfaces:**

- 产出：`ErrorCode.API_TO_MCP_CONFIG_ERROR/7001`、`API_TO_MCP_BUILD_FAILED/7002`、`API_TO_MCP_EXECUTION_FAILED/7003`、`API_TO_MCP_INTERNAL=7004`，供 Task 2-5 使用。
- 三表映射值（verbatim）：
  - 7001 CONFIG_ERROR：message `'API-to-MCP 配置错误'`、severity `HIGH`、httpStatus `500`
  - 7002 BUILD_FAILED：message `'API-to-MCP 请求构建失败'`、severity `MEDIUM`、httpStatus `400`
  - 7003 EXECUTION_FAILED：message `'API-to-MCP 执行失败'`、severity `MEDIUM`、httpStatus `502`
  - 7004 INTERNAL：message `'API-to-MCP 内部错误'`、severity `HIGH`、httpStatus `500`
- getCategory：7000-7499 → `ErrorCategory.RUNTIME`。

- [ ] **Step 1: 写失败测试（新增 4 码 + 三表 + getCategory）**

在 `index.unit.test.ts` 新增测试块：

```typescript
describe('API-to-MCP 错误码段 (7000-7499)', () => {
  it('7001 CONFIG_ERROR 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_CONFIG_ERROR).toBe(7001);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_CONFIG_ERROR]).toBe('API-to-MCP 配置错误');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_CONFIG_ERROR]).toBe(ErrorSeverity.HIGH);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_CONFIG_ERROR)).toBe(500);
  });
  it('7002 BUILD_FAILED 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_BUILD_FAILED).toBe(7002);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_BUILD_FAILED]).toBe('API-to-MCP 请求构建失败');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_BUILD_FAILED]).toBe(ErrorSeverity.MEDIUM);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_BUILD_FAILED)).toBe(400);
  });
  it('7003 EXECUTION_FAILED 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_EXECUTION_FAILED).toBe(7003);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_EXECUTION_FAILED]).toBe('API-to-MCP 执行失败');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_EXECUTION_FAILED]).toBe(ErrorSeverity.MEDIUM);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_EXECUTION_FAILED)).toBe(502);
  });
  it('7004 INTERNAL 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_INTERNAL).toBe(7004);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_INTERNAL]).toBe('API-to-MCP 内部错误');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_INTERNAL]).toBe(ErrorSeverity.HIGH);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_INTERNAL)).toBe(500);
  });
  it('7000 段归类为 RUNTIME', () => {
    const err = new ServiceError(ErrorCode.API_TO_MCP_INTERNAL);
    expect(err.category).toBe(ErrorCategory.RUNTIME);
  });
});
```

（确认测试文件顶部已 import `ErrorCode/ERROR_MESSAGES/ERROR_SEVERITY/ErrorSeverity/getHttpStatusForError/ServiceError/ErrorCategory`，缺什么补什么。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest --run packages/core/src/errors/index.unit.test.ts 2>&1 | tail -15`
Expected: FAIL（新码未定义，编译/断言错误）。

- [ ] **Step 3: 实现——ErrorCode enum 末尾（OAuth 出站段后）追加**

在 `ErrorCode` enum 的 `OAUTH_OUTBOUND_ENV_VAR_MISSING = 6203` 之后追加：

```typescript
  // API-to-MCP 子系统错误（7000-7499）
  API_TO_MCP_CONFIG_ERROR = 7001,
  API_TO_MCP_BUILD_FAILED = 7002,
  API_TO_MCP_EXECUTION_FAILED = 7003,
  API_TO_MCP_INTERNAL = 7004,
```

- [ ] **Step 4: 三表追加**

在 `ERROR_MESSAGES`（OAuth 出站段后）追加：

```typescript
  // API-to-MCP 子系统错误
  [ErrorCode.API_TO_MCP_CONFIG_ERROR]: 'API-to-MCP 配置错误',
  [ErrorCode.API_TO_MCP_BUILD_FAILED]: 'API-to-MCP 请求构建失败',
  [ErrorCode.API_TO_MCP_EXECUTION_FAILED]: 'API-to-MCP 执行失败',
  [ErrorCode.API_TO_MCP_INTERNAL]: 'API-to-MCP 内部错误',
```

`ERROR_SEVERITY` 追加：

```typescript
  [ErrorCode.API_TO_MCP_CONFIG_ERROR]: ErrorSeverity.HIGH,
  [ErrorCode.API_TO_MCP_BUILD_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.API_TO_MCP_EXECUTION_FAILED]: ErrorSeverity.MEDIUM,
  [ErrorCode.API_TO_MCP_INTERNAL]: ErrorSeverity.HIGH,
```

`ERROR_HTTP_STATUS` 追加：

```typescript
  [ErrorCode.API_TO_MCP_CONFIG_ERROR]: 500,
  [ErrorCode.API_TO_MCP_BUILD_FAILED]: 400,
  [ErrorCode.API_TO_MCP_EXECUTION_FAILED]: 502,
  [ErrorCode.API_TO_MCP_INTERNAL]: 500,
```

- [ ] **Step 5: getCategory 增加 7000 段判断**

在 `getCategory()` 的 `if (code >= 6000 && code < 7000) return ErrorCategory.RUNTIME;` 之后、`return ErrorCategory.SYSTEM;` 之前加：

```typescript
if (code >= 7000 && code < 8000) return ErrorCategory.RUNTIME;
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest --run packages/core/src/errors/index.unit.test.ts 2>&1 | tail -10`
Expected: 全 passed（含新增 5 个用例）。

- [ ] **Step 7: 确认 core 包编译（Record 全覆盖约束）**

Run: `pnpm --filter @mcp-core/mcp-hub-core build 2>&1 | tail -5`
Expected: 编译通过（三表未漏配则 tsc 报错）。

- [ ] **Step 8: 提交**

```bash
git add packages/core/src/errors/index.ts packages/core/src/errors/index.unit.test.ts
git commit -m "feat(errors): 新增 API-to-MCP 子系统错误码段 7000-7499（4 个粗粒度码）

API_TO_MCP_CONFIG_ERROR/BUILD_FAILED/EXECUTION_FAILED/INTERNAL，
三表（消息/severity/httpStatus）全覆盖，getCategory 归类 RUNTIME。"
```

---

## Task 2: 替换 utils/http-request-builder.ts 的 6 处裸 Error（BUILD_FAILED）

**Files:**

- Modify: `packages/core/src/api-to-mcp/utils/http-request-builder.ts`（L131,144,177,203,235,267）
- Test: 若有 `http-request-builder.unit.test.ts` 则更新断言；无则跳过 Step 1。

**Interfaces:**

- 消费：Task 1 产出的 `ErrorCode.API_TO_MCP_BUILD_FAILED`、`ServiceError`。
- 这 6 处全是模板渲染失败，统一映射 `API_TO_MCP_BUILD_FAILED`。

**映射（verbatim）：**

- L131 `URL模板渲染失败: ${urlResult.error}` → `new ServiceError(ErrorCode.API_TO_MCP_BUILD_FAILED, \`URL模板渲染失败: ${urlResult.error}\`)`
- L144 `查询参数 '${key}' 模板渲染失败: ${paramResult.error}` → 同模式
- L177 `请求头 '${key}' 模板渲染失败: ${headerResult.error}` → 同模式
- L203 `请求体模板渲染失败: ${bodyResult.error}` → 同模式
- L235 `对象属性 '${key}' 模板渲染失败: ${templateResult.error}` → 同模式
- L267 `数组元素模板渲染失败: ${templateResult.error}` → 同模式

- [ ] **Step 1: 顶部 import 追加**

```typescript
import { ErrorCode, ServiceError } from '../../errors/index.js';
```

- [ ] **Step 2: 6 处替换**（按上表，保留原 message 字符串和模板变量）

- [ ] **Step 3: 若存在单测，更新断言**（`toThrow(/模板渲染失败/)` 仍匹配，因为 message 不变；若有 `expect(e).toBeInstanceOf(Error)` 改为可选 `ServiceError`。逐个核对。）

- [ ] **Step 4: 跑相关测试**

Run: `npx vitest --run --project core 2>&1 | tail -8`
Expected: 全 passed。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/api-to-mcp/utils/http-request-builder.ts
git commit -m "refactor(api-to-mcp): http-request-builder 6 处裸 Error → ServiceError(BUILD_FAILED)"
```

---

## Task 3: 替换 services/authentication.ts 的 8 处裸 Error（CONFIG_ERROR）

**Files:**

- Modify: `packages/core/src/api-to-mcp/services/authentication.ts`（L38,41,84,87,134,137,248,254）

**Interfaces:** 消费 `ErrorCode.API_TO_MCP_CONFIG_ERROR`。8 处全是认证配置校验失败。

**映射（verbatim，message 保留）：**

- L38 `Bearer 策略收到非 bearer 配置`、L41 `Bearer token认证需要提供token`
- L84 `API Key 策略收到非 apikey 配置`、L87 `API Key认证需要提供token`
- L134 `Basic 策略收到非 basic 配置`、L137 `Basic认证需要提供用户名和密码`
- L248 `不支持的认证类型: ${authConfig.type}`、L254 `认证配置无效: ${validation.error}`
  全部 → `new ServiceError(ErrorCode.API_TO_MCP_CONFIG_ERROR, <原message>)`

- [ ] **Step 1: import 追加**（`import { ErrorCode, ServiceError } from '../../errors/index.js';`）
- [ ] **Step 2: 8 处替换**
- [ ] **Step 3: 更新 `authentication.unit.test.ts` 断言**（若有 `toBeInstanceOf(Error)`，`ServiceError extends Error` 仍匹配；若断言具体 Error 类型需改。grep `authentication.unit.test.ts` 的 throw 断言逐个核对。）
- [ ] **Step 4: 跑测试** `npx vitest --run --project core 2>&1 | tail -8` → 全 passed
- [ ] **Step 5: 提交**

```bash
git add packages/core/src/api-to-mcp/services/authentication.ts packages/core/src/api-to-mcp/services/authentication.unit.test.ts
git commit -m "refactor(api-to-mcp): authentication 8 处裸 Error → ServiceError(CONFIG_ERROR)"
```

---

## Task 4: 替换 services/cache-key-manager.ts 的 9 处裸 Error（INTERNAL）

**Files:**

- Modify: `packages/core/src/api-to-mcp/services/cache-key-manager.ts`（L80,161,200,204,225,275,307,311,334）

**Interfaces:** 消费 `ErrorCode.API_TO_MCP_INTERNAL`。9 处全是缓存键生成不变量/契约违反。

**特殊处理：**

- L80 `无法生成缓存键: ${...}` 带 `{ cause: error }` → `new ServiceError(ErrorCode.API_TO_MCP_INTERNAL, \`无法生成缓存键: ${...}\`, undefined, { cause: error instanceof Error ? error.message : String(error) })`
- L161 多行 Error → 合并为 ServiceError（读 L161-165 完整内容确认 message）。
- L334 `所有键生成都失败了...` → ServiceError。

- [ ] **Step 1: import 追加**
- [ ] **Step 2: 9 处替换**（L80/L334 保留原始错误信息到 context.cause）
- [ ] **Step 3: 更新单测断言**
- [ ] **Step 4: 跑测试** `npx vitest --run --project core` → 全 passed
- [ ] **Step 5: 提交** `refactor(api-to-mcp): cache-key-manager 9 处裸 Error → ServiceError(INTERNAL)`

---

## Task 5: 替换 services/api-to-mcp-service-manager.ts 的 7 处裸 Error（混合码段）

**Files:**

- Modify: `packages/core/src/api-to-mcp/services/api-to-mcp-service-manager.ts`（L189,197,217,486,529,581,607）

**Interfaces:** 按语义混合使用 CONFIG_ERROR / INTERNAL。

**映射：**

- L189 `初始化失败: ${msg}` 带 cause → `ServiceError(API_TO_MCP_INTERNAL, ..., undefined, { cause: msg })`
- L197 `配置文件路径未设置` → `ServiceError(API_TO_MCP_CONFIG_ERROR, ...)`
- L217 `重新加载失败: ${msg}` 带 cause → `ServiceError(API_TO_MCP_INTERNAL, ..., undefined, { cause: msg })`
- L486 `无法重启：配置文件路径未设置` → `ServiceError(API_TO_MCP_CONFIG_ERROR, ...)`
- L529 `服务管理器未运行，当前状态: ${this.status}` → `ServiceError(API_TO_MCP_INTERNAL, ...)`
- L581 `配置文件路径未设置` → `ServiceError(API_TO_MCP_CONFIG_ERROR, ...)`
- L607 `找不到工具 '${tool.name}' 的配置` → `ServiceError(API_TO_MCP_CONFIG_ERROR, ...)`

- [ ] **Step 1-5**: 同 Task 4 模式（import → 7 处替换 → 更新单测 → 跑测试 → 提交）
- 提交信息：`refactor(api-to-mcp): service-manager 7 处裸 Error → ServiceError（CONFIG_ERROR/INTERNAL）`

---

## Task 6: 替换 services/api-executor.ts 的 4 处 + 新增边界测试（BUILD_FAILED + 边界验证）

**Files:**

- Modify: `packages/core/src/api-to-mcp/services/api-executor.ts`（L119,190,194,238）
- Test: `packages/core/src/api-to-mcp/services/api-executor.unit.test.ts`（新增边界测试）

**Interfaces:** L119 参数验证失败、L190/194 请求构建失败 → `BUILD_FAILED`；L238 认证 env 缺失 → `CONFIG_ERROR`。

**关键：executor 边界不可破。** `execute()` 的 catch（L155-174）必须继续把所有 throw 转成 `{success:false, error}`。

- [ ] **Step 1: import 追加**（`api-executor.ts` 已 import `ErrorCode, ServiceError`，确认即可）
- [ ] **Step 2: 4 处替换**
  - L119 `参数验证失败: ${...}` → `ServiceError(API_TO_MCP_BUILD_FAILED, ...)`
  - L190 `构建HTTP请求失败: ${buildResult.error}` → `ServiceError(API_TO_MCP_BUILD_FAILED, ...)`
  - L194 `构建HTTP请求失败: 请求对象为空` → `ServiceError(API_TO_MCP_BUILD_FAILED, ...)`
  - L238 `认证配置中的环境变量未定义: ${...}` → `ServiceError(API_TO_MCP_CONFIG_ERROR, ...)`
- [ ] **Step 3: 新增 executor 边界测试**（验证结构化错误不逃逸）

在 `api-executor.unit.test.ts` 新增：

```typescript
describe('executor 边界：内部 throw 不逃逸到调用方', () => {
  it('内部 ServiceError 被 catch 转成 {success:false, error}，不抛出', async () => {
    // 构造一个会让 buildHttpRequest throw ServiceError 的 config（如无效 URL 模板）
    // 调 executor.execute()，断言返回 { success: false, error: <string> }，不 throw
    const result = await executor.execute(badConfig, {});
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
```

（具体 badConfig 构造参考现有测试的 fixture；核心断言是"不 throw + 返回 success:false"。）

- [ ] **Step 4: 跑测试** `npx vitest --run --project core` → 全 passed
- [ ] **Step 5: 提交**

```bash
git add packages/core/src/api-to-mcp/services/api-executor.ts packages/core/src/api-to-mcp/services/api-executor.unit.test.ts
git commit -m "refactor(api-to-mcp): executor 4 处裸 Error → ServiceError + 边界测试防逃逸"
```

---

## Task 7: 替换剩余 4 文件的裸 Error（config-manager/cache-manager/tool-generator/response-processor/http-client）

**Files:**

- Modify: `services/api-config-manager.ts`（L211,230,301）、`services/cache-manager.ts`（L68,534）、`services/api-tool-generator.ts`（L54）、`services/response-processor.ts`（L214）、`services/http-client.ts`（L135）

**映射：**

- api-config-manager L211 `必须先调用 loadConfig()...`、L301 `没有当前配置文件路径...` → `CONFIG_ERROR`；L230（读内容）按语义定 CONFIG/INTERNAL
- cache-manager L68 `无法生成缓存键...`（带 cause）→ `INTERNAL`；L534 `不支持的缓存类型: ${type}` → `INTERNAL`
- api-tool-generator L54 `生成工具...失败`（带 cause）→ `INTERNAL`
- response-processor L214 `JSONata表达式无效...` → `BUILD_FAILED`
- http-client L135 `Network timeout`（带 cause）→ `EXECUTION_FAILED`

- [ ] **Step 1: 5 文件各自 import 追加**
- [ ] **Step 2: 各文件替换**（带 cause 的用 context.cause）
- [ ] **Step 3: 更新各自单测断言**
- [ ] **Step 4: 跑 core 全量测试** `npx vitest --run --project core` → 全 passed
- [ ] **Step 5: 提交**

```bash
git add packages/core/src/api-to-mcp/services/api-config-manager.ts packages/core/src/api-to-mcp/services/cache-manager.ts packages/core/src/api-to-mcp/services/api-tool-generator.ts packages/core/src/api-to-mcp/services/response-processor.ts packages/core/src/api-to-mcp/services/http-client.ts
# 含各自单测
git commit -m "refactor(api-to-mcp): 剩余文件裸 Error → ServiceError（config/cache/tool/response/http）"
```

---

## Task 8: 删除轨道 B 死代码 + 修正 3 处 instanceof

**Files:**

- Modify: `backend/src/services/mcp_hub_service.ts`（删 L19-67 的 5 个错误类、修 L368/441/841 的 instanceof、删 import）

**Interfaces:** 无（纯删除死代码）。

**核实依据**：4 个子类（`ServiceNotInitializedError`/`GroupNotFoundError`/`ToolNotFoundError`/`ServiceInitializationError`）全仓无 `throw new`；3 处 `instanceof McpHubError` 因子类从未被 throw 而永不命中，移除该判断保留 `instanceof ServiceError` 行为不变。

- [ ] **Step 1: 删除 L19-67 的 5 个错误类定义**（`McpHubError` + 4 子类）

- [ ] **Step 2: 修正 3 处 instanceof**

L368: `if (error instanceof McpHubError || error instanceof ServiceError) throw error;` → `if (error instanceof ServiceError) throw error;`
L441: `if (error instanceof McpHubError) { ... }` → 读取该块逻辑（L441-455），若块内是 `throw error` 则改为 `if (error instanceof ServiceError) throw error;`；若是其他处理，需判断 McpHubError 命中时的行为并迁移。
L841: 同 L441 处理。

> ⚠️ L441/L841 必须先读完整块内容再改——不能盲目删除。若块内对 McpHubError 有特殊处理（非简单 rethrow），需将等价逻辑迁移到 ServiceError 分支或确认死代码后删。

- [ ] **Step 3: 删除 McpHubError 相关 import**

- [ ] **Step 4: 跑 backend 全量测试** `npx vitest --run --project api-unit 2>&1 | tail -8` → 全 passed
- [ ] **Step 5: 确认无残留引用**
      Run: `grep -rn "McpHubError\|GroupNotFoundError\|ToolNotFoundError\|ServiceNotInitializedError\|ServiceInitializationError" backend/src packages --include="*.ts" 2>/dev/null | grep -v test`
      Expected: 0 命中（或仅注释）。
- [ ] **Step 6: 提交**

```bash
git add backend/src/services/mcp_hub_service.ts
git commit -m "refactor: 删除轨道B死代码（McpHubError 及4子类），修正3处 instanceof

4子类全仓无 throw new 调用，instanceof McpHubError 分支永不命中。
移除该判断保留 instanceof ServiceError，行为不变。"
```

---

## Task 9: 阶段一全量回归验证

- [ ] **Step 1: core/api-to-mcp 生产代码裸 Error = 0**
      Run: `grep -rn "throw new Error(" packages/core/src/api-to-mcp --include="*.ts" | grep -vE "test|mock|integration" | wc -l`
      Expected: `0`
- [ ] **Step 2: 轨道B清零**
      Run: `grep -rn "class McpHubError\|extends McpHubError\|instanceof McpHubError" backend/src packages --include="*.ts" | wc -l`
      Expected: `0`
- [ ] **Step 3: 全量测试** `pnpm test 2>&1 | tail -6` → ≥ 1820 passed / 0 failed
- [ ] **Step 4: typecheck + lint** `pnpm check 2>&1 | tail -5` → 全绿；`pnpm check:ci 2>&1 | tail -5` → oxlint 0 errors
- [ ] **Step 5: 报告**（如实汇报数据，失败则说明）

---

# 阶段二：拆 groups 上帝文件

## Task 10: 抽出 validation-key-service.ts（5 端点业务逻辑）

**Files:**

- Create: `backend/src/api/groups/validation-key-service.ts`
- Modify: `backend/src/api/groups/index.ts`（L1455-1929 的 5 个 handler 内联逻辑移出，handler 改为调 service 函数）

**Interfaces:**

- 消费：`crypto.ts` 的 `encryptValidationKey`/`decryptValidationKey`/`generateValidationKey`、`getAllConfig`/`saveConfig`、`logger`。
- 产出纯函数（verbatim 签名）：

```typescript
export async function createValidationKey(
  groupId: string,
  algorithm?: string,
): Promise<{ key: string }>;
export async function getValidationKey(
  groupId: string,
): Promise<{ validationKey?: string; keyCreatedAt?: string } | null>;
export async function validateKey(
  groupId: string,
  key: string,
): Promise<{ valid: boolean; reason?: string }>;
export async function deleteValidationKey(groupId: string): Promise<void>;
export async function generateValidationKey(
  groupId: string,
): Promise<{ key: string; algorithm?: string }>;
```

（实际签名以 index.ts 现有 handler 的返回结构为准——先读 L1455-1929 提取真实返回类型。）

- [ ] **Step 1: 读 index.ts L1455-1929，逐端点记录"输入参数 + 返回数据结构 + 抛错条件"**（这是 service 函数签名和实现的依据）

- [ ] **Step 2: 创建 validation-key-service.ts**，把 5 个 handler 的业务逻辑（参数处理、crypto 调用、config 读写）移入纯函数。**不包含 Hono Context 操作、不包含 successResponse/errorResponse**。

- [ ] **Step 3: index.ts 的 5 个 handler 瘦身**为：

```typescript
groupsApi.post('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = await c.req.json();
    const result = await createValidationKey(groupId, body.algorithm);
    return successResponse(c, result);
  } catch (error) {
    return errorResponse(c, error as Error);
  }
});
```

（响应格式、状态码、错误消息逐字保持——从原 handler 复制 successResponse/errorResponse 的调用方式。）

- [ ] **Step 4: 黄金校验** `npx vitest --run src/api/groups/groups.unit.test.ts 2>&1 | tail -8` → 全 passed，**断言未改**
- [ ] **Step 5: 提交**

```bash
git add backend/src/api/groups/validation-key-service.ts backend/src/api/groups/index.ts
git commit -m "refactor(groups): 抽出 validation-key-service（5端点业务逻辑纯函数化)"
```

---

## Task 11: 抽出 tool-access-service.ts（4 端点）

**Files:**

- Create: `backend/src/api/groups/tool-access-service.ts`
- Modify: `backend/src/api/groups/index.ts`（L464,1008,1183,1312 的 4 个 handler）

**Interfaces:**

- 消费：`getHubService()`（拿工具列表/服务器状态）、`logger`。
- 4 端点：GET/POST `/:groupId/tools`、GET `/:groupId/available-tools`、POST `/:groupId/validate-tool-access`。
- 纯函数签名以 L464/1008/1183/1312 现有 handler 返回结构为准。

- [ ] **Step 1: 读 4 个 handler（L464-552, L1008-1182, L1183-1311, L1312-1454），记录输入/返回/抛错**
- [ ] **Step 2: 创建 tool-access-service.ts**，移入业务逻辑
- [ ] **Step 3: 4 个 handler 瘦身**为调 service + successResponse/errorResponse
- [ ] **Step 4: 黄金校验** `groups.unit.test.ts` 全 passed，断言未改
- [ ] **Step 5: 提交** `refactor(groups): 抽出 tool-access-service（4端点业务逻辑纯函数化）`

---

## Task 12: 抽出 group-service.ts（7 端点 CRUD/health/servers）

**Files:**

- Create: `backend/src/api/groups/group-service.ts`
- Modify: `backend/src/api/groups/index.ts`（L56,227,361,553,645,779,919 的 7 个 handler）

**Interfaces:**

- 消费：`getAllConfig`/`saveConfig`、`performanceMonitor`、`validateGroupData`/`validateGroupId`、`logger`。
- 7 端点：GET/POST/PUT/DELETE 组、GET health、GET servers。

- [ ] **Step 1: 读 7 个 handler，记录输入/返回/抛错**
- [ ] **Step 2: 创建 group-service.ts**，移入业务逻辑（含 performanceMonitor 调用）
- [ ] **Step 3: 7 个 handler 瘦身**
- [ ] **Step 4: 黄金校验** `groups.unit.test.ts` 全 passed，断言未改
- [ ] **Step 5: 提交** `refactor(groups): 抽出 group-service（7端点CRUD/health/servers业务逻辑纯函数化）`

---

## Task 13: 阶段二全量回归验证

- [ ] **Step 1: index.ts 行数** `wc -l backend/src/api/groups/index.ts` → < 500
- [ ] **Step 2: 3 service 存在** `ls backend/src/api/groups/*-service.ts` → 3 个
- [ ] **Step 3: 黄金校验集** `npx vitest --run src/api/groups/groups.unit.test.ts` → 全 passed，断言未改（`git diff HEAD~3 -- groups.unit.test.ts` 应无变化或仅格式）
- [ ] **Step 4: 全量测试** `pnpm test 2>&1 | tail -6` → ≥ 1820 passed / 0 failed
- [ ] **Step 5: typecheck + lint** `pnpm check` 全绿；`pnpm check:ci` oxlint 0 errors
- [ ] **Step 6: 报告**（行数、测试数、lint 结果）

---

## 执行后

- 阶段一 + 阶段二全部完成，两项代码债还清。
- 本 plan 文件可保留为工作记录或提交为 docs commit。
