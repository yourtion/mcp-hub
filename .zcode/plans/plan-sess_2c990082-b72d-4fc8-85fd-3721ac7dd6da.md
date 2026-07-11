# MCP Hub P0/P1 问题修复计划（4 阶段）

基于审计报告 + 深度探索验证，执行全部 4 个阶段。每个阶段独立可验证（测试 + lint + build 通过即可提交）。

---

## 阶段 1：快速修复（1-2 天）

### 1.1 console→logger 全局替换（29 处）

**目标文件与改动**：

| 文件 | 处数 | 改动 |
|------|------|------|
| `backend/src/api/config/index.ts` | 9 | 新增 `import { logger }`，`console.error` → `logger.error`，错误返回改用 `errorResponse(c, error)` |
| `backend/src/api/auth/index.ts` | 6 | `console.log/warn` → `logger.info/warn`，带 requestId + ip 上下文 |
| `backend/src/services/config_service.ts` | 10 | `console.error/warn` → `logger.error/warn` |
| `backend/src/utils/json_storage.ts` | 2 | `console.error` → `logger.error` |
| `backend/src/sse.ts` | 2 | `console.log` → `logger.info` |
| `backend/src/validation/config.ts` | 1 | `console.warn` → `logger.warn` |

**logger.error 签名**：`(message: string, error?: Error, context?: Partial<LogEntry>)` — 第二参数是 Error 对象（不是拼接字符串），需注意适配。

**oxlint 规则**：`.oxlintrc.json` 第 11 行 `"no-console": "off"` → `"error"`，并在 overrides（第 37 行）的测试文件 rules 中加 `"no-console": "off"` 豁免。

### 1.2 删除 simple-auth.ts 死代码

探索确认：真实的 JWT 认证系统（`AuthService` + `createAuthMiddleware`，含 bcrypt + jwt.verify）已存在并全局挂载到 `apiToMcpRoutes`（`app.ts:69`）。`simple-auth.ts` 的 `requireAuth` 是冗余死代码。

- 删除 `backend/src/middleware/simple-auth.ts`
- 移除 `backend/src/api/api-to-mcp/index.ts` 中 6 处 `requireAuth` 引用（L8 import + L74/95/159/233/277/310 路由中间件参数）
- 如果存在 `simple-auth` 的测试文件，一并删除

### 1.3 修复硬编码 admin 用户

`backend/src/services/config_service.ts` L387 和 L566：`user: 'admin'` → 从认证上下文获取。

由于 `ConfigService` 目前不接收认证上下文，最小改动方案：给记录历史/备份的方法增加可选的 `user?: string` 参数（默认 `'system'` 而非伪造 `'admin'`），由调用方从 `c.get('user')` 或 JWT payload 传入真实用户名。

### 1.4 统计数据对接现有 PerformanceMonitor

探索发现 `PerformanceMonitor` 已全局挂载并收集数据，`getStatsByEndpoint()` 已提供所需字段。

- `backend/src/api/groups/index.ts` L376-380：硬编码占位 → 查询 `performanceMonitor.getStatsByEndpoint()`
- 由于现有指标按完整 path 记录（含具体 groupId），需要按组路由前缀聚合（或添加 `getStatsByPathPrefix(prefix)` 方法到 `PerformanceMonitor`）
- 如果按前缀聚合成本高，简化方案：移除 `performance` 块（而非返回假数据），在前端标注"暂无统计"

### 验证
- `pnpm test` 全绿
- `pnpm check`（oxlint 0 warnings，包含新的 no-console 规则）
- `pnpm build` 通过

---

## 阶段 2：McpServiceManager 收敛到 service-registry（1-2 天）

### 2.1 扩展 service-registry.ts

在 `backend/src/services/service-registry.ts` 中新增 `McpServiceManager` 管理：

```typescript
// 新增（与 hubService 并行的第二注册项）
let coreServiceManager: McpServiceManager | null = null;

export async function getCoreServiceManager(): Promise<McpServiceManager> {
  if (!coreServiceManager) {
    throw new ServiceError(ErrorCode.SERVICE_UNAVAILABLE, 'McpServiceManager 未初始化');
  }
  return coreServiceManager;
}

export async function reloadCoreServiceManager(): Promise<McpServiceManager> {
  // 封装现有的 shutdown → null → reinit 逻辑
  if (coreServiceManager) {
    await coreServiceManager.shutdown().catch(err => logger.warn(...));
    coreServiceManager = null;
  }
  return initCoreServiceManager();
}

export async function initCoreServiceManager(): Promise<McpServiceManager> {
  const { servers, groups } = getAllConfig();
  coreServiceManager = new McpServiceManager();
  await coreServiceManager.initializeFromConfig({ servers, groups });
  return coreServiceManager;
}
```

### 2.2 替换 4 处模块级实例化

| 文件 | 改动 |
|------|------|
| `api/groups/index.ts` L65/L79 | 删除模块级 `let coreServiceManager`，`ensureCoreServiceInitialized` → `getCoreServiceManager()`，4 处重启代码块 → `reloadCoreServiceManager()` |
| `api/mcp/group-router.ts` L43/L58 | 同上 |
| `services/mcp_service.ts` L28/L41 | 启动期调用 `initCoreServiceManager()` |
| `legacy/mcp-legacy.ts` L40/L57 | 同上（或保留独立实例但标注 legacy 原因） |

### 验证
- 组 CRUD 操作后不再有冷启动延迟尖峰
- `pnpm test` + `pnpm check` + `pnpm build`

---

## 阶段 3：groups/index.ts 拆分 + 弱密钥修复（2-3 天）

### 3.1 拆分为 5 个文件

```
backend/src/api/groups/
├── index.ts              # 路由注册 + re-export groupsApi/shutdownGroupsApi（~400 行）
├── crypto.ts             # encryptValidationKey / decryptValidationKey / generateValidationKey
├── key-policy.ts         # assessKeyComplexity / calculateEntropy / generateSecurityRecommendations / validateKeyFormat
├── validation.ts         # validateGroupData / validateGroupId / estimateToolComplexity + JsonSchema 类型
└── core-service.ts       # [阶段2产物] getCoreServiceManager / reloadCoreServiceManager 的调用封装
```

拆分依据（来自探索）：
- `crypto.ts`：依赖 `node:crypto`，与路由零耦合，天然分界
- `key-policy.ts`：纯逻辑无外部依赖，仅 `generateSecurityRecommendations` → `assessKeyComplexity` 内部依赖
- `validation.ts`：依赖 share 类型，`estimateToolComplexity` 带局部 `JsonSchema` 类型（L25-45）
- `index.ts`：仅做 `new Hono()` + 路由 handler + re-export，对外接口不变（`hub.ts` 无需改动）

### 3.2 移除硬编码弱密钥

`crypto.ts`（原 L705）：
```typescript
// 修改前
const secret = process.env.VALIDATION_KEY_SECRET || 'mcp-hub-default-secret-key';
// 修改后
const secret = process.env.VALIDATION_KEY_SECRET;
if (!secret || secret.length < 32) {
  throw new ConfigError(ErrorCode.INVALID_CONFIG_FORMAT, 'VALIDATION_KEY_SECRET 未设置或长度不足 32 字符');
}
```

### 3.3 更新测试

`backend/src/api/groups/groups.unit.test.ts` 当前检查路由存在性（17 条路由）。拆分后路由数量和路径不变，测试应继续通过。但需：
- 更新 import 路径（如果测试直接 import 辅助函数）
- 为拆出的 `crypto.ts` / `key-policy.ts` / `validation.ts` 各添加单元测试（这些函数之前内联在路由文件中，可能缺乏独立测试）

### 验证
- 路由测试 17 条全绿
- 新增的 crypto/key-policy/validation 单元测试覆盖加密/解密对称性、密钥复杂度评分逻辑、校验规则
- 弱密钥场景启动报错
- `pnpm test` + `pnpm check` + `pnpm build`

---

## 阶段 4：统一错误体系（3-5 天）

### 4.1 ErrorCode → httpStatus 映射

在 `packages/core/src/errors/index.ts` 中新增：

```typescript
const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  // 配置错误 1000-1999 → 500 (服务器配置问题) / 400 (客户端提交配置问题)
  [ErrorCode.INVALID_SERVER_CONFIG]: 500,
  [ErrorCode.SCHEMA_VALIDATION_FAILED]: 400,
  [ErrorCode.CONFIG_FILE_NOT_FOUND]: 500,
  // 连接错误 2000-2999 → 502/503
  [ErrorCode.SERVER_UNAVAILABLE]: 503,
  [ErrorCode.CONNECTION_TIMEOUT]: 504,
  [ErrorCode.AUTHENTICATION_FAILED]: 401,
  // 运行时错误 3000-3999 → 404/403/500
  [ErrorCode.TOOL_NOT_FOUND]: 404,
  [ErrorCode.GROUP_NOT_FOUND]: 404,
  [ErrorCode.TOOL_ACCESS_DENIED]: 403,
  // 验证错误 4000-4999 → 400
  [ErrorCode.INVALID_REQUEST_FORMAT]: 400,
  [ErrorCode.MISSING_REQUIRED_PARAMETER]: 400,
  // 系统错误 5000-5999 → 500
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  // 认证错误 6000-6999 → 401/403
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_ACCESS_DENIED]: 403,
  // ... 其余映射
};

export function getHttpStatusForError(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code] ?? 500;
}
```

### 4.2 更新 errorResponse()

`backend/src/utils/api-response.ts`：
```typescript
export function errorResponse(c: Context, error: Error, status?: number): Response {
  const requestId = c.get('requestId');
  const formatted = defaultErrorHandler.formatErrorResponse(error, undefined, requestId);
  // 如果调用方未指定 status 且是结构化错误，从 ErrorCode 推导
  const httpStatus = status ?? (error instanceof McpHubCoreError
    ? getHttpStatusForError(error.code)
    : 500);
  logger.error('API error', error, { requestId, path: c.req.path, method: c.req.method });
  return c.json(formatted, httpStatus as 500);
}
```

### 4.3 废弃 backend McpHubError 家族

`backend/src/services/mcp_hub_service.ts` L14-52：
- 给 5 个错误类加 `@deprecated 使用 core 包的 McpHubCoreError 体系` JSDoc
- 内部 9 处 throw 逐步替换为 core 包对等类：
  - `ServiceNotInitializedError` → `ServiceError(ErrorCode.SERVICE_UNAVAILABLE, ...)`
  - `GroupNotFoundError` → `ServiceError(ErrorCode.GROUP_NOT_FOUND, ...)`
  - `ToolNotFoundError` → `ToolExecutionError(ErrorCode.TOOL_NOT_FOUND, ...)`
  - `ServiceInitializationError` → `ConfigError(ErrorCode.SERVER_STARTUP_FAILED, ...)`

### 4.4 分批替换裸 Error（73 处，按风险排序）

**第一批（安全相关，16 处）**：`services/auth.ts`
- 登录失败 → `AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, ...)`
- Token 过期 → `AuthError(ErrorCode.AUTH_TOKEN_EXPIRED, ...)`
- Token 无效 → `AuthError(ErrorCode.AUTH_TOKEN_INVALID, ...)`

**第二批（API 层，9 处）**：`api/groups/index.ts`（拆分后的 index.ts）
- 组不存在 → `ServiceError(ErrorCode.GROUP_NOT_FOUND, ...)`
- 校验失败 → `ValidationError(ErrorCode.INVALID_PARAMETER_VALUE, ...)`

**第三批（service 层）**：`api-to-mcp-web-service.ts`(12) → `server_manager.ts`(7) → `mcp_service.ts`(6) → `config_service.ts`(4) → 其余

每批替换后跑测试验证，不一次性全改。

### 验证
- `pnpm test` 全绿（需要更新 mock 断言，因为错误类型变了）
- 用 curl 验证错误响应的 HTTP 状态码正确（404 vs 400 vs 500 vs 401）
- `pnpm check` + `pnpm build`
- `@deprecated` 标记不影响运行，后续 PR 逐步清理

---

## 横切关注点

### 测试策略
- 每阶段完成后立即 `pnpm test` + `pnpm check` + `pnpm build`
- 阶段 3 拆分出的纯函数（crypto/key-policy/validation）需要新增单元测试
- 阶段 4 错误类型变更需要更新相关测试的 mock 断言

### 文档同步
- 每阶段完成后更新对应文档（CLAUDE.md 的错误处理章节、TROUBLESHOOTING.md 的弱密钥说明等）
- 不在本次修改 README（产品定位文档后续单独处理）

### 分支策略
- 每个阶段一个 commit（或拆得更细），保持 main 分支始终可运行
- 不创建新分支（当前在 main，用户未要求 PR 流程）
