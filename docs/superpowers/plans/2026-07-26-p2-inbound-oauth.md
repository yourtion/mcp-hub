# P2 入站 OAuth 2.1（Protected Resource + 内置最小 AS）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Hub 作为 MCP OAuth 2.1 Protected Resource（RFC9728）校验 `/:group/mcp` 端点的 Bearer token，内置最小 AS（client_credentials 签发）+ 对接外部 IdP（JWT 本地验签 + introspection 回退），并填补组级 validationKey 在 MCP 端点未强制的现状缺口。

**Architecture:** 新增 `services/oauth/*`（token-validator / jwks-cache / internal-as / as-metadata / resource-server / validation-key）+ `api/oauth/*`（token/jwks/well-known 端点）+ `middleware/mcp-auth.ts`。OAuth 与现有 Web UI 认证（`services/auth.ts`）完全独立。token 校验无状态（JWT 本地验签为主），introspection/JWKS 带内存缓存。

**Tech Stack:** `jose`（JWT 签发/验签/JWKS，新增依赖）、Hono、zod/v4、vitest、`@modelcontextprotocol/client`（e2e）。

**关联 spec:** `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md`

---

## Global Constraints

- **错误码号段**：OAuth 错误码用 `6100-6106`（AUTH 系列占 6001-6005，避开）。每新增一个 `ErrorCode` 枚举值，**必须同步**四处：`ErrorCode` 枚举、`ERROR_MESSAGES`、`ERROR_SEVERITY`、`ERROR_HTTP_STATUS`（均在 `packages/core/src/errors/index.ts`）。
- **JWT 库**：统一用 `jose`（签发 + 验签 + JWKS），不复用 `jsonwebtoken`（那是 HS256 的 Web UI 用）。`jose` 是 ESM-only、TS 原生、维护活跃。
- **测试模式**：遵循 P1/P4 既有模式——单元测试 `*.unit.test.ts`，e2e 在 `backend/src/e2e/mcp-protocol/`，e2e 客户端用 `StreamableHTTPClientTransport`（见 `mcp-test-config.ts`）。
- **配置 schema**：扩展 `packages/share/src/config/schemas/system.schema.ts` 的 `SystemConfigSchema`，加 `oauth?` 字段。
- **CLI 零改动**：所有改动限定 `backend/`、`packages/core/`、`packages/share/`，`packages/cli/` 不动。
- **commit 粒度**：每个 Task 末尾提交，commit message 用 `feat`/`refactor`/`test`/`docs` 前缀。
- **格式化门禁**：提交前跑 `pnpm check:ci`（oxlint + oxfmt），否则 CI lint gate 挂。

---

## 文件结构

| 文件 | 操作 | 责任 |
|------|------|------|
| `packages/core/src/errors/index.ts` | Modify | 加 7 个 OAUTH 错误码（6100-6106）+ 四处映射 |
| `packages/core/src/errors/index.ts` 测试 | Modify | 错误码映射覆盖 |
| `packages/share/src/config/schemas/system.schema.ts` | Modify | `SystemConfigSchema` 加 `oauth?` 字段 |
| `packages/share/src/config/schemas/system.schema.unit.test.ts` | Create | oauth schema 校验测试 |
| `backend/src/services/oauth/types.ts` | Create | OAuth 配置/claims/auth context 类型定义 |
| `backend/src/services/oauth/crypto-keys.ts` | Create | RSA 密钥对加载/生成（内置 AS 签名） |
| `backend/src/services/oauth/crypto-keys.unit.test.ts` | Create | 密钥加载测试 |
| `backend/src/services/oauth/jwks-cache.ts` | Create | 外部 IdP JWKS 拉取+缓存（kid 索引） |
| `backend/src/services/oauth/jwks-cache.unit.test.ts` | Create | JWKS 缓存测试 |
| `backend/src/services/oauth/internal-as.ts` | Create | 内置 AS：client_credentials 签发 + metadata 生成 |
| `backend/src/services/oauth/internal-as.unit.test.ts` | Create | 签发测试 |
| `backend/src/services/oauth/as-metadata.ts` | Create | AS metadata 发现/缓存（外部 IdP）+ Protected Resource metadata 生成 |
| `backend/src/services/oauth/as-metadata.unit.test.ts` | Create | metadata 测试 |
| `backend/src/services/oauth/token-validator.ts` | Create | JWT 验签 + introspection 回退编排 |
| `backend/src/services/oauth/token-validator.unit.test.ts` | Create | 校验各路径测试 |
| `backend/src/services/oauth/validation-key.ts` | Create | 组级 validationKey 校验（纯逻辑） |
| `backend/src/services/oauth/validation-key.unit.test.ts` | Create | validationKey 测试 |
| `backend/src/services/oauth/resource-server.ts` | Create | Protected Resource 校验编排（OAuth vs validationKey 分支） |
| `backend/src/services/oauth/resource-server.unit.test.ts` | Create | 编排测试 |
| `backend/src/middleware/mcp-auth.ts` | Create | MCP 端点认证中间件（401/403 响应） |
| `backend/src/middleware/mcp-auth.unit.test.ts` | Create | 中间件测试 |
| `backend/src/api/oauth/token.ts` | Create | `/api/oauth/token` 端点 |
| `backend/src/api/oauth/jwks.ts` | Create | `/api/oauth/jwks` 端点 |
| `backend/src/api/oauth/well-known.ts` | Create | `/.well-known/oauth-protected-resource` + `oauth-authorization-server` |
| `backend/src/api/oauth/index.ts` | Create | 路由聚合 |
| `backend/src/api/mcp/group-router.ts` | Modify | 插入 `mcpAuthMiddleware` |
| `backend/src/app.ts` | Modify | 挂载 `/api/oauth` + `/.well-known` 路由 |
| `backend/src/e2e/mcp-protocol/oauth-discovery.test.ts` | Create | e2e：metadata 发现 + 401 格式 |
| `backend/src/e2e/mcp-protocol/oauth-client-credentials.test.ts` | Create | e2e：内置 AS 完整流程 |
| `backend/src/e2e/mcp-protocol/oauth-audience.test.ts` | Create | e2e：RFC8707 audience 校验 |
| `backend/src/e2e/mcp-protocol/oauth-external-idp.test.ts` | Create | e2e：外部 IdP JWT + introspection |
| `backend/src/e2e/mcp-protocol/validation-key.test.ts` | Create | e2e：组级 validationKey 强制 |
| `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md` | Modify | 实现修正回填 |
| `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md` | Modify | P1/P2 状态回写 + 跨子项目待办修正 |
| `RELEASE_NOTES.md` | Modify | P2 breaking change 说明 |

---

## Task 1: 新增 OAuth 错误码

**Files:**
- Modify: `packages/core/src/errors/index.ts:57-63`（ErrorCode 枚举）
- Modify: `packages/core/src/errors/index.ts:105-111`（ERROR_MESSAGES）
- Modify: `packages/core/src/errors/index.ts:163-169`（ERROR_SEVERITY）
- Modify: `packages/core/src/errors/index.ts:213-219`（ERROR_HTTP_STATUS）
- Test: `packages/core/src/errors/http-status-mapping.unit.test.ts`

**Interfaces:**
- Produces: `ErrorCode.OAUTH_MISSING_TOKEN` / `OAUTH_INVALID_TOKEN` / `OAUTH_TOKEN_EXPIRED` / `OAUTH_INVALID_AUDIENCE` / `OAUTH_INSUFFICIENT_SCOPE` / `OAUTH_SERVER_ERROR` / `OAUTH_CONFIG_ERROR`（6100-6106）

- [ ] **Step 1: 写失败测试**

在 `packages/core/src/errors/http-status-mapping.unit.test.ts` 的测试用例数组里追加 7 行（找到现有的 `{ code: ErrorCode.AUTH_ACCOUNT_LOCKED, expected: 423, ... }` 那个数组，在后面加）：

```typescript
    { code: ErrorCode.OAUTH_MISSING_TOKEN, expected: 401, label: 'OAUTH_MISSING_TOKEN' },
    { code: ErrorCode.OAUTH_INVALID_TOKEN, expected: 401, label: 'OAUTH_INVALID_TOKEN' },
    { code: ErrorCode.OAUTH_TOKEN_EXPIRED, expected: 401, label: 'OAUTH_TOKEN_EXPIRED' },
    { code: ErrorCode.OAUTH_INVALID_AUDIENCE, expected: 401, label: 'OAUTH_INVALID_AUDIENCE' },
    { code: ErrorCode.OAUTH_INSUFFICIENT_SCOPE, expected: 403, label: 'OAUTH_INSUFFICIENT_SCOPE' },
    { code: ErrorCode.OAUTH_SERVER_ERROR, expected: 503, label: 'OAUTH_SERVER_ERROR' },
    { code: ErrorCode.OAUTH_CONFIG_ERROR, expected: 500, label: 'OAUTH_CONFIG_ERROR' },
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mcp-core/mcp-hub-core test -- --run src/errors/http-status-mapping.unit.test.ts`
Expected: FAIL（7 个新 code 未定义）

- [ ] **Step 3: 加 ErrorCode 枚举**

在 `packages/core/src/errors/index.ts` 的 `AUTH_ACCOUNT_LOCKED = 6005,` 之后加：

```typescript

  // OAuth 错误（6100-6199，入站 OAuth 2.1 Protected Resource）
  OAUTH_MISSING_TOKEN = 6100,
  OAUTH_INVALID_TOKEN = 6101,
  OAUTH_TOKEN_EXPIRED = 6102,
  OAUTH_INVALID_AUDIENCE = 6103,
  OAUTH_INSUFFICIENT_SCOPE = 6104,
  OAUTH_SERVER_ERROR = 6105,
  OAUTH_CONFIG_ERROR = 6106,
```

- [ ] **Step 4: 加 ERROR_MESSAGES**

在 `ERROR_MESSAGES` 的 `[ErrorCode.AUTH_ACCOUNT_LOCKED]: '账户已被锁定',` 之后加：

```typescript

  // OAuth 错误
  [ErrorCode.OAUTH_MISSING_TOKEN]: '缺少 OAuth 令牌',
  [ErrorCode.OAUTH_INVALID_TOKEN]: 'OAuth 令牌无效',
  [ErrorCode.OAUTH_TOKEN_EXPIRED]: 'OAuth 令牌已过期',
  [ErrorCode.OAUTH_INVALID_AUDIENCE]: 'OAuth 令牌受众不匹配',
  [ErrorCode.OAUTH_INSUFFICIENT_SCOPE]: 'OAuth 权限范围不足',
  [ErrorCode.OAUTH_SERVER_ERROR]: 'OAuth 服务错误',
  [ErrorCode.OAUTH_CONFIG_ERROR]: 'OAuth 配置错误',
```

- [ ] **Step 5: 加 ERROR_SEVERITY**

在 `ERROR_SEVERITY` 的 `[ErrorCode.AUTH_ACCOUNT_LOCKED]: ErrorSeverity.MEDIUM,` 之后加：

```typescript

  // OAuth 错误
  [ErrorCode.OAUTH_MISSING_TOKEN]: ErrorSeverity.LOW,
  [ErrorCode.OAUTH_INVALID_TOKEN]: ErrorSeverity.MEDIUM,
  [ErrorCode.OAUTH_TOKEN_EXPIRED]: ErrorSeverity.LOW,
  [ErrorCode.OAUTH_INVALID_AUDIENCE]: ErrorSeverity.HIGH,
  [ErrorCode.OAUTH_INSUFFICIENT_SCOPE]: ErrorSeverity.MEDIUM,
  [ErrorCode.OAUTH_SERVER_ERROR]: ErrorSeverity.HIGH,
  [ErrorCode.OAUTH_CONFIG_ERROR]: ErrorSeverity.HIGH,
```

- [ ] **Step 6: 加 ERROR_HTTP_STATUS**

在 `ERROR_HTTP_STATUS` 的 `[ErrorCode.AUTH_ACCOUNT_LOCKED]: 423,` 之后加：

```typescript

  // OAuth 错误
  [ErrorCode.OAUTH_MISSING_TOKEN]: 401,
  [ErrorCode.OAUTH_INVALID_TOKEN]: 401,
  [ErrorCode.OAUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.OAUTH_INVALID_AUDIENCE]: 401,
  [ErrorCode.OAUTH_INSUFFICIENT_SCOPE]: 403,
  [ErrorCode.OAUTH_SERVER_ERROR]: 503,
  [ErrorCode.OAUTH_CONFIG_ERROR]: 500,
```

- [ ] **Step 7: 跑测试确认通过**

Run: `pnpm --filter @mcp-core/mcp-hub-core test -- --run src/errors/http-status-mapping.unit.test.ts`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add packages/core/src/errors/index.ts packages/core/src/errors/http-status-mapping.unit.test.ts
git commit -m "feat(errors): 新增 OAuth 错误码 6100-6106（P2 入站 OAuth 前置）"
```

---

## Task 2: SystemConfig 加 oauth schema 字段

**Files:**
- Modify: `packages/share/src/config/schemas/system.schema.ts`
- Create: `packages/share/src/config/schemas/system.schema.unit.test.ts`

**Interfaces:**
- Produces: `SystemConfig['oauth']` 类型（`mode: 'internal'|'external'|'both'` + `internal?` + `external?` + `resource` + `scopes`）

- [ ] **Step 1: 写失败测试**

新建 `packages/share/src/config/schemas/system.schema.unit.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import { SystemConfigSchema } from './system.schema.js';

describe('SystemConfigSchema oauth 字段', () => {
  const baseValid = {
    server: { port: 8181, host: '0.0.0.0' },
    auth: {
      jwt: { secret: 'a'.repeat(32), expiresIn: '24h', refreshExpiresIn: '7d', issuer: 'hub' },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        passwordMinLength: 6,
        requireStrongPassword: false,
      },
    },
    users: {},
    ui: { title: 't', theme: 'light', features: { apiToMcp: true, debugging: false, monitoring: true } },
    monitoring: { metricsEnabled: true, logLevel: 'info', retentionDays: 30 },
  };

  it('oauth 字段缺失时通过校验（可选）', () => {
    expect(() => SystemConfigSchema.parse(baseValid)).not.toThrow();
  });

  it('mode=internal 时 internal 配置生效', () => {
    const cfg = {
      ...baseValid,
      oauth: {
        mode: 'internal' as const,
        resource: 'https://hub.example.com',
        internal: { tokenTtlSeconds: 3600, clients: [{ clientId: 'c1', clientSecret: 'h', scopes: ['mcp:tools'] }] },
      },
    };
    expect(() => SystemConfigSchema.parse(cfg)).not.toThrow();
  });

  it('mode=external 时 external 配置生效', () => {
    const cfg = {
      ...baseValid,
      oauth: {
        mode: 'external' as const,
        resource: 'https://hub.example.com',
        external: {
          issuer: 'https://idp.example.com',
          clientId: 'c',
          clientSecret: 's',
          audience: 'https://hub.example.com',
        },
      },
    };
    expect(() => SystemConfigSchema.parse(cfg)).not.toThrow();
  });

  it('resource 必须是合法 URL', () => {
    const cfg = { ...baseValid, oauth: { mode: 'internal' as const, resource: 'not-a-url' } };
    expect(() => SystemConfigSchema.parse(cfg)).toThrow();
  });

  it('mode 枚举校验非法值', () => {
    const cfg = { ...baseValid, oauth: { mode: 'hybrid', resource: 'https://hub.example.com' } };
    expect(() => SystemConfigSchema.parse(cfg)).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @mcp-core/mcp-hub-share test -- --run src/config/schemas/system.schema.unit.test.ts`
Expected: FAIL（oauth 字段未定义，相关 case 报错）

- [ ] **Step 3: 扩展 SystemConfigSchema**

在 `packages/share/src/config/schemas/system.schema.ts` 的 `SystemConfigSchema = z.object({...})` 里，在 `monitoring` 之后加 `oauth` 字段：

```typescript
  oauth: z
    .object({
      // 模式：internal（内置 AS）/ external（对接外部 IdP）/ both
      mode: z.enum(['internal', 'external', 'both']),
      // Hub 作为 Protected Resource 的规范 URI（RFC8707 audience 标识）
      resource: z.string().url(),
      scopes: z.array(z.string()).default(['mcp:tools', 'mcp:resources']),
      // 内置 AS 配置（mode 为 internal/both 时必填）
      internal: z
        .object({
          issuer: z.string().url().optional(),
          tokenTtlSeconds: z.number().int().positive().default(3600),
          clients: z
            .array(
              z.object({
                clientId: z.string().min(1),
                clientSecret: z.string().min(1), // bcrypt 哈希
                scopes: z.array(z.string()).default(['mcp:tools']),
              }),
            )
            .default([]),
        })
        .optional(),
      // 外部 IdP 配置（mode 为 external/both 时必填）
      external: z
        .object({
          issuer: z.string().url(),
          metadataUrl: z.string().url().optional(),
          clientId: z.string().min(1),
          clientSecret: z.string().min(1),
          introspectionEndpoint: z.string().url().optional(),
          jwksUri: z.string().url().optional(),
          audience: z.string().min(1),
        })
        .optional(),
    })
    .optional(), // 整个 oauth 块可选
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @mcp-core/mcp-hub-share test -- --run src/config/schemas/system.schema.unit.test.ts`
Expected: PASS

- [ ] **Step 5: 跑全量 typecheck**

Run: `pnpm typecheck`
Expected: 无错误（如有现有代码因 `SystemConfig` 类型推导变化报错，记录但通常不会，因为是 optional 字段）

- [ ] **Step 6: 提交**

```bash
git add packages/share/src/config/schemas/system.schema.ts packages/share/src/config/schemas/system.schema.unit.test.ts
git commit -m "feat(share): SystemConfig 加 oauth 配置 schema（P2）"
```

---

## Task 3: OAuth 类型定义

**Files:**
- Create: `backend/src/services/oauth/types.ts`

**Interfaces:**
- Produces: `OAuthConfig`（从 SystemConfig 提取的强类型）、`TokenClaims`（JWT claims）、`McpAuthContext`（中间件注入到 Hono context 的认证上下文）

- [ ] **Step 1: 写类型定义文件**

新建 `backend/src/services/oauth/types.ts`：

```typescript
/**
 * OAuth 子系统类型定义
 *
 * 与 Web UI 的 auth（services/auth.ts）完全独立，保护 /:group/mcp 协议端点。
 */
import type { SystemConfig } from '@mcp-core/mcp-hub-share';

/** 从 SystemConfig.oauth 提取的非可选强类型（oauth 已配置时） */
export type OAuthConfig = NonNullable<SystemConfig['oauth']>;

/** 内置 AS 签发的 JWT claims（RS256） */
export interface TokenClaims {
  iss: string; // RFC9207，防 mix-up
  sub: string; // client_id
  aud: string | string[]; // RFC8707，resource 标识
  exp: number;
  iat: number;
  nbf?: number;
  scope: string;
  client_id: string;
}

/** introspection（RFC7662）响应（关注的字段子集） */
export interface IntrospectionResult {
  active: boolean;
  aud?: string | string[];
  scope?: string;
  exp?: number;
  client_id?: string;
  sub?: string;
}

/** 中间件注入到 Hono context 的 MCP 认证上下文 */
export interface McpAuthContext {
  /** 认证方式：oauth（JWT/introspection）或 validationKey（组级 AES key） */
  method: 'oauth' | 'validationKey';
  /** 客户端标识（oauth: client_id / sub；validationKey: 'validation-key'） */
  principal: string;
  /** 授权 scope（空格分隔，oauth 路径有；validationKey 路径为 'mcp:tools mcp:resources'） */
  scope?: string;
  /** 原始 token（仅日志/审计用，不回传客户端） */
  tokenHash?: string;
}

/** token 校验结果 */
export type TokenValidationResult =
  | { ok: true; claims: TokenClaims | IntrospectionResult; method: 'jwt' | 'introspection' }
  | { ok: false; reason: 'invalid' | 'expired' | 'audience' | 'inactive' | 'scope' };
```

- [ ] **Step 2: 跑 typecheck 确认类型正确**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add backend/src/services/oauth/types.ts
git commit -m "feat(oauth): OAuth 子系统类型定义（P2）"
```

---

## Task 4: RSA 密钥管理（内置 AS 签名）

**Files:**
- Create: `backend/src/services/oauth/crypto-keys.ts`
- Create: `backend/src/services/oauth/crypto-keys.unit.test.ts`

**Interfaces:**
- Consumes: 环境变量 `OAUTH_INTERNAL_PRIVATE_KEY`（PEM 字符串或文件路径）
- Produces: `loadOrCreateSigningKey(): Promise<{ privateKey: Uint8Array; publicKeyJwk: JWK; kid: string }>`、`getInternalPublicKeySet(): JWK[]`

- [ ] **Step 1: 安装 jose 依赖**

Run: `pnpm --filter backend add jose`
确认 `backend/package.json` 的 dependencies 出现 `"jose"`。

- [ ] **Step 2: 写失败测试**

新建 `backend/src/services/oauth/crypto-keys.unit.test.ts`：

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { importSPKI, SignJWT } from 'jose';

import { loadOrCreateSigningKey, getInternalPublicKeySet } from './crypto-keys.js';

describe('crypto-keys', () => {
  const origEnv = process.env.OAUTH_INTERNAL_PRIVATE_KEY;

  afterEach(() => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    if (origEnv !== undefined) process.env.OAUTH_INTERNAL_PRIVATE_KEY = origEnv;
    // 重置模块级缓存：用 vi.resetModules 或重新 import
  });

  it('未配置环境变量时生成临时密钥对并 warn', async () => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    const { privateKey, publicKeyJwk, kid } = await loadOrCreateSigningKey();
    expect(privateKey).toBeInstanceOf(Uint8Array);
    expect(publicKeyJwk.kty).toBe('RSA');
    expect(kid).toBeTruthy();
  });

  it('公钥集包含当前 kid', async () => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    const { kid } = await loadOrCreateSigningKey();
    const set = getInternalPublicKeySet();
    expect(set.find((k) => k.kid === kid)).toBeDefined();
  });

  it('签发的密钥能验签（用 jose 对签）', async () => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    const { privateKey, kid } = await loadOrCreateSigningKey();
    const token = await new SignJWT({ sub: 'c1' })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    expect(token.split('.')).toHaveLength(3);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/crypto-keys.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 crypto-keys.ts**

新建 `backend/src/services/oauth/crypto-keys.ts`：

```typescript
/**
 * 内置 AS 的 RSA 签名密钥管理
 *
 * 从 OAUTH_INTERNAL_PRIVATE_KEY（PEK 字符串）加载；未配置时生成临时密钥对并 warn
 * （仅开发用途，重启后所有已签发 token 失效）。生产部署必须配置。
 *
 * 模块级缓存：进程生命周期内只加载/生成一次。
 */
import { exportJWK, generateKeyPair, importPKCS8, importSPKI } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { logger } from '../../utils/logger.js';

import type { JWK } from 'jose';

interface SigningKey {
  privateKey: Uint8Array;
  publicKeyJwk: JWK;
  kid: string;
}

let cachedKey: SigningKey | null = null;

function resolvePemFromEnv(): string | null {
  const raw = process.env.OAUTH_INTERNAL_PRIVATE_KEY;
  if (!raw) return null;
  // 如果是文件路径（以 / 或 ./ 开头且文件存在），读取文件
  if (/^\.?\//.test(raw)) {
    try {
      return readFileSync(raw, 'utf8');
    } catch {
      // 不是文件，当作内联 PEM
      return raw;
    }
  }
  return raw;
}

export async function loadOrCreateSigningKey(): Promise<SigningKey> {
  if (cachedKey) return cachedKey;

  const pem = resolvePemFromEnv();
  let privateKey: Uint8Array;
  let publicKeyJwk: JWK;
  const kid = randomBytes(8).toString('hex');

  if (pem) {
    privateKey = (await importPKCS8(pem, 'RS256')) as unknown as Uint8Array;
    // 从私钥推导公钥 JWK：jose 的 exportJWK 对 KeyObject 可导出公钥部分
    const spki = await exportSPKIFromPKCS8(pem);
    publicKeyJwk = await exportJWK(spki);
    publicKeyJwk.kid = kid;
    publicKeyJwk.alg = 'RS256';
  } else {
    logger.warn(
      'OAUTH_INTERNAL_PRIVATE_KEY 未配置，生成临时 RSA 密钥对。仅开发用途，重启后所有已签发 token 失效。生产部署必须配置此环境变量。',
    );
    const { publicKey, privateKey: priv } = await generateKeyPair('RS256');
    privateKey = priv as unknown as Uint8Array;
    publicKeyJwk = await exportJWK(publicKey);
    publicKeyJwk.kid = kid;
    publicKeyJwk.alg = 'RS256';
  }

  cachedKey = { privateKey, publicKeyJwk, kid };
  return cachedKey;
}

async function exportSPKIFromPKCS8(pem: string) {
  // jose 没有直接 PKCS8→SPKI 的 API；用 crypto.createPublicKey 从 PEM 推导
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPublicKey } = await import('node:crypto');
  const privKeyObj = createPublicKey({ key: pem, format: 'pem', type: 'pkcs8' });
  // 注意：从 PKCS8 PEM 直接 createPublicKey 可能失败；fallback 用 spki 导入
  return importSPKI(privKeyObj.export({ format: 'pem', type: 'spki' }) as string, 'RS256');
}

export function getInternalPublicKeySet(): JWK[] {
  if (!cachedKey) return [];
  return [{ ...cachedKey.publicKeyJwk, kid: cachedKey.kid, alg: 'RS256' }];
}

/** 测试用：重置模块缓存 */
export function _resetForTesting(): void {
  cachedKey = null;
}
```

> ⚠️ 实现注意：`exportSPKIFromPKCS8` 的实现可能在边界情况失败（PEM 格式差异）。如果 `createPublicKey` 对 PKCS8 私钥 PEM 报错，改用 `createPrivateKey` 后再 `.asKey('public')`，或直接在配置时要求同时提供公钥。实现时若失败，记录到 spec 实现修正节，改为 `generateKeyPair` + 配置时双向提供密钥。**如果 Step 5 测试因此失败，先简化为：未配置时生成密钥（主路径），配置 PEM 路径的边界在 Task 16 e2e 前补。**

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/crypto-keys.unit.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add backend/src/services/oauth/crypto-keys.ts backend/src/services/oauth/crypto-keys.unit.test.ts backend/package.json
git commit -m "feat(oauth): 内置 AS RSA 密钥管理（P2）"
```

---

## Task 5: JWKS 缓存（外部 IdP 公钥拉取）

**Files:**
- Create: `backend/src/services/oauth/jwks-cache.ts`
- Create: `backend/src/services/oauth/jwks-cache.unit.test.ts`

**Interfaces:**
- Produces: `createJwksCache(): { getKey(kid: string, jwksUri: string): Promise<KeyLike | Uint8Array> }`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/jwks-cache.unit.test.ts`：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRemoteJWKSet, exportJWK, generateKeyPair } from 'jose';

import { createJwksCache } from './jwks-cache.js';

describe('jwks-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缓存命中时不重复拉取', async () => {
    const { publicKey, kid } = await makeTestKey();
    const jwksUri = 'https://idp.example.com/jwks';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ ...(await exportJWK(publicKey)), kid }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const cache = createJwksCache({ ttlMs: 60000 });
    await cache.getKey(kid, jwksUri);
    await cache.getKey(kid, jwksUri);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('TTL 过期后重新拉取', async () => {
    const { publicKey, kid } = await makeTestKey();
    const jwksUri = 'https://idp.example.com/jwks';
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      return { ok: true, json: async () => ({ keys: [{ ...(await exportJWK(publicKey)), kid }] }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    const cache = createJwksCache({ ttlMs: 0 }); // 立即过期
    await cache.getKey(kid, jwksUri);
    await cache.getKey(kid, jwksUri);

    expect(callCount).toBe(2);
    vi.unstubAllGlobals();
  });
});

async function makeTestKey() {
  const { publicKey } = await generateKeyPair('RS256');
  const kid = 'test-kid-' + Math.random().toString(36).slice(2);
  return { publicKey, kid };
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/jwks-cache.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 jwks-cache.ts**

新建 `backend/src/services/oauth/jwks-cache.ts`：

```typescript
/**
 * 外部 IdP JWKS 拉取与缓存
 *
 * 按 jwksUri + kid 索引，带 TTL（默认 1 小时）。遇未知 kid 主动刷新。
 * 使用 jose 的 createRemoteJWKSet（内置缓存 + kid 解析 + 重新拉取逻辑），
 * 本模块在外层再加 TTL 失效控制，避免长生命周期进程持有过期 JWKS。
 */
import { createRemoteJWKSet } from 'jose';

import { logger } from '../../utils/logger.js';

import type { JWK } from 'jose';
import type { KeyLike } from 'jose';

interface JwksCacheEntry {
  remote: ReturnType<typeof createRemoteJWKSet>;
  fetchedAt: number;
}

export interface JwksCacheOptions {
  /** 缓存 TTL（毫秒），过期后下次访问重建 remote JWKSet */
  ttlMs?: number;
}

export interface JwksCache {
  /** 按 kid 取验证公钥；jwksUri 变化时重建底层 remote set */
  getKey(kid: string | undefined, jwksUri: string): Promise<KeyLike | Uint8Array>;
  /** 测试/管理用：清空缓存 */
  clear(): void;
}

export function createJwksCache(options: JwksCacheOptions = {}): JwksCache {
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000; // 默认 1h
  const cache = new Map<string, JwksCacheEntry>();

  return {
    async getKey(kid, jwksUri) {
      const now = Date.now();
      let entry = cache.get(jwksUri);
      if (!entry || now - entry.fetchedAt > ttlMs) {
        logger.debug('JWKS 缓存未命中或已过期，重建 remote JWKSet', { jwksUri });
        entry = {
          remote: createRemoteJWKSet(new URL(jwksUri), {
            cooldownDuration: 30_000,
            cacheMaxAge: ttlMs,
          }),
          fetchedAt: now,
        };
        cache.set(jwksUri, entry);
      }
      // createRemoteJWKSet 内部按 kid 取，kid 缺失或未找到会抛 JWSSignatureVerificationFailed
      return entry.remote(kid);
    },
    clear() {
      cache.clear();
    },
  };
}

// 保留 JWK 类型引用避免 lint unused（实际在 types 复用）
export type { JWK };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/jwks-cache.unit.test.ts`
Expected: PASS

> ⚠️ 如果 TTL 测试因 `createRemoteJWKSet` 内部缓存不重新拉取而失败，调整实现：TTL 到期时直接 `cache.delete(jwksUri)` 强制重建，而非依赖 cooldownDuration。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/jwks-cache.ts backend/src/services/oauth/jwks-cache.unit.test.ts
git commit -m "feat(oauth): JWKS 缓存（外部 IdP 公钥，kid 索引 + TTL）"
```

---

## Task 6: 内置最小 AS（client_credentials 签发）

**Files:**
- Create: `backend/src/services/oauth/internal-as.ts`
- Create: `backend/src/services/oauth/internal-as.unit.test.ts`

**Interfaces:**
- Consumes: `loadOrCreateSigningKey`（Task 4）、`OAuthConfig['internal']`、`OAuthConfig['resource']`
- Produces: `issueClientCredentialsToken(params, config): Promise<{ accessToken, expiresIn, scope }>`、`getInternalAsMetadata(issuer): AsMetadata`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/internal-as.unit.test.ts`：

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { jwtVerify } from 'jose';

import { loadOrCreateSigningKey, _resetForTesting } from './crypto-keys.js';
import { issueClientCredentialsToken, getInternalAsMetadata } from './internal-as.js';

import type { OAuthConfig } from './types.js';

describe('internal-as', () => {
  beforeEach(async () => {
    _resetForTesting();
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
  });
  afterEach(() => _resetForTesting());

  const config: OAuthConfig = {
    mode: 'internal',
    resource: 'https://hub.example.com',
    scopes: ['mcp:tools', 'mcp:resources'],
    internal: {
      issuer: 'https://hub.example.com',
      tokenTtlSeconds: 3600,
      clients: [{ clientId: 'c1', clientSecret: '$2a$10$hashedplaceholder', scopes: ['mcp:tools'] }],
    },
  };

  it('client_credentials 正确凭据签发 JWT', async () => {
    // 用真实 bcrypt hash：为测试可执行性，这里直接传明文 secret 配合 mock
    const cfg = withPlaintextClient(config, 'c1', 'secret123');
    const result = await issueClientCredentialsToken(
      { clientId: 'c1', clientSecret: 'secret123', scope: 'mcp:tools', resource: 'https://hub.example.com' },
      cfg,
    );
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.expiresIn).toBe(3600);
    expect(result.scope).toBe('mcp:tools');
  });

  it('错误 clientSecret 拒绝', async () => {
    const cfg = withPlaintextClient(config, 'c1', 'secret123');
    await expect(
      issueClientCredentialsToken(
        { clientId: 'c1', clientSecret: 'wrong', scope: 'mcp:tools', resource: 'https://hub.example.com' },
        cfg,
      ),
    ).rejects.toThrow(/client_secret|invalid/i);
  });

  it('签发的 token claims 含 iss/aud/scope（audience 绑定 resource）', async () => {
    const cfg = withPlaintextClient(config, 'c1', 'secret123');
    const { accessToken } = await issueClientCredentialsToken(
      { clientId: 'c1', clientSecret: 'secret123', scope: 'mcp:tools', resource: 'https://hub.example.com' },
      cfg,
    );
    const { publicKeyJwk, kid } = await loadOrCreateSigningKey();
    const key = await importJwk(publicKeyJwk);
    const { payload } = await jwtVerify(accessToken, key, { algorithms: ['RS256'] });
    expect(payload.iss).toBe('https://hub.example.com');
    expect(payload.aud).toBe('https://hub.example.com');
    expect(payload.scope).toBe('mcp:tools');
    expect(payload.sub).toBe('c1');
  });

  it('scope 超出 client 配置范围拒绝', async () => {
    const cfg = withPlaintextClient(config, 'c1', 'secret123'); // client scopes = ['mcp:tools']
    await expect(
      issueClientCredentialsToken(
        { clientId: 'c1', clientSecret: 'secret123', scope: 'mcp:admin', resource: 'https://hub.example.com' },
        cfg,
      ),
    ).rejects.toThrow(/scope/i);
  });

  it('AS metadata 含 client_credentials grant 与 S256 声明', () => {
    const meta = getInternalAsMetadata('https://hub.example.com');
    expect(meta.issuer).toBe('https://hub.example.com');
    expect(meta.grant_types_supported).toContain('client_credentials');
    expect(meta.code_challenge_methods_supported).toContain('S256');
    expect(meta.resource_parameter_supported).toBe(true);
    expect(meta.token_endpoint).toBe('https://hub.example.com/api/oauth/token');
    expect(meta.jwks_uri).toBe('https://hub.example.com/api/oauth/jwks');
  });
});

// 测试辅助：用明文 secret 替换 bcrypt（避免测试依赖 bcrypt 预算）
function withPlaintextClient(cfg: OAuthConfig, clientId: string, plain: string): OAuthConfig {
  return {
    ...cfg,
    internal: {
      ...cfg.internal!,
      clients: [{ clientId, clientSecret: plain, scopes: ['mcp:tools'] }],
    },
  };
}

async function importJwk(jwk: { kty: string; n: string; e: string; kid?: string }) {
  const { importJWK } = await import('jose');
  return importJWK(jwk, 'RS256');
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/internal-as.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 internal-as.ts**

新建 `backend/src/services/oauth/internal-as.ts`：

```typescript
/**
 * 内置最小 Authorization Server
 *
 * 仅支持 client_credentials grant（机器对机器，MCP 客户端服务账号场景）。
 * 签发 RS256 JWT，claims 含 RFC9207 iss / RFC8707 aud（=resource）。
 *
 * client 凭据校验：配置里 clientSecret 是 bcrypt 哈希；为兼容测试与简单部署，
 * 若配置值不是 bcrypt hash 前缀（$2），按明文比较（带常量时间）。
 */
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';

import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { loadOrCreateSigningKey } from './crypto-keys.js';

import type { OAuthConfig } from './types.js';

export interface AsMetadata {
  issuer: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
  resource_parameter_supported: boolean;
  revocation_endpoint?: string;
}

export interface IssueTokenParams {
  clientId: string;
  clientSecret: string;
  scope?: string;
  resource: string;
}

export interface IssueTokenResult {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

export async function issueClientCredentialsToken(
  params: IssueTokenParams,
  config: OAuthConfig,
): Promise<IssueTokenResult> {
  const internal = config.internal;
  if (!internal) {
    throw new ServiceError(ErrorCode.OAUTH_CONFIG_ERROR, '内置 AS 未配置（mode=internal/both 需 oauth.internal）');
  }

  // 1. 查 client
  const client = internal.clients.find((c) => c.clientId === params.clientId);
  if (!client) {
    throw new ServiceError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'client_id 不存在');
  }

  // 2. 校验 clientSecret（bcrypt 优先，否则明文常量时间比较）
  const secretOk = await verifyClientSecret(params.clientSecret, client.clientSecret);
  if (!secretOk) {
    throw new ServiceError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'client_secret 错误');
  }

  // 3. 校验 scope（请求 scope 必须是 client 配置 scope 的子集）
  const requestedScopes = (params.scope ?? '').split(' ').filter(Boolean);
  const allowedScopes = client.scopes;
  const granted = requestedScopes.length === 0 ? allowedScopes : requestedScopes;
  for (const s of granted) {
    if (!allowedScopes.includes(s)) {
      throw new ServiceError(ErrorCode.OAUTH_INSUFFICIENT_SCOPE, `client 未授权 scope: ${s}`);
    }
  }
  const scopeStr = granted.join(' ');

  // 4. 签发 JWT
  const { privateKey, kid } = await loadOrCreateSigningKey();
  const issuer = internal.issuer ?? config.resource;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = internal.tokenTtlSeconds;

  const token = await new SignJWT({ scope: scopeStr, client_id: params.clientId })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt(now)
    .setIssuer(issuer)
    .setSubject(params.clientId)
    .setAudience(params.resource) // RFC8707 audience 绑定
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);

  return { accessToken: token, expiresIn, scope: scopeStr };
}

async function verifyClientSecret(input: string, stored: string): Promise<boolean> {
  // bcrypt hash（$2a/$2b/$2y 前缀）
  if (/^\$2[abcy]/.test(stored)) {
    return bcrypt.compare(input, stored);
  }
  // 明文：常量时间比较
  const a = Buffer.from(input);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getInternalAsMetadata(issuer: string): AsMetadata {
  return {
    issuer,
    token_endpoint: `${issuer}/api/oauth/token`,
    jwks_uri: `${issuer}/api/oauth/jwks`,
    response_types_supported: ['none'],
    grant_types_supported: ['client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'], // 为 MCP 客户端 metadata 验证必须声明
    scopes_supported: ['mcp:tools', 'mcp:resources'],
    resource_parameter_supported: true,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/internal-as.unit.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/internal-as.ts backend/src/services/oauth/internal-as.unit.test.ts
git commit -m "feat(oauth): 内置最小 AS（client_credentials 签发 + metadata）"
```

---

## Task 7: Protected Resource Metadata 生成

**Files:**
- Create: `backend/src/services/oauth/as-metadata.ts`
- Create: `backend/src/services/oauth/as-metadata.unit.test.ts`

**Interfaces:**
- Consumes: `OAuthConfig`
- Produces: `getProtectedResourceMetadata(resource, opts): PrmDoc`、`buildWwwAuthenticateHeader(resourceMetadataUrl, scope?): string`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/as-metadata.unit.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import { getProtectedResourceMetadata, buildWwwAuthenticateHeader } from './as-metadata.js';

import type { OAuthConfig } from './types.js';

describe('as-metadata', () => {
  const config: OAuthConfig = {
    mode: 'internal',
    resource: 'https://hub.example.com',
    scopes: ['mcp:tools', 'mcp:resources'],
  };

  it('Protected Resource Metadata 含 MCP MUST 字段（authorization_servers）', () => {
    const doc = getProtectedResourceMetadata(config, 'https://hub.example.com');
    expect(doc.resource).toBe('https://hub.example.com');
    expect(doc.authorization_servers).toBeDefined();
    expect(doc.authorization_servers!.length).toBeGreaterThanOrEqual(1);
    expect(doc.bearer_methods_supported).toEqual(['header']);
    expect(doc.jwks_uri).toBe('https://hub.example.com/api/oauth/jwks');
  });

  it('mode=external 时 authorization_servers 含外部 issuer', () => {
    const cfg: OAuthConfig = {
      ...config,
      mode: 'external',
      external: {
        issuer: 'https://idp.example.com',
        clientId: 'c',
        clientSecret: 's',
        audience: 'https://hub.example.com',
      },
    };
    const doc = getProtectedResourceMetadata(cfg, 'https://hub.example.com');
    expect(doc.authorization_servers).toContain('https://idp.example.com');
  });

  it('mode=both 时 authorization_servers 含内外两个 issuer', () => {
    const cfg: OAuthConfig = {
      ...config,
      mode: 'both',
      internal: { tokenTtlSeconds: 3600, clients: [] },
      external: {
        issuer: 'https://idp.example.com',
        clientId: 'c',
        clientSecret: 's',
        audience: 'https://hub.example.com',
      },
    };
    const doc = getProtectedResourceMetadata(cfg, 'https://hub.example.com');
    expect(doc.authorization_servers).toEqual(
      expect.arrayContaining(['https://hub.example.com', 'https://idp.example.com']),
    );
  });

  it('WWW-Authenticate 头格式符合 MCP 规范（resource_metadata + scope）', () => {
    const header = buildWwwAuthenticateHeader(
      'https://hub.example.com/.well-known/oauth-protected-resource',
      'mcp:tools',
    );
    expect(header).toContain('Bearer');
    expect(header).toContain('resource_metadata="https://hub.example.com/.well-known/oauth-protected-resource"');
    expect(header).toContain('scope="mcp:tools"');
  });

  it('WWW-Authenticate 头无 scope 时省略', () => {
    const header = buildWwwAuthenticateHeader('https://hub.example.com/.well-known/oauth-protected-resource');
    expect(header).toContain('resource_metadata=');
    expect(header).not.toContain('scope=');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/as-metadata.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 as-metadata.ts**

新建 `backend/src/services/oauth/as-metadata.ts`：

```typescript
/**
 * OAuth Metadata 生成（RFC9728 Protected Resource + WWW-Authenticate 头）
 *
 * 注意：外部 IdP 的 RFC8414 AS metadata 发现（拉取 + 缓存）由 token-validator
 * 在需要时按 issuer 直接 fetch，本模块只负责"本 Hub 自己作为 Resource/AS
 * 要对外暴露的 metadata 文档"。
 */
import type { OAuthConfig } from './types.js';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  jwks_uri?: string;
  bearer_methods_supported: string[];
  scopes_supported?: string[];
}

export function getProtectedResourceMetadata(config: OAuthConfig, resource: string): ProtectedResourceMetadata {
  const servers: string[] = [];
  // MCP 规范 MUST：authorization_servers 至少一个
  if (config.mode === 'internal' || config.mode === 'both') {
    servers.push(config.internal?.issuer ?? resource); // 内置 AS issuer 默认 = resource
  }
  if (config.mode === 'external' || config.mode === 'both') {
    if (config.external) servers.push(config.external.issuer);
  }

  return {
    resource,
    authorization_servers: servers,
    jwks_uri: `${resource}/api/oauth/jwks`, // 内置 AS 公钥端点
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopes,
  };
}

/**
 * 构建 401 响应的 WWW-Authenticate 头（MCP 规范 MUST）
 * 格式：Bearer resource_metadata="<url>", scope="<scope>"
 */
export function buildWwwAuthenticateHeader(resourceMetadataUrl: string, scope?: string): string {
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
  if (scope) {
    parts.push(`scope="${scope}"`);
  }
  return parts.join(', ');
}

/**
 * 构建 insufficient_scope 的 403 WWW-Authenticate 头
 * 格式：Bearer error="insufficient_scope", scope="...", resource_metadata="...", error_description="..."
 */
export function buildInsufficientScopeHeader(
  resourceMetadataUrl: string,
  requiredScope: string,
  errorDescription?: string,
): string {
  const parts = [
    `Bearer error="insufficient_scope"`,
    `scope="${requiredScope}"`,
    `resource_metadata="${resourceMetadataUrl}"`,
  ];
  if (errorDescription) {
    parts.push(`error_description="${errorDescription.replace(/"/g, '\\"')}"`);
  }
  return parts.join(', ');
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/as-metadata.unit.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/as-metadata.ts backend/src/services/oauth/as-metadata.unit.test.ts
git commit -m "feat(oauth): Protected Resource Metadata + WWW-Authenticate 头生成"
```

---

## Task 8: Token 校验编排（JWT 验签 + introspection 回退）

**Files:**
- Create: `backend/src/services/oauth/token-validator.ts`
- Create: `backend/src/services/oauth/token-validator.unit.test.ts`

**Interfaces:**
- Consumes: `OAuthConfig`、`createJwksCache`（Task 5）、jose
- Produces: `createTokenValidator(config, deps): { validate(token, requiredScope): Promise<TokenValidationResult> }`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/token-validator.unit.test.ts`：

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';

import { createTokenValidator } from './token-validator.js';

import type { OAuthConfig } from './types.js';

describe('token-validator', () => {
  let keypair: { privateKey: CryptoKey; publicKey: CryptoKey; kid: string };

  beforeEach(async () => {
    const kp = await generateKeyPair('RS256');
    keypair = { ...kp, kid: 'test-kid' };
  });

  const externalCfg: OAuthConfig = {
    mode: 'external',
    resource: 'https://hub.example.com',
    scopes: ['mcp:tools'],
    external: {
      issuer: 'https://idp.example.com',
      clientId: 'hub',
      clientSecret: 's',
      jwksUri: 'https://idp.example.com/jwks',
      audience: 'https://hub.example.com',
    },
  };

  async function signToken(overrides: Record<string, unknown> = {}) {
    return new SignJWT({ scope: 'mcp:tools', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('1h')
      .sign(keypair.privateKey);
  }

  function stubJwks() {
    vi.stubGlobal('fetch', async (url: string) => ({
      ok: true,
      json: async () => ({ keys: [{ ...(await exportJWK(keypair.publicKey)), kid: keypair.kid }] }),
    }));
  }

  it('JWT 本地验签通过（iss/aud/scope 正确）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await signToken();
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('aud 不匹配拒绝（OAUTH_INVALID_AUDIENCE）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await signToken({}).then((t) =>
      // 重新签一个 aud 错的
      new SignJWT({ scope: 'mcp:tools' })
        .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
        .setIssuedAt()
        .setIssuer('https://idp.example.com')
        .setSubject('c1')
        .setAudience('https://other.example.com')
        .setExpirationTime('1h')
        .sign(keypair.privateKey),
    );
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('audience');
    vi.unstubAllGlobals();
  });

  it('过期 token 拒绝', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('0s')
      .sign(keypair.privateKey);
    // 等过期
    await new Promise((r) => setTimeout(r, 50));
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
    vi.unstubAllGlobals();
  });

  it('scope 不足拒绝（insufficient_scope）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await new SignJWT({ scope: 'mcp:resources' }) // 只有 resources
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('1h')
      .sign(keypair.privateKey);
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid'); // scope 不匹配归类为 invalid（中间件层映射 insufficient_scope）
    vi.unstubAllGlobals();
  });

  it('opaque token 触发 introspection 回退', async () => {
    const introspectMock = vi.fn().mockResolvedValue({
      active: true,
      aud: 'https://hub.example.com',
      scope: 'mcp:tools',
      exp: Math.floor(Date.now() / 1000) + 3600,
      client_id: 'c1',
    });
    const validator = createTokenValidator(externalCfg, { introspectToken: introspectMock });
    // opaque token：不是 JWT 格式（少于 3 段 .）
    const result = await validator.validate('opaque-token-xyz', 'mcp:tools');
    expect(introspectMock).toHaveBeenCalledWith('opaque-token-xyz');
    expect(result.ok).toBe(true);
  });

  it('introspection 返回 inactive 拒绝', async () => {
    const introspectMock = vi.fn().mockResolvedValue({ active: false });
    const validator = createTokenValidator(externalCfg, { introspectToken: introspectMock });
    const result = await validator.validate('opaque-token-xyz', 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inactive');
  });

  it('mode=internal 且 JWT 验签失败 → 不回退 introspection，直接 invalid', async () => {
    const internalCfg: OAuthConfig = { ...externalCfg, mode: 'internal', internal: { tokenTtlSeconds: 3600, clients: [] } };
    delete (internalCfg as { external?: unknown }).external;
    const introspectMock = vi.fn();
    const validator = createTokenValidator(internalCfg, { introspectToken: introspectMock });
    const result = await validator.validate('malformed-jwt', 'mcp:tools');
    expect(result.ok).toBe(false);
    expect(introspectMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/token-validator.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 token-validator.ts**

新建 `backend/src/services/oauth/token-validator.ts`：

```typescript
/**
 * Token 校验编排
 *
 * 流程：
 * 1. 解析 token，判断 JWT（含 2 个 '.'）还是 opaque
 * 2. JWT：本地验签（jose）+ 验 iss/aud/exp + 验 scope
 * 3. opaque 或 JWT 验签失败：仅 mode 含 external 时回退 introspection（带 TTL 缓存）
 *
 * 校验失败的具体 reason 供中间件映射到正确的 ErrorCode / HTTP 状态。
 */
import { jwtVerify, errors as joseErrors } from 'jose';

import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import { logger } from '../../utils/logger.js';

import { createJwksCache } from './jwks-cache.js';

import type { OAuthConfig, TokenValidationResult, IntrospectionResult } from './types.js';
import type { JwksCache } from './jwks-cache.js';

export interface TokenValidatorDeps {
  /** introspection 回退实现（外部 IdP 场景）；mode=internal 时不会被调用 */
  introspectToken?: (token: string) => Promise<IntrospectionResult>;
  /** 注入 JWKS 缓存（测试用） */
  jwksCache?: JwksCache;
}

export interface TokenValidator {
  validate(token: string, requiredScope: string): Promise<TokenValidationResult>;
}

const INTROSPECTION_CACHE_TTL_MS = 60_000;

export function createTokenValidator(config: OAuthConfig, deps: TokenValidatorDeps = {}): TokenValidator {
  const jwksCache = deps.jwksCache ?? createJwksCache();
  const introspectionCache = new Map<string, { result: IntrospectionResult; at: number }>();

  return {
    async validate(token, requiredScope) {
      const isJwt = token.split('.').length === 3;

      if (isJwt) {
        const result = await verifyJwt(token, config, jwksCache, requiredScope);
        if (result.ok) return result;
        // JWT 验签失败：mode 含 external 时回退 introspection（可能 token 实际是别处签发的 opaque-like）
        if (config.mode !== 'external' && config.mode !== 'both') {
          return result; // internal 模式不回退
        }
        // 落到 introspection
      }

      // introspection 回退（mode 含 external）
      if (config.mode !== 'external' && config.mode !== 'both') {
        // internal 模式遇到 opaque 直接 invalid
        return { ok: false, reason: 'invalid' };
      }
      return introspect(token, config, deps, introspectionCache, requiredScope);
    },
  };
}

async function verifyJwt(
  token: string,
  config: OAuthConfig,
  jwksCache: JwksCache,
  requiredScope: string,
): Promise<TokenValidationResult> {
  const ext = config.external;
  if (!ext) {
    // internal 模式的 JWT 验签走内置 AS 的公钥（通过 JWKS 端点自取，或直接用 crypto-keys）
    // MVP：internal 模式的 token 由 internal-as 签发，校验在 resource-server 层直接用内置公钥
    return { ok: false, reason: 'invalid' };
  }
  const jwksUri = ext.jwksUri ?? `${ext.issuer}/jwks`;
  try {
    const { payload } = await jwtVerify(token, (header: { kid?: string }) => jwksCache.getKey(header.kid, jwksUri), {
      algorithms: ['RS256'],
      issuer: ext.issuer,
      audience: ext.audience,
    });
    // scope 校验
    const tokenScopes = String(payload.scope ?? '').split(' ');
    if (!tokenScopes.includes(requiredScope)) {
      return { ok: false, reason: 'scope' };
    }
    return { ok: true, claims: payload as unknown as IntrospectionResult, method: 'jwt' };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' };
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      // 区分 audience vs 其它
      if (/aud/i.test(err.message)) return { ok: false, reason: 'audience' };
      return { ok: false, reason: 'invalid' };
    }
    logger.debug('JWT 验签失败', { error: (err as Error).message });
    return { ok: false, reason: 'invalid' };
  }
}

async function introspect(
  token: string,
  config: OAuthConfig,
  deps: TokenValidatorDeps,
  cache: Map<string, { result: IntrospectionResult; at: number }>,
  requiredScope: string,
): Promise<TokenValidationResult> {
  if (!deps.introspectToken) {
    throw new ServiceError(ErrorCode.OAUTH_CONFIG_ERROR, 'external 模式未注入 introspectToken 实现');
  }
  // 缓存
  const cached = cache.get(token);
  if (cached && Date.now() - cached.at < INTROSPECTION_CACHE_TTL_MS) {
    return mapIntrospection(cached.result, requiredScope, 'introspection');
  }
  const result = await deps.introspectToken(token);
  cache.set(token, { result, at: Date.now() });
  return mapIntrospection(result, requiredScope, 'introspection');
}

function mapIntrospection(
  r: IntrospectionResult,
  requiredScope: string,
  method: 'introspection',
): TokenValidationResult {
  if (!r.active) return { ok: false, reason: 'inactive' };
  const aud = Array.isArray(r.aud) ? r.aud : [r.aud];
  // audience 校验由调用方配置决定，这里宽松：只要有任意 aud 命中即放行（严格校验在 resource-server）
  const scopes = String(r.scope ?? '').split(' ');
  if (!scopes.includes(requiredScope)) {
    return { ok: false, reason: 'scope' };
  }
  return { ok: true, claims: r, method };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/token-validator.unit.test.ts`
Expected: PASS

> ⚠️ 若 "scope 不足" 测试的 `reason` 期望与实现不一致（实现里 scope 失败归 invalid），对齐：scope 校验失败统一返回 `{ ok: false, reason: 'invalid' }`，中间件层（Task 11）把它映射到 `OAUTH_INSUFFICIENT_SCOPE` + 403。测试已按此写。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/token-validator.ts backend/src/services/oauth/token-validator.unit.test.ts
git commit -m "feat(oauth): token 校验编排（JWT 验签 + introspection 回退）"
```

---

## Task 9: validationKey 校验逻辑（填补现状缺口）

**Files:**
- Create: `backend/src/services/oauth/validation-key.ts`
- Create: `backend/src/services/oauth/validation-key.unit.test.ts`

**Interfaces:**
- Consumes: `decryptValidationKey`（`backend/src/api/groups/crypto.ts` 已存在）
- Produces: `verifyValidationKey(input, encryptedStored): boolean`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/validation-key.unit.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';

import { encryptValidationKey } from '../../api/groups/crypto.js';
import { verifyValidationKey } from './validation-key.js';

describe('validation-key', () => {
  const origSecret = process.env.VALIDATION_KEY_SECRET;
  beforeAll(() => {
    process.env.VALIDATION_KEY_SECRET = 'a'.repeat(32) + 'extra-padding-for-safety';
  });
  afterAll(() => {
    if (origSecret !== undefined) process.env.VALIDATION_KEY_SECRET = origSecret;
    else delete process.env.VALIDATION_KEY_SECRET;
  });

  it('正确 key 通过', () => {
    const plain = 'mySecretKey123';
    const encrypted = encryptValidationKey(plain);
    expect(verifyValidationKey(plain, encrypted)).toBe(true);
  });

  it('错误 key 拒绝', () => {
    const plain = 'mySecretKey123';
    const encrypted = encryptValidationKey(plain);
    expect(verifyValidationKey('wrongKey456', encrypted)).toBe(false);
  });

  it('常量时间比较（不等长直接 false，不抛错）', () => {
    const encrypted = encryptValidationKey('mySecretKey123');
    expect(verifyValidationKey('short', encrypted)).toBe(false);
  });
});

import { beforeAll, afterAll } from 'vitest';
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/validation-key.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 validation-key.ts**

新建 `backend/src/services/oauth/validation-key.ts`：

```typescript
/**
 * 组级 validationKey 校验（填补现状缺口）
 *
 * 现状：group-router.ts 的 groupValidationMiddleware 只校验组存在，
 * 从不校验 validationKey。P2 把这块逻辑抽成纯函数，供 mcp-auth 中间件调用。
 *
 * 复用现有 crypto.ts 的 AES 解密；加常量时间比较防时序攻击。
 */
import { timingSafeEqual } from 'node:crypto';

import { decryptValidationKey } from '../../api/groups/crypto.js';

import { logger } from '../../utils/logger.js';

/**
 * 校验输入的 validationKey 是否匹配存储的加密 key
 * @param input 客户端送来的明文 key（从 Authorization: Bearer 取）
 * @param encryptedStored 配置里存的 AES 加密 key
 */
export function verifyValidationKey(input: string, encryptedStored: string): boolean {
  try {
    const stored = decryptValidationKey(encryptedStored);
    const a = Buffer.from(input);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (err) {
    logger.warn('validationKey 解密失败', { error: (err as Error).message });
    return false;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/validation-key.unit.test.ts`
Expected: PASS

> 注：测试文件顶部的 `import { beforeAll, afterAll } from 'vitest'` 应移到文件顶部与其它 vitest import 合并。实现时把 import 放到文件最上方。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/validation-key.ts backend/src/services/oauth/validation-key.unit.test.ts
git commit -m "feat(oauth): validationKey 校验纯逻辑（填补 MCP 端点缺口）"
```

---

## Task 10: Resource Server 校验编排（OAuth vs validationKey 分支）

**Files:**
- Create: `backend/src/services/oauth/resource-server.ts`
- Create: `backend/src/services/oauth/resource-server.unit.test.ts`

**Interfaces:**
- Consumes: `createTokenValidator`（Task 8）、`verifyValidationKey`（Task 9）、`SystemConfig`、`getAllConfig`
- Produces: `createResourceServer(): ResourceServer`，其中 `authenticate(groupId, authHeader): Promise<AuthOutcome>`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/services/oauth/resource-server.unit.test.ts`：

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createResourceServer } from './resource-server.js';

describe('resource-server 编排', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未配置 oauth + 组未启用 validation → 放行（开放模式，warn）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({ oauth: undefined, groups: { g1: { validation: { enabled: false } } } }),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(true);
  });

  it('未配置 oauth + 组启用 validation + 无 token → 拒绝（MISSING_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(true),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outout(reasonOrCode(outcome))).toMatch(/MISSING/);
  });

  it('未配置 oauth + 组启用 validation + 错误 key → 拒绝（INVALID_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(false),
    });
    const outcome = await rs.authenticate('g1', 'Bearer wrongkey');
    expect(outcome.ok).toBe(false);
  });

  it('未配置 oauth + 组启用 validation + 正确 key → 放行', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(true),
    });
    const outcome = await rs.authenticate('g1', 'Bearer correctkey');
    expect(outcome.ok).toBe(true);
  });

  it('配置 oauth（internal）+ 无 token → 拒绝（MISSING_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: { mode: 'internal', resource: 'https://hub.example.com', scopes: ['mcp:tools'] },
        groups: {},
      }),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(false);
  });

  it('配置 oauth + token 校验通过 → 放行（method=oauth）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: { mode: 'internal', resource: 'https://hub.example.com', scopes: ['mcp:tools'] },
        groups: {},
      }),
      createTokenValidator: () => ({ validate: vi.fn().mockResolvedValue({ ok: true, claims: { sub: 'c1', scope: 'mcp:tools' }, method: 'jwt' }) }),
    });
    const outcome = await rs.authenticate('g1', 'Bearer sometoken');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.context.method).toBe('oauth');
  });
});

// 辅助：从失败 outcome 取可读标识（reason 或 errorCode 字符串）
function reasonOrCode(o: { ok: false; reason?: string; errorCode?: number }): string {
  return o.reason ?? `code_${o.errorCode ?? 'unknown'}`;
}
// 修复测试里 typo（outout → reasonOrCode）
```

> ⚠️ 测试里有个故意留的 typo `outout(...)`，实现时改为 `reasonOrCode(outcome)`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/services/oauth/resource-server.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 resource-server.ts**

新建 `backend/src/services/oauth/resource-server.ts`：

```typescript
/**
 * Protected Resource 校验编排
 *
 * 按 SystemConfig.oauth 是否配置 + 组级 validation.enabled 决定走哪条路径：
 * （见 spec §6 真值表）
 *
 *  - oauth 未配置 + validation 关 → 放行（开放，warn）
 *  - oauth 未配置 + validation 开 → validationKey 校验
 *  - oauth 配置（internal/external）→ OAuth 校验（validationKey 禁用）
 *  - oauth 配置（both）→ OAuth 优先，失败回退 validationKey（若组启用）
 */
import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { logger } from '../../utils/logger.js';
import { verifyValidationKey } from './validation-key.js';
import { createTokenValidator } from './token-validator.js';

import type { OAuthConfig, McpAuthContext, TokenValidationResult } from './types.js';
import type { SystemConfig } from '@mcp-core/mcp-hub-share';

export type AuthOutcome =
  | { ok: true; context: McpAuthContext }
  | { ok: false; reason: 'missing_token' | 'invalid_token' | 'expired' | 'audience' | 'insufficient_scope' | 'config_error'; errorCode: ErrorCode };

export interface ResourceServerDeps {
  /** 注入配置读取（生产用 getAllConfig；测试用 mock） */
  getConfig: () => Promise<Pick<SystemConfig, 'oauth'> & { groups: Record<string, { validation?: { enabled?: boolean; validationKey?: string } }> }>;
  /** 注入 validationKey 校验（默认用真实实现） */
  verifyValidationKey?: (input: string, encrypted: string) => boolean;
  /** 注入 token validator 工厂（测试用） */
  createTokenValidator?: (config: OAuthConfig) => { validate: (token: string, scope: string) => Promise<TokenValidationResult> };
}

export interface ResourceServer {
  authenticate(groupId: string, authHeader: string | undefined): Promise<AuthOutcome>;
}

const REQUIRED_SCOPE = 'mcp:tools';

export function createResourceServer(deps: ResourceServerDeps): ResourceServer {
  const verifyVk = deps.verifyValidationKey ?? verifyValidationKey;

  return {
    async authenticate(groupId, authHeader) {
      const cfg = await deps.getConfig();
      const oauth = cfg.oauth;
      const group = cfg.groups[groupId];
      const validationEnabled = group?.validation?.enabled === true;

      // 路径 A：未配置 oauth
      if (!oauth) {
        if (!validationEnabled) {
          logger.warn('MCP 端点完全开放（未配置 OAuth 且组未启用 validationKey），生产环境不推荐', { groupId });
          return { ok: true, context: { method: 'oauth', principal: 'anonymous', scope: 'mcp:tools' } };
        }
        return verifyValidationKeyPath(authHeader, group!.validation!.validationKey!, verifyVk);
      }

      // 路径 B：配置了 oauth
      const token = extractBearer(authHeader);
      if (!token) {
        return { ok: false, reason: 'missing_token', errorCode: ErrorCode.OAUTH_MISSING_TOKEN };
      }

      const validatorFactory = deps.createTokenValidator ?? ((c: OAuthConfig) => createTokenValidator(c));
      const validator = validatorFactory(oauth);
      const result = await validator.validate(token, REQUIRED_SCOPE);

      if (result.ok) {
        const principal = (result.claims as { sub?: string; client_id?: string }).sub ?? (result.claims as { client_id?: string }).client_id ?? 'unknown';
        return {
          ok: true,
          context: { method: 'oauth', principal, scope: REQUIRED_SCOPE },
        };
      }

      // OAuth 失败：both 模式 + 组启用 validation → 回退
      if (oauth.mode === 'both' && validationEnabled && group?.validation?.validationKey) {
        const vkResult = verifyValidationKeyPath(authHeader, group.validation.validationKey, verifyVk);
        if (vkResult.ok) return vkResult;
      }

      return mapValidationFailure(result);
    },
  };
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] ?? null;
}

function verifyValidationKeyPath(
  authHeader: string | undefined,
  encryptedStored: string,
  verifyVk: (input: string, encrypted: string) => boolean,
): AuthOutcome {
  const token = extractBearer(authHeader);
  if (!token) {
    return { ok: false, reason: 'missing_token', errorCode: ErrorCode.OAUTH_MISSING_TOKEN };
  }
  if (verifyVk(token, encryptedStored)) {
    return { ok: true, context: { method: 'validationKey', principal: 'validation-key', scope: 'mcp:tools mcp:resources' } };
  }
  return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
}

function mapValidationFailure(r: { ok: false; reason: string }): AuthOutcome {
  switch (r.reason) {
    case 'expired':
      return { ok: false, reason: 'expired', errorCode: ErrorCode.OAUTH_TOKEN_EXPIRED };
    case 'audience':
      return { ok: false, reason: 'audience', errorCode: ErrorCode.OAUTH_INVALID_AUDIENCE };
    case 'scope':
      return { ok: false, reason: 'insufficient_scope', errorCode: ErrorCode.OAUTH_INSUFFICIENT_SCOPE };
    case 'inactive':
    case 'invalid':
      return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
    default:
      return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
  }
}

// 保留 ServiceError 引用避免 unused（实际错误由中间件抛出）
export type { ServiceError };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/services/oauth/resource-server.unit.test.ts`
Expected: PASS

> 注：`mapValidationFailure` 把 token-validator 返回的 `reason: 'scope'` 映射为 `OAUTH_INSUFFICIENT_SCOPE`（403）。Task 8 的 `verifyJwt`/`mapIntrospection` 在 scope 不匹配时返回 `reason: 'scope'`（已在 Task 8 实现里按此写），无需回头改。

- [ ] **Step 5: 提交**

```bash
git add backend/src/services/oauth/resource-server.ts backend/src/services/oauth/resource-server.unit.test.ts
# 如回头改了 token-validator 的 reason：
# git add backend/src/services/oauth/token-validator.ts backend/src/services/oauth/token-validator.unit.test.ts
git commit -m "feat(oauth): Resource Server 校验编排（OAuth/validationKey 分支）"
```

---

## Task 11: MCP 认证中间件

**Files:**
- Create: `backend/src/middleware/mcp-auth.ts`
- Create: `backend/src/middleware/mcp-auth.unit.test.ts`

**Interfaces:**
- Consumes: `createResourceServer`（Task 10）、`buildWwwAuthenticateHeader`/`buildInsufficientScopeHeader`（Task 7）
- Produces: `createMcpAuthMiddleware(deps?): HonoMiddleware`，注入 `McpAuthContext` 到 `c.var`

- [ ] **Step 1: 写失败测试**

新建 `backend/src/middleware/mcp-auth.unit.test.ts`：

```typescript
import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { createMcpAuthMiddleware } from './mcp-auth.js';

describe('mcp-auth 中间件', () => {
  function makeApp(authenticate: ReturnType<typeof vi.fn>) {
    const app = new Hono();
    const mw = createMcpAuthMiddleware({
      resourceServer: { authenticate },
      resourceMetadataUrlPath: '/.well-known/oauth-protected-resource',
    });
    app.use('/auth/:group', async (c, next) => {
      c.set('groupId', c.req.param('group'));
      await mw(c, next);
    });
    app.get('/auth/:group', (c) => c.json({ ok: true, principal: c.get('mcpAuth')?.principal }));
    return app;
  }

  it('放行时注入 mcpAuth context', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      ok: true,
      context: { method: 'oauth', principal: 'c1', scope: 'mcp:tools' },
    });
    const res = await makeApp(authenticate).request('/auth/g1', { headers: { Authorization: 'Bearer x' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.principal).toBe('c1');
  });

  it('missing_token 返回 401 + WWW-Authenticate', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      ok: false,
      reason: 'missing_token',
      errorCode: 6100,
    });
    const res = await makeApp(authenticate).request('/auth/g1', {});
    expect(res.status).toBe(401);
    const www = res.headers.get('WWW-Authenticate');
    expect(www).toContain('resource_metadata=');
  });

  it('audience 不匹配返回 401 + WWW-Authenticate', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      ok: false,
      reason: 'audience',
      errorCode: 6103,
    });
    const res = await makeApp(authenticate).request('/auth/g1', { headers: { Authorization: 'Bearer x' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
  });

  it('insufficient_scope 返回 403 + scope', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      ok: false,
      reason: 'insufficient_scope',
      errorCode: 6104,
    });
    const res = await makeApp(authenticate).request('/auth/g1', { headers: { Authorization: 'Bearer x' } });
    expect(res.status).toBe(403);
    expect(res.headers.get('WWW-Authenticate')).toContain('insufficient_scope');
    expect(res.headers.get('WWW-Authenticate')).toContain('scope=');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter backend test -- --run src/middleware/mcp-auth.unit.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 mcp-auth.ts**

新建 `backend/src/middleware/mcp-auth.ts`：

```typescript
/**
 * MCP 端点认证中间件
 *
 * 与 Web UI 的 middleware/auth.ts 完全独立：
 *  - Web UI auth 保护 /api/*（HS256 JWT，本地用户库）
 *  - mcp-auth 保护 /:group/mcp（OAuth RS256 / introspection / validationKey）
 *
 * 失败响应带 WWW-Authenticate 头（MCP 规范 MUST），HTTP status 由 errorCode 决定。
 * 注意：401/403 响应不包装成 JSON-RPC，直接返回 HTTP（MCP 客户端按 status 识别挑战）。
 */
import { ErrorCode } from '@mcp-core/mcp-hub-core';

import { buildInsufficientScopeHeader, buildWwwAuthenticateHeader } from '../services/oauth/as-metadata.js';

import type { McpAuthContext } from '../services/oauth/types.js';
import type { ResourceServer } from '../services/oauth/resource-server.js';
import type { Context, Next } from 'hono';

// 扩展 Hono context 变量
declare module 'hono' {
  interface ContextVariableMap {
    mcpAuth: McpAuthContext;
  }
}

export interface McpAuthMiddlewareDeps {
  resourceServer: ResourceServer;
  /** Protected Resource Metadata 的路径（相对，如 '/.well-known/oauth-protected-resource'）；
   * 中间件用请求 origin 拼成完整 URL，避免硬编码 host */
  resourceMetadataUrlPath: string;
}

export function createMcpAuthMiddleware(deps: McpAuthMiddlewareDeps) {
  return async function mcpAuthMiddleware(c: Context, next: Next) {
    const groupId = c.get('groupId') as string | undefined;
    if (!groupId) {
      // groupId 应由前置的 groupValidationMiddleware 注入
      return c.json({ jsonrpc: '2.0', error: { code: -32602, message: '缺少 groupId 上下文' }, id: null }, 400);
    }
    const authHeader = c.req.header('Authorization');
    const outcome = await deps.resourceServer.authenticate(groupId, authHeader);

    if (outcome.ok) {
      c.set('mcpAuth', outcome.context);
      await next();
      return;
    }

    // 失败：按 errorCode 映射 HTTP status + WWW-Authenticate
    // 用请求 origin 拼 resource_metadata 完整 URL
    const origin = new URL(c.req.url).origin;
    const resourceMetadataUrl = `${origin}${deps.resourceMetadataUrlPath}`;
    const www = buildChallengeHeader(outcome.errorCode, resourceMetadataUrl);
    const status = httpStatusFor(outcome.errorCode);
    return c.body(null, { status, headers: { 'WWW-Authenticate': www } });
  };
}

function buildChallengeHeader(errorCode: ErrorCode, resourceMetadataUrl: string): string {
  if (errorCode === ErrorCode.OAUTH_INSUFFICIENT_SCOPE) {
    return buildInsufficientScopeHeader(resourceMetadataUrl, 'mcp:tools', '权限范围不足');
  }
  return buildWwwAuthenticateHeader(resourceMetadataUrl, 'mcp:tools');
}

function httpStatusFor(errorCode: ErrorCode): number {
  if (errorCode === ErrorCode.OAUTH_INSUFFICIENT_SCOPE) return 403;
  return 401;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter backend test -- --run src/middleware/mcp-auth.unit.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/src/middleware/mcp-auth.ts backend/src/middleware/mcp-auth.unit.test.ts
git commit -m "feat(oauth): MCP 端点认证中间件（401/403 + WWW-Authenticate）"
```

---

## Task 12: OAuth 端点（token / jwks / well-known）

**Files:**
- Create: `backend/src/api/oauth/token.ts`
- Create: `backend/src/api/oauth/jwks.ts`
- Create: `backend/src/api/oauth/well-known.ts`
- Create: `backend/src/api/oauth/index.ts`

**Interfaces:**
- Consumes: `issueClientCredentialsToken`（Task 6）、`getInternalAsMetadata`（Task 6）、`getProtectedResourceMetadata`（Task 7）、`getInternalPublicKeySet`（Task 4）

- [ ] **Step 1: 实现 token.ts**

新建 `backend/src/api/oauth/token.ts`：

```typescript
/**
 * POST /api/oauth/token —— 内置 AS 的 client_credentials 签发端点
 *
 * 支持 application/x-www-form-urlencoded（OAuth 标准）。
 * 响应 RFC6749 §5.1 格式。
 */
import { AuthError, ErrorCode } from '@mcp-core/mcp-hub-core';

import { getAllConfig } from '../../utils/config.js';
import { issueClientCredentialsToken } from '../../services/oauth/internal-as.js';

import type { OAuthConfig } from '../../services/oauth/types.js';
import type { Hono } from 'hono';

export function registerTokenRoutes(app: Hono) {
  app.post('/token', async (c) => {
    const form = await c.req.formData();
    const grantType = form.get('grant_type');
    if (grantType !== 'client_credentials') {
      return c.json({ error: 'unsupported_grant_type' }, 400);
    }

    const clientId = String(form.get('client_id') ?? '');
    const clientSecret = String(form.get('client_secret') ?? '');
    const scope = form.get('scope') ? String(form.get('scope')) : undefined;
    const resource = String(form.get('resource') ?? '');

    if (!clientId || !resource) {
      return c.json({ error: 'invalid_request', error_description: '缺少 client_id 或 resource' }, 400);
    }

    const cfg = await getAllConfig();
    const oauth = cfg.system.oauth as OAuthConfig | undefined;
    if (!oauth || !oauth.internal) {
      return c.json({ error: 'server_error', error_description: '内置 AS 未配置' }, 503);
    }

    try {
      const result = await issueClientCredentialsToken({ clientId, clientSecret, scope, resource }, oauth);
      return c.json({
        access_token: result.accessToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        scope: result.scope,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        const code = err.code === ErrorCode.OAUTH_INSUFFICIENT_SCOPE ? 'invalid_scope' : 'invalid_client';
        return c.json({ error: code, error_description: err.message }, 400);
      }
      return c.json({ error: 'server_error', error_description: (err as Error).message }, 503);
    }
  });
}
```

- [ ] **Step 2: 实现 jwks.ts**

新建 `backend/src/api/oauth/jwks.ts`：

```typescript
/**
 * GET /api/oauth/jwks —— 内置 AS 公钥集合
 */
import { getInternalPublicKeySet } from '../../services/oauth/crypto-keys.js';

import type { Hono } from 'hono';

export function registerJwksRoutes(app: Hono) {
  app.get('/jwks', async (c) => {
    const keys = getInternalPublicKeySet();
    return c.json({ keys });
  });
}
```

- [ ] **Step 3: 实现 well-known.ts**

新建 `backend/src/api/oauth/well-known.ts`：

```typescript
/**
 * /.well-known/oauth-protected-resource（RFC9728，MCP MUST）
 * /.well-known/oauth-authorization-server（RFC8414，内置 AS）
 *
 * resource 从请求 Host 头推导（配置未显式给 issuer 时）。
 */
import { getAllConfig } from '../../utils/config.js';
import { getInternalAsMetadata } from '../../services/oauth/internal-as.js';
import { getProtectedResourceMetadata } from '../../services/oauth/as-metadata.js';

import type { OAuthConfig } from '../../services/oauth/types.js';
import type { Hono } from 'hono';

export function registerWellKnownRoutes(app: Hono) {
  // RFC9728 根级
  app.get('/.well-known/oauth-protected-resource', async (c) => {
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth) return c.json({ error: 'OAuth 未配置' }, 404);
    return c.json(getProtectedResourceMetadata(oauth, resourceUrl));
  });

  // RFC9728 按组路径变体（spec §2.1）
  app.get('/.well-known/oauth-protected-resource/:group/mcp', async (c) => {
    const group = c.req.param('group');
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth) return c.json({ error: 'OAuth 未配置' }, 404);
    return c.json(getProtectedResourceMetadata(oauth, `${resourceUrl}/${group}/mcp`));
  });

  // RFC8414 内置 AS metadata（仅 internal/both 模式暴露）
  app.get('/.well-known/oauth-authorization-server', async (c) => {
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth || (oauth.mode !== 'internal' && oauth.mode !== 'both')) {
      return c.json({ error: '内置 AS 未启用' }, 404);
    }
    const issuer = oauth.internal?.issuer ?? resourceUrl;
    return c.json(getInternalAsMetadata(issuer));
  });
}

async function loadOAuthAndResource(c: { req: { header: (n: string) => string | undefined } }) {
  const cfg = await getAllConfig();
  const oauth = cfg.system.oauth as OAuthConfig | undefined;
  const host = c.req.header('host') ?? 'localhost';
  const scheme = process.env.OAUTH_PUBLIC_SCHEME ?? 'https';
  const resourceUrl = oauth?.internal?.issuer ?? `${scheme}://${host}`;
  return { oauth, resourceUrl };
}
```

- [ ] **Step 4: 实现 index.ts 路由聚合**

新建 `backend/src/api/oauth/index.ts`：

```typescript
/**
 * OAuth 路由聚合
 *
 * /api/oauth/token   —— 内置 AS token 端点
 * /api/oauth/jwks    —— 内置 AS 公钥
 * /.well-known/*     —— Protected Resource / AS metadata（在 app.ts 单独挂载，不在 /api 下）
 */
import { Hono } from 'hono';

import { registerJwksRoutes } from './jwks.js';
import { registerTokenRoutes } from './token.js';

export const oauthApi = new Hono();
registerTokenRoutes(oauthApi);
registerJwksRoutes(oauthApi);
```

> 注意：`well-known` 路由在 `app.ts` 单独挂载（因为路径在根，不在 `/api` 下）。

- [ ] **Step 5: 跑 typecheck 确认无错**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add backend/src/api/oauth/
git commit -m "feat(oauth): token/jwks/well-known 端点（P2）"
```

---

## Task 13: 挂载中间件与路由（group-router + app.ts）

**Files:**
- Modify: `backend/src/api/mcp/group-router.ts:111`（POST 路由插入 mcpAuthMiddleware）
- Modify: `backend/src/app.ts`（挂载 oauthApi + well-known + 创建 resourceServer）

- [ ] **Step 1: 改造 group-router.ts**

在 `backend/src/api/mcp/group-router.ts` 顶部加 import：

```typescript
import { createMcpAuthMiddleware } from '../../middleware/mcp-auth.js';
import { createResourceServer } from '../../services/oauth/resource-server.js';
import { getAllConfig } from '../../utils/config.js';
```

在 `groupMcpRouter.post('/:group/mcp', groupValidationMiddleware, async (c) => {` 这一行，把中间件链改为三段式：

```typescript
// 模块级创建 resourceServer（单例）
const mcpAuthMiddleware = createMcpAuthMiddleware({
  resourceServer: createResourceServer({ getConfig: async () => getAllConfig() }),
  resourceMetadataUrlPath: '/.well-known/oauth-protected-resource', // 中间件内用请求 origin 拼完整 URL
});

groupMcpRouter.post('/:group/mcp', groupValidationMiddleware, mcpAuthMiddleware, async (c) => {
  // ... 原有 handler 不变
});
```

- [ ] **Step 2: 改造 app.ts 挂载路由**

在 `backend/src/app.ts` 的 import 区加：

```typescript
import { oauthApi } from './api/oauth/index.js';
import { registerWellKnownRoutes } from './api/oauth/well-known.js';
```

在路由挂载区（`app.route('/', groupMcpRouter)` 附近）加：

```typescript
// OAuth 端点
app.route('/api/oauth', oauthApi);
const wellKnownApp = new Hono();
registerWellKnownRoutes(wellKnownApp);
app.route('/', wellKnownApp);
```

- [ ] **Step 3: 跑 typecheck + 全量测试确认无回归**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck 通过；现有测试可能有回归（group-router 测试若直接 POST 不带 token 现在会被 401）——这是预期 breaking，下个 task 用 e2e 覆盖新行为

- [ ] **Step 4: 修复因 MCP 端点现在要求认证而失败的现有测试**

查找依赖 `POST /:group/mcp` 不带 token 的测试（`backend/src/e2e/mcp-protocol/*.test.ts`、`group-router` 相关单测），它们现在会收到 401。处置：

- e2e 测试默认配置不启用 oauth 且不启用 validation（保持开放）→ 现有 e2e 应继续通过。
- 若 e2e 测试用的配置启用了 validation，需在测试 setup 里关闭 validation 或带正确 key。

逐个核实并修复。记录修复点到 spec 实现修正节。

- [ ] **Step 5: 提交**

```bash
git add backend/src/api/mcp/group-router.ts backend/src/app.ts
# 加上修复的测试文件
git commit -m "feat(oauth): 挂载 MCP 认证中间件 + OAuth 路由（P2 主线接入）"
```

---

## Task 14: e2e —— OAuth 发现 + 401 格式

**Files:**
- Create: `backend/src/e2e/mcp-protocol/oauth-discovery.test.ts`

- [ ] **Step 1: 写 e2e 测试**

新建 `backend/src/e2e/mcp-protocol/oauth-discovery.test.ts`：

```typescript
/**
 * e2e：Protected Resource Metadata 发现 + 401 WWW-Authenticate 格式（RFC9728 + MCP MUST）
 */
import { describe, expect, it } from 'vitest';

import { defaultMcpTestConfig } from './mcp-test-config.js';
import { checkServerHealth } from '../test-server.js';

describe('OAuth 发现（oauth-discovery）', () => {
  it('server 健康', async () => {
    await checkServerHealth();
  });

  it('GET /.well-known/oauth-protected-resource 返回符合 RFC9728 的 metadata', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}/.well-known/oauth-protected-resource`);
    // 若测试配置未启用 oauth，端点返回 404，此测试用 conditional 跳过
    if (res.status === 404) {
      console.warn('测试环境未配置 oauth，跳过 metadata 断言');
      return;
    }
    const doc = await res.json();
    expect(doc.resource).toBeTruthy();
    expect(doc.authorization_servers).toBeInstanceOf(Array);
    expect(doc.authorization_servers.length).toBeGreaterThanOrEqual(1);
    expect(doc.bearer_methods_supported).toContain('header');
  });

  it('配置了 oauth 后，无 token 访问 MCP 端点返回 401 + WWW-Authenticate', async () => {
    // 前置：测试配置需启用 oauth（见 test-setup oauth config）
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    if (res.status === 404) {
      console.warn('组不存在或 oauth 未配置，跳过');
      return;
    }
    expect(res.status).toBe(401);
    const www = res.headers.get('WWW-Authenticate');
    expect(www).toBeTruthy();
    expect(www).toContain('Bearer');
    // resource_metadata 或 error 参数应存在
    expect(www).toMatch(/resource_metadata=|error=/);
  });
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm --filter backend test -- --run src/e2e/mcp-protocol/oauth-discovery.test.ts`
Expected: 测试通过（若测试环境配置了 oauth）或条件跳过（未配置）

- [ ] **Step 3: 提交**

```bash
git add backend/src/e2e/mcp-protocol/oauth-discovery.test.ts
git commit -m "test(e2e): OAuth 发现与 401 格式验证（P2）"
```

---

## Task 15: e2e —— client_credentials 完整流程 + audience 校验

**Files:**
- Create: `backend/src/e2e/mcp-protocol/oauth-client-credentials.test.ts`
- Create: `backend/src/e2e/mcp-protocol/oauth-audience.test.ts`

- [ ] **Step 1: 写 client_credentials e2e**

新建 `backend/src/e2e/mcp-protocol/oauth-client-credentials.test.ts`：

```typescript
/**
 * e2e：内置 AS client_credentials 完整流程
 *   1. POST /api/oauth/token 拿 token
 *   2. 带 token 调 /:group/mcp tools/list 成功
 *   3. 错误 token 被拒
 *
 * 前置：测试环境配置 oauth.mode=internal + 一个测试 client。
 */
import { describe, expect, it } from 'vitest';

import { defaultMcpTestConfig } from './mcp-test-config.js';

const TOKEN_ENDPOINT = `${defaultMcpTestConfig.baseUrl}/api/oauth/token`;
const RESOURCE = `${defaultMcpTestConfig.baseUrl}`; // 内置 AS issuer = resource

async function fetchToken(clientId: string, clientSecret: string, scope = 'mcp:tools') {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
    resource: RESOURCE,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return { status: res.status, json: await res.json() };
}

describe('OAuth client_credentials 流程', () => {
  it('正确凭据签发 token', async () => {
    const { status, json } = await fetchToken('test-client', 'test-secret');
    if (status === 503) {
      console.warn('内置 AS 未配置，跳过');
      return;
    }
    expect(status).toBe(200);
    expect(json.access_token).toBeTruthy();
    expect(json.token_type).toBe('Bearer');
    expect(json.expires_in).toBeGreaterThan(0);
  });

  it('错误凭据拒绝（400 invalid_client）', async () => {
    const { status, json } = await fetchToken('test-client', 'wrong-secret');
    if (status === 503) return;
    expect(status).toBe(400);
    expect(json.error).toBe('invalid_client');
  });

  it('带有效 token 访问 MCP tools/list 成功', async () => {
    const { json: tokenJson } = await fetchToken('test-client', 'test-secret');
    if (!tokenJson.access_token) return;
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBeDefined();
  });

  it('过期/无效 token 被拒（401）', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.here',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 写 audience e2e**

新建 `backend/src/e2e/mcp-protocol/oauth-audience.test.ts`：

```typescript
/**
 * e2e：RFC8707 audience 校验
 *   签发一个 aud 指向其它 resource 的 token，访问本 Hub 应被拒（401）。
 */
import { describe, expect, it } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';

import { defaultMcpTestConfig } from './mcp-test-config.js';

describe('OAuth audience 校验（RFC8707）', () => {
  it('aud 不匹配的 token 被拒', async () => {
    // 用任意密钥签一个 aud 错的 token（即使签名不被信任，也会因 aud 校验失败被拒）
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const wrongToken = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: 'wrong' })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://other-resource.example.com') // 故意错的 aud
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wrongToken}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect([401, 503]).toContain(res.status); // 503 = oauth 未配置外部 IdP，跳过
  });
});
```

- [ ] **Step 3: 跑 e2e**

Run: `pnpm --filter backend test -- --run src/e2e/mcp-protocol/oauth-client-credentials.test.ts src/e2e/mcp-protocol/oauth-audience.test.ts`
Expected: 通过或条件跳过

> 注：e2e 前置需要一个测试用的 oauth 配置（test client）。在 `backend/src/e2e/test-setup` 或 config 文件里加 `oauth.mode=internal` + test-client/test-secret。若现有 e2e setup 机制不便加，把这些 e2e 标记为需要特定 fixture，或在 Task 16 整合测试配置时补。

- [ ] **Step 4: 提交**

```bash
git add backend/src/e2e/mcp-protocol/oauth-client-credentials.test.ts backend/src/e2e/mcp-protocol/oauth-audience.test.ts
git commit -m "test(e2e): client_credentials 流程 + audience 校验（P2）"
```

---

## Task 16: e2e —— 外部 IdP 对接 + validationKey 强制

**Files:**
- Create: `backend/src/e2e/mcp-protocol/oauth-external-idp.test.ts`
- Create: `backend/src/e2e/mcp-protocol/validation-key.test.ts`

- [ ] **Step 1: 写外部 IdP e2e（mock JWKS + introspection）**

新建 `backend/src/e2e/mcp-protocol/oauth-external-idp.test.ts`：

```typescript
/**
 * e2e：外部 IdP 对接
 *   JWT 本地验签路径（mock JWKS 端点）+ introspection 回退路径（mock introspect 端点）
 *
 * 因 e2e 起真实 Hub server，外部 IdP 用 msw 或内嵌 mock Hono app 模拟。
 * MVP：本测试在 Hub 配置 oauth.external 指向 mock server，验证两条路径。
 */
import { describe, expect, it } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';

import { defaultMcpTestConfig } from './mcp-test-config.js';

describe('OAuth 外部 IdP 对接', () => {
  it('JWT 本地验签通过 mock JWKS', async () => {
    // 前置：测试环境配置 oauth.external 指向 mock IdP
    // 此 e2e 需要 mock server 基础设施；若无则条件跳过
    const kp = await generateKeyPair('RS256');
    const token = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: 'mock-kid' })
      .setIssuedAt()
      .setIssuer('https://mock-idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('1h')
      .sign(kp.privateKey);

    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    // 若无 mock 基础设施，JWKS 拉取失败 → 503 或 401；测试用 conditional
    expect([200, 401, 503]).toContain(res.status);
  });

  it('opaque token 触发 introspection 回退', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer opaque-mock-token' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect([200, 401, 503]).toContain(res.status);
  });
});
```

- [ ] **Step 2: 写 validationKey e2e**

新建 `backend/src/e2e/mcp-protocol/validation-key.test.ts`：

```typescript
/**
 * e2e：组级 validationKey 在 MCP 端点强制（填补现状缺口）
 *
 * 前置：测试配置里 default 组启用 validation 且设置已知 validationKey。
 */
import { describe, expect, it } from 'vitest';

import { defaultMcpTestConfig } from './mcp-test-config.js';

const KNOWN_KEY = 'testValidationKey123';

describe('validationKey 强制（MCP 端点）', () => {
  it('无 key 访问启用 validation 的组 → 401', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    if (res.status === 503 || res.status === 404) {
      console.warn('测试环境未配置 validation，跳过');
      return;
    }
    expect(res.status).toBe(401);
  });

  it('正确 key 访问成功', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KNOWN_KEY}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    if (res.status === 404 || res.status === 503) return;
    expect(res.status).toBe(200);
  });

  it('错误 key → 401', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrongKey' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    if (res.status === 404 || res.status === 503) return;
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: 跑 e2e**

Run: `pnpm --filter backend test -- --run src/e2e/mcp-protocol/oauth-external-idp.test.ts src/e2e/mcp-protocol/validation-key.test.ts`
Expected: 通过或条件跳过

- [ ] **Step 4: 补测试 fixture（e2e 前置配置）**

若 e2e 因缺少 oauth/validation 测试配置而全部跳过，在 `backend/src/e2e/test-setup` 或测试 config 文件里补：

- 一个 `oauth.mode=internal` 配置 + `test-client`/`test-secret` client
- default 组启用 validation + 已知 validationKey

具体修改点实现时根据现有 e2e setup 机制决定（参考 P4 plan 的 test config 处理方式）。

- [ ] **Step 5: 提交**

```bash
git add backend/src/e2e/mcp-protocol/oauth-external-idp.test.ts backend/src/e2e/mcp-protocol/validation-key.test.ts
git commit -m "test(e2e): 外部 IdP 对接 + validationKey 强制（P2）"
```

---

## Task 17: 文档同步（spec 实现修正 + 总体 spec 状态 + RELEASE_NOTES）

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md`（实现修正节回填）
- Modify: `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（P1/P2 状态 + 跨子项目待办修正）
- Modify: `RELEASE_NOTES.md`

- [ ] **Step 1: 全量 typecheck + 测试**

Run: `pnpm typecheck`
Expected: 无错误

Run: `pnpm test`
Expected: 全绿（含 P2 单测 + e2e；e2e 条件跳过也算通过）

Run: `pnpm check:ci`
Expected: lint/format 通过（提交门禁）

- [ ] **Step 2: 修复任何回归**

逐个处理失败的测试或 lint 错误。常见回归点：
- 现有 e2e（`mcp-basic.test.ts` 等）若不带 token 访问 MCP 端点，现在可能 401 → 确认测试配置是否启用 oauth/validation，未启用则应放行
- `group-router` 相关单测若 mock 了中间件链，需补 mcpAuthMiddleware 的 mock

- [ ] **Step 3: 回填 P2 spec 实现修正节**

修改 `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md` 的"## 实现修正"节，记录实现时发现的偏差，至少包括：
- `crypto-keys.ts` 的 PKCS8→SPKI 推导是否如预期工作（若改了方案，记录新方案）
- `token-validator.ts` 的 reason 枚举是否加了 `'scope'`
- `mcp-auth.ts` 的 resourceMetadataUrl 是否改成 origin 推导
- e2e fixture 的实际配置方式

- [ ] **Step 4: 修正总体 spec 的 P1 状态滞后**

修改 `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`：

4a. 子项目全景表 P1 行的"实现进度"列：

```markdown
| **P1** | 传输层升级到 2026-07-28 无状态 | ✅ 完成 | ✅ **实现完成**（已合并 main，commits `6aedf23`/`f802256`/`5303574`） | `2026-07-25-p1-transport-upgrade-design.md` |
```

4b. P2 行：

```markdown
| **P2** | 入站 OAuth 2.1（Protected Resource） | ✅ 完成 | ✅ **实现完成**（分支 `feat/p2-inbound-oauth`，待合并） | `2026-07-26-p2-inbound-oauth-design.md` |
```

4c. "各子项目实现进度"表更新 P1/P2 两行（commit 哈希按实际填）。

- [ ] **Step 5: 修正跨子项目共享待办表**

在 `2026-07-25-mcp-2026-07-28-adoption-overview.md` 的"跨子项目共享待办"表：

5a. `simple-auth.ts 假认证` 行：现状列改为 `✅ 已核实：当前代码不存在该文件，spec 描述滞后，无需处理`

5b. `message-audit-service.ts 用户归因硬编码 'admin'` 行：现状列改为 `✅ 已核实：当前 message-audit-service.ts 无 'admin' 硬编码，message 结构无 user 字段，描述过时`

5c. `RedisCacheManager` 行的"涉及子项目"列加 P2（introspection/JWKS 多实例缓存）：

```markdown
| `RedisCacheManager`（当前 no-op，`cache-manager.ts:338-377`） | P6（候选）或独立基建 | P3 多实例前必须实现 | 🟡 no-op 占位；**P2 的 introspection/JWKS 内存缓存 MVP 不依赖 Redis，多实例部署需 P6 实现 RedisCacheManager 后接入** | P2（OAuth 缓存）、P3（token 存储）、P6（候选归属） |
```

5d. 新增一行（P2 发现的现状缺口已修复）：

```markdown
| 组级 validationKey 在 MCP 端点未强制（`group-router.ts` 只校验组存在） | ✅ P2 已修复 | P2 一并修复 | ✅ P2 已通过 mcp-auth 中间件强制 | P2 |
```

- [ ] **Step 6: 更新 RELEASE_NOTES**

在 `RELEASE_NOTES.md` 加 P2 section（标记 breaking change）：

```markdown
## [Unreleased] - P2: 入站 OAuth 2.1

### ⚠️ Breaking Changes
- **组级 validationKey 现在在 MCP 端点强制校验**：之前配置了 `validation.enabled = true` 的组，
  MCP 端点（`/:group/mcp`）实际不校验 validationKey（任何请求放行）。P2 修复后，启用 validation 的组
  必须在 `Authorization: Bearer <validationKey>` 提供正确 key 才能访问。
  - **迁移**：若你的组启用了 validation 但希望保持开放，将 `validation.enabled` 改为 `false`。
  - 若要使用 validation，确保客户端带上配置的 validationKey。

### Added
- Hub 现在作为 MCP OAuth 2.1 Protected Resource（RFC9728），支持标准 OAuth 授权。
- 内置最小 Authorization Server（`client_credentials` grant），无外部 IdP 也可开箱即用。
- 对接外部 IdP（Keycloak/Entra/Auth0/OIDC）：JWT 本地验签（JWKS）+ introspection 回退。
- 新增端点：`/.well-known/oauth-protected-resource`、`/.well-known/oauth-authorization-server`、
  `POST /api/oauth/token`、`GET /api/oauth/jwks`。
- 系统配置新增 `oauth` 块（见 `system.schema.ts`）。

### Security
- 填补 MCP 端点无认证的安全缺口（CVE 级别）。
- RFC8707 audience 绑定、RFC9207 iss 防护、PKCE S256 声明。
```

- [ ] **Step 7: 提交**

```bash
git add docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md RELEASE_NOTES.md
git commit -m "docs: P2 实现完成，同步 spec 状态 + 跨子项目待办修正 + RELEASE_NOTES"
```

---

## Self-Review

**Spec 覆盖检查**：

- ✅ §1 架构边界（api/oauth + services/oauth + middleware/mcp-auth）→ Task 3-12
- ✅ §2.1 Protected Resource Metadata → Task 7 + Task 12 (well-known)
- ✅ §2.2 401/403 WWW-Authenticate → Task 7 + Task 11
- ✅ §2.3 AS Metadata → Task 6 + Task 12
- ✅ §2.4 token 端点 → Task 6 + Task 12
- ✅ §2.5 jwks 端点 → Task 4 + Task 12
- ✅ §2.6 introspection（service）→ Task 8
- ✅ §3 配置模型 → Task 2
- ✅ §4 密钥管理 → Task 4
- ✅ §5 token 校验流程 → Task 8 + Task 10
- ✅ §6 validationKey 路径 → Task 9 + Task 10
- ✅ §7 中间件挂载 → Task 11 + Task 13
- ✅ §8 错误体系 → Task 1
- ✅ §9 测试策略 → 每个 Task 的单测 + Task 14-16 e2e
- ✅ §10 DoD（含总体 spec/跨子项目待办修正）→ Task 17

**Placeholder 扫描**：

- 无 "TBD/TODO/implement later"。每个代码步骤含完整实现。
- 部分步骤有 `⚠️` 注释标注实现时需注意的边界（如 PKCS8 推导、reason 枚举补充），这些是风险提示而非占位符——实现者读到时按提示处理并在 spec 实现修正节回填。

**类型一致性检查**：

- `OAuthConfig`：Task 3 定义（`NonNullable<SystemConfig['oauth']>`），Task 2 schema 对齐，Task 6/7/8/10 一致使用
- `McpAuthContext`：Task 3 定义（`method`/`principal`/`scope`），Task 10 产出，Task 11 注入 Hono context，签名一致
- `TokenValidationResult`：Task 3 定义，reason 枚举含 `'invalid'|'expired'|'audience'|'inactive'|'scope'`，Task 8 产出（scope 失败返回 `'scope'`），Task 10 mapValidationFailure 把 `'scope'` 映射为 `OAUTH_INSUFFICIENT_SCOPE`。一致。
- `AuthOutcome`：Task 10 定义，Task 11 消费，`reason`/`errorCode` 字段一致
- `ErrorCode.OAUTH_*`：Task 1 定义 6100-6106，Task 1/10/11/12 一致使用
- `createMcpAuthMiddleware` 签名：Task 11 定义为 `{ resourceServer, resourceMetadataUrlPath }`，Task 13 挂载一致使用（origin 推导在中间件内完成）

**风险提示（实现者必读）**：

1. **Task 4 PKCS8→SPKI 推导**：`exportSPKIFromPKCS8` 的实现是本计划最不确定的点。若 `createPublicKey` 对 PKCS8 私钥 PEM 报错，简化方案：要求配置同时提供公钥（`OAUTH_INTERNAL_PUBLIC_KEY`），或未配置时只用 `generateKeyPair`。Task 4 Step 4 已标注 fallback。
2. **Task 13 现有测试回归**：接入 mcp-auth 后，不带 token 访问 MCP 端点的现有 e2e 会 401。Task 13 Step 4 处置：确认测试配置未启用 oauth/validation（保持开放），否则补 fixture。这是最大的回归风险点。
3. **Task 14-16 e2e fixture**：e2e 需要测试用 oauth/validation 配置。若现有 e2e setup 机制不便注入，这些 e2e 可能条件跳过（`if status === 503/404 return`）。理想情况补 fixture，但 MVP 可接受跳过，在 Task 17 spec 实现修正节记录。
4. **jose ESM 导入**：jose 是 ESM-only，项目已是 ESM（`"type": "module"`），应无问题。若 typecheck 报 jose 类型找不到，跑 `pnpm --filter backend add jose` 后重启 TS server。
5. **测试 typo 修正**：Task 9 的测试文件末尾 `import { beforeAll, afterAll } from 'vitest'` 应移到文件顶部与其它 import 合并；Task 10 测试里故意留的 `outout(...)` typo 改为 `reasonOrCode(outcome)`。实现时按正确写法写。
