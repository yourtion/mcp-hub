# P2: 入站 OAuth 2.1（Protected Resource + 内置最小 AS）

- **状态**: Draft
- **日期**: 2026-07-26
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（总体跟踪）
  - `docs/superpowers/specs/2026-07-25-p1-transport-upgrade-design.md`（P1，弱依赖）
  - `docs/superpowers/specs/2026-07-11-project-audit-report.md`（产品/架构审计）

## 背景

当前 Hub 的 MCP 协议端点 `POST /:group/mcp`（P1 已升级到 SDK v2 `createMcpHandler`，无状态、`legacy: 'reject'`）**完全没有任何认证**——`group-router.ts` 的 `groupValidationMiddleware` 只校验组是否存在，不校验任何凭据。任何人知道 group 名就能调用 MCP 工具。这是项目首要的安全缺口。

与此同时，组级 `validationKey`（AES 共享密钥，`groups/index.ts` 有完整的设置/验证/加密存储逻辑）**配置了却从未在 MCP 端点强制**——典型"配了不用"的悬空状态。

P2 的目标是让 Hub 作为 MCP **OAuth 2.1 Protected Resource**（RFC9728），对 MCP 客户端（Claude Desktop 等）做标准授权，同时填补 validationKey 的现状缺口。对齐 MCP `2025-11-25` Authorization 规范 + `2026-07-28` 加固。

## 范围

### 目标

1. Hub 作为 **OAuth Protected Resource**（RFC9728）：暴露 `/.well-known/oauth-protected-resource`，401 响应带 `WWW-Authenticate: Bearer resource_metadata="...", scope="..."`，校验 `Authorization: Bearer <token>`，验证 audience（RFC8707）。
2. Hub 内置一个**最小 Authorization Server**：实现 RFC8414 Authorization Server Metadata + token 端点（`client_credentials` grant 签发 JWT）+ JWKs 端点，让无外部 IdP 的团队开箱即用。
3. 同时支持**对接外部 IdP**（Keycloak/Entra/Auth0/OIDC Provider）：通过 RFC8414 metadata 发现外部 AS，token 校验优先本地 JWT 验签（JWKS），失败回退到 introspection（RFC7662）。
4. **填补 validationKey 现状缺口**：组级 `validation.enabled + validationKey` 在 MCP 端点真正强制（轻量 API key 路径），与 OAuth 并行作为备选授权方式。
5. PKCE S256 声明（为未来 `authorization_code` 预留）+ RFC9207 `iss` 参数防 mix-up（内置 AS 签发的 token 带 `iss`）。

### 非目标（留给后续子项目或显式排除）

- **CLI（`@mcp-core/mcp-hub-cli`）不支持 OAuth**。MCP 2025-11-25 Authorization 规范明确："Implementations using an STDIO transport SHOULD NOT follow this specification, and instead retrieve credentials from the environment。" CLI 走 stdio 传输，授权边界由宿主进程负责，不在 OAuth 范畴。P2 所有改动限定在 `backend/`，CLI 零改动，不预留任何 CLI 钩子（YAGNI）。
- `authorization_code` grant（用户浏览器交互式登录）。内置 AS 本轮只做 `client_credentials`（机器对机器，MCP 客户端作为服务账号的主场景）。`authorization_code` 留待未来。
- Client ID Metadata Documents（`draft-ietf-oauth-client-id-metadata-document-00`）。该 draft 还在 `-00`，外部 IdP / 客户端生态支持极少，Hub 实现了也难验证。本轮显式不纳入。
- OAuth 2.0 Dynamic Client Registration（RFC7591）。2026-07-28 已弃用为备选，不实现。
- 多实例共享的 introspection / JWKS 缓存（依赖 `RedisCacheManager`）。本轮 MVP 单实例内存缓存，`RedisCacheManager` 登记到跨子项目待办（P6 候选）。
- 出站 OAuth（Hub 连外部 REST API / MCP server 时的认证）属 P3 和独立待办，不在 P2。
- Web UI 登录（`backend/src/middleware/auth.ts` + `services/auth.ts`，本地用户库 + HS256 JWT）**完全不变**，它保护 `/api/*` 管理端点，是独立子系统。

## 关键决策（已在 brainstorming 中确认）

| 决策          | 选择                                                     | 理由                                                                              |
| ------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| AS 策略       | 对接外部 IdP + 内置最小 AS                               | 既支持企业 IdP，又给小团队开箱即用                                                |
| 内置 AS 范围  | `client_credentials` 签发 + metadata + JWKs + token 端点 | 覆盖 MCP 客户端服务账号主场景，不做 `authorization_code`                          |
| Token 校验    | JWT 优先（JWKS 本地验签）+ introspection 回退            | 兼容外部 IdP 可能签发 opaque token；JWT 本地验签与 P1 无状态方向一致              |
| validationKey | 接入 MCP 端点（填补缺口）+ OAuth 增强                    | validationKey 作为轻量 API key 路径，OAuth 作为标准增强；两条并行                 |
| 加固项        | RFC9728 + RFC8414 + RFC8707 + PKCE S256 + RFC9207 iss    | 覆盖 2025-11-25 规范主体 + 2026-07-28 主流加固；不做 Client ID Metadata Documents |
| 配置粒度      | 系统级 OAuth + 组级 validationKey                        | Hub 作为一个 Resource Server，一套授权策略；validationKey 按 group 区分           |
| CLI 范围      | 不支持                                                   | stdio 传输不在 OAuth 规范范畴                                                     |

## 设计

### §1 整体架构与模块边界

**核心思路**：Hub 同时扮演两个 OAuth 角色——

- **Protected Resource**（主角色）：对 MCP 客户端，校验 Bearer token，暴露 RFC9728 metadata。
- **Authorization Server**（内置最小 AS）：当未配置外部 IdP 时，用 `client_credentials` 签发 token，让 Hub 开箱即用；当配置了外部 IdP 时，内置 AS metadata 端点可仍可用（或仅代理外部 AS metadata）。

**新增模块布局**（全部在 `backend/`）：

```
backend/src/
├── api/mcp/
│   └── group-router.ts          # 改造：在 groupValidationMiddleware 之后插入 mcpAuthMiddleware
├── api/oauth/                   # 【新增】OAuth/AS 端点
│   ├── index.ts                 # 路由聚合
│   ├── protected-resource.ts    # RFC9728 metadata + 401 WWW-Authenticate 生成器
│   ├── authorization-server.ts  # RFC8414 AS metadata（内置 AS 或外部 IdP 代理）
│   ├── token.ts                 # /token 端点（内置 AS 的 client_credentials 签发）
│   ├── jwks.ts                  # /jwks 端点（内置 AS 公钥集合）
│   └── introspection.ts         # /introspect 代理（转发给外部 IdP，token 校验回退用）
├── middleware/
│   └── mcp-auth.ts              # 【新增】MCP 端点专用认证中间件（区别于 Web UI 的 auth.ts）
├── services/
│   ├── oauth/                   # 【新增】OAuth 核心服务
│   │   ├── resource-server.ts   # Protected Resource 逻辑（token 校验编排、audience 校验）
│   │   ├── token-validator.ts   # JWT 本地验签 + introspection 回退编排
│   │   ├── jwks-cache.ts        # JWKS 拉取与缓存（带 kid 索引，TTL 失效）
│   │   ├── as-metadata.ts       # AS metadata 解析与缓存（外部 IdP 发现 + 内置 AS 生成）
│   │   ├── internal-as.ts       # 内置最小 AS（client_credentials 签发、密钥管理、token 端点逻辑）
│   │   └── validation-key.ts    # 组级 validationKey 校验（从 groups/index.ts 抽出的纯逻辑）
│   └── auth.ts                  # 不变（Web UI 本地登录，独立子系统）
├── utils/
│   └── crypto/                  # 【新增或复用】RSA 密钥对生成/加载（内置 AS 签名用）
└── app.ts                       # 改造：挂载 /api/oauth 与 well-known 路由
```

**与 Web UI 认证的关系**（两套完全独立）：

| 子系统              | 中间件                   | 服务               | 保护对象               | Token 形态                              |
| ------------------- | ------------------------ | ------------------ | ---------------------- | --------------------------------------- |
| Web UI 登录（不变） | `middleware/auth.ts`     | `services/auth.ts` | `/api/*` 管理端点      | HS256 JWT（本地用户库）                 |
| MCP OAuth（新增）   | `middleware/mcp-auth.ts` | `services/oauth/*` | `/:group/mcp` 协议端点 | RS256 JWT（asymmetric）或 introspection |

**与 P1 无状态方向的对齐**：token 校验无状态（JWT 本地验签为主），不引入服务端 session。introspection 结果带短 TTL 缓存（内存，单实例 MVP）。JWKS 缓存同样内存 + TTL。多实例共享缓存依赖 `RedisCacheManager`（当前 no-op），登记到跨子项目待办，P2 不实现。

**关键隔离原则**：OAuth 子系统不依赖 Web UI 的 `AuthService`，反之亦然。两者通过各自的中间件挂载点和独立的 service 模块隔离。OAuth 子系统不读写 `SystemConfig.users`（本地用户库）。

### §2 端点与协议契约

P2 新增的 HTTP 端点（全部走 HTTPS，部署层保证）：

#### §2.1 Protected Resource Metadata（RFC9728）— MCP 规范 MUST

**路径**（两种都实现，客户端按优先级探测）：

- `GET /.well-known/oauth-protected-resource`（根级，Hub 作为单一 Resource Server）
- `GET /.well-known/oauth-protected-resource/:group/mcp`（按组路径变体）

**响应**（200，JSON）：

```json
{
  "resource": "https://hub.example.com/default/mcp",
  "authorization_servers": ["https://hub.example.com"],
  "jwks_uri": "https://hub.example.com/api/oauth/jwks",
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["mcp:tools", "mcp:resources"]
}
```

字段说明（RFC9728）：

- `resource`（REQUIRED）：本 Resource Server 的规范 URI。根级 metadata 用 Hub base URL；组级变体用 `https://<host>/<group>/mcp`。
- `authorization_servers`（RFC9728 OPTIONAL，但 **MCP 规范加 MUST**）：issuer 标识符数组。内置 AS 时是 Hub 自身 issuer；配置了外部 IdP 时是外部 issuer；两者都有时并列。
- `jwks_uri`（OPTIONAL，本 Hub 提供）：内置 AS 的公钥集合，供客户端本地验签用。`MUST` 用 https。
- `bearer_methods_supported`：`["header"]`（Hub 只支持 `Authorization` 头传 token，不接受 body/query）。
- `scopes_supported`（RECOMMENDED）：本 Hub 认识的 scope 集合。

#### §2.2 401 Unauthorized 响应（MCP 规范 MUST）

未带 token / token 无效 / token 过期时，MCP 端点返回：

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://hub.example.com/.well-known/oauth-protected-resource",
                         scope="mcp:tools"
```

MCP 客户端按规范从 `resource_metadata` URL 拉取 Protected Resource Metadata，再走 AS 发现 → token 获取流程。

**insufficient_scope**（token 有效但 scope 不足）返回 403：

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
                         scope="mcp:tools",
                         resource_metadata="https://hub.example.com/.well-known/oauth-protected-resource",
                         error_description="..."
```

#### §2.3 Authorization Server Metadata（RFC8414）— 内置 AS

**路径**：`GET /.well-known/oauth-authorization-server`（Hub 自身作为 AS 时）

**响应**（200，JSON，关键字段）：

```json
{
  "issuer": "https://hub.example.com",
  "token_endpoint": "https://hub.example.com/api/oauth/token",
  "jwks_uri": "https://hub.example.com/api/oauth/jwks",
  "response_types_supported": ["none"],
  "grant_types_supported": ["client_credentials"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools", "mcp:resources"],
  "resource_parameter_supported": true,
  "revocation_endpoint": "https://hub.example.com/api/oauth/revoke"
}
```

**关键合规点**：

- `code_challenge_methods_supported: ["S256"]` **必须声明**。MCP 规范明确："If `code_challenge_methods_supported` is absent, the authorization server does not support PKCE and MCP clients MUST refuse to proceed。" 本轮内置 AS 只做 `client_credentials`（用不到 PKCE），但声明此字段是为 MCP 客户端 metadata 验证通过——否则客户端看到缺失会直接拒绝连接。注释里说明这是为 `authorization_code` 预留的声明。
- `resource_parameter_supported: true`：声明本 AS 支持 RFC8707 resource 参数。
- 对接外部 IdP 时，Hub 不暴露自己的 AS metadata 端点（或重定向到外部 IdP 的 metadata），由 `as-metadata.ts` 按配置决定。

#### §2.4 Token 端点（内置 AS）

**路径**：`POST /api/oauth/token`

**请求**（`client_credentials` grant）：

```http
POST /api/oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=<client_id>
&client_secret=<client_secret>
&scope=mcp:tools
&resource=https://hub.example.com/default/mcp
```

**响应**（200，JSON）：

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp:tools"
}
```

签发的 JWT（RS256）claims：

- `iss`：Hub issuer（RFC9207，防 mix-up）
- `sub`：client_id
- `aud`：请求里的 `resource` 值（RFC8707 audience 绑定）
- `exp`/`iat`/`nbf`
- `scope`：授权的 scope
- `client_id`：客户端标识

**client 管理**：内置 AS 的 client（client_id/secret）配置在系统级 OAuth 配置里（见 §3）。MVP 不实现 client 注册端点，client 通过配置文件预置。

#### §2.5 JWKs 端点（内置 AS）

**路径**：`GET /api/oauth/jwks`

返回内置 AS 当前签名密钥的公钥集合（JWK Set 格式，带 `kid`）。密钥从启动时加载或生成（见 §4）。

#### §2.6 Introspection 代理（RFC7662，外部 IdP 场景）

**路径**：`POST /api/oauth/introspect`（仅当配置了外部 IdP 时启用）

Hub 作为 Resource Server，对拿到的 opaque token 无法本地验签时，转发到外部 IdP 的 introspection 端点（带 Hub 的 client 凭据）。结果带短 TTL 缓存。

**此端点不对外暴露**：introspection 是 Hub 内部 `token-validator.ts` 调用的 service 方法（`introspectToken(token)`），不挂 HTTP 路由。外部客户端不应直接调 introspection——那是 AS 的职责，不是 Resource Server 的。本节描述的是 service 行为契约，不是公开端点。

### §3 配置模型

**系统级 OAuth 配置**（新增到 `SystemConfig.oauth`，与现有 `auth`/`users` 平级）：

```typescript
// packages/share/src/config/schemas/system.schema.ts 扩展
SystemConfigSchema.extend({
  oauth: z
    .object({
      // 模式：'internal'（内置 AS）/ 'external'（对接外部 IdP）/ 'both'
      mode: z.enum(['internal', 'external', 'both']).default('internal'),

      // 内置 AS 配置（mode 为 internal/both 时必填）
      internal: z
        .object({
          // RSA 私钥 PEM（环境变量 OAuth_INTERNAL_PRIVATE_KEY 指向路径或内联）
          // 未配置时启动期生成临时密钥对（仅开发，生产警告）
          issuer: z.string().url().optional(), // 默认从请求推断
          tokenTtlSeconds: z.number().int().positive().default(3600),
          clients: z
            .array(
              z.object({
                clientId: z.string(),
                clientSecret: z.string(), // bcrypt 哈希存储
                scopes: z.array(z.string()).default(['mcp:tools']),
              }),
            )
            .default([]),
        })
        .optional(),

      // 外部 IdP 配置（mode 为 external/both 时必填）
      external: z
        .object({
          issuer: z.string().url(), // 外部 AS issuer
          metadataUrl: z.string().url().optional(), // 覆盖默认 .well-known 发现
          clientId: z.string(), // Hub 作为 Resource Server 的 client_id（用于 introspection）
          clientSecret: z.string(), // 对应 secret
          introspectionEndpoint: z.string().url().optional(), // 覆盖 metadata 发现
          jwksUri: z.string().url().optional(), // 覆盖 metadata 发现
          audience: z.string(), // Hub 的 audience 标识（RFC8707）
        })
        .optional(),

      // 受众校验（resource 标识）
      resource: z.string().url(), // Hub 作为 Resource 的规范 URI，如 https://hub.example.com
      scopes: z.array(z.string()).default(['mcp:tools', 'mcp:resources']),
    })
    .optional(), // 整个 oauth 块可选，未配置时 MCP 端点回退到仅 validationKey
});
```

**组级 validation 配置**（不变，`GroupValidationSchema` 已存在）：`enabled` + `validationKey`（AES 加密存储）。

**配置缺失的兜底**：

- `SystemConfig.oauth` 整块未配置 + 组级 `validation.enabled = false` → MCP 端点**完全开放**（保持当前行为，但启动时 logger.warn 强提示安全风险）。
- 这种兜底保证现有部署升级 P2 后不会因配置缺失而 break，但明确警告。

### §4 密钥管理（内置 AS）

**签名密钥（RSA）**：

- 从环境变量 `OAUTH_INTERNAL_PRIVATE_KEY` 读取 PEM（指向文件路径或内联 PEM）。
- 未配置时：启动期生成临时 RSA-2048 密钥对，logger.warn("仅开发用途，重启后所有已签发 token 失效")。生产部署必须配置。
- 密钥轮换：支持多个 `kid` 并存（JWKs 返回多个，签发用最新的），轮换配置走环境变量。MVP 可只支持单密钥，多密钥轮换登记为 follow-up。

**JWKS 缓存（外部 IdP 场景）**：

- `jwks-cache.ts` 拉取外部 IdP 的 JWKS，按 `kid` 索引，带 TTL（默认 1 小时，遇未知 kid 主动刷新）。
- 缓存内存态，单实例 MVP。

**Hub 自身公钥**（`/api/oauth/jwks`）：从内置 AS 的私钥推导公钥，导出为 JWK。

### §5 Token 校验流程（核心编排）

`middleware/mcp-auth.ts` 对每个到 `/:group/mcp` 的请求执行（在 `groupValidationMiddleware` 之后）：

```
1. 解析 Authorization: Bearer <token>，缺失 → §2.2 的 401
2. 查 SystemConfig.oauth：
   a. 未配置 oauth → 进入 validationKey 路径（§6）
   b. 配置了 oauth → 进入 OAuth 路径（下面 3-7）
3. 尝试 JWT 本地验签（token-validator.ts）：
   a. 解析 JWT header 取 kid
   b. 从 jwks-cache 查对应公钥（内置 AS 用本地公钥，外部 IdP 用 JWKS URI）
   c. 验签 + 验 exp/nbf + 验 iss（RFC9207）+ 验 aud（RFC8707，aud 必须含 §3 的 resource）
   d. 验 scope（请求需要的 scope 在 token.scope 内）
   e. 成功 → 注入 auth context（sub、scope、clientId），放行
4. JWT 验签失败 / token 是 opaque → introspection 回退（仅 mode 含 external）：
   a. 调外部 IdP 的 /introspect（带 Hub client 凭据），结果带短 TTL 缓存（默认 60s）
   b. introspection 返回 active=true → 验 audience/scope → 放行
   c. active=false → 401
5. introspection 也不可用（mode=internal 且 JWT 验签失败）→ 401（invalid_token）
6. scope 不足 → 403（insufficient_scope，§2.2）
7. audience 不匹配 → 401（invalid_token，error_description 说明 audience 校验失败）
```

**无状态性**：除 introspection 缓存外，校验全在请求内完成，不依赖服务端 session。introspection 缓存丢失最多导致多打几次 IdP，不影响正确性。

### §6 validationKey 路径（填补现状缺口）

当组级 `validation.enabled = true` 且请求走 validationKey 路径（OAuth 未配置，或 OAuth 配置允许 fallback）：

```
1. 从 Authorization: Bearer <key> 取 token（validationKey 也走 Bearer 头，复用客户端习惯）
2. 从配置读该 group 的加密 validationKey，AES 解密（复用 crypto.ts）
3. 常量时间比较
4. 匹配 → 放行；不匹配 → 401（不走 OAuth 的 WWW-Authenticate，而是简单的 Bearer challenge）
```

**OAuth 与 validationKey 的优先级**（由 `SystemConfig.oauth` 是否配置 + 组级 `validation.enabled` 共同决定）：

| `SystemConfig.oauth`                | 组级 `validation.enabled` | MCP 端点行为                                                           |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| 未配置                              | `false`                   | 完全开放（启动 warn，不推荐生产）                                      |
| 未配置                              | `true`                    | 仅 validationKey 校验                                                  |
| `mode = 'internal'` 或 `'external'` | 任意                      | 仅 OAuth 校验（validationKey 路径禁用，避免语义混淆）                  |
| `mode = 'both'`                     | `true`                    | OAuth 优先：JWT 验签/opaque introspection 失败后，回退到 validationKey |
| `mode = 'both'`                     | `false`                   | 仅 OAuth 校验                                                          |

设计原则：**配置了 OAuth 就以 OAuth 为准**，validationKey 只在 OAuth 未配置或 `both` 模式回退时启用。这避免两套语义在正常路径上混淆。

**现状修复**：当前 `group-router.ts` 的 `groupValidationMiddleware` 不校验 validationKey。P2 改造为：组级启用 validation 时，`mcp-auth.ts` 强制走 validationKey 校验。这填补"配了不用"的缺口，是 breaking change（之前调 MCP 端点不需任何凭据，现在启用了 validation 的组需要）——在 RELEASE_NOTES 明确。

### §7 中间件挂载与路由

**`app.ts` 改造**：

```typescript
// 现有：app.route('/', groupMcpRouter); 改为
app.route('/', groupMcpRouter); // 不变，但 groupMcpRouter 内部加了 mcpAuthMiddleware

// 新增 OAuth 路由
app.route('/api/oauth', oauthApi); // token, jwks, introspect, revoke
app.route('/.well-known', wellKnownRoutes); // oauth-protected-resource, oauth-authorization-server
```

**`group-router.ts` 改造**：

```typescript
// 当前
groupMcpRouter.post('/:group/mcp', groupValidationMiddleware, async (c) => { ... });

// P2 改造：在 groupValidationMiddleware 之后、handler 之前插入 mcpAuthMiddleware
groupMcpRouter.post('/:group/mcp', groupValidationMiddleware, mcpAuthMiddleware, async (c) => { ... });
```

**注意**：`mcpAuthMiddleware` 在 group 存在校验通过后才跑（需要 groupId 上下文决定走哪个组的 validation 配置）。401 响应需绕过 `createMcpHandler` 的 JSON-RPC 包装，直接返回 HTTP 401（MCP 客户端按 HTTP status 识别授权挑战，不读 JSON-RPC error）。

### §8 错误处理与边界

**错误体系对齐**：复用现有 `McpHubCoreError` + `ErrorCode`。新增 OAuth 专用错误码：

```typescript
// packages/core/src/errors/ 扩展 ErrorCode 枚举
OAUTH_MISSING_TOKEN; // 缺 Authorization 头
OAUTH_INVALID_TOKEN; // 验签失败 / introspection inactive
OAUTH_TOKEN_EXPIRED; // exp 过期
OAUTH_INVALID_AUDIENCE; // aud 不含本 resource
OAUTH_INSUFFICIENT_SCOPE; // scope 不足
OAUTH_SERVER_ERROR; // 内置 AS 签发失败 / JWKS 拉取失败
OAUTH_CONFIG_ERROR; // OAuth 配置缺失或无效
```

**边界策略**：OAuth 库（如 `jose` 做 JWT 验签）抛的底层错误在 `token-validator.ts` 边界捕获，转成 `McpHubCoreError`，不泄漏库错误类型到上层。

**外部 IdP 不可达**：JWKS 拉取失败 / introspection 超时 → 返回 503（Service Unavailable）+ logger.error，不降级为放行（fail-closed）。重试由 jwks-cache 的 TTL + 主动刷新策略处理。

### §9 测试策略

**单元测试**：

| 模块                 | 测试重点                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `token-validator.ts` | JWT 验签（正确/错误密钥/过期/aud 不匹配/iss 不匹配）、opaque token 触发 introspection、introspection 缓存命中/失效 |
| `jwks-cache.ts`      | kid 索引、TTL 过期、未知 kid 触发刷新、拉取失败的 fail-closed                                                      |
| `internal-as.ts`     | client_credentials 签发（正确凭据/错误凭据/scope 校验/resource 参数写入 aud）、JWT claims 完整性                   |
| `resource-server.ts` | Protected Resource Metadata 字段正确性、401/403 响应头格式、scope 校验编排                                         |
| `mcp-auth.ts`        | OAuth 路径 vs validationKey 路径的分支、mode='both' 的 fallback、配置缺失的兜底                                    |
| `validation-key.ts`  | AES 解密 + 常量时间比较、错误 key 拒绝                                                                             |
| `as-metadata.ts`     | 外部 IdP metadata 发现与缓存、内置 AS metadata 生成、覆盖配置                                                      |

**集成测试**：

- 端到端授权流程：客户端无 token → 401 + WWW-Authenticate → 拉 metadata → 走内置 AS token 端点 → 拿 token → 调 MCP 端点成功。
- 外部 IdP mock：用 mock JWKS + introspection 端点验证外部对接路径。
- validationKey 端到端：启用 validation 的组，无 key → 401，正确 key → 放行。

**e2e 协议测试**（`backend/src/e2e/`，遵循 P1/P4 的 e2e 模式）：

| 用例                               | 验证点                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `oauth-discovery.test.ts`          | `/.well-known/oauth-protected-resource` 返回正确字段；401 响应的 `WWW-Authenticate` 格式符合 MCP 规范 |
| `oauth-client-credentials.test.ts` | 内置 AS 完整流程：token 端点签发 → MCP 端点用 token 访问成功；过期/无效 token 被拒                    |
| `oauth-audience.test.ts`           | RFC8707 audience 校验：token aud 不含本 resource → 401                                                |
| `oauth-external-idp.test.ts`       | 外部 IdP 对接：mock JWKS + introspection，JWT 本地验签路径 + opaque token introspection 回退路径      |
| `validation-key.test.ts`           | 组级 validationKey 在 MCP 端点强制（填补现状缺口的验证）                                              |

**测试基础设施**：复用 P1/P4 的 `TestContext`。新增 RSA 密钥对测试夹具（固定密钥，保证测试可复现）。外部 IdP 用 `msw` 或内嵌 mock Hono app。

### §10 Definition of Done

P2 完成的判据：

- `GET /.well-known/oauth-protected-resource` 返回符合 RFC9728 + MCP 规范的 metadata（`authorization_servers` 字段 MUST 存在）。
- 401 响应的 `WWW-Authenticate` 头格式符合 MCP 规范（`resource_metadata` + `scope`）。
- 内置 AS 的 `POST /api/oauth/token`（`client_credentials`）能签发 JWT，签发的 token 能通过 MCP 端点校验。
- JWT 本地验签覆盖：正确密钥/过期/aud/iss/scope 各路径有单测。
- introspection 回退路径有单测 + e2e（mock 外部 IdP）。
- 组级 validationKey 在 MCP 端点真正强制（`validation.enabled = true` 的组，无 key 被拒）。
- 外部 IdP 对接路径有 e2e（mock JWKS + introspection）。
- `pnpm typecheck` 通过。
- `pnpm test` 全绿（含新增 OAuth e2e）。
- 总体 spec `adoption-overview.md` 的 P2 行状态更新为"实现完成"，并修正 P1 状态滞后（P1 已合并 main）。
- 跨子项目共享待办表更新：`RedisCacheManager`（P2 的 introspection/JWKS 多实例缓存归属 P6）、validationKey 缺口、`simple-auth.ts`/`message-audit admin` 两条已过时条目的状态修正。
- RELEASE_NOTES 补 P2 的 breaking change（启用了 validation 的组现在强制校验）。

## 风险与缓解

| 风险                                                  | 缓解                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 内置 AS 密钥管理不当（默认密钥/泄露）                 | 未配置 `OAUTH_INTERNAL_PRIVATE_KEY` 时启动期生成临时密钥 + 强 warn；生产部署文档强调必须配置；私钥从不进 JWKs 端点             |
| introspection 回退引入 IdP 强依赖与性能瓶颈           | introspection 结果带 TTL 缓存（默认 60s）；IdP 不可达时 fail-closed（503）而非放行；多实例缓存共享留待 `RedisCacheManager`     |
| MCP 客户端兼容性（Claude Desktop 等对新规范的实现度） | e2e 用标准客户端 transport 验证；保留 validationKey 作为兼容兜底（非标准但简单可用）；跟踪客户端 changelog                     |
| validationKey 强制是 breaking change                  | RELEASE_NOTES 明确；升级指南说明如何关闭 validation 或迁移到 OAuth；默认 `oauth` 未配置时保持开放行为（仅 warn）以减小升级冲击 |
| 两套认证路径（OAuth + validationKey）语义混淆         | mode 配置明确控制路径启停；`both` 模式文档说明优先级；测试覆盖所有 mode 分支                                                   |
| OAuth 库选型（`jose` vs 手写）引入依赖与维护成本      | 倾向用 `jose`（成熟、维护活跃、TS 原生），实现时确认；如选其他库在 spec follow-up 记录                                         |
| JWKS 缓存与密钥轮换导致验签间歇失败                   | kid 索引 + 未知 kid 主动刷新；轮换时新旧密钥并存；轮换策略文档化                                                               |

## 实现修正（实现时发现的 spec 偏差）

> 实现过程中发现 spec 描述与实际不符之处，在此记录，避免读者按 spec 抄错。

1. **`pnpm typecheck` 脚本不存在**：§10 DoD 与多处提到 `pnpm typecheck`，但仓库根 `package.json` 无此脚本。实际用 `cd backend && pnpm exec tsc --noEmit`（或 `pnpm --filter <pkg> exec tsc --noEmit`）替代。

2. **构建顺序约束**：backend typecheck/test 前必须先 `pnpm --filter @mcp-core/mcp-hub-share build && pnpm --filter @mcp-core/mcp-hub-core build`。workspace symlink 解析 share/core 的 dist，若 dist 未同步（如 Task 1 新增错误码后未重建 core），会报"oauth does not exist"或"OAUTH\_\* 不存在"。

3. **`getAllConfig()` 返回结构**：§3/§5 假设 oauth 在顶层（`cfg.oauth`），实际 `getAllConfig()` 返回 `{ mcps, groups, system: { oauth, ... } }`——oauth 在 `cfg.system.oauth`。`group-router.ts` 的 `resourceServerGetConfig` 做了结构映射（`system.oauth` 提到顶层）。

4. **jose v6 API 偏差**（多处）：
   - `createRemoteJWKSet` 返回的 resolver 第一个参数是 `JWSHeaderParameters` 对象（含 `kid`/`alg`），不是 kid 字符串；且需 `alg` 字段（`getKtyFromAlg` 依赖），所以 `jwksCache.getKey` 内部调用时传 `{ kid, alg: 'RS256' }`。
   - jose v6 不再导出 `KeyLike` 类型，改用 `CryptoKey | Uint8Array`。
   - `createRemoteJWKSet` 校验 `res.status === 200`（不是 `res.ok`），测试 mock 需返回 `{ status: 200 }` 而非 `{ ok: true }`。
   - 版本：`jose ^6.2.4`。

5. **`crypto-keys.ts` PEM 加载方案**：§4 示例用 `importPKCS8` + `exportSPKIFromPKCS8`，实际 Node.js 的 `createPublicKey({type:'pkcs8'})` 不接受私钥 PEM。改用 `createPrivateKey(pem)` → `createPublicKey(privateKeyObj)` 派生公钥 → `exportJWK`。私钥直接以 KeyObject 传给 jose `SignJWT.sign()`，不转 Uint8Array。

6. **`token-validator.ts` introspection 回退收紧**：§5 流程描述"JWT 验签失败/opaque → introspection 回退"，实际收紧为：仅 `reason='invalid'`（signature/格式失败）才回退；`expired`/`audience`/`scope` 是针对已验签 JWT 的确定结论，introspection 同一 token 结论相同，不回退。

7. **`token-validator.ts` internal 模式验签**：§5 流程未明确 internal 模式如何验签。实现拆成 `verifyJwtWithJwks`（external/both 主路径）+ `verifyJwtWithInternalKeys`（internal 主路径、both 回退路径），后者用 `getInternalPublicKeySet` + `importJWK` 本地验签。

8. **`internal-as.ts` 错误捕获**：§2.4 暗示用 `instanceof AuthError` 捕获，实际 `issueClientCredentialsToken` 抛 `ServiceError`（不是 `AuthError` 子类）。`token.ts` 改用 `McpHubCoreError` 基类 + `err.code` 精确映射 OAuth error。`invalid_client` 状态码用 401（RFC6749 §5.2），不是 brief 早期草稿的 400。

9. **`mcp-auth.ts` origin 推导**：§7 示例 `resourceMetadataUrl` 用完整 URL，实际改为 `resourceMetadataUrlPath`（相对路径），中间件内用 `new URL(c.req.url).origin + path` 拼完整 URL，避免硬编码 host。

10. **`error_description` ASCII 限制**：HTTP 头是 ByteString，`buildInsufficientScopeHeader` 的 `error_description` 须为 ASCII。中间件层传英文 `'insufficient scope'`。`buildInsufficientScopeHeader` 本身对非 ASCII 未做百分号编码（已知 minor，当前调用方用 ASCII 规避）。

11. **Hono `ContentfulStatusCode`**：`c.json()`/`c.body()` 的 status 参数需字面量联合（如 `400 | 401 | 403 | 503`），不接受 `number`。

12. **e2e conditional skip 扩展**：§9 的 e2e skip 条件 `status === 404/503` 不够——open 模式下 MCP 裸 POST 会被协议层以 400 拒绝（到不了 auth 中间件），实际 skip 集合扩展为含 400/404/503。

## 审查 follow-up（代码审查发现，留待后续）

1. **PEM 加载路径无单测覆盖**（Task 4）：`crypto-keys.ts` 的 PEM 加载分支（`OAUTH_INTERNAL_PRIVATE_KEY` 已配置）只有 3 个测试覆盖"未配置→生成"主路径。配置了 PEM 的路径（`createPrivateKey` → `createPublicKey` → `exportJWK`）已就位但 CI 未验证。建议在补 oauth fixture 时用一个真实生成的 PKCS8 PEM 验证。

2. **`crypto-keys.ts` 首调用理论竞态**（Task 4）：`loadOrCreateSigningKey()` 非原子检查-设置，并发调用可能生成两份密钥。实际启动期单调用，无现实影响。如需严格幂等可改 cache promise 模式。

3. **`system.schema` 测试未断言默认值**（Task 2）：happy path 仅断言 `parse()` 不抛错，未验证 `scopes`/`tokenTtlSeconds`/`clients` 默认值生效。

4. **`as-metadata.ts` `buildInsufficientScopeHeader` 无专门单测**（Task 7）：测试只覆盖 `buildWwwAuthenticateHeader`。

5. **`resource-server.ts` both 模式回退分支无单测**（Task 10）：`oauth.mode === 'both'` + OAuth 失败 → validationKey 回退的分支代码已实现（resource-server.ts 约第 92-95 行）但 6 个用例未覆盖。

6. **e2e 在 open 模式下 conditional skip**（Task 14-16）：5 个 oauth/validation e2e 在当前测试环境（未配 oauth/validation）全部 conditional skip。补 oauth/validation fixture 后自动激活。这是 plan 允许的 MVP 取舍。

7. **`jwks-cache.ts` 头部注释与代码不一致**（Task 5）：注释说 `>` 但代码用 `>=`（cosmetic）。

8. **`internal-as.ts` 空 scope 语义**（Task 6）：请求 `scope` 缺省时授予 client 全部配置 scope（RFC6749 §3.3 允许），但 spec §2.4 未明确此语义。

9. **`introspection.ts` 生产实现**（最终审查 fix wave）：原 Task 8 只实现了 introspection 接口 + 缓存，生产侧 `introspectToken` 从未注入（只测试 mock）。最终全分支审查发现后补 `introspection.ts`（HTTP POST + Basic auth + fail-closed）+ resource-server 注入 + `mapIntrospection` audience 校验（去 `void aud`）。

10. **introspection cache LRU 上界**（最终审查 fix wave）：原 introspectionCache 无淘汰，长生命周期进程内存增长。加 `INTROSPECTION_CACHE_MAX_ENTRIES=1000` FIFO 淘汰（实际是 FIFO 非 LRU，对 60s TTL 小规模 cache 可接受）。

11. **`mcp-auth.ts` origin 推导统一**（最终审查 fix wave）：原用 `new URL(c.req.url).origin`，反代后可能指向内部地址。改用 Host 头 + `OAUTH_PUBLIC_SCHEME`（与 `well-known.ts` 一致）。

## 参考资料

- [MCP 2025-11-25 Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [RFC 9728 OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414 OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 8707 Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 7662 OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 9207 OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207)
- [OAuth Client ID Metadata Document (draft)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00)
- [WorkOS: MCP 2026 spec agent authentication](https://workos.com/blog/mcp-2026-spec-agent-authentication)
