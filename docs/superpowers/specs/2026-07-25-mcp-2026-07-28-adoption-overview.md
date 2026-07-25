# 总体跟踪 Spec：跟进 MCP 2026-07-28 协议演进

- **状态**: Draft（跟踪用）
- **日期**: 2026-07-25
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-11-project-audit-report.md`（产品/架构审计）
  - `docs/superpowers/specs/2026-07-25-p1-transport-upgrade-design.md`（P1 详细设计）

## 目的

本 spec 是"全量跟进 MCP 2026-07-28 协议演进"这一迭代的**总体跟踪文档**。它记录：

1. 已确认的全景决策（适用于所有子项目）。
2. P1-P6 六个子项目的范围、依赖、状态。
3. 每个子项目的设计大纲（够启动、够跟踪，但不强求 P1 那种逐节深度——深度设计在轮到具体子项目时通过 brainstorming 产出独立 spec）。

**使用方式**：每个子项目启动时，基于本 spec 的对应章节发起 brainstorming，产出独立 spec，然后回这里更新状态和链接。

## 全景决策（brainstorming 已确认）

| 决策 | 选择 | 理由 |
|---|---|---|
| 迭代主线 | 全量跟进 MCP 2026-07-28，分解为 P1-P6 分阶段交付 | 一次性做会失控；分解后每个子项目可独立 spec/计划/实现 |
| 总体兼容性策略 | 激进升级，只支持新协议（入站方向） | 项目 0.0.1，趁早切干净 |
| 出站方向策略 | 保留兼容（`auto` 模式 + 保留 SSE 连接） | 外部 server 生态参差不齐，网关价值在于能连各种 server |
| OAuth 范围 | 不自建完整 IAM；入站做 Protected Resource，出站接 `AuthenticationStrategy`，Web 登录可接 OIDC | 审计报告建议接 Keycloak/Entra/OIDC，不自造 |
| 社交登录 | 纳入考虑（属 Web UI 范畴，与 MCP 协议解耦） | 偏用户体验 |

## 子项目全景

| # | 子项目 | 状态 | 详细 spec |
|---|---|---|---|
| **P1** | 传输层升级到 2026-07-28 无状态 | ✅ spec 完成 | `2026-07-25-p1-transport-upgrade-design.md` |
| P2 | 入站 OAuth 2.1（Protected Resource） | ⏳ 待 brainstorming | — |
| P3 | 出站 OAuth（AuthenticationStrategy） | ⏳ 待 brainstorming | — |
| P4 | `ttlMs`/`cacheScope` 缓存语义 | ⏳ 待 brainstorming | — |
| P5 | `subscriptions/listen` + MRTR | ⏳ 推迟（观望客户端生态） | — |
| P6 | OTel trace context + 弃用项清理 | ⏳ 待 brainstorming | — |

**推荐主线顺序**：P1 → P4 → P2 → P3 → P6 → P5

### 依赖关系

```
P1（传输层）────────┬──→ P2（入站 OAuth）
                   ├──→ P4（缓存语义，弱依赖：结果字段）
                   ├──→ P5（subscriptions/listen，强依赖）
                   └──→ P6（OTel/弃用清理，无依赖可穿插）

P3（出站 OAuth）──── 无依赖，可独立做
```

- P1 是地基，解锁 P2/P4/P5。
- P3 与 P1 解耦（改的是 `api-to-mcp` 子系统，不碰传输层），可独立做。
- P6 无依赖，任何时候可穿插。

---

## P2: 入站 OAuth 2.1（Protected Resource）

- **状态**: 待 brainstorming
- **复杂度**: 高
- **依赖**: 弱依赖 P1（token 校验走无状态，复用 P1 的无状态传输）
- **价值**: ⭐⭐⭐ 安全达标，审计报告"必须"项

### 范围

让 Hub 作为 MCP **OAuth 2.1 Protected Resource**（RFC9728），对 MCP 客户端（Claude Desktop 等）做授权。对齐 MCP `2025-11-25` Authorization 规范 + `2026-07-28` 加固。

### 设计大纲

**需实现的端点/能力**（基于 MCP Authorization 规范）：

1. **Protected Resource Metadata**（RFC9728）：
   - `/.well-known/oauth-protected-resource`（或按组路径 `/.well-known/oauth-protected-resource/:group/mcp`）。
   - 401 响应带 `WWW-Authenticate: Bearer resource_metadata="...", scope="..."`。

2. **Token 校验中间件**（入站）：
   - 校验 `Authorization: Bearer <token>`。
   - 验证 audience（RFC8707 `resource` 参数绑定，防止 token 跨服务误用）。
   - 无状态校验（JWT 验签，不依赖服务端 session）—— 与 P1 的无状态方向一致。
   - 挂在 Hono 中间件链，保护 `/:group/mcp` 端点。

3. **Authorization Server 对接**（不自建完整 AS）：
   - Hub 作为 Resource Server，对接外部 AS（Keycloak/Entra/Auth0/OIDC Provider）。
   - 支持 RFC8414 Authorization Server Metadata 发现。
   - **可选**：Hub 内置一个最小 AS（仅 client_credentials + 本地用户库），给无外部 IdP 的小团队用。需 brainstorming 决定是否做。

4. **Client ID Metadata Documents 支持**（draft-ietf-oauth-client-id-metadata-document-00）：
   - AS 侧拉取客户端 metadata URL，**防 SSRF**（限制内网地址、超时、缓存）。
   - 2026-07-28 已弃用 DCR（RFC7591）为备选，优先用 Client ID Metadata Documents。

5. **PKCE 强制**（S256）+ `iss` 参数校验（RFC9207，防 mix-up）。

### 关键决策点（待 brainstorming）

- 内置最小 AS vs 纯对接外部 IdP？
- token 存储用 JWT（无状态）还是 opaque + introspection？
- 是否保留现有组级 `validationKey`（AES 共享密钥）作为 OAuth 之外的轻量 API key 方案？
- 顺带修复 `simple-auth.ts` 假认证（任何非空 token 放行）和 `message-audit-service.ts` 用户归因硬编码 `'admin'`。

### 现有挂载点

- `backend/src/middleware/auth.ts`：当前 JWT 校验中间件（Web UI 登录用），需新增独立的 MCP OAuth 中间件。
- `backend/src/api/groups/crypto.ts` + `key-policy.ts`：现有组级 `validationKey`，决策保留或演进。

---

## P3: 出站 OAuth（AuthenticationStrategy）

- **状态**: 待 brainstorming
- **复杂度**: 中
- **依赖**: 无（改 `api-to-mcp` 子系统，不碰传输层）
- **价值**: ⭐⭐ 扩展 REST API 工具的接入面

### 范围

让 Hub 作为**客户端**调用外部 OAuth 保护的 REST API（如 GitHub API、Google API）时，自动获取/刷新 token。把当前 `AuthenticationStrategy` 里 `type: 'oauth'` 的**抛错占位**改成真实实现。

### 设计大纲

1. **扩展 `AuthConfig` 类型**（`packages/core/src/api-to-mcp/types/api-config.ts:56-62`）：
   - `type` enum 加 `'oauth'`。
   - 新增字段：`clientId`、`clientSecret`、`tokenUrl`、`authUrl`、`redirectUri`、`scope`、`grantType`。

2. **实现 `OAuthStrategy implements AuthenticationStrategy`**（`packages/core/src/api-to-mcp/services/authentication.ts`）：
   - `applyAuth`：附 token 到请求；token 过期时自动用 refresh_token 刷新。
   - `validateConfig`：校验 OAuth 配置完整性。
   - 在 `AuthenticationManager` 构造时注册（当前 L182-184 注册了 bearer/apikey/basic，加 oauth）。

3. **Token 存储**：
   - 内存缓存 token + 过期时间（复用现有 `CacheManager`？或独立轻量存储）。
   - 多实例部署需共享 → 接 `RedisCacheManager`（当前是 no-op，需先实现，或 P3 范围内只做单实例）。

4. **支持的 grant types**（brainstorming 决定范围）：
   - `client_credentials`（服务间，最常用，MVP）。
   - `authorization_code`（需用户交互，复杂）。
   - `refresh_token`（token 刷新）。

### 关键决策点（待 brainstorming）

- MVP 只做 `client_credentials` + `refresh_token`，还是连 `authorization_code`？
- token 存储用现有 `CacheManager` 还是独立？
- 是否依赖 P6 的 OTel 给 token 刷新加追踪？

### 现有挂载点

- `AuthenticationStrategy` 接口（`authentication.ts:16-25`）+ `AuthenticationManager`（L192 `registerStrategy`）。
- `oauth` 抛错占位（`authentication.ts:217`，测试 `authentication.unit.test.ts:499,533`）。

---

## P4: `ttlMs`/`cacheScope` 缓存语义

- **状态**: 待 brainstorming
- **复杂度**: 中
- **依赖**: 弱依赖 P1（结果是 MCP 响应字段，需 P1 的新 SDK）
- **价值**: ⭐⭐⭐ 网关天然差异化

### 范围

采纳 MCP `2026-07-28` 的 `CacheableResult`（SEP-2549），在 `tools/list`、`resources/list`、`resources/read` 等结果的 `ttlMs`/`cacheScope` 字段上提供有意义的缓存提示，并利用 Hub 作为网关的位置优势做**响应缓存层**。

### 重要区分：两层缓存

项目已有缓存，但那是**工具调用结果缓存**（API→MCP 工具调外部 REST API 的响应）。P4 是**协议级缓存语义**（MCP `list`/`read` 结果给客户端的缓存提示）。两者不同层面：

| 层面 | 位置 | 用途 |
|---|---|---|
| 已有：工具调用结果缓存 | `packages/core/src/api-to-mcp/services/cache-manager.ts` | Hub 调外部 REST API 后缓存响应，减少外部调用 |
| P4：协议级缓存语义 | MCP 响应的 `ttlMs`/`cacheScope` 字段 | 告诉 MCP 客户端（如 Claude Desktop）这份 `tools/list` 结果可缓存多久 |

P4 **不是替换**已有缓存，而是**新增协议层缓存提示**，并探索两者协同（如协议层 `ttlMs` 可参考工具层缓存的剩余有效期）。

### 设计大纲

1. **设置 `cacheHints`**（v2 SDK 方式）：
   - `ServerOptions.cacheHints`：全局默认。
   - `registerResource` 的 `cacheHint`：按资源配置。
   - `tools/list` 结果：根据工具集稳定性给合理 `ttlMs`（工具集稳定时可给较长 ttl，提升客户端 prompt cache 命中率）。

2. **网关差异化**：
   - Hub 聚合多个 server，`tools/list` 的 `ttlMs` 可取**所有上游 server 工具列表的最小稳定性**。
   - 配置驱动的 `cacheScope`（public/private）。

3. **与现有 `CacheManager` 协同**：
   - 工具调用结果缓存的剩余 ttl 可作为协议层 `ttlMs` 的输入。

### 关键决策点（待 brainstorming）

- `tools/list` 的 `ttlMs` 默认值？（工具集通常稳定，可较长；但配置变更时需失效）
- 是否实现 `RedisCacheManager`（当前 no-op）以支持多实例缓存共享？
- `cacheScope` 默认 public 还是 private？

### 现有挂载点

- `CacheManager` 接口（`cache-manager.ts`：`get/set(ttl)/getStats/setStrategy`），`MemoryCacheManager` 可用。
- `RedisCacheManager`（L338-377）是 no-op 占位，多实例场景需先实现。

---

## P5: `subscriptions/listen` + MRTR

- **状态**: **推迟**（观望客户端生态）
- **复杂度**: 中高
- **依赖**: 强依赖 P1
- **价值**: ⭐（客户端侧支持还弱，网关先做意义不大）

### 推迟理由

`subscriptions/listen` 和 MRTR（Multi Round-Trip Requests）是 `2026-07-28` 的新能力，但：
- 主流 MCP 客户端（Claude Desktop 等）对这两项的支持还在早期。
- 网关先于客户端实现，价值无法兑现。
- 建议等客户端生态跟进后再启动。

### 范围（未来启动时）

1. **`subscriptions/listen`**：
   - 用 `createMcpHandler` 返回的 `.notify.{toolsChanged, promptsChanged, resourcesChanged, resourceUpdated(uri)}` 总线。
   - 替代旧的 `resources/subscribe`/`resources/unsubscribe` + HTTP GET 端点。
   - Hub 聚合多个上游 server 的变更通知，转发给客户端。

2. **MRTR（`InputRequiredResult`）**：
   - 工具 handler 返回 `inputRequired(...)`。
   - 需要 `ServerOptions.requestState.verify` codec 管理 server-minted 状态句柄。
   - 替代旧的 `elicitation/create`、`sampling/createMessage`、`roots/list` 等服务端发起请求。

### 关键决策点（未来 brainstorming）

- 网关如何聚合多个上游 server 的 listChanged 通知？
- MRTR 的 `requestState` 在无状态网关里怎么管理（不能存内存 session）？

### 现状

- 项目零实现 `subscriptions/listen`/MRTR（命中的 `subscriptions` 都是 Dashboard 业务 SSE，无关）。

---

## P6: OTel trace context + 弃用项清理

- **状态**: 待 brainstorming
- **复杂度**: 低
- **依赖**: 无（可穿插）
- **价值**: ⭐ 可观测性 + 代码债清理

### 范围

1. **OTel trace context 传播**（SEP-414）：
   - `_meta` 里 `traceparent`/`tracestate`/`baggage` 的读写约定。
   - Hub 作为网关，从客户端请求提取 trace context，传播到上游 server 调用（分布式追踪）。

2. **弃用项清理**（2026-07-28 Deprecation）：
   - **Roots/Sampling/Logging**：项目当前零实现（已验证 grep 无命中），**直接不采用**，无需清理。
   - **HTTP+SSE 传输**：P1 已处理（删除 `/sse` 端点）。
   - **`includeContext` 的 `thisServer`/`allServers`**：检查是否使用，未用则忽略。
   - **DCR（RFC7591）**：P2 入站 OAuth 时优先用 Client ID Metadata Documents，不采用 DCR。

3. **日志统一**（顺带）：
   - 审计报告指出 25+ 处生产代码绕过统一 Logger 走 `console.*`（当前分支正在修）。
   - 弃用 Logging 特性后，日志统一走 stderr + OTel。

### 关键决策点（待 brainstorming）

- OTel 接入到什么程度？只做 trace context 传播，还是接完整 OTel SDK 导出？
- 是否在本子项目实现 `RedisCacheManager`（支撑 P3/P4 多实例）？

### 现状

- OTel：零接入。
- Roots/Sampling/Logging：零实现（干净）。

---

## 跟踪机制

- 每个子项目完成后，回本 spec 更新"状态"列和"详细 spec"链接。
- 主线顺序（P1 → P4 → P2 → P3 → P6 → P5）是推荐，可根据实际情况调整。
- P5 推迟期间，定期检查客户端生态对 `subscriptions/listen`/MRTR 的支持进度。

## 风险与缓解（全局）

| 风险 | 缓解 |
|---|---|
| SDK v2 还在 beta，可能有 breaking change | 跟踪 GA；版本用 codemod 输出而非手钉 |
| 子项目间隐性依赖未识别 | 每个子项目 brainstorming 时复查与本 spec 的依赖声明 |
| 激进升级导致与主流客户端不兼容 | P1 验证 Claude Desktop 等对新协议的支持情况；必要时回退某项决策 |
| 范围蔓延（子项目越做越大） | 每个子项目独立 spec，严格按 spec 范围控制 |

## 参考资料

- [MCP 2026-07-28 Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
- [MCP Draft Changelog](https://modelcontextprotocol.io/specification/draft/changelog)
- [MCP 2025-11-25 Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [SDK v1→v2 Migration Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md)
- [Adopting 2026-07-28 Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md)
- [WorkOS: MCP 2026 spec agent authentication](https://workos.com/blog/mcp-2026-spec-agent-authentication)
