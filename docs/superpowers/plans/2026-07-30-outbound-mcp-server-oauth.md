# 出站 MCP server OAuth 认证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Hub 连外部 MCP server（SSE/Streamable）时通过 SDK 原生 authProvider 动态获取/刷新 token，支持 bearer 静态 token 和 oauth client_credentials 两种机器认证。

**Architecture:** 配置层在 server.schema.ts 的 HttpServerConfigSchema 新增 `auth` 字段（discriminated union: bearer/oauth）。新建 `mcp-server-auth-provider.ts` 工厂，从 auth 配置构造 SDK authProvider——bearer 返回最小 `{ token }`，oauth 返回 SDK 现成 `ClientCredentialsProvider`（metadata 发现式，不需 tokenUrl）。server_manager 的 SSE/Streamable 连接把 authProvider 传给 transport。secret 支持 `${VAR}` 环境变量引用。

**Tech Stack:** TypeScript、zod、`@modelcontextprotocol/client@2.0.0-beta.5`（ClientCredentialsProvider + AuthProvider）、Vitest、Hono。

## Global Constraints

- **回归基线**：当前 `pnpm test` = 119 文件 / 1828 passed / 1 skipped / 0 failed。完成后不得低于此。
- **SDK API**：用 `@modelcontextprotocol/client` 导出的 `ClientCredentialsProvider`（oauth 分支）和 `AuthProvider` 类型（bearer 分支）。SDK 版本锁 2.0.0-beta.5。
- **secret 解析**：`clientSecret`/`token` 值若完整匹配 `${VAR_NAME}` 形式（`^\$\{(\w+)\}$`）则从 `process.env` 解析；否则当明文。环境变量未定义则抛 `ConfigError(INVALID_SERVER_CONFIG)`。
- **不复用 P3 OAuthStrategy**（不同代码路径，依赖不同）。
- **auth 可选**：`auth` 字段 optional，无 auth 的 server 行为不变（authProvider=undefined，SDK 视同未传）。
- **只动 sse/streaming**：stdio server 不涉及认证（本地进程）。
- **secret 不进日志**：clientSecret/token 原文绝不写日志/错误 context。
- Node >=20，pnpm 10.6.4，直接在 main 工作。
- commit 风格：conventional commits。

---

## Task 1: schema 扩展 — HttpServerConfigSchema 新增 auth 字段

**Files:**

- Modify: `packages/share/src/config/schemas/server.schema.ts`（HttpServerConfigSchema L52-57）
- Test: `packages/share/src/config/schemas/server.schema.test.ts`（若无则创建）

**Interfaces:**

- 产出：`ServerAuthConfigSchema`（discriminated union）+ `HttpServerConfigSchema.auth` 字段，供 Task 3 的 `createServerAuthProvider` 消费。
- 类型导出：`ServerAuthConfig`（从 schema 推导 `z.infer`），供 backend 使用。

- [ ] **Step 1: 写失败测试**

在 schema 测试文件新增（若无测试文件则创建 `server.schema.test.ts`）：

```typescript
import { ServerConfigSchema } from './server.schema.js';

describe('HttpServerConfigSchema auth 字段', () => {
  it('bearer auth 合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'bearer', token: 'abc123' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
  it('oauth auth 合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientId: 'my-client', clientSecret: '${MY_SECRET}', scope: 'read' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
  it('oauth 缺 clientId 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientSecret: 'x' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
  it('bearer 缺 token 不合法', () => {
    const config = { type: 'streaming', url: 'https://example.com/mcp', auth: { type: 'bearer' } };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
  it('无 auth 仍合法（向后兼容）', () => {
    const config = { type: 'streaming', url: 'https://example.com/mcp' };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
  it('stdio server 不接受 auth（或忽略）', () => {
    // stdio 配置带 auth 应仍合法（auth 字段在 HttpServerConfigSchema，union 解析为 stdio 分支时 auth 被忽略）
    const config = { type: 'stdio', command: 'echo', auth: { type: 'bearer', token: 'x' } };
    const result = ServerConfigSchema.safeParse(config);
    // 确认行为：若 z.union 严格模式拒绝，则记录预期；若放行则 OK。实现时确认。
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest --run packages/share/src/config/schemas/server.schema.test.ts 2>&1 | tail -10`
Expected: FAIL（auth 字段未定义）。

- [ ] **Step 3: 实现 ServerAuthConfigSchema + HttpServerConfigSchema.auth**

在 `server.schema.ts` 的 `HttpServerConfigSchema` 之前新增：

```typescript
/**
 * MCP server 出站认证配置（仅 sse/streaming 类型有意义）
 * - bearer：静态 token，直接用，无刷新
 * - oauth：client_credentials 机器认证，SDK 自动发现+获取+刷新
 */
export const ServerAuthConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bearer'),
    token: z.string().min(1, { error: 'bearer token 不能为空' }),
  }),
  z.object({
    type: z.literal('oauth'),
    clientId: z.string().min(1, { error: 'clientId 不能为空' }),
    clientSecret: z.string().min(1, { error: 'clientSecret 不能为空' }),
    scope: z.string().optional(),
    clientName: z.string().optional(),
  }),
]);

export type ServerAuthConfig = z.infer<typeof ServerAuthConfigSchema>;
```

`HttpServerConfigSchema.extend` 追加 `auth: ServerAuthConfigSchema.optional()`。

确认 `ServerAuthConfig` 类型从 share 包的 config 入口导出（`packages/share/src/config/index.ts` 或相应 barrel），供 backend import。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest --run packages/share/src/config/schemas/server.schema.test.ts 2>&1 | tail -8`
Expected: 全 passed。确认 stdio+auth 的实际行为，若被拒绝需在测试调整预期（stdio 不该带 auth）。

- [ ] **Step 5: share 包编译**

Run: `pnpm --filter @mcp-core/mcp-hub-share build 2>&1 | tail -5`
Expected: 编译通过。

- [ ] **Step 6: 提交**

```bash
git add packages/share/src/config/schemas/server.schema.ts packages/share/src/config/schemas/server.schema.test.ts
# 若改了 config barrel 导出也一起 add
git commit -m "feat(config): HttpServerConfigSchema 新增 auth 字段（bearer/oauth discriminated union）

支持 MCP server 出站认证配置。bearer=静态token，oauth=client_credentials
（SDK 现成 ClientCredentialsProvider）。secret 支持 \${VAR} 环境变量引用。"
```

---

## Task 2: secret 解析工具 + createServerAuthProvider 工厂

**Files:**

- Create: `backend/src/services/mcp-server-auth-provider.ts`
- Create: `backend/src/services/mcp-server-auth-provider.unit.test.ts`

**Interfaces:**

- 消费：Task 1 的 `ServerAuthConfig` 类型、SDK 的 `ClientCredentialsProvider` 和 `AuthProvider`（从 `@modelcontextprotocol/client`）。
- 产出：`createServerAuthProvider(auth): AuthProvider | OAuthClientProvider | undefined`，供 Task 3 的 server_manager 调用。

- [ ] **Step 1: 写失败测试**

`mcp-server-auth-provider.unit.test.ts`：

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerAuthProvider } from './mcp-server-auth-provider.js';

// mock SDK 的 ClientCredentialsProvider（避免真实 OAuth 流程）
vi.mock('@modelcontextprotocol/client', () => ({
  ClientCredentialsProvider: vi.fn(function (this: any, opts: any) {
    this.opts = opts;
  }),
}));

import { ClientCredentialsProvider } from '@modelcontextprotocol/client';

describe('createServerAuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TEST_SECRET;
  });

  it('无 auth 返回 undefined', () => {
    expect(createServerAuthProvider(undefined)).toBeUndefined();
  });

  it('bearer 返回 AuthProvider，token() 返回配置 token', async () => {
    const provider = createServerAuthProvider({ type: 'bearer', token: 'my-token' })!;
    expect(await provider.token!()).toBe('my-token');
  });

  it('bearer + ${VAR} 解析环境变量', async () => {
    process.env.TEST_SECRET = 'env-token';
    const provider = createServerAuthProvider({ type: 'bearer', token: '${TEST_SECRET}' })!;
    expect(await provider.token!()).toBe('env-token');
  });

  it('bearer + ${VAR} 环境变量未定义抛 ConfigError', () => {
    expect(() => createServerAuthProvider({ type: 'bearer', token: '${UNDEFINED_VAR}' })).toThrow();
  });

  it('oauth 返回 ClientCredentialsProvider 实例，options 正确', () => {
    createServerAuthProvider({
      type: 'oauth',
      clientId: 'c-id',
      clientSecret: 'secret',
      scope: 'read',
    });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith({
      clientId: 'c-id',
      clientSecret: 'secret',
      scope: 'read',
    });
  });

  it('oauth + ${VAR} 解析 secret 环境变量', () => {
    process.env.TEST_SECRET = 'env-secret';
    createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: '${TEST_SECRET}' });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'env-secret' }),
    );
  });

  it('oauth + ${VAR} 环境变量未定义抛错', () => {
    expect(() =>
      createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: '${UNDEFINED}' }),
    ).toThrow();
  });

  it('明文 secret（非 ${VAR} 形式）直接使用', () => {
    createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: 'plain-secret' });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'plain-secret' }),
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest --run src/services/mcp-server-auth-provider.unit.test.ts 2>&1 | tail -10`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 mcp-server-auth-provider.ts**

```typescript
import { ClientCredentialsProvider } from '@modelcontextprotocol/client';
import { ConfigError, ErrorCode } from '@mcp-core/mcp-hub-core';

import type { ServerAuthConfig } from '@mcp-core/mcp-hub-share/config';

const ENV_VAR_PATTERN = /^\$\{(\w+)\}$/;

/**
 * 解析 secret 值：${VAR} 形式从 process.env 取，否则当明文。
 * 环境变量未定义则抛 ConfigError。
 */
export function resolveSecret(value: string): string {
  const match = value.match(ENV_VAR_PATTERN);
  if (!match) return value; // 明文
  const envVar = match[1];
  const resolved = process.env[envVar];
  if (resolved === undefined) {
    throw new ConfigError(
      ErrorCode.INVALID_SERVER_CONFIG,
      `环境变量 ${envVar} 未定义（server auth secret 引用了 \${${envVar}}）`,
    );
  }
  return resolved;
}

/**
 * 从 server 配置的 auth 字段构造 SDK authProvider。
 * - bearer：最小 AuthProvider { token }，无刷新。
 * - oauth：SDK 现成 ClientCredentialsProvider（metadata 发现 + client_credentials + 自动刷新）。
 * - undefined：返回 undefined（沿用现状，仅 requestInit.headers）。
 */
export function createServerAuthProvider(
  auth: ServerAuthConfig | undefined,
): ReturnType<typeof createBearerProvider> | ClientCredentialsProvider | undefined {
  if (!auth) return undefined;
  if (auth.type === 'bearer') {
    return createBearerProvider(auth.token);
  }
  return new ClientCredentialsProvider({
    clientId: auth.clientId,
    clientSecret: resolveSecret(auth.clientSecret),
    scope: auth.scope,
    clientName: auth.clientName,
  });
}

function createBearerProvider(rawToken: string) {
  const token = resolveSecret(rawToken);
  return {
    token: async () => token,
    // 无 onUnauthorized：静态 token 无法刷新，401 重试失败则 SDK 抛 UnauthorizedError（正确行为）
  };
}
```

> 注意：bearer 分支返回的 `{ token }` 对象类型上需兼容 SDK 的 `AuthProvider`。若 TS 报类型不匹配，给返回类型加 `as AuthProvider` 或显式标注。import `AuthProvider` 类型从 `@modelcontextprotocol/client`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest --run src/services/mcp-server-auth-provider.unit.test.ts 2>&1 | tail -10`
Expected: 全 passed（8 个用例）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/mcp-server-auth-provider.ts backend/src/services/mcp-server-auth-provider.unit.test.ts
git commit -m "feat(server): createServerAuthProvider 工厂 + secret 环境变量解析

bearer→最小 AuthProvider，oauth→SDK ClientCredentialsProvider。
secret 支持 \${VAR} 环境变量引用，未定义抛 ConfigError。"
```

---

## Task 3: server_manager 接入 authProvider

**Files:**

- Modify: `backend/src/services/server_manager.ts`（connectSseServer L179-195、connectStreamingServer L197-213）
- Modify: `backend/src/services/server_manager.unit.test.ts`（补 mock + 新增用例）

**Interfaces:**

- 消费：Task 2 的 `createServerAuthProvider`。
- 改动：SSE/Streamable 连接把 `createServerAuthProvider(config.auth)` 传给 transport 的 `authProvider`。

- [ ] **Step 1: 写失败测试（新增 authProvider 传递验证）**

在 `server_manager.unit.test.ts` 新增 describe：

```typescript
describe('SSE/Streamable 连接的 authProvider', () => {
  it('带 oauth auth 的 streaming server：transport 收到 authProvider', async () => {
    process.env.TEST_OAUTH_SECRET = 'secret-val';
    const config = {
      id: 'auth-server',
      type: 'streaming' as const,
      url: 'https://example.com/mcp',
      auth: { type: 'oauth' as const, clientId: 'cid', clientSecret: '${TEST_OAUTH_SECRET}' },
    };
    // 调 initializeServer 或直接测 connectStreamingServer（参考现有测试如何触发连接）
    // 断言 StreamableHTTPClientTransport 被调用时第二参数含 authProvider（非 undefined）
    // ...
    delete process.env.TEST_OAUTH_SECRET;
  });

  it('无 auth 的 streaming server：authProvider 为 undefined（回归）', async () => {
    const config = { id: 'plain', type: 'streaming' as const, url: 'https://example.com/mcp' };
    // 断言 StreamableHTTPClientTransport 调用参数中 authProvider 为 undefined 或未传
    // ...
  });
});
```

（具体触发连接的方式参考现有测试——server_manager.unit.test.ts 已 mock transport，看它如何断言 transport 构造参数。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest --run src/services/server_manager.unit.test.ts 2>&1 | tail -10`
Expected: 新增用例 FAIL（authProvider 未传）。

- [ ] **Step 3: 改 connectSseServer + connectStreamingServer**

两处都改（模式相同）：

```typescript
// connectStreamingServer（原 L207-210）
const headers: Record<string, string> = { ...config.headers };
const authProvider = createServerAuthProvider(config.auth);
const transport = new StreamableHTTPClientTransport(new URL(config.url), {
  requestInit: { headers },
  authProvider,
});
```

connectSseServer（L189-192）同样加 `authProvider`。

顶部 import：`import { createServerAuthProvider } from './mcp-server-auth-provider.js';`

> 注意：`config.auth` 的类型——ServerConfig 的 sse/streaming 分支需要带上 auth 字段类型（Task 1 已加到 HttpServerConfigSchema）。若 TS 对 `config.auth` 类型报错，确认 ServerConfig 类型流转正确。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest --run src/services/server_manager.unit.test.ts 2>&1 | tail -10`
Expected: 全 passed（含新增 2 用例 + 现有用例回归）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/server_manager.ts backend/src/services/server_manager.unit.test.ts
git commit -m "feat(server): SSE/Streamable 连接接入 authProvider（动态 token）

connectSseServer/connectStreamingServer 从 config.auth 构造 authProvider
传给 SDK transport。无 auth 时 authProvider=undefined，行为不变。"
```

---

## Task 4: 全量回归验证

- [ ] **Step 1: 全量测试**

Run: `npx vitest --run 2>&1 | tail -6`
Expected: ≥ 1828 passed / 0 failed（不低于基线）。

- [ ] **Step 2: typecheck + lint**

Run: `pnpm check 2>&1 | tail -5` → 全绿
Run: `pnpm check:ci 2>&1 | tail -6` → oxlint 0 errors（oxfmt 仅既有文档格式债）

- [ ] **Step 3: 确认 secret 不泄露**

Run: `grep -rn "clientSecret\|auth.*token" backend/src/services/mcp-server-auth-provider.ts | grep -i "logger\|console\|error\|warn"`
Expected: 0 命中（secret 原文不进日志/错误）。

- [ ] **Step 4: 更新示例配置**

在 `backend/config/mcp_server.json.example` 增加一个带 auth 的示例 server（注释形式，展示 bearer 和 oauth 两种配置），供用户参考。

- [ ] **Step 5: 报告**

如实汇报：测试数、lint 结果、secret 泄露检查、示例配置。

---

## 执行后

- 第 4 项（出站 MCP server OAuth）完成。
- 用户可在 server 配置里加 `auth: { type: 'oauth', clientId, clientSecret: '${VAR}', scope }` 连接 OAuth 保护的 MCP server，token 自动获取刷新。
- 至此 1（救火）→ 2（代码债）→ 4（出站 OAuth）三项全部完成。
