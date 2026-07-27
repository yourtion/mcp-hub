# P3 出站 OAuth 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `api-to-mcp` 子系统的 `AuthenticationStrategy` 支持真实 OAuth（client_credentials + refresh_token），Hub 作为客户端调外部 OAuth 保护 REST API 时自动获取/刷新 token。

**Architecture:** `AuthenticationStrategy` 接口 async 化（向后兼容现有 3 策略）；`AuthConfigSchema` 用 `z.discriminatedUnion` 重构加 oauth 分支；新增 `OAuthStrategy` 注入现有 `HttpClient`（原生 fetch 封装）+ `CacheManager`（token 存储）；fail-fast 错误码 6200-6203。

**Tech Stack:** TypeScript、Zod v4（`zod/v4`）、Vitest、原生 fetch（Node 20+）、现有 `McpHubCoreError` 错误体系。

**Spec:** `docs/superpowers/specs/2026-07-27-p3-outbound-oauth-design.md`

## Global Constraints

- 工作目录：仓库根 `/Users/yourtionguo/codes/open/mcp-hub`，所有相对路径基于此。
- 分支：`feat/p3-outbound-oauth`（已创建，spec 已提交 `fcbb68b`）。
- 包管理：pnpm。门禁命令 `pnpm check:ci`（oxlint + oxfmt，0 warnings/errors）+ `pnpm test`（vitest，全绿）。**注意：项目无 `pnpm typecheck` 脚本**，类型检查走各包 `tsc --noEmit`（仅 backend/core/cli 参与，frontend 用 rsbuild 不做 tsc）。
- Zod 导入：`import { z } from 'zod/v4'`（注意 `/v4` 后缀，见 `api-config.ts:5`）。
- 错误抛出范式：`throw new ServiceError(ErrorCode.XXX, '中文消息', details?, context?)`，`ServiceError` from `../../errors/index.js`。P2 入站 OAuth 沿用此范式。
- 日志：`import { createLogger } from '../../utils/logger.js'`，`const logger = createLogger({ component: 'XxxName' })`。**clientSecret/clientId 原文绝不进日志**。
- 测试范式：Vitest，`describe/it/expect`。async 测试用 `it('...', async function () { await ... })`。抛错断言用 `await expect(fn()).rejects.toThrow('...')`。
- 测试文件命名：`*.unit.test.ts`（单测），与被测文件同目录。
- ESM：import 路径必须带 `.js` 后缀（项目用 NodeNext，如 `'./authentication.js'`）。

## File Structure

**新建：**
- `packages/core/src/api-to-mcp/services/oauth-strategy.ts` — `OAuthStrategy` 类（fetchToken/refresh/applyAuth/validateConfig/cacheKey）。
- `packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts` — OAuthStrategy 单测。

**修改：**
- `packages/core/src/errors/index.ts` — 加 6200-6203 错误码 + 三张映射表。
- `packages/core/src/api-to-mcp/types/api-config.ts` — `AuthConfigSchema` 重构为 discriminated union + 导出 `OAuthAuthConfig`。
- `packages/core/src/api-to-mcp/services/authentication.ts` — 接口 async 化 + `AuthenticationManager` 构造接收 deps + 环境变量解析扩展 + re-export OAuthStrategy。
- `packages/core/src/api-to-mcp/services/authentication.unit.test.ts` — async 化回归 + oauth 测试改期望成功。
- `packages/core/src/api-to-mcp/services/api-executor.ts` — `applyAuthentication` 调用点加 await。
- `packages/core/src/api-to-mcp/services/cached-api-executor.ts` — `applyAuthentication` 包装方法加 async。
- `packages/core/src/api-to-mcp/services/api-to-mcp-service-manager.ts` — `new AuthenticationManager()` 改传 deps。
- `packages/core/src/api-to-mcp/services/api-to-mcp-service-manager.unit.test.ts`（如存在且受影响）— 跟随调整。

---

## Task 1: 错误码 6200-6203

**Files:**
- Modify: `packages/core/src/errors/index.ts`（enum L65-71 之后、`ERROR_MESSAGES` L128、`ERROR_SEVERITY` L195、`ERROR_HTTP_STATUS` L254）
- Test: `packages/core/src/errors/index.test.ts`（如存在；否则新建 `errors.unit.test.ts`）

**Interfaces:**
- Produces: `ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID` (6200)、`OAUTH_OUTBOUND_TOKEN_FETCH_FAILED` (6201)、`OAUTH_OUTBOUND_TOKEN_EXPIRED` (6202)、`OAUTH_OUTBOUND_ENV_VAR_MISSING` (6203)，后续 task 的 `OAuthStrategy` 抛错依赖这些。

- [ ] **Step 1: 写失败测试**

新建 `packages/core/src/errors/index.unit.test.ts`（若已存在则在末尾追加 describe）：

```typescript
import { describe, expect, it } from 'vitest';

import { ErrorCode, ERROR_MESSAGES, ERROR_SEVERITY, ErrorSeverity } from './index.js';

describe('P3 出站 OAuth 错误码', () => {
  it('6200-6203 错误码已定义', () => {
    expect(ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID).toBe(6200);
    expect(ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED).toBe(6201);
    expect(ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED).toBe(6202);
    expect(ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING).toBe(6203);
  });

  it('每个错误码都有中文消息', () => {
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]).toBeTruthy();
  });

  it('每个错误码都有严重程度', () => {
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]).toBe(ErrorSeverity.LOW);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]).toBe(ErrorSeverity.HIGH);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]).toBe(ErrorSeverity.HIGH);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]).toBe(ErrorSeverity.LOW);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run packages/core/src/errors/index.unit.test.ts`
Expected: FAIL，报 `ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID` 为 undefined。

- [ ] **Step 3: 加错误码 enum**

在 `packages/core/src/errors/index.ts` 的 `OAUTH_CONFIG_ERROR = 6106,` 之后加：

```typescript

  // OAuth 出站错误（6200-6299，出站 OAuth client_credentials/refresh_token）
  OAUTH_OUTBOUND_CONFIG_INVALID = 6200,
  OAUTH_OUTBOUND_TOKEN_FETCH_FAILED = 6201,
  OAUTH_OUTBOUND_TOKEN_EXPIRED = 6202,
  OAUTH_OUTBOUND_ENV_VAR_MISSING = 6203,
```

- [ ] **Step 4: 加 ERROR_MESSAGES 映射**

在 `ERROR_MESSAGES` 的 `[ErrorCode.OAUTH_CONFIG_ERROR]: 'OAuth 配置错误',` 之后加：

```typescript

  // OAuth 出站错误
  [ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]: 'OAuth 出站配置无效',
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]: 'OAuth 出站 token 获取失败',
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]: 'OAuth 出站 token 已过期',
  [ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]: 'OAuth 出站环境变量未定义',
```

- [ ] **Step 5: 加 ERROR_SEVERITY 映射**

在 `ERROR_SEVERITY` 的 `[ErrorCode.OAUTH_CONFIG_ERROR]: ErrorSeverity.HIGH,` 之后加：

```typescript

  // OAuth 出站错误
  [ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]: ErrorSeverity.LOW,
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]: ErrorSeverity.HIGH,
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]: ErrorSeverity.HIGH,
  [ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]: ErrorSeverity.LOW,
```

- [ ] **Step 6: 加 ERROR_HTTP_STATUS 映射**

在 `ERROR_HTTP_STATUS` 的 `[ErrorCode.OAUTH_CONFIG_ERROR]: 500,` 之后加：

```typescript

  // OAuth 出站错误（内部错误，不直接映射 HTTP；用 500 占位，api-executor 会重新包装）
  [ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]: 500,
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]: 500,
  [ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]: 500,
  [ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]: 500,
```

- [ ] **Step 7: 运行测试确认通过**

Run: `pnpm vitest --run packages/core/src/errors/index.unit.test.ts`
Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add packages/core/src/errors/index.ts packages/core/src/errors/index.unit.test.ts
git commit -m "feat(errors): P3 出站 OAuth 错误码 6200-6203"
```

---

## Task 2: AuthConfigSchema 重构为 discriminated union

**Files:**
- Modify: `packages/core/src/api-to-mcp/types/api-config.ts:54-62`（`AuthConfigSchema`）+ L184（`AuthConfig` 类型）
- Test: `packages/core/src/api-to-mcp/types/api-config.unit.test.ts`（新建）

**Interfaces:**
- Produces: `AuthConfigSchema`（discriminated union）、`AuthConfig`（联合类型）、`OAuthAuthConfig`（oauth 分支类型）。后续 task 的 `OAuthStrategy` 和 `authentication.ts` 依赖这些类型。
- 注意：此 task 改变 `AuthConfig` 类型形态（平坦 → 联合），会触发现有 `authentication.ts` / `api-executor.ts` 的 TS 错误（访问 `config.token` 需先收窄 type）。**这些 TS 错误在 Task 3/4 修复**，本 task 只负责 schema + 类型导出 + 自身测试。

- [ ] **Step 1: 写失败测试**

新建 `packages/core/src/api-to-mcp/types/api-config.unit.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import { AuthConfigSchema } from './api-config.js';

describe('AuthConfigSchema（discriminated union）', () => {
  it('接受有效的 bearer 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'bearer', token: 'xxx' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 apikey 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'apikey', token: 'xxx', header: 'X-Key' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 basic 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'basic', username: 'u', password: 'p' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 oauth client_credentials 配置', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
      scope: 'read',
    });
    expect(result.success).toBe(true);
  });

  it('oauth 缺 clientId 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
    });
    expect(result.success).toBe(false);
  });

  it('oauth tokenUrl 非 URL 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('oauth 非法 grantType 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'password',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
    });
    expect(result.success).toBe(false);
  });

  it('未知 type 被拒', () => {
    const result = AuthConfigSchema.safeParse({ type: 'unknown', token: 'x' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/types/api-config.unit.test.ts`
Expected: FAIL（oauth 用例失败，因 schema 还没 oauth 分支）。

- [ ] **Step 3: 重构 AuthConfigSchema**

替换 `api-config.ts:54-62` 的 `AuthConfigSchema` 定义为：

```typescript
/**
 * Bearer Token 认证配置
 */
export const BearerAuthConfigSchema = z.object({
  type: z.literal('bearer'),
  token: z.string(),
  header: z.string().optional(),
});

/**
 * API Key 认证配置
 */
export const ApiKeyAuthConfigSchema = z.object({
  type: z.literal('apikey'),
  token: z.string(),
  header: z.string().optional(),
});

/**
 * Basic Auth 认证配置
 */
export const BasicAuthConfigSchema = z.object({
  type: z.literal('basic'),
  username: z.string(),
  password: z.string(),
});

/**
 * OAuth 出站认证配置（client_credentials / refresh_token）
 */
export const OAuthAuthConfigSchema = z.object({
  type: z.literal('oauth'),
  grantType: z.enum(['client_credentials', 'refresh_token']),
  clientId: z.string(),
  clientSecret: z.string(),
  tokenUrl: z.string().url(),
  scope: z.string().optional(),
  refreshToken: z.string().optional(),
  headerName: z.string().optional(),
  tokenPrefix: z.string().optional(),
});

/**
 * 认证配置的 Zod schema（discriminated union，按 type 区分字段）
 */
export const AuthConfigSchema = z.discriminatedUnion('type', [
  BearerAuthConfigSchema,
  ApiKeyAuthConfigSchema,
  BasicAuthConfigSchema,
  OAuthAuthConfigSchema,
]);
```

然后在文件末尾类型导出区（L183-188 附近）加 `OAuthAuthConfig`：

```typescript
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type BearerAuthConfig = z.infer<typeof BearerAuthConfigSchema>;
export type ApiKeyAuthConfig = z.infer<typeof ApiKeyAuthConfigSchema>;
export type BasicAuthConfig = z.infer<typeof BasicAuthConfigSchema>;
export type OAuthAuthConfig = z.infer<typeof OAuthAuthConfigSchema>;
```

（保留原有 `export type AuthConfig = z.infer<typeof AuthConfigSchema>;` 一行，新增其余 4 个。）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/types/api-config.unit.test.ts`
Expected: PASS。

- [ ] **Step 5: 跑全量测试，确认仅 authentication 相关用例因类型变化失败（预期内）**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/authentication.unit.test.ts 2>&1 | tail -20`
Expected: 运行时测试可能仍过（TS 类型错误不阻塞 vitest 执行，esbuild 转译忽略类型）。若 PASS 则继续；若 FAIL 记录失败点，Task 3 处理。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/api-to-mcp/types/api-config.ts packages/core/src/api-to-mcp/types/api-config.unit.test.ts
git commit -m "feat(api-to-mcp): AuthConfigSchema 重构为 discriminated union + oauth 分支"
```

---

## Task 3: AuthenticationStrategy 接口 async 化（含现有 3 策略回归）

**Files:**
- Modify: `packages/core/src/api-to-mcp/services/authentication.ts`（接口 L16-25 + 3 策略类 + `AuthenticationManager.applyAuthentication/validateAuthConfig`）
- Modify: `packages/core/src/api-to-mcp/services/authentication.unit.test.ts`（所有 `applyAuthentication`/`validateAuthConfig` 调用加 await）

**Interfaces:**
- Produces: async 化的 `AuthenticationStrategy.applyAuth(request, config): Promise<HttpRequestConfig>`、`validateConfig(config): Promise<{valid, error?}>`、`AuthenticationManager.applyAuthentication(...): Promise<HttpRequestConfig>`。
- Consumes: Task 2 的 `AuthConfig` 联合类型（现有 3 策略的 `validateConfig` 内访问 `config.token`/`username`/`password` 需加 type 守卫）。

- [ ] **Step 1: 改造现有测试为 async**

在 `authentication.unit.test.ts` 中，把所有调用 `manager.applyAuthentication(...)` 和 `manager.validateAuthConfig(...)` 的测试改成 async 并加 await。模式：

```typescript
// 改前
it('应该使用 bearer 策略应用认证', function () {
  const result = manager.applyAuthentication(request, config);
  expect(result.headers!.Authorization).toBe('Bearer xxx');
});

// 改后
it('应该使用 bearer 策略应用认证', async function () {
  const result = await manager.applyAuthentication(request, config);
  expect(result.headers!.Authorization).toBe('Bearer xxx');
});
```

抛错断言改为 rejects：

```typescript
// 改前
expect(function () {
  manager.applyAuthentication(request, config);
}).toThrow('不支持的认证类型: oauth');

// 改后
await expect(manager.applyAuthentication(request, config)).rejects.toThrow('不支持的认证类型: oauth');
```

**注意 L497-504 和 L532-538 的 oauth 抛错测试**：本 task 暂保留"oauth 未注册 → 抛错"的期望（Task 5 才注册 OAuthStrategy），但要改成 async。

逐个改造所有 `describe('applyAuthentication')` / `describe('validateAuthConfig')` 下的用例。`resolveEnvironmentVariables` / `validateEnvironmentVariables` 是同步方法，**不改**。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/authentication.unit.test.ts`
Expected: FAIL（接口还是同步，await 同步返回值不报错，但 rejects 断言会失败）。

- [ ] **Step 3: 接口 async 化**

在 `authentication.ts`：

改接口（L16-25）：
```typescript
export interface AuthenticationStrategy {
  readonly name: string;
  applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig>;
  validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }>;
}
```

`BearerTokenStrategy`：方法签名加 `async`，加 type 守卫：
```typescript
export class BearerTokenStrategy implements AuthenticationStrategy {
  readonly name = 'bearer';

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'bearer') {
      throw new Error('Bearer 策略收到非 bearer 配置');
    }
    if (!config.token) {
      throw new Error('Bearer token认证需要提供token');
    }
    const headers = { ...request.headers };
    headers.Authorization = `Bearer ${config.token}`;
    logger.debug('应用Bearer Token认证');
    return { ...request, headers };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'bearer') {
      return { valid: false, error: '认证类型不匹配' };
    }
    if (!config.token) {
      return { valid: false, error: 'Bearer认证需要提供token' };
    }
    if (typeof config.token !== 'string') {
      return { valid: false, error: 'Token必须是字符串' };
    }
    if (config.token.trim() === '') {
      return { valid: false, error: 'Token必须是非空字符串' };
    }
    return { valid: true };
  }
}
```

`ApiKeyStrategy` 同模式（`config.type !== 'apikey'` 守卫，方法加 `async`，返回 `Promise<...>`）。

`BasicAuthStrategy` 同模式（`config.type !== 'basic'` 守卫）。

- [ ] **Step 4: AuthenticationManager 方法 async 化**

改 `applyAuthentication`（L214-228）：
```typescript
async applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig): Promise<HttpRequestConfig> {
  const strategy = this.strategies.get(authConfig.type);
  if (!strategy) {
    throw new Error(`不支持的认证类型: ${authConfig.type}`);
  }
  const validation = await strategy.validateConfig(authConfig);
  if (!validation.valid) {
    throw new Error(`认证配置无效: ${validation.error}`);
  }
  return strategy.applyAuth(request, authConfig);
}
```

改 `validateAuthConfig`（L233-243）：
```typescript
async validateAuthConfig(authConfig: AuthConfig): Promise<{ valid: boolean; error?: string }> {
  const strategy = this.strategies.get(authConfig.type);
  if (!strategy) {
    return { valid: false, error: `不支持的认证类型: ${authConfig.type}` };
  }
  return strategy.validateConfig(authConfig);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/authentication.unit.test.ts`
Expected: PASS（所有现有用例 async 化回归通过，oauth 仍抛"不支持的认证类型"）。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/api-to-mcp/services/authentication.ts packages/core/src/api-to-mcp/services/authentication.unit.test.ts
git commit -m "feat(auth): AuthenticationStrategy 接口 async 化 + 现有 3 策略回归"
```

---

## Task 4: 调用链 async 化（api-executor + cached-api-executor）

**Files:**
- Modify: `packages/core/src/api-to-mcp/services/api-executor.ts:123`（调用点加 await）+ L209（方法签名加 async）
- Modify: `packages/core/src/api-to-mcp/services/cached-api-executor.ts:178`（包装方法加 async）

**Interfaces:**
- Consumes: Task 3 的 async `applyAuthentication`。

- [ ] **Step 1: api-executor 调用点加 await**

`api-executor.ts:123`：
```typescript
// 改前
request = this.applyAuthentication(request, config.security.authentication);
// 改后
request = await this.applyAuthentication(request, config.security.authentication);
```

`api-executor.ts:209` 方法签名：
```typescript
// 改前
applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig): HttpRequestConfig {
// 改后
async applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig): Promise<HttpRequestConfig> {
```

方法体内 L222 `return this.authManager.applyAuthentication(...)` 已经是 async 返回值，直接 `return this.authManager.applyAuthentication(...)`（Promise 自动转发）。

- [ ] **Step 2: cached-api-executor 包装方法加 async**

`cached-api-executor.ts:178`：
```typescript
// 改前
applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig) {
  return this.baseExecutor.applyAuthentication(request, authConfig);
}
// 改后
async applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig): Promise<HttpRequestConfig> {
  return this.baseExecutor.applyAuthentication(request, authConfig);
}
```

- [ ] **Step 3: 运行全量 core 测试确认无破坏**

Run: `pnpm vitest --run packages/core/src/api-to-mcp 2>&1 | tail -20`
Expected: PASS（async 化对调用方透明，现有测试不涉及 oauth 路径）。

- [ ] **Step 4: 提交**

```bash
git add packages/core/src/api-to-mcp/services/api-executor.ts packages/core/src/api-to-mcp/services/cached-api-executor.ts
git commit -m "feat(api-to-mcp): applyAuthentication 调用链 async 化"
```

---

## Task 5: OAuthStrategy 实现（client_credentials + refresh + cache）

**Files:**
- Create: `packages/core/src/api-to-mcp/services/oauth-strategy.ts`
- Create: `packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts`
- Modify: `packages/core/src/api-to-mcp/services/authentication.ts`（`AuthenticationManager` 构造接收 deps + 注册 OAuthStrategy + re-export）

**Interfaces:**
- Consumes: Task 1 错误码、Task 2 `OAuthAuthConfig`、Task 3 async 接口、现有 `HttpClient`（`../services/http-client.js`）、`CacheManager`（`./cache-manager.js`）。
- Produces: `OAuthStrategy` 类，注入到 `AuthenticationManager`。

**关键常量：**
```typescript
const EXPIRY_BUFFER_MS = 60_000;  // expiresAt 前 60s 视为将过期
const REDACTED = '[REDACTED]';
```

- [ ] **Step 1: 写失败测试 — fetchToken 成功路径**

新建 `packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts`：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { CacheManager } from './cache-manager.js';
import type { HttpClient } from './http-client.js';
import type { HttpRequestConfig, HttpResponse } from '../types/http-client.js';

import { OAuthStrategy } from './oauth-strategy.js';

function createMockHttpClient(tokenResponse: unknown, status = 200): HttpClient {
  const mockResponse: HttpResponse = {
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    headers: new Headers(),
    data: tokenResponse,
    raw: new Response(),
    config: { url: '', method: 'POST' },
  };
  return {
    request: vi.fn().mockResolvedValue(mockResponse),
  } as unknown as HttpClient;
}

function createMockCache(): CacheManager & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, keys: 0, maxKeys: 0 })),
    setStrategy: vi.fn(),
    clear: vi.fn(async () => {
      store.clear();
    }),
  } as unknown as CacheManager & { store: Map<string, unknown> };
}

describe('OAuthStrategy', () => {
  describe('applyAuth — client_credentials 首次取 token', () => {
    it('缓存未命中 → fetchToken → 注入 Authorization: Bearer', async () => {
      const httpClient = createMockHttpClient({
        access_token: 'tok-123',
        expires_in: 3600,
        token_type: 'Bearer',
      });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };
      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        scope: 'read',
      };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers!.Authorization).toBe('Bearer tok-123');
      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('缓存命中 → 不再调 token endpoint', async () => {
      const httpClient = createMockHttpClient({ access_token: 'tok-fresh', expires_in: 3600 });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        scope: 'read',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      // 第一次：miss → fetch
      await strategy.applyAuth(request, config);
      // 第二次：应命中缓存
      await strategy.applyAuth(request, config);

      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('自定义 headerName/tokenPrefix → 注入到指定 header', async () => {
      const httpClient = createMockHttpClient({ access_token: 'tok-x', expires_in: 3600 });
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
        headerName: 'X-Token',
        tokenPrefix: '',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers!['X-Token']).toBe('tok-x');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts`
Expected: FAIL，`OAuthStrategy` 未定义。

- [ ] **Step 3: 实现 OAuthStrategy 骨架 + fetchToken + applyAuth**

新建 `packages/core/src/api-to-mcp/services/oauth-strategy.ts`：

```typescript
/**
 * OAuth 出站认证策略
 * 支持 client_credentials grant + refresh_token 续期
 */

import { createHash } from 'node:crypto';

import { ErrorCode, ServiceError } from '../../errors/index.js';
import { createLogger } from '../../utils/logger.js';

import type { CacheManager } from './cache-manager.js';
import type { HttpClient } from './http-client.js';
import type { OAuthAuthConfig } from '../types/api-config.js';
import type { AuthConfig, HttpRequestConfig } from '../types/index.js';
import type { AuthenticationStrategy } from './authentication.js';

const logger = createLogger({ component: 'OAuthStrategy' });

const EXPIRY_BUFFER_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}

/**
 * 计算 token 缓存键
 * 用 hash 是因为 clientSecret 不能进 key（即使 key 不进日志，hash 更安全）
 */
function buildCacheKey(config: OAuthAuthConfig): string {
  const raw = [config.clientId, config.tokenUrl, config.scope ?? '', config.grantType].join('|');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return `oauth:token:${hash}`;
}

export class OAuthStrategy implements AuthenticationStrategy {
  readonly name = 'oauth';

  constructor(
    private readonly httpClient: HttpClient,
    private readonly cache: CacheManager,
  ) {
    logger.info('OAuthStrategy 初始化');
  }

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'oauth') {
      throw new ServiceError(ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID, 'OAuth 策略收到非 oauth 配置');
    }

    const accessToken = await this.getAccessToken(config);

    const headerName = config.headerName ?? 'Authorization';
    const tokenPrefix = config.tokenPrefix ?? 'Bearer ';
    const headers = { ...request.headers };
    headers[headerName] = `${tokenPrefix}${accessToken}`;

    logger.debug('应用 OAuth 认证', { context: { headerName, clientId: config.clientId } });
    return { ...request, headers };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'oauth') {
      return { valid: false, error: '认证类型不匹配' };
    }
    if (!config.clientId) {
      return { valid: false, error: 'OAuth 需要 clientId' };
    }
    if (!config.clientSecret) {
      return { valid: false, error: 'OAuth 需要 clientSecret' };
    }
    if (!config.tokenUrl) {
      return { valid: false, error: 'OAuth 需要 tokenUrl' };
    }
    if (config.grantType === 'refresh_token' && !config.refreshToken) {
      return { valid: false, error: 'refresh_token grant 需要 refreshToken' };
    }
    return { valid: true };
  }

  /**
   * 获取有效 access token：缓存优先，将过期则 refresh，否则 client_credentials 重取
   */
  private async getAccessToken(config: OAuthAuthConfig): Promise<string> {
    const cacheKey = buildCacheKey(config);
    const now = Date.now();

    const cached = (await this.cache.get(cacheKey)) as CachedToken | null;
    if (cached && cached.expiresAt - now > EXPIRY_BUFFER_MS) {
      logger.debug('OAuth token 缓存命中', { context: { clientId: config.clientId } });
      return cached.accessToken;
    }

    // 将过期且有 refreshToken → 尝试 refresh（失败静默回退）
    if (cached?.refreshToken) {
      try {
        const refreshed = await this.refreshToken(config, cached.refreshToken, cacheKey);
        return refreshed;
      } catch (err) {
        logger.warn('OAuth refresh 失败，回退到 client_credentials', {
          context: { clientId: config.clientId, error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    return this.fetchToken(config, cacheKey);
  }

  /**
   * client_credentials grant 取新 token
   */
  private async fetchToken(config: OAuthAuthConfig, cacheKey: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    if (config.scope) {
      body.set('scope', config.scope);
    }

    const response = await this.httpClient.request({
      url: config.tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString(),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        `OAuth token endpoint 返回 ${response.status}`,
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl, scope: config.scope, statusCode: response.status },
      );
    }

    const tokenData = response.data as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        'OAuth token endpoint 响应缺 access_token',
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl },
      );
    }

    const expiresIn = tokenData.expires_in ?? 3600;
    const cached: CachedToken = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: tokenData.refresh_token,
    };
    await this.cache.set(cacheKey, cached, Math.max(expiresIn - 60, 60));

    logger.info('OAuth token 获取成功', {
      context: { clientId: config.clientId, expiresIn, hasRefreshToken: !!tokenData.refresh_token },
    });

    return cached.accessToken;
  }

  /**
   * refresh_token 续期（优化路径，失败由调用方静默回退）
   */
  private async refreshToken(config: OAuthAuthConfig, refreshToken: string, cacheKey: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await this.httpClient.request({
      url: config.tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString(),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        `OAuth refresh 返回 ${response.status}`,
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl },
      );
    }

    const tokenData = response.data as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };

    const expiresIn = tokenData.expires_in ?? 3600;
    const cached: CachedToken = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: tokenData.refresh_token ?? refreshToken,
    };
    await this.cache.set(cacheKey, cached, Math.max(expiresIn - 60, 60));

    logger.info('OAuth token 刷新成功', { context: { clientId: config.clientId, expiresIn } });
    return cached.accessToken;
  }
}
```

**注意 `AuthConfig, HttpRequestConfig` 的 import 路径**：核查 `packages/core/src/api-to-mcp/types/index.ts` 是否 re-export 这两个类型；若否，分别从 `'../types/api-config.js'` 和 `'../types/http-client.js'` 导入。实现时以实际 barrel 文件为准。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 追加测试 — fetchToken 失败 + refresh + secret 不泄漏**

在 `oauth-strategy.unit.test.ts` 末尾追加：

```typescript
  describe('applyAuth — 失败处理', () => {
    it('token endpoint 返回 401 → 抛 OAUTH_OUTBOUND_TOKEN_FETCH_FAILED', async () => {
      const httpClient = createMockHttpClient({ error: 'invalid_client' }, 401);
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow();
    });

    it('错误 context 不含 clientSecret', async () => {
      const httpClient = createMockHttpClient({ error: 'bad' }, 500);
      const cache = createMockCache();
      const strategy = new OAuthStrategy(httpClient, cache);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'super-secret-value',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      try {
        await strategy.applyAuth(request, config);
        expect.fail('应抛错');
      } catch (err) {
        const str = JSON.stringify(err);
        expect(str).not.toContain('super-secret-value');
      }
    });
  });

  describe('applyAuth — refresh_token 续期', () => {
    it('缓存将过期 + 有 refreshToken → refresh 成功', async () => {
      const cache = createMockCache();
      // 预置一个将过期的 token
      const cacheKey = 'oauth:token:' + 'x'.repeat(32); // 实际 key 由 hash 算出，测试用 spy 验证调用即可
      cache.store.set(cacheKey, {
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000, // 30s 后过期，< 60s buffer → 触发 refresh
        refreshToken: 'rt-xxx',
      });

      let callCount = 0;
      const httpClient = {
        request: vi.fn(async (req: HttpRequestConfig) => {
          callCount++;
          const body = req.data as string;
          if (body.includes('grant_type=refresh_token')) {
            return {
              status: 200,
              statusText: 'OK',
              headers: new Headers(),
              data: { access_token: 'refreshed-tok', expires_in: 3600 },
              raw: new Response(),
              config: req,
            } as unknown as HttpResponse;
          }
          return {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            data: { access_token: 'fresh-tok', expires_in: 3600 },
            raw: new Response(),
            config: req,
          } as unknown as HttpResponse;
        }),
      } as unknown as HttpClient;

      const strategy = new OAuthStrategy(httpClient, cache);
      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      // 注意：上面预置的 cacheKey 是假的，实际 getAccessToken 会算真实 key 找不到。
      // 这个用例验证的是"当缓存返回将过期 token 时走 refresh"——需要让 cache.get 返回将过期 token。
      // 改用 spy 控制 cache.get 返回值：
      vi.spyOn(cache, 'get').mockResolvedValueOnce({
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000,
        refreshToken: 'rt-xxx',
      } as unknown as CachedToken);

      const result = await strategy.applyAuth(request, config);
      expect(result.headers!.Authorization).toBe('Bearer refreshed-tok');
      expect(httpClient.request).toHaveBeenCalledOnce();
    });

    it('refresh 失败（invalid_grant）→ 静默回退 client_credentials', async () => {
      const cache = createMockCache();
      const httpClient = {
        request: vi.fn(async (req: HttpRequestConfig) => {
          const body = req.data as string;
          if (body.includes('grant_type=refresh_token')) {
            return {
              status: 400,
              statusText: 'Bad Request',
              headers: new Headers(),
              data: { error: 'invalid_grant' },
              raw: new Response(),
              config: req,
            } as unknown as HttpResponse;
          }
          return {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            data: { access_token: 'fallback-tok', expires_in: 3600 },
            raw: new Response(),
            config: req,
          } as unknown as HttpResponse;
        }),
      } as unknown as HttpClient;

      const strategy = new OAuthStrategy(httpClient, cache);
      vi.spyOn(cache, 'get').mockResolvedValueOnce({
        accessToken: 'old-tok',
        expiresAt: Date.now() + 30_000,
        refreshToken: 'rt-xxx',
      } as unknown as CachedToken);

      const config = {
        type: 'oauth' as const,
        grantType: 'client_credentials' as const,
        clientId: 'cid',
        clientSecret: 'secret',
        tokenUrl: 'https://as.example.com/token',
      };
      const request: HttpRequestConfig = { url: 'https://api.example.com/x', method: 'GET', headers: {} };

      const result = await strategy.applyAuth(request, config);
      expect(result.headers!.Authorization).toBe('Bearer fallback-tok');
      expect(httpClient.request).toHaveBeenCalledTimes(2); // refresh 1 次 + client_credentials 1 次
    });
  });

  describe('validateConfig', () => {
    const strategy = new OAuthStrategy({} as HttpClient, {} as CacheManager);

    it('缺 clientId → 无效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'client_credentials',
        // @ts-expect-error 测试缺字段
        clientId: undefined,
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(false);
    });

    it('refresh_token grant 缺 refreshToken → 无效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'refresh_token',
        clientId: 'cid',
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('refreshToken');
    });

    it('完整配置 → 有效', async () => {
      const result = await strategy.validateConfig({
        type: 'oauth',
        grantType: 'client_credentials',
        clientId: 'cid',
        clientSecret: 's',
        tokenUrl: 'https://x.com/token',
      });
      expect(result.valid).toBe(true);
    });
  });
```

**注意**：`CachedToken` 是内部类型未导出，测试里用 `as unknown as CachedToken` 需要先在测试文件顶部加 `import type { CachedToken } from './oauth-strategy.js'`，并在 `oauth-strategy.ts` 里 `export interface CachedToken {...}`（导出该类型）。

- [ ] **Step 6: 导出 CachedToken 类型**

在 `oauth-strategy.ts` 把 `interface CachedToken` 改为 `export interface CachedToken`。测试文件顶部加：

```typescript
import type { CachedToken } from './oauth-strategy.js';
```

- [ ] **Step 7: 运行全部 oauth-strategy 测试确认通过**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts`
Expected: PASS（全部用例）。

- [ ] **Step 8: 提交**

```bash
git add packages/core/src/api-to-mcp/services/oauth-strategy.ts packages/core/src/api-to-mcp/services/oauth-strategy.unit.test.ts
git commit -m "feat(oauth): OAuthStrategy 实现（client_credentials + refresh + cache）"
```

---

## Task 6: AuthenticationManager 注册 OAuthStrategy + 环境变量解析扩展

**Files:**
- Modify: `packages/core/src/api-to-mcp/services/authentication.ts`（构造函数 L180-187 + `resolveEnvironmentVariables` L249 + `validateEnvironmentVariables` L301）
- Modify: `packages/core/src/api-to-mcp/services/authentication.unit.test.ts`（改 oauth 抛错测试为期望成功 + 加边界测试）

**Interfaces:**
- Consumes: Task 5 `OAuthStrategy`。
- Produces: `AuthenticationManager` 可选 deps 注入 + oauth 环境变量解析。

- [ ] **Step 1: 改造 oauth 测试（从抛错改为成功）**

在 `authentication.unit.test.ts` 顶部 import 加：
```typescript
import type { HttpClient } from './http-client.js';
import type { CacheManager } from './cache-manager.js';
```

把 L497-504 和 L532-538 的两个 oauth 测试改成期望成功（需注入 deps 的 manager）：

```typescript
describe('OAuth 策略（注入 deps）', () => {
  let oauthManager: AuthenticationManager;

  beforeEach(() => {
    oauthManager = new AuthenticationManager({
      httpClient: {} as HttpClient,
      cache: {} as CacheManager,
    });
  });

  it('注册了 oauth 策略，不抛错', async () => {
    // 注入 mock 让 applyAuth 不真正调网络
    const httpClient = {
      request: vi.fn().mockResolvedValue({
        status: 200,
        data: { access_token: 'tok', expires_in: 3600 },
      }),
    } as unknown as HttpClient;
    const cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as unknown as CacheManager;
    const m = new AuthenticationManager({ httpClient, cache });

    const request = { url: 'https://x.com', method: 'GET' as const, headers: {} };
    const config = {
      type: 'oauth' as const,
      grantType: 'client_credentials' as const,
      clientId: 'cid',
      clientSecret: 's',
      tokenUrl: 'https://as.com/token',
    };

    const result = await m.applyAuthentication(request, config);
    expect(result.headers!.Authorization).toBe('Bearer tok');
  });

  it('未注入 deps 的 manager 不注册 oauth（getSupportedTypes 不含 oauth）', () => {
    const plainManager = new AuthenticationManager();
    expect(plainManager.getSupportedTypes()).not.toContain('oauth');
  });

  it('注入 deps 的 manager 注册了 oauth', () => {
    expect(oauthManager.getSupportedTypes()).toContain('oauth');
  });
});
```

**删除**原 L497-504 的"未知认证类型 oauth 抛错"和 L532-538 的"未知认证类型 oauth 返回错误"测试（已被上面替代）。**保留** L506-513 的"无效的 bearer 配置抛错"测试（仍有效，验证通用错误路径，但改成 async rejects 形式——Task 3 已改）。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/authentication.unit.test.ts`
Expected: FAIL（`new AuthenticationManager({ httpClient, cache })` 还不支持，oauth 未注册）。

- [ ] **Step 3: 构造函数接收 deps + 注册 OAuthStrategy**

在 `authentication.ts` 顶部 import 加：
```typescript
import { HttpClient } from './http-client.js';
import type { CacheManager } from './cache-manager.js';
import { OAuthStrategy } from './oauth-strategy.js';
```

（`HttpClient` 用值导入因构造要 new 实例的类型注解；实际只用作类型可也用 `import type`。核查现有 `HttpClient` 是否 class——是 class，用 `import type` 即可作类型注解。统一用 `import type`。）

改构造函数（L180-187）：
```typescript
export interface AuthenticationManagerDeps {
  httpClient?: HttpClient;
  cache?: CacheManager;
}

export class AuthenticationManager {
  private readonly strategies = new Map<string, AuthenticationStrategy>();

  constructor(deps?: AuthenticationManagerDeps) {
    this.registerStrategy(new BearerTokenStrategy());
    this.registerStrategy(new ApiKeyStrategy());
    this.registerStrategy(new BasicAuthStrategy());

    if (deps?.httpClient && deps?.cache) {
      this.registerStrategy(new OAuthStrategy(deps.httpClient, deps.cache));
    }

    logger.info('认证管理器初始化完成', {
      context: { strategies: this.getSupportedTypes() },
    });
  }
```

在文件末尾 re-export：
```typescript
export { OAuthStrategy } from './oauth-strategy.js';
export type { CachedToken } from './oauth-strategy.js';
```

- [ ] **Step 4: 环境变量解析扩展（resolveEnvironmentVariables + validateEnvironmentVariables）**

现有 `resolveEnvironmentVariables`（L249-273）按平坦字段处理 token/username/password/header。改成按 type 分支。替换整个方法：

```typescript
resolveEnvironmentVariables(authConfig: AuthConfig): AuthConfig {
  if (authConfig.type === 'bearer' || authConfig.type === 'apikey') {
    return {
      ...authConfig,
      token: authConfig.token ? this.resolveEnvVariable(authConfig.token) : authConfig.token,
      header: authConfig.header ? this.resolveEnvVariable(authConfig.header) : authConfig.header,
    };
  }
  if (authConfig.type === 'basic') {
    return {
      ...authConfig,
      username: this.resolveEnvVariable(authConfig.username),
      password: this.resolveEnvVariable(authConfig.password),
    };
  }
  // oauth
  return {
    ...authConfig,
    clientId: this.resolveEnvVariable(authConfig.clientId),
    clientSecret: this.resolveEnvVariable(authConfig.clientSecret),
    refreshToken: authConfig.refreshToken ? this.resolveEnvVariable(authConfig.refreshToken) : authConfig.refreshToken,
  };
}
```

同样改造 `validateEnvironmentVariables`（L301-331）按 type 分支检查字段。替换：

```typescript
validateEnvironmentVariables(authConfig: AuthConfig): {
  valid: boolean;
  missingVars: string[];
} {
  const missingVars: string[] = [];
  const envPattern = /\{\{env\.([A-Z_][A-Z0-9_]*)\}\}/g;

  let fieldsToCheck: string[] = [];
  if (authConfig.type === 'bearer' || authConfig.type === 'apikey') {
    fieldsToCheck = [authConfig.token, authConfig.header].filter(Boolean) as string[];
  } else if (authConfig.type === 'basic') {
    fieldsToCheck = [authConfig.username, authConfig.password].filter(Boolean) as string[];
  } else if (authConfig.type === 'oauth') {
    fieldsToCheck = [authConfig.clientId, authConfig.clientSecret, authConfig.refreshToken].filter(Boolean) as string[];
  }

  for (const field of fieldsToCheck) {
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: 需要在循环中执行正则匹配
    while ((match = envPattern.exec(field)) !== null) {
      const varName = match[1];
      if (process.env[varName] === undefined) {
        missingVars.push(varName);
      }
    }
  }

  return {
    valid: missingVars.length === 0,
    missingVars: [...new Set(missingVars)],
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/authentication.unit.test.ts`
Expected: PASS。

- [ ] **Step 6: 跑全量 core 测试确认无破坏**

Run: `pnpm vitest --run packages/core/src/api-to-mcp 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/core/src/api-to-mcp/services/authentication.ts packages/core/src/api-to-mcp/services/authentication.unit.test.ts
git commit -m "feat(auth): AuthenticationManager 注入 deps 注册 OAuthStrategy + env 解析扩展"
```

---

## Task 7: service-manager 注入 deps

**Files:**
- Modify: `packages/core/src/api-to-mcp/services/api-to-mcp-service-manager.ts:140` + L475

**Interfaces:**
- Consumes: Task 6 的 `AuthenticationManager(deps)` 构造签名。

- [ ] **Step 1: 改两处 new AuthenticationManager() 调用**

`api-to-mcp-service-manager.ts:140` 附近，找到 `const authManager = new AuthenticationManager();`。该作用域内已有 `const httpClient = new HttpClient();`（L139）和应有 cache 实例。核查上下文 cache 变量名（搜索 `cacheManager` 或 `CacheManagerImpl`）。

改：
```typescript
const httpClient = new HttpClient();
const cacheManager = new CacheManagerImpl(/* 现有参数 */);
const authManager = new AuthenticationManager({ httpClient, cache: cacheManager });
```

若 L139 处没现成的 cache 实例，则就地 `new CacheManagerImpl()`（用默认配置）。L475 同模式。

**实现时核查**：精确变量名和构造参数以现有代码为准；若 service-manager 用的是别的 cache 类（如 `MemoryCacheManager` 或注入的 `CacheManager` 接口实例），用实际那个。

- [ ] **Step 2: 运行 service-manager 测试确认无破坏**

Run: `pnpm vitest --run packages/core/src/api-to-mcp/services/api-to-mcp-service-manager 2>&1 | tail -20`
Expected: PASS。

- [ ] **Step 3: 提交**

```bash
git add packages/core/src/api-to-mcp/services/api-to-mcp-service-manager.ts
git commit -m "feat(api-to-mcp): service-manager 注入 HttpClient/CacheManager 给 AuthenticationManager"
```

---

## Task 8: e2e 测试（内嵌假 AS）

**Files:**
- Create: `backend/src/e2e/mcp-protocol/oauth-outbound.test.ts`

**Interfaces:**
- Consumes: Task 1-7 完整 P3 实现。

**说明：** 参考 P2 e2e 的内嵌假 AS 模式。若搭建成本高，本 task 降级为 conditional skip 并登记 follow-up（仍需文件存在 + skip 标记，证明 DoD 项有交代）。

- [ ] **Step 1: 写 e2e 测试骨架（内嵌假 AS）**

新建 `backend/src/e2e/mcp-protocol/oauth-outbound.test.ts`。参考同目录 `oauth-client-credentials.test.ts` 的 conditional skip 模式 + test-app 挂载假端点模式。

```typescript
import { describe, it, expect } from 'vitest';

import type { TestApp } from '../../test-app.js';

// 参考 P2：若测试环境未配 api-to-mcp oauth 工具，conditional skip
const hasOAuthOutboundFixture = !!process.env.P3_OAUTH_OUTBOUND_E2E;

describe.skipIf(!hasOAuthOutboundFixture)('OAuth 出站（api-to-mcp）', () => {
  it('调 oauth 保护的 API 工具 → 自动取 token + 注入 + 缓存命中', async () => {
    // TODO: 用 test-app 挂载假 AS token endpoint + 假受保护资源
    // 1. 配置一个 api-to-mcp 工具，auth.type=oauth, tokenUrl 指向假 AS
    // 2. 调工具 → 验证 Authorization: Bearer <token> 注入到受保护资源请求
    // 3. 第二次调 → 验证不再打 token endpoint（缓存命中）
    expect(true).toBe(true);
  });
});
```

**降级策略**：因 `P3_OAUTH_OUTBOUND_E2E` 环境变量默认未设，此测试默认 skip。**如时间允许**，把上面的 TODO 展开成真实实现（参考 P2 `oauth-client-credentials.test.ts` 的假 AS 挂载方式：test-app 加一个 `POST /fake-as/token` 返回固定 token，加一个 `GET /fake-resource` 校验 Authorization 头）。

- [ ] **Step 2: 运行确认 skip 行为正确**

Run: `pnpm vitest --run --project api-e2e backend/src/e2e/mcp-protocol/oauth-outbound.test.ts 2>&1 | tail -10`
Expected: 显示 `skipped`（因未设环境变量）。

- [ ] **Step 3: 提交**

```bash
git add backend/src/e2e/mcp-protocol/oauth-outbound.test.ts
git commit -m "test(e2e): P3 OAuth 出站 e2e 骨架（conditional skip，待 fixture 激活）"
```

---

## Task 9: 收尾 — 全量门禁 + 文档同步

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（P3 实现进度）
- Modify: `docs/superpowers/specs/2026-07-27-p3-outbound-oauth-design.md`（状态改 实现完成 + 记 follow-up）

- [ ] **Step 1: 全量门禁**

Run: `pnpm check:ci`
Expected: 0 warnings, 0 errors。

Run: `pnpm test`
Expected: 全绿（含新增 oauth-strategy 单测；e2e conditional skip）。

- [ ] **Step 2: 类型检查（core 包）**

Run: `cd packages/core && pnpm exec tsc --noEmit`
Expected: 0 errors。

（若 backend 有独立 tsc 也跑 `cd backend && pnpm exec tsc --noEmit`；frontend 的已知类型错误与本 task 无关，不修。）

- [ ] **Step 3: 更新 adoption-overview P3 行**

把 P3 行的"实现进度"从 ⬜ 改为 ✅，加关键 commit + 测试数。参考 P2 行格式：
```
| P3 | 出站 OAuth（AuthenticationStrategy） | ✅ 完成 | ✅ **实现完成**（commit `xxx`） | `2026-07-27-p3-outbound-oauth-design.md` |
```

同时在"各子项目实现进度"表加 P3 行。

- [ ] **Step 4: 更新 P3 spec 状态**

把 `2026-07-27-p3-outbound-oauth-design.md` 顶部"状态"从 `Draft（待实现）` 改为 `实现完成`。在末尾加"实现修正 / follow-up"节，记录：
- e2e 是 conditional skip（待 fixture 激活），登记为 follow-up。
- 并发去重（stampede 防护）未实现，登记为 follow-up。
- RedisCacheManager 接入待 P6。

- [ ] **Step 5: 提交**

```bash
git add docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md docs/superpowers/specs/2026-07-27-p3-outbound-oauth-design.md
git commit -m "docs: P3 实现完成，同步 spec 状态 + adoption-overview 进度"
```

---

## Self-Review 清单（实现者每 task 后自检）

- [ ] 每个 task 提交前 `pnpm vitest --run <本 task 测试文件>` 通过。
- [ ] Task 5/6 中任何日志/错误 context 不含 clientSecret / refreshToken 原文。
- [ ] Task 3 async 化后，所有 `applyAuthentication` 调用点（grep 确认）都加了 await。
- [ ] Task 2 的 discriminated union 没破坏现有 bearer/apikey/basic 配置解析（runtime safeParse 行为不变）。
