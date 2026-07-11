# MCP Hub 项目审计报告

> **审计日期**：2026-07-11
> **审计版本**：0.0.1（main 分支，commit `ba85737`，工作区另有 16 个文件未提交）
> **审计维度**：架构与代码质量、产品与迭代方向
> **审计方法**：静态代码分析 + 依赖关系梳理 + MCP 生态竞品调研

---

## 目录

- [第一部分：架构与代码质量](#第一部分架构与代码质量)
  - [1.1 执行摘要](#11-执行摘要)
  - [1.2 问题分级矩阵](#12-问题分级矩阵)
  - [1.3 P0：groups/index.ts 职责失控（2378 行）](#13-p0groupsindexts-职责失控2378-行)
  - [1.4 P0：错误体系三轨并存](#14-p0错误体系三轨并存)
  - [1.5 P0：McpServiceManager 四重实例化](#15-p0mcpservicemanager-四重实例化)
  - [1.6 P0：logger 被系统性绕过](#16-p0logger-被系统性绕过)
  - [1.7 P1：功能占位与安全隐患](#17-p1功能占位与安全隐患)
  - [1.8 P1：类型双轨与 71 处不安全断言](#18-p1类型双轨与-71-处不安全断言)
  - [1.9 P2：仓库卫生与工具链](#19-p2仓库卫生与工具链)
  - [1.10 正面亮点](#110-正面亮点)
- [第二部分：产品与迭代方向](#第二部分产品与迭代方向)
  - [2.1 市场现状：赛道已是红海](#21-市场现状赛道已是红海)
  - [2.2 命名冲突：存在同名直接竞品](#22-命名冲突存在同名直接竞品)
  - [2.3 协议演进：2026-07-28-RC 带来颠覆性变化](#23-协议演进2026-07-28-rc-带来颠覆性变化)
  - [2.4 差异化机会](#24-差异化机会)
  - [2.5 功能占位与迭代建议](#25-功能占位与迭代建议)
- [第三部分：优先级行动清单](#第三部分优先级行动清单)
- [附录](#附录)

---

## 第一部分：架构与代码质量

### 1.1 执行摘要

MCP Hub 是一个 MCP 服务器聚合网关（monorepo：share / core / cli / backend / frontend），当前版本 0.0.1，处于正式发布前的打磨阶段。最近的 5 个 refactor commit 方向正确——拆分上帝类、统一错误、消除 `any`、隔离 legacy 层——已经解决了最难的结构性问题。

**但当前仍存在 4 个 P0 级别的架构债务**，它们共同指向同一个根因：**"service → API 边界"的抽象不完整**。重构把 service 层拆好了，但 API 层（尤其是 `groups/index.ts`）和跨层协作（错误传播、服务实例化、日志）还停留在重构前的状态。

代码质量基本面良好：`any` 仅剩 2 处、oxlint 0 warnings、测试文件 97 个、测试分层规范。问题集中在"最后一步的收尾"。

### 1.2 问题分级矩阵

| 级别 | 问题 | 影响范围 | 工作量估算 |
|------|------|----------|------------|
| **P0** | `groups/index.ts` 2378 行，加密/密钥策略/校验/路由混合，含硬编码弱密钥 | 安全 + 可维护性 | 2-3 天 |
| **P0** | 错误体系三轨并存，73 处裸 `Error` 导致分类信息全丢失 | 全局可观测性 | 3-5 天 |
| **P0** | `McpServiceManager` 4 处模块级 `new`，请求路径内重建实例 | 性能 + 一致性 | 1-2 天 |
| **P0** | 25+ 处 `console.error/log` 绕过统一 logger | 可观测性 | 1 天 |
| **P1** | `simple-auth.ts` JWT 完全未实现，任何 Bearer token 放行 | 安全 | 1-2 天 |
| **P1** | `RedisCacheManager` 纯占位，接入 Redis 后缓存为 no-op | 性能 | 2-3 天 |
| **P1** | 统计数据硬编码占位（`successRate: 100`） | 数据可信度 | 2-3 天 |
| **P1** | share ↔ core 配置类型双轨，71 处 `as unknown as` 断言 | 类型安全 | 3-5 天 |
| **P1** | 硬编码 `'admin'` 用户名（审计日志失真） | 审计合规 | 0.5 天 |
| **P2** | 本地领先 origin 10 commit 未推送 | 发布流程 | 即时 |
| **P2** | CI pnpm 9 vs packageManager 10.6.4 不一致 | CI 可靠性 | 即时 |
| **P2** | `config/` 根目录占位空文件、`temp-test/` 空目录 | 仓库卫生 | 即时 |

---

### 1.3 P0：`groups/index.ts` 职责失控（2378 行）

**文件**：`backend/src/api/groups/index.ts` — 全项目最大的单一文件。

这一个文件混合了 **5 类完全不同的关注点**，共承载 17 个 HTTP 端点 + 8 个辅助函数：

| 关注点 | 行号范围 | 函数/端点 |
|--------|----------|-----------|
| HTTP 路由（17 个端点） | L96–2363 | `GET /` `GET /:groupId` `POST /` `PUT /:groupId` `DELETE /:groupId` 等 |
| **AES-256-CBC 加密** | L702–745 | `encryptValidationKey` `decryptValidationKey` |
| **密钥安全策略** | L750–860 | `generateValidationKey` `assessKeyComplexity` `calculateEntropy` `generateSecurityRecommendations` |
| 校验逻辑 | L863–982 | `validateKeyFormat` `validateGroupData` `validateGroupId` `estimateToolComplexity` |
| 模块级单例管理 | L65–90 | `coreServiceManager` 惰性初始化 |

**安全红旗**：加密密钥有硬编码默认值（`groups/index.ts:705`）：

```typescript
process.env.VALIDATION_KEY_SECRET || 'mcp-hub-default-secret-key'
```

如果部署时未设置环境变量，所有组的校验密钥都用同一个公开的弱密钥加密——这在安全审查中是一票否决项。

**建议拆分**：

```
backend/src/api/groups/
├── index.ts              ← 仅路由注册（~400 行）
├── crypto.ts             ← encryptValidationKey / decryptValidationKey / generateValidationKey
├── key-policy.ts         ← assessKeyComplexity / calculateEntropy / generateSecurityRecommendations
├── validation.ts         ← validateKeyFormat / validateGroupData / validateGroupId / estimateToolComplexity
└── service-handler.ts    ← 业务逻辑（当前路由 handler 内联的逻辑提取）
```

加密模块移出后，应同时修复弱密钥问题：**移除默认值，启动时检查 `VALIDATION_KEY_SECRET` 是否已设置，未设置则拒绝启动**（fail-fast）。

---

### 1.4 P0：错误体系三轨并存

这是当前最显著的架构裂缝。项目同时存在三套互不贯通的错误处理方式：

**轨道 A — core 包结构化错误**（`packages/core/src/errors/index.ts`，673 行）：
- `McpHubCoreError` 基类 + 6 个子类
- `ErrorCode` 枚举（数字编码，分 5 段 1000–6999）
- `ErrorCategory` / `ErrorSeverity` / 中文消息映射
- `UnifiedErrorHandler.formatErrorResponse()` 统一格式化

**轨道 B — backend service 错误**（`mcp_hub_service.ts:14–52`）：
- 独立的 `McpHubError` + 4 个子类
- 用字符串 `code`（`'TOOL_NOT_FOUND'`、`'GROUP_NOT_FOUND'`）
- 与轨道 A 的数字 `ErrorCode`（如 `3004`）完全无关

**轨道 C — 裸 `Error`**（API 层主流）：
- 全项目生产代码 **73 处** `throw new Error(...)`
- `errorResponse()` 统一调用 `formatErrorResponse()`，但传入的几乎都是裸 `Error`

**后果**：裸 `Error` 经 `formatErrorResponse()`（`errors/index.ts:562–576`）一律落入兜底分支——code 恒为 `UNKNOWN_ERROR`、category 恒为 `SYSTEM`、severity 恒为 `HIGH`、HTTP 状态恒为 `500`。**错误分类信息在跨越 service → API 边界时完全丢失**，前端无法根据 code 做差异化提示，监控无法按 category 聚合。

裸 `Error` 分布热点：

| 文件 | 数量 |
|------|------|
| `services/auth.ts` | 16 |
| `services/api-to-mcp-web-service.ts` | 12 |
| `api/groups/index.ts` | 9 |
| `services/server_manager.ts` | 7 |
| `services/mcp_service.ts` | 6 |
| `utils/sse.ts` | 5 |
| `services/config_service.ts` | 4 |
| 其余 | 14 |

**建议**：

1. **废弃轨道 B**：将 `mcp_hub_service.ts:14–52` 的 5 个错误类标记 `@deprecated`，逐步替换为 core 包的对等类（`ToolNotFoundError` → `ToolExecutionError`，`GroupNotFoundError` → `ServiceError` 等）。
2. **建立 HTTP 状态映射**：在 `errors/index.ts` 中为每个 `ErrorCode` 添加 `httpStatus` 字段，让 `errorResponse()` 能根据错误类型返回正确的 HTTP 状态（404 vs 400 vs 500），而非一律 500。
3. **分批替换裸 `Error`**：按文件逐个替换，优先处理 `auth.ts`（16 处，安全相关）和 API 路由层。

---

### 1.5 P0：McpServiceManager 四重实例化

`service-registry.ts` 注释（第 9 行）明确声明"禁止在请求路径中创建新的服务实例"。但 `McpServiceManager` 实际被 **4 个模块各自独立 `new`**：

| 模块 | 声明行 | 实例化行 | 是否在请求路径 |
|------|--------|----------|----------------|
| `api/groups/index.ts` | L65 | L79 | **是**（每个组管理路由先 await `ensureCoreServiceInitialized`） |
| `api/mcp/group-router.ts` | L43 | L58 | **是**（同上模式） |
| `services/mcp_service.ts` | L28 | L41 | 否（启动期） |
| `legacy/mcp-legacy.ts` | L40 | L57 | 否（legacy 路径） |

每个模块维护自己的模块级 `let coreServiceManager`，没有共享单例。

**最严重的后果**在 `groups/index.ts`：组配置变更后（L1140/1282/1398/1565/2370），代码主动置 `coreServiceManager = null`，导致**下一个请求触发完整的重新实例化 + `initializeFromConfig`**，造成请求延迟尖峰。在变更频繁的场景下，这等同于每次请求都冷启动。

此外 `group-router.ts:60` 用 `JSON.parse(JSON.stringify(...))` 深拷贝配置，与其他模块的类型转换方式不一致，可能引入微妙的行为差异。

**建议**：统一收敛到 `service-registry.ts`。将 `McpServiceManager` 纳入注册表管理，提供一个带配置热重载的 `getCoreServiceManager()` 方法，替代 4 处模块级单例。

---

### 1.6 P0：logger 被系统性绕过

项目已有完整的统一 Logger（`packages/share/src`），但 25+ 处生产代码直接使用 `console.error/log`，绕过了日志的级别控制、结构化格式和 requestId 关联：

| 模块 | `console.*` 数量 | 说明 |
|------|-------------------|------|
| `api/config/index.ts` | **9** | 整个 config API 的错误处理全用 `console.error` |
| `services/config_service.ts` | **9** | service 层也大量绕过 |
| `api/auth/index.ts` | 3 | 认证日志（含 IP）走 `console.log` |
| `utils/json_storage.ts` | 2 | 文件 I/O 异常直接打到 stderr |
| `utils/sse.ts` | 2 | SSE 连接生命周期日志 |
| `test-app.ts` | 1 | — |

**后果**：生产环境的日志聚合（ELK / Loki / CloudWatch）无法统一收集这些日志，结构化查询失效，日志级别无法动态调整，requestId 链路追踪断裂。

**建议**：全局搜索替换 `console.error/log/warn` → `logger.error/info/warn`，配合 oxlint 添加 `no-console` 规则（生产代码禁用 console，测试文件豁免）防止回退。

---

### 1.7 P1：功能占位与安全隐患

三个 P1 问题都指向同一个模式——**占位实现看起来"能用"但实际不工作**，比"明确报错"更危险：

#### 1.7.1 `simple-auth.ts`：JWT 完全未实现

**文件**：`backend/src/middleware/simple-auth.ts`（全 39 行）

```typescript
// L13-39
async function requireAuth(...) {
  // 仅检查 "Bearer " 前缀，缺失返回 401
  const _token = authHeader.slice(7);  // 提取后赋给 _token，从未使用
  // TODO: 验证JWT token的有效性和权限
  return next();  // 直接放行
}
```

**任何非空 Bearer token 都通过认证**——无签名验证、无过期检查、无 payload 解析、无权限校验。如果此中间件被挂载到任何生产端点，等同于无认证。同时项目另有 `services/auth.ts`（454 行，含真实 bcrypt 密码校验和 refresh token），存在两套并行的认证路径，容易混淆。

#### 1.7.2 `RedisCacheManager`：纯占位 no-op

**文件**：`packages/core/src/api-to-mcp/services/cache-manager.ts:337–377`

```typescript
// L338 构造函数
logger.warn('RedisCacheManager 是一个占位符实现，需要实际的Redis客户端')

// L341-350 get()
// TODO: 实现Redis GET操作
this.stats.misses++;  // 始终 miss
return null;

// L352-359 set()
// TODO: 实现Redis SET操作
// 不存储任何数据，仅打 debug 日志
```

`get` 永远返回 `null`，`set` 不存储数据。如果用户配置了 Redis，缓存层实际为 no-op，所有查询穿透到底层 API，缓存命中率恒为 0，但**不会报错**——用户以为缓存生效了。

#### 1.7.3 统计数据硬编码

**文件**：`api/groups/index.ts:376–380`（组详情响应）

```typescript
performance: {
  averageResponseTime: 0, // TODO: 实现响应时间统计
  totalRequests: 0,       // TODO: 实现请求统计
  successRate: 100,       // TODO: 实现成功率统计
}
```

`successRate: 100` 让前端显示"100% 成功率"，但实际上从未统计过。`averageResponseTime: 0` 和 `totalRequests: 0` 同理。

#### 1.7.4 硬编码 admin 用户

**文件**：`services/config_service.ts:387` 和 `:566`

```typescript
user: 'admin', // TODO: 从认证上下文获取用户信息
```

配置变更的审计日志和历史记录中，操作者一律归因为虚构的 `admin`，无法追踪真实操作人。

---

### 1.8 P1：类型双轨与 71 处不安全断言

`packages/share` 和 `packages/core` 各自定义了一套配置类型（`McpConfig`、`GroupConfig`、`SystemConfig`），结构相似但不兼容，导致后端需要大量 `as unknown as` 双重断言桥接：

典型位置（共 71 处）：
- `services/mcp_service.ts:44,45,193,201,211` — `config.mcps as unknown as McpConfig`
- `services/config_service.ts:220,637,731` — `config as unknown as McpConfig/SystemConfig`

commit `20bbf0e`（"消除 backend 配置双轨"）已部分处理，但 71 处断言的存在表明根因未消除——两套类型定义仍然并存。

`any` 使用情况则非常好：非测试源文件中仅 **2 处**（1 处是注释中的英文单词 "any"，1 处是测试辅助函数的 `Promise<any>`），最近的提交链已系统性消除了 `any`。

**建议**：统一到单一类型源。让 core 包的配置类型作为唯一定义，share 包通过 re-export 引用，而非重复定义。然后逐步移除 `as unknown as` 断言。

---

### 1.9 P2：仓库卫生与工具链

| 问题 | 位置 | 建议 |
|------|------|------|
| 本地领先 origin **10 commit 未推送** | git | 确认后推送 |
| 16 个文件工作区改动未提交 | git status | 当前改动是 api-to-mcp 测试增强（+2700 行测试），确认后提交 |
| CI 用 pnpm 9，`packageManager` 指定 10.6.4 | `.github/workflows/ci.yml` | 统一版本，避免 CI 与本地行为差异 |
| `config/` 根目录 3 个占位空文件（3–20 字节） | `config/group.json` 等 | 删除或填充真实示例 |
| `temp-test/` 空目录 | 仓库根 | 删除 |
| `.prettierrc` 残留（已改用 oxfmt） | 仓库根 | 删除 |

---

### 1.10 正面亮点

值得明确肯定的做得好的部分：

1. **门面化重构方向正确**：`mcp_hub_service.ts`（commit `4c66c62`）已从上帝类转变为 Facade 编排器，通过组合持有 6 个子服务，自身方法大部分是委托调用。
2. **legacy 层隔离规范**：`backend/src/legacy/deprecation.ts` 实现了符合 RFC 8594 的弃用中间件（`Deprecation`/`Sunset`/`Link` 响应头），Sunset 日期设为 `2026-10-01`。
3. **`any` 清理彻底**：仅剩 2 处（1 处非真实），oxlint 达到 0 warnings 0 errors。
4. **api-to-mcp 子系统分层清晰**：types / config / utils / services / integration 五层，职责明确。
5. **测试基础设施完善**：97 个测试文件，自研 `TestContext` 资源生命周期管理，Vitest projects 模式 + V8 覆盖率。
6. **启动编排健壮**：超时控制、优雅关闭、资源清理、信号处理完整。
7. **`service-registry.ts` 设计本身良好**：有防重入保护——问题只在于未被一致采用。
8. **构建链路零依赖**：CLI 用手写参数解析器避免引入 commander/yargs，是有意识的轻量化选择。

---

## 第二部分：产品与迭代方向

### 2.1 市场现状：赛道已是红海

截至 2026 年 7 月，MCP 网关/聚合赛道已有大量活跃竞品：

| 项目 | Stars | 定位 | 技术栈 |
|------|-------|------|--------|
| **IBM/mcp-context-forge** | ~4.1k | AI Gateway + registry + proxy，联邦 MCP/A2A/REST/gRPC | Python |
| **metatool-ai/metamcp** | ~2.5k | Aggregator + Orchestrator + Middleware，一键 Docker | TypeScript |
| **samanhappy/mcphub** | ~2.2k | 统一管理 + 动态编排 + 按组路由（**同名**） | TypeScript |
| **StacklokLabs/toolhive** | ~1.9k | 企业级 MCP 平台，per-server 隔离容器 + K8s operator | Go |
| **supercorp-ai/supergateway** | ~2.7k | stdio↔SSE/WS/StreamableHTTP transport 适配 | Node |
| **1mcp-app/agent** | ~470 | 统一 MCP runtime，聚合 + 渐进式工具发现 | TypeScript |

竞品共性能力（已成事实标准）：**聚合 + 按命名空间/组路由 + OAuth + Docker + 可观测性（OTel）+ transport 互转**。ContextForge 和 MCPHub（竞品）已支持向量语义搜索做工具发现、工具结果压缩等 token 优化特性。

> 来源：[IBM/mcp-context-forge](https://github.com/IBM/mcp-context-forge) · [metatool-ai/metamcp](https://github.com/metatool-ai/metamcp) · [samanhappy/mcphub](https://github.com/samanhappy/mcphub) · [StacklokLabs/toolhive](https://github.com/StacklokLabs/toolhive)

### 2.2 命名冲突：存在同名直接竞品

> ⚠️ **这是最需要优先决策的产品问题。**

`samanhappy/mcphub`（Apache-2.0，TypeScript，2.2k stars，域名 mcphub.app，docs.mcphub.app，2026 年 7 月仍在活跃 push）的功能集与本项目高度重叠：

- 集中管理多 MCP server 的 dashboard
- 按「全量 / 单 server / 逻辑分组」暴露 Streamable HTTP(SSE) 端点
- 细粒度的 Tool/Prompt/Resource 可见性控制
- **Smart Routing（向量语义搜索做工具发现）**
- OAuth 2.0（client + server 模式）、社交登录（GitHub/Google）
- Database Mode（PostgreSQL）、Docker 一键部署

项目名 "MCP Hub" / "MCPHub" 存在**命名冲突和功能重叠**。继续使用这个名字将面临：
- **SEO/发现性**：搜索"mcphub"会优先指向竞品（有域名 + 更高 stars）
- **品牌混淆**：用户无法区分两个项目
- **法律风险**：取决于商标注册情况（需法律顾问确认）

**需要决策**：是否改名？如果改名，新名称应尽早确定以减少迁移成本。

### 2.3 协议演进：2026-07-28-RC 带来颠覆性变化

MCP 协议即将发布的 `2026-07-28-RC` 版本包含**重大破坏性变更**，对网关产品影响极大：

1. **移除协议级 session 和 `Mcp-Session-Id` 头**——MCP 变为无状态。
2. **移除 `initialize` 握手**——每个请求在 `_meta` 里自带 `protocolVersion`、`clientInfo`。
3. **`subscriptions/listen` 取代** HTTP GET 端点和 `resources/subscribe`。
4. **MRTR（Multi Round-Trip Requests）模式**取代服务端发起请求。
5. **新增 list 结果缓存控制字段**（`ttlMs` / `cacheScope`）——**利好共享网关/CDN 缓存**。
6. **新增强制 HTTP 头** `Mcp-Method`、`Mcp-Name`。
7. **移除 SSE 流的可恢复性**（`Last-Event-ID`）。
8. **OpenTelemetry trace context 传播**（`traceparent`/`tracestate`/`baggage` 写进 `_meta`）。

> 来源：[MCP draft changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/changelog.mdx)

**产品含义**：`2026-07-28-RC` 的无状态化 + 缓存控制字段 + MRTR 模式，几乎可以理解为"为 MCP 网关/聚合层量身定制"。无状态模型下，聚合多个后端 server 的 Hub 天然好做水平扩展、缓存、CDN。**抢先实现 2026-07-28 兼容是时间窗口型机会**——多数现存竞品（写于 2025 有状态时代）都需要大改。

当前项目基于 `2025-11-25` 版本（Streamable HTTP + OAuth 2.1），需要评估升级路径。重点关注的变更：

- 当前依赖 `Mcp-Session-Id` 的会话管理逻辑需要重构
- SSE 事件管理器（`sse_event_manager.ts`，475 行）需要适配新的 `subscriptions/listen` 模型
- 缓存层（当前 Redis 占位）可以对接新的 `ttlMs`/`cacheScope` 字段，这是差异化机会

### 2.4 差异化机会

在红海市场中，本项目可能的差异化方向（按可行性排序）：

**机会 A：抢先实现 2026-07-28 无状态网关**
- 时间窗口型机会，多数竞品需要大改
- 无状态 + `ttlMs`/`cacheScope` 缓存 = 天然适配共享网关/CDN
- 需要紧跟协议演进，技术投入大但壁垒高

**机会 B：深度集成官方 Registry**
- 官方 registry（[modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry)，~7k stars）已进入 API freeze
- 标准化的 `server.json` 格式可作为上游数据源
- 把「官方 registry 数据 + 私有内部 server + 运行时网关」组合——这是 MetaMCP/MCPHub（竞品）目前都没做好的点
- 定位为 **subregistry + 运行时网关**，而非自管配置

**机会 C：轻量自托管开发者工具**
- 比 MetaMCP 更轻、比 ToolHive 更易上手、比 MCPHub（竞品）更紧跟新协议
- 面向开发者/中小团队，而非大企业（企业赛道 ContextForge + ToolHive 已占）
- 强调零配置启动 + 渐进式增强

**应避免的方向**：
- ❌ 自建 MCP server registry（官方已定格局）
- ❌ 自造 transport 适配（[supergateway](https://github.com/supercorp-ai/supergateway) 已覆盖）
- ❌ 完整企业 IAM（接 Keycloak/Entra/OIDC 即可）
- ❌ 与 ContextForge/ToolHive 正面竞争企业平台赛道

### 2.5 功能占位与迭代建议

基于代码中的占位实现，以下是建议的功能迭代优先级：

| 优先级 | 功能 | 当前状态 | 建议 |
|--------|------|----------|------|
| **必须** | JWT 认证 | `simple-auth.ts` 占位，任意 token 放行 | 对接 MCP 协议的 OAuth 2.1（`2025-11-25` 已标准化） |
| **必须** | 统计数据 | 硬编码 `0` / `100` | 实现请求计时 + 计数中间件，或明确移除字段而非返回假数据 |
| **必须** | 审计日志用户归因 | 硬编码 `'admin'` | 从认证上下文注入真实用户 |
| **推荐** | Redis 缓存 | 占位 no-op | 接入真实 Redis 或移除 Redis 选项，避免误导 |
| **推荐** | 协议升级 2026-07-28 | 基于旧版 | 评估无状态化改造路径，这是最大技术机会 |
| **推荐** | OTel 可观测性 | 无 | 协议新版本原生支持 `_meta` 传播 trace context |
| **可选** | 向量语义工具发现 | 无 | 竞品已有，跟进或明确放弃 |
| **可选** | 官方 Registry 集成 | 无 | 差异化机会 B |

---

## 第三部分：优先级行动清单

### 即时（< 1 天）
- [ ] 推送本地 10 个 commit 到 origin
- [ ] 提交工作区 16 个文件的改动（api-to-mcp 测试增强）
- [ ] 统一 CI 与 packageManager 的 pnpm 版本
- [ ] 清理 `temp-test/`、`config/` 占位空文件、`.prettierrc` 残留

### 短期（1-2 周）
- [ ] **P0**：`groups/index.ts` 拆分为 5 个文件，移除硬编码弱密钥
- [ ] **P0**：全局替换 `console.error/log` → `logger`，添加 oxlint `no-console` 规则
- [ ] **P0**：`McpServiceManager` 收敛到 `service-registry`
- [ ] **P1**：`simple-auth.ts` 实现 JWT 验证或明确标记"仅开发环境使用"
- [ ] **P1**：修复硬编码 `'admin'` 用户名

### 中期（2-4 周）
- [ ] **P0**：统一错误体系，废弃 `McpHubError`，分批替换裸 `Error`，添加 `ErrorCode → httpStatus` 映射
- [ ] **P1**：实现统计数据（请求计时 + 计数），移除硬编码占位
- [ ] **P1**：消除配置类型双轨，移除 71 处 `as unknown as` 断言
- [ ] **产品决策**：评估命名冲突，决定是否改名

### 长期（1-3 个月）
- [ ] **P1**：Redis 缓存实现或移除
- [ ] **协议升级**：评估 MCP `2026-07-28-RC` 无状态化改造路径
- [ ] **差异化**：选择并启动一个差异化方向（协议抢先 / Registry 集成 / 轻量定位）
- [ ] **P1**：拆分 `tool_manager.ts`（1128 行），抽取 `ToolResultTransformer`

---

## 附录

### 审计方法说明

- **架构分析**：基于静态代码分析，覆盖 `backend/src`、`packages/core/src`、`packages/cli/src`、`packages/share/src` 全部非测试源文件（约 225 个）。
- **代码引用**：所有行号基于审计时点（commit `ba85737` + 工作区改动）的文件状态。
- **竞品调研**：基于各竞品 GitHub 仓库一手资料（README、API 文档、specification）。
- **协议信息**：基于 [MCP 官方 specification](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/docs/specification)。

### 关键来源

**协议**：
- [MCP Specification 2025-11-25](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/changelog.mdx)
- [MCP Draft (2026-07-28-RC) Changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/changelog.mdx)

**竞品**：
- [IBM/mcp-context-forge](https://github.com/IBM/mcp-context-forge)
- [metatool-ai/metamcp](https://github.com/metatool-ai/metamcp)
- [samanhappy/mcphub](https://github.com/samanhappy/mcphub)（同名竞品）
- [StacklokLabs/toolhive](https://github.com/StacklokLabs/toolhive)
- [supercorp-ai/supergateway](https://github.com/supercorp-ai/supergateway)

**Registry**：
- [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry)
- [Registry 生态愿景](https://github.com/modelcontextprotocol/registry/blob/main/docs/design/ecosystem-vision.md)
- [server.json 格式](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md)
