# 出站 MCP server OAuth 认证

- **状态**: Draft
- **日期**: 2026-07-30
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（P3 范围边界 §，本项是其中登记的"未归属独立待办"）
  - `docs/superpowers/specs/2026-07-27-p3-outbound-oauth-design.md`（P3 出站 REST OAuth，本项与之不同代码路径）

## 目的

让 Hub 作为 MCP **客户端**连接外部 OAuth 保护的 MCP server（SSE/Streamable HTTP 类型）时，通过 SDK 原生的 `authProvider` 机制动态获取/刷新 token，而非只塞静态 header。

**背景**：`backend/src/services/server_manager.ts` 的 `connectSseServer`（L189）和 `connectStreamingServer`（L207）当前只用 `config.headers`（静态）作为 transport 的 `requestInit.headers`。外部 server 需要 OAuth token 时，用户必须手动把 token 写死在 headers 里——无 token 获取、无过期刷新，token 过期后连接废掉且无告警。

## 与 P3 的边界（重要）

| 问题                                                | 归属            | 代码路径                                                                          |
| --------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| Hub 把外部 **REST API** 封装成 MCP 工具的出站 OAuth | ✅ P3（已完成） | `packages/core/src/api-to-mcp/`（AuthenticationStrategy，per-request 注入）       |
| Hub 连外部 **MCP server** 的出站 OAuth              | ✅ **本 spec**  | `backend/src/services/server_manager.ts`（SDK authProvider，per-connection 注入） |

两者代码路径完全不同。本项不复用 P3 的 `OAuthStrategy` 实例（它依赖 api-to-mcp 的 httpClient/CacheManager）。

## 技术发现：SDK 原生 authProvider 支持

经查证 `@modelcontextprotocol/client@2.0.0-beta.5`（context7 + dist 类型）：

- `SSEClientTransport` 和 `StreamableHTTPClientTransport` 都接受 `authProvider?: AuthProvider | OAuthClientProvider` 选项。
- **AuthProvider 接口**（最小形态）：`{ token(): Promise<string|undefined>; onUnauthorized?(ctx): Promise<void> }`。
  - `token()`：每次请求前调用，返回 bearer token。SDK 自动设 `Authorization: Bearer <token>`。
  - `onUnauthorized()`：收到 401 时调用，刷新后 SDK 自动重试一次。
  - `requestInit.headers` 里的自定义 header 仍会合并保留。
- **SDK 自带 `ClientCredentialsProvider`**：专为机器认证设计（"machine-to-machine"），构造只需 `{ clientId, clientSecret, scope?, clientName?, expectedIssuer? }`，**不需 tokenUrl**。工作流程：
  1. 首次连接 server 返回 401 + `WWW-Authenticate` challenge
  2. SDK 从 challenge 做 RFC 8414 OAuth metadata 发现，拿到 token endpoint
  3. 发 `grant_type=client_credentials`（`client_secret_basic` 认证）
  4. 401 时自动刷新重试一次

**含义**：oauth 分支直接复用 SDK 现成 `ClientCredentialsProvider`，不自己写 token 获取逻辑。代价：要求目标 MCP server 支持 OAuth metadata 发现（返回 challenge + `.well-known`）。

## 范围

**纳入**：

- `server.schema.ts` 的 `HttpServerConfigSchema` 新增 `auth` 字段（支持 `bearer`/`oauth` 两种机器认证）。
- `server_manager.ts` 的 SSE/Streamable 连接：从 `config.auth` 构造 authProvider 传给 transport。
- 配置 secret 解析（`${VAR}` 环境变量引用 + 明文两种支持）。

**显式排除**：

- 交互式 `authorization_code`（网关后台难落地，谁来点授权？）。
- stdio server（本地进程，无 HTTP 认证）。
- 自实现 token 获取逻辑（用 SDK 现成 `ClientCredentialsProvider`，不重复造轮子）。
- 显式 tokenUrl 配置（SDK 通过 metadata 发现获取，不暴露 tokenUrl 配置项）。

---

## 配置 schema 设计

在 `packages/share/src/config/schemas/server.schema.ts` 的 `HttpServerConfigSchema` 新增可选 `auth` 字段（discriminated union）：

```typescript
const ServerAuthConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bearer'),
    token: z.string().min(1, { error: 'bearer token 不能为空' }),
  }),
  z.object({
    type: z.literal('oauth'),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1), // 支持 ${VAR} 环境变量引用，见下
    scope: z.string().optional(),
    clientName: z.string().optional(),
  }),
]);

export const HttpServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.enum(['sse', 'streaming']),
  url: z.string().url({ error: '必须是有效的URL' }),
  headers: z.record(z.string(), z.string()).optional(),
  auth: ServerAuthConfigSchema.optional(), // 新增
});
```

**两种认证形态**：

| type     | 用途                      | 实现                                                               | 刷新                        |
| -------- | ------------------------- | ------------------------------------------------------------------ | --------------------------- |
| `bearer` | 用户已有 token            | `AuthProvider = { token: async () => token }`，无 onUnauthorized   | 无（静态，过期则 401 报错） |
| `oauth`  | 服务间 client_credentials | SDK `ClientCredentialsProvider({ clientId, clientSecret, scope })` | SDK 自动（401→刷新→重试）   |

**secret 解析约定**：

- `clientSecret` / bearer `token` 的值若以 `${` 开头、`}` 结尾，则视为环境变量引用，运行时从 `process.env` 解析；否则当明文。
- 环境变量是推荐用法（配置文件不含明文密钥）。
- 解析失败（环境变量未定义）→ 启动/连接时报错。

**向后兼容**：`auth` 是 optional，现有无 auth 的 server 配置行为不变。

---

## server_manager 改动

### authProvider 构造

新建 `backend/src/services/mcp-server-auth-provider.ts`，提供"从 ServerAuthConfig 构造 SDK authProvider"的工厂：

```typescript
import { ClientCredentialsProvider, type AuthProvider } from '@modelcontextprotocol/client';

/**
 * 从 server 配置的 auth 字段构造 SDK authProvider。
 * - bearer：返回最小 AuthProvider { token }，无刷新。
 * - oauth：返回 SDK 现成 ClientCredentialsProvider（自动发现+获取+刷新）。
 * - 无 auth：返回 undefined（沿用现状，仅 requestInit.headers）。
 */
export function createServerAuthProvider(
  auth: ServerAuthConfig | undefined,
): AuthProvider | OAuthClientProvider | undefined {
  if (!auth) return undefined;
  if (auth.type === 'bearer') {
    const token = resolveSecret(auth.token); // ${VAR} 解析
    return { token: async () => token };
  }
  // oauth
  return new ClientCredentialsProvider({
    clientId: auth.clientId,
    clientSecret: resolveSecret(auth.clientSecret),
    scope: auth.scope,
    clientName: auth.clientName,
  });
}
```

### 连接逻辑改动

`connectSseServer` / `connectStreamingServer`：

```typescript
// 现状
const headers = { ...config.headers };
new StreamableHTTPClientTransport(url, { requestInit: { headers } });

// 改后
const headers = { ...config.headers };
const authProvider = createServerAuthProvider(config.auth);
new StreamableHTTPClientTransport(url, {
  requestInit: { headers },
  authProvider, // undefined 时不影响行为（SDK 视同未传）
});
```

SSE 分支同理。

### 错误处理

- secret 解析失败（环境变量未定义）→ `createServerAuthProvider` 抛 `ConfigError(INVALID_SERVER_CONFIG)`，连接失败走现有错误处理（标记 disconnected + 日志）。
- OAuth 发现/获取失败 → SDK 抛 `UnauthorizedError` → `client.connect()` 失败 → 现有连接失败处理。
- bearer token 过期 → 401 重试仍失败 → `UnauthorizedError` → 连接失败（正确行为）。
- 不新增独立错误码段（复用现有 `INVALID_SERVER_CONFIG` / `AUTHENTICATION_FAILED`）。

---

## 测试与验证

### 测试策略

- **createServerAuthProvider 单测**（TDD）：
  - bearer：返回 AuthProvider，`token()` 返回配置 token
  - bearer + `${VAR}`：环境变量解析正确
  - oauth：返回 `ClientCredentialsProvider` 实例，options 正确（clientId/secret/scope）
  - oauth + `${VAR}`：secret 环境变量解析
  - 环境变量未定义：抛 ConfigError
  - 无 auth：返回 undefined
- **server_manager 集成测试**：
  - 带 auth 的 server：transport 收到 authProvider（mock transport 验证）
  - 无 auth 的 server：行为不变（回归）
- **schema 测试**：auth 字段校验（oauth 必填 clientId/secret、bearer 必填 token、discriminated union 正确分流）

### 验证标准

- 全量 `pnpm test` ≥ 1828 passed（基线）
- typecheck + oxlint 0 errors

---

## 风险与缓解

| 风险                                                               | 缓解                                                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| SDK ClientCredentialsProvider 的 metadata 发现对某些 server 不工作 | 本 spec 明确范围只覆盖支持发现的 server；不支持发现的 server 用户仍可用 bearer 静态 token 兜底 |
| secret 明文配置被误提交 git                                        | `${VAR}` 模式推荐 + `backend/config` 已 gitignore + 文档提示                                   |
| 现有无 auth server 行为回归                                        | auth 是 optional，无 auth 走原路径（authProvider=undefined）；集成测试覆盖回归                 |
| ClientCredentialsProvider 是 beta API 可能变                       | SDK 2.0.0-beta.5 锁版本；GA 时随 SDK 升级一起跟进                                              |

## 实施顺序

单一阶段（范围小）：

1. schema 扩展（auth 字段 + secret 解析）
2. createServerAuthProvider 工厂
3. server_manager 接入
4. 测试 + 全量回归
