# P3：出站 OAuth（AuthenticationStrategy）

- **状态**: 实现完成
- **日期**: 2026-07-27
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（总体跟踪，§P3）
  - `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md`（P2 入站 OAuth，错误码体系复用）

## 目的

让 Hub 作为**客户端**调用外部 OAuth 保护的 REST API（如 GitHub API、Google API）时，自动获取/刷新 token。把 `api-to-mcp` 子系统的 `AuthenticationStrategy` 里 OAuth 从"未注册 → 通用抛错"变成真实可用的 `OAuthStrategy`。

## 范围与边界

### 做什么

- 扩展 `AuthConfigSchema` 支持 `type: 'oauth'`（discriminated union 重构）。
- 实现 `OAuthStrategy implements AuthenticationStrategy`，支持 `client_credentials` + `refresh_token`。
- `AuthenticationStrategy` 接口 async 化（向后兼容）。
- token 存储复用现有 `CacheManager`（MVP 用 `MemoryCacheManager`）。

### 不做什么（边界）

| 问题                                                                           | 是否属 P3 | 说明                                                                                        |
| ------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| `api-to-mcp` 调外部 REST API 的 OAuth                                          | ✅ 是     | P3 核心                                                                                     |
| Hub 连外部 **MCP server** 的出站认证（`server_manager.ts` 只透传静态 headers） | ❌ 否     | 另一套代码路径（MCP client transport），已登记在 adoption-overview 跨子项目待办，待独立立项 |
| `authorization_code` grant（需用户交互/redirect/PKCE）                         | ❌ 否     | 本轮只做服务间场景，复杂度高且 api-to-mcp 场景少见                                          |
| 多实例 token 共享（Redis）                                                     | ❌ 否     | MVP 用 `MemoryCacheManager`，多实例待 P6 实现 `RedisCacheManager` 后接入                    |

### 对 adoption-overview spec 描述的修正

adoption-overview §P3 称"`authentication.ts:217` 有 oauth 抛错占位"——实际不准确。当前 `authentication.ts:216-217` 是 `AuthenticationManager.applyAuthentication` 在 type 未注册时的**通用**抛错（`不支持的认证类型: ${type}`），oauth 没注册就落到这里。单测 `authentication.unit.test.ts:499,533` 测的是这个通用路径。P3 不是"修占位"，是"新增真实策略 + 注册"。

## 关键决策（brainstorming 已确认）

| 决策              | 选择                                                                     | 理由                                                                                                          |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 接口 async 化     | 改 `applyAuth`/`validateConfig` 为 `Promise` 返回，现有 3 策略包 `async` | OAuth 需异步取 token；同步接口装不下。bearer/apikey/basic 逻辑不变，向后兼容                                  |
| grant types       | `client_credentials` + `refresh_token`                                   | 服务间最常用；refresh 是优化路径（AS 顺带返回就存，避免频繁打扰 token endpoint）                              |
| token 存储        | 复用现有 `CacheManager`（async 接口 `get/set(ttl)`）                     | MVP 用 `MemoryCacheManager`；多实例待 P6 Redis                                                                |
| 配置 schema       | `z.discriminatedUnion('type', [...])` 重构                               | 类型安全最好，TS 能按 type 收窄字段                                                                           |
| clientSecret 安全 | 支持 `{{env.VAR}}` + 绝不记日志/错误 context                             | 复用现有环境变量解析机制                                                                                      |
| HTTP 客户端       | **注入现有 `HttpClient`**                                                | HttpClient 本就是原生 fetch 封装（`http-client.ts:129`），复用超时/重试/日志；依赖图无环（HttpClient 是叶子） |
| 失败策略          | fail-fast 抛明确错误码                                                   | token 获取失败不静默吞；可配少量重试应对网络抖动                                                              |

## 设计

### §1 接口与依赖

#### 接口 async 化（`authentication.ts`）

```typescript
export interface AuthenticationStrategy {
  readonly name: string;
  applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig>;
  validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }>;
}
```

现有 `BearerTokenStrategy` / `ApiKeyStrategy` / `BasicAuthStrategy` 逻辑不变，方法体加 `async`（返回值自动成 Promise）。`AuthenticationManager.applyAuthentication` / `validateAuthConfig` 改 async，调用方加 `await`。

#### OAuthStrategy 依赖注入

```typescript
export class OAuthStrategy implements AuthenticationStrategy {
  readonly name = 'oauth';
  constructor(
    private readonly httpClient: HttpClient, // 复用原生 fetch 封装（超时/重试/日志）
    private readonly cache: CacheManager, // token 存储
  ) {}
}
```

#### 依赖图（证明无环）

```
api-executor ──→ AuthenticationManager ──→ OAuthStrategy ──→ HttpClient (叶子，原生 fetch)
                        │                        └──→ CacheManager (叶子)
                        └──→ Bearer/ApiKey/Basic
```

- `HttpClient` 是叶子节点（只依赖 logger），注入给 `OAuthStrategy` 无环。
- `HttpClient` 发请求不加认证头（认证是 `api-executor` 层手动调 `applyAuthentication` 加的），所以 `OAuthStrategy` 调 token endpoint **没有递归加认证的风险**。

#### AuthenticationManager 构造函数扩展

```typescript
constructor(deps?: { httpClient?: HttpClient; cache?: CacheManager }) {
  // 注册默认 3 策略
  this.registerStrategy(new BearerTokenStrategy());
  this.registerStrategy(new ApiKeyStrategy());
  this.registerStrategy(new BasicAuthStrategy());
  // 有依赖时注册 OAuth
  if (deps?.httpClient && deps?.cache) {
    this.registerStrategy(new OAuthStrategy(deps.httpClient, deps.cache));
  }
}
```

不传 deps 则不注册 OAuthStrategy（向后兼容现有 `new AuthenticationManager()` 调用）。

### §2 配置 Schema（discriminated union）

重构 `AuthConfigSchema`（`api-config.ts:56-62`）：

```typescript
export const AuthConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bearer'),
    token: z.string(),
    header: z.string().optional(),
  }),
  z.object({
    type: z.literal('apikey'),
    token: z.string(),
    header: z.string().optional(),
  }),
  z.object({
    type: z.literal('basic'),
    username: z.string(),
    password: z.string(),
  }),
  z.object({
    type: z.literal('oauth'),
    grantType: z.enum(['client_credentials', 'refresh_token']),
    clientId: z.string(),
    clientSecret: z.string(), // 支持 {{env.VAR}}
    tokenUrl: z.string().url(),
    scope: z.string().optional(),
    refreshToken: z.string().optional(), // 首次可能没有，靠 client_credentials 换
    headerName: z.string().optional(), // 默认 'Authorization'
    tokenPrefix: z.string().optional(), // 默认 'Bearer '
  }),
]);

export type OAuthAuthConfig = Extract<AuthConfig, { type: 'oauth' }>;
```

#### 字段设计说明

- `headerName` / `tokenPrefix` 可配置：有些 API 要 `X-Token` 而非 `Authorization: Bearer`，保留灵活性。
- `refreshToken` 可选：首次启动可能没有，`client_credentials` 换到后若 AS 顺带返回则缓存。
- `grantType` 包含 `refresh_token`：用于显式声明"这条配置主要靠 refresh 续期"的场景（refreshToken 必填）。

#### 向后兼容性波及

discriminated union 改变 `AuthConfig` 的 TS 类型（从平坦变联合）。所有 `config.token` / `config.username` / `config.password` 访问点需先收窄 `type`——现有 3 策略的 `validateConfig` 已按 type 分策略（天然满足），但 TS 需显式守卫。详见 §5。

#### 环境变量解析扩展

现有 `resolveEnvironmentVariables`（`authentication.ts:249`）只处理 token/username/password/header 四字段。扩展处理 oauth 的 `clientSecret` / `refreshToken` / `clientId`。日志绝不打印这些字段原文（现有代码已遵守，扩展时保持）。

### §3 OAuthStrategy 核心逻辑

#### applyAuth 流程

```
1. 解析 config 里的 {{env.*}}（clientSecret 等）
2. 计算 cacheKey = `oauth:token:${sha256(clientId|tokenUrl|scope|grantType)}`
3. cache.get(cacheKey) → 查缓存
   ├─ 命中且未过期（< expiresAt - EXPIRY_BUFFER_MS）→ 直接用 cached.accessToken
   ├─ 命中但将过期 + 有 refreshToken → 尝试 refresh
   └─ 未命中 / 已过期 / refresh 失败 → 走 client_credentials 取新 token
4. 把 accessToken 注入 request.headers[headerName] = tokenPrefix + accessToken
5. 返回 request
```

#### client_credentials 取 token（fetchToken）

```
POST {tokenUrl}
  Content-Type: application/x-www-form-urlencoded
  grant_type=client_credentials
  client_id=...
  client_secret=...(已解析 env)
  scope=...(可选)
→ 200: 解析 {access_token, expires_in, refresh_token?, token_type}
       写缓存: cache.set(cacheKey, {accessToken, expiresAt, refreshToken}, ttl=expires_in - buffer)
→ 非200/网络错: fail-fast 抛 OAUTH_OUTBOUND_TOKEN_FETCH_FAILED（6201）
```

#### refresh_token 续期（refreshToken）——优化路径，非必需

- `client_credentials` grant 通常每次都能直接换新 token，refresh_token 是"如果 AS 顺带返回了就存，避免频繁打扰 token endpoint"。
- 流程：`POST tokenUrl grant_type=refresh_token refresh_token=... client_id=...` → 成功则更新缓存、返回新 token；失败（400 invalid_grant 等）则**静默回退**到 `client_credentials` 重取（不抛错，因为 refresh 失败是正常的 token 过期场景）。
- **缓冲量**：`EXPIRY_BUFFER_MS = 60_000`，expiresAt 前 60 秒视为将过期，触发 refresh。

#### cacheKey 设计

`oauth:token:${sha256(clientId|tokenUrl|scope|grantType)}`。用 hash 是因为 clientSecret 不能进 key（即使 key 不进日志，hash 更安全）。scope 区分不同权限的 token。

#### 并发去重（待实现时评估）

同一 cacheKey 多个请求同时 miss 时，用 in-flight Promise 去重，避免 stampede。MVP 可先不做。实现时核查 `CacheManager` 是否已有锁机制；无则评估是否值得加。**不阻塞设计**，标记为 follow-up。

### §4 错误码

复用现有错误码体系（`packages/core/src/errors/index.ts`，P2 已加 6100-6106 入站）。P3 出站加独立段：

| 错误码 | 名称                                | 触发场景                                          | severity |
| ------ | ----------------------------------- | ------------------------------------------------- | -------- |
| 6200   | `OAUTH_OUTBOUND_CONFIG_INVALID`     | OAuth 配置校验失败（缺 clientId/tokenUrl 等）     | warn     |
| 6201   | `OAUTH_OUTBOUND_TOKEN_FETCH_FAILED` | token endpoint 返回非 2xx 或网络错                | error    |
| 6202   | `OAUTH_OUTBOUND_TOKEN_EXPIRED`      | 缓存无 token 且无法获取新 token（fail-fast 终态） | error    |
| 6203   | `OAUTH_OUTBOUND_ENV_VAR_MISSING`    | `{{env.*}}` 引用的环境变量未定义                  | warn     |

不设 httpStatus——这些是内部调用外部 API 时的错误，不直接暴露给 MCP 客户端；上游工具调用失败时由 `api-executor` 统一包装成 MCP 工具错误。错误对象带 `context: { clientId, tokenUrl, scope, statusCode, errorBody摘要 }`，**绝不带 clientSecret / refreshToken 原文**。

现有错误码映射表（`errors/index.ts` 的 message/severity/httpStatus 三张表）各加 4 行，沿用 P2 模式。

### §5 调用链改造波及面

#### 必改（async 化）

| 文件                     | 改动                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `authentication.ts`      | `AuthenticationStrategy` 接口 + 3 策略方法体加 `async` + `AuthenticationManager.applyAuthentication/validateAuthConfig` 加 `async` |
| `api-executor.ts`        | L123 `request = this.applyAuthentication(...)` → `request = await this.applyAuthentication(...)`；L209 方法签名加 `async`          |
| `cached-api-executor.ts` | L178 包装方法加 `async`（已转发，无逻辑改动）                                                                                      |

#### 需核查的字段访问点（discriminated union 改了类型形态）

| 文件                                                     | 访问点                              | 处理                                                                               |
| -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `authentication.ts` `BearerTokenStrategy.validateConfig` | `config.token`                      | 加 `if (config.type === 'bearer')` 守卫（现有逻辑已按 type 分策略，TS 需显式收窄） |
| `ApiKeyStrategy` / `BasicAuthStrategy`                   | 类似                                | 同上                                                                               |
| `resolveEnvironmentVariables`                            | 遍历 token/username/password/header | 改成按 type 分支处理对应字段（oauth 加 clientSecret/refreshToken/clientId）        |
| `validateEnvironmentVariables`                           | 同上                                | 同步改                                                                             |

#### 新增

| 文件                                                               | 内容                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `oauth-strategy.ts`（新建，独立文件避免 `authentication.ts` 膨胀） | `OAuthStrategy` 类                                  |
| `authentication.ts`                                                | re-export `OAuthStrategy`                           |
| `api-config.ts`                                                    | discriminated union schema + 导出 `OAuthAuthConfig` |
| `errors/index.ts`                                                  | 6200-6203                                           |
| `AuthenticationManager` 构造函数                                   | 接收可选 `{ httpClient?, cache? }`                  |

#### new AuthenticationManager() 调用点

`api-to-mcp-service-manager.ts:140,475` 改成传 `{ httpClient, cache }`（这两个在 service-manager 里已 new 好，顺手注入）。

#### 文件组织决策

`OAuthStrategy` 逻辑量较大（fetchToken/refresh/cacheKey/env 解析），为避免 `authentication.ts` 膨胀（现 345 行），拆成独立文件 `oauth-strategy.ts`，`authentication.ts` re-export。

### §6 测试策略

#### 单测（重点，覆盖率高）

**`oauth-strategy.unit.test.ts`（新增）：**

- `fetchToken` 成功 → 缓存命中 → 注入正确 header（含自定义 `headerName`/`tokenPrefix`）
- `fetchToken` 失败（4xx/5xx/网络错）→ 抛 6201 + 错误 context 不含 secret
- refresh_token 续期成功 → 缓存更新
- refresh_token 失败（invalid_grant）→ 静默回退 client_credentials
- 缓存将过期（<60s）→ 触发 refresh
- `validateConfig`：缺字段 / grantType 非法 / tokenUrl 非 URL → 6200
- env 解析：`{{env.VAR}}` 未定义 → 6203
- clientSecret 绝不出现在日志/错误 context（断言）

**`authentication.unit.test.ts`（改造现有）：**

- L499/533 的 oauth 测试从"期望抛错"改成"期望成功"（type 注册了）
- 现有 bearer/apikey/basic 测试加 `await`（async 化），逻辑不变
- 加"OAuthStrategy 在 manager 未注入 httpClient 时不注册"的边界测试

#### e2e（参考 P2/P4 模式）

**`oauth-outbound.test.ts`（新增）：** mock 一个 OAuth AS（token endpoint + 受保护资源），配置一个 api-to-mcp 工具用 oauth 认证，调工具 → 验证 token 自动获取 + 注入 + 缓存命中（第二次调用不再打 token endpoint）。

由于要 mock 外部 AS，实现时考虑用 `msw` 或 test-app 内嵌假 AS（P2 e2e 已有内嵌假 AS 经验可复用）。

**降级策略**：如果 e2e 环境搭起来成本高，至少单测覆盖 `fetchToken`/`refresh`/`cacheKey`/`env` 全路径，e2e 用 conditional skip（沿用 P2 模式，登记为 follow-up）。**先单测做扎实，e2e 尽量做但允许降级。**

#### 门禁

`pnpm check:ci` + `pnpm test` 全绿（沿用项目门禁，不引 `typecheck` 脚本——adoption-overview 已确认它不存在）。

## DoD（完成定义）

- `AuthConfigSchema` 重构为 discriminated union，含 oauth 分支，类型检查通过。
- `OAuthStrategy` 实现，支持 client_credentials + refresh_token，注入 HttpClient + CacheManager。
- `AuthenticationStrategy` 接口 async 化，现有 3 策略向后兼容，调用链全 async。
- 错误码 6200-6203 定义并接入。
- 单测覆盖 oauth-strategy 全路径 + 现有策略 async 化回归。
- e2e `oauth-outbound.test.ts` 存在（实际跑或 conditional skip 均可，登记状态）。
- `pnpm check:ci` + `pnpm test` 全绿。

## 风险与缓解

| 风险                                               | 缓解                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| async 化波及面超出预期（隐藏的同步调用点）         | TDD 逐文件改造，每步跑测试；TS 会强制把遗漏的 await 暴露出来                                                          |
| discriminated union 改变类型形态，破坏现有配置文件 | 现有 bearer/apikey/basic 配置字段不变，只是 schema 结构从平坦变 union，运行时解析兼容；核查所有 `config.token` 访问点 |
| clientSecret 泄漏到日志/错误                       | 单测断言"clientSecret 绝不出现在日志/错误 context"；错误对象只带 clientId/tokenUrl/scope/statusCode                   |
| e2e mock 外部 AS 成本高                            | 降级策略：单测优先，e2e 允许 conditional skip                                                                         |
| token stampede（并发 miss）                        | 标记为 follow-up；MVP 不做并发去重，CacheManager 若有锁则用                                                           |

## 待实现时评估的 follow-up

- 并发去重（in-flight Promise）是否值得加。
- e2e mock AS 用 msw 还是内嵌假 AS。
- `RedisCacheManager` 接入（依赖 P6 实现）。

## 实现修正 / follow-up（2026-07-27 收尾）

P3 八个实现 task 已完成（commits `8d953de`..`5194ed2`），门禁全绿（`pnpm check:ci` 0 warnings/errors，`pnpm test` 1783 passed | 2 skipped，core + backend `tsc --noEmit` 0 errors）。记录实现期间产生的 follow-up：

- **e2e conditional skip（待 fixture 激活）**：`backend` e2e 骨架 `oauth-outbound.test.ts` 已落地，但按 P2 模式做了 conditional skip——环境未配置内嵌假 AS / msw fixture 时默认跳过（运行时确认 1 test | 1 skipped）。单测 `oauth-strategy.unit.test.ts` 已覆盖 `fetchToken`/`refresh`/`cacheKey`/`env` 全路径。激活 e2e 需补 mock AS fixture，登记为 follow-up，不阻塞 P3 DoD（设计 §6 已允许 e2e 降级为 conditional skip）。
- **并发去重（stampede 防护）未实现**：`OAuthStrategy` 当前不做 in-flight Promise 去重，同一 cacheKey 并发 miss 会各自打 token endpoint。设计 §3 已标记为 follow-up，MVP 不做。后续评估 `CacheManager` 是否提供锁机制，再决定是否加单飞去重。
- **`RedisCacheManager` 接入待 P6**：当前 token 缓存用 `MemoryCacheManager`（单实例）。多实例部署下 token 不共享，需 P6 实现 `RedisCacheManager` 后接入。已登记在 adoption-overview 跨子项目共享待办。
- **6202（OAUTH_OUTBOUND_TOKEN_EXPIRED）当前由 6201 覆盖语义，未独立抛出**：spec §4 原将 6202 定义为"缓存无 token 且无法获取新 token（fail-fast 终态）"，但在当前实现里这一终态实际由 6201（`fetchToken` 失败：token endpoint 非 2xx 或响应缺 `access_token`）覆盖——没有独立的"终态"分支可挂 6202。强行接入会造一个无意义的分支。待后续若需区分"endpoint 拒绝（token 过期/无效，可重试）"与"无法获取终态（凭证失效，不可重试）"时再接入 6202。错误码定义、消息表、severity、HTTP 映射保留，不删除。
