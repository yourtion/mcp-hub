# Follow-up：OAuth/validation e2e fixture 激活

- **状态**: Draft（待实现）
- **日期**: 2026-07-27
- **作者**: yourtion
- **关联**:
  - `docs/superpowers/specs/2026-07-25-mcp-2026-07-28-adoption-overview.md`（P2/P3 review 发现的 Gap #1）
  - `docs/superpowers/specs/2026-07-26-p2-inbound-oauth-design.md`（P2 入站 OAuth）
  - `docs/superpowers/specs/2026-07-27-p3-outbound-oauth-design.md`（P3 出站 OAuth）

## 目的

激活 6 个 OAuth/validation e2e 测试，从当前的 conditional skip 状态变成 CI 中真实运行的测试。这是 P2/P3 review 阶段发现的最高价值 gap——安全特性（OAuth）的端到端流程当前在 CI 里实际未验证。

## 范围

**激活 6 个 e2e：**
| 测试 | 当前状态 | 归属 |
| --- | --- | --- |
| `oauth-discovery.test.ts` | 2 处 conditional skip | P2 |
| `oauth-client-credentials.test.ts` | 2 处 conditional skip | P2 |
| `oauth-audience.test.ts` | 1 处宽松断言（放行 400/404/503）| P2 |
| `oauth-external-idp.test.ts` | 1 处宽松断言 | P2 |
| `validation-key.test.ts` | 1 处 conditional skip | P2 |
| `oauth-outbound.test.ts` | describe.skipIf + throw 占位 | P3 |

**不改生产代码**（`services/oauth/`、`api/oauth/`、`app.ts`、`packages/core/`）。所有改动集中在 `backend/src/e2e/` 的 fixture/setup/测试文件。

## 调研结论（已核实）

1. **e2e 连真实 app**（`backend/src/app.ts` 经 `test-server.ts` 启动），不连 `test-app.ts`。配置由 `setupTestConfig()`（`test-utils.ts`）写临时目录。
2. **runtime AuthConfig schema 已支持 oauth**（core 的 `api-config-schemas.ts` re-export `api-config.ts` 的 discriminated union，含 oauth 分支）。只有 share 的镜像 schema 没同步（不影响 runtime）。
3. **内置 AS 无需配 `OAUTH_INTERNAL_PRIVATE_KEY`**——`crypto-keys.ts` 会临时生成 RSA 密钥对（开发用途，P2 spec §4 允许）。
4. **validation 与 oauth 互斥**（`resource-server.ts:68`：配了 oauth 则 validationKey 路径禁用，仅 `mode:'both'` 回退）。

## 关键风险与决策（已核实）

| 风险 | 核实结果 | 决策 |
| --- | --- | --- |
| client-credentials 错误凭据返回 400 还是 401 | `token.ts:43` 返回 **401**（invalid_client），测试期望 400 | **改测试**：`toBe(400)` → `toBe(401)` |
| api-tools schema 是否含 oauth 分支 | core runtime schema 已含（Task 2 改的）；share 镜像未同步但 runtime 不用 | **无需改 schema** |
| api-to-mcp 在 e2e 是否 initialize | `app.ts:28` 模块级 new，`initialize()` 只在 `index.ts`（e2e 不跑）调 → **未 initialize** | **测试侧补**：在 outbound e2e 的 setup 里 `await apiToMcpWebService.initialize(configPath)`（`app.ts` 暴露单例，测试可导入） |
| validation/oauth 互斥 | `resource-server.ts:68` 确认互斥 | **拆 vitest project**：oauth-profile 和 validation-profile 各自独立 project + setup，配置隔离 |

## 设计

### Step 1: setupTestConfig profile 化 + 拆 vitest project

**当前**：`vitest.e2e.setup.ts` 单 setup，`fileParallelism: false` 串行，所有 e2e 文件共享一份配置。

**改造**：拆成两个 vitest project（在 `vitest.e2e.config.ts` 定义）：
- `api-e2e`（现有）：open 模式配置（无 oauth/validation），跑现有的非 oauth e2e（mcp-basic / hub-aggregation / cache-semantics / mcp-http-api / protocol-compliance）。
- `api-e2e-oauth`（新增）：oauth internal 模式配置，跑 4 个 oauth 入站 e2e（discovery/client-credentials/audience/external-idp）。
- `api-e2e-validation`（新增）：validation 模式配置，跑 validation-key e2e。
- `api-e2e-outbound`（新增）：oauth 出站配置 + api-to-mcp initialize，跑 oauth-outbound e2e。

每个 project 独立 setup 文件 + 独立临时配置目录（避免互斥）。

**setupTestConfig 改造**：加 profile 参数 `setupTestConfig(profile: 'open'|'oauth'|'validation'|'outbound')`，按 profile 写不同 system.json/group.json/api_tools.json。

**隔离机制**：每个 project 用不同 `CONFIG_PATH` 环境变量（或不同临时目录前缀），避免 JsonStorage 缓存串。

### Step 2: 激活 4 个 oauth 入站 e2e（oauth profile）

**fixture（oauth profile 的 system.json）**：
```json
{
  "oauth": {
    "mode": "internal",
    "resource": "http://localhost:3000",
    "scopes": ["mcp:tools", "mcp:resources"],
    "internal": {
      "tokenTtlSeconds": 3600,
      "clients": [{ "clientId": "test-client", "clientSecret": "test-secret", "scopes": ["mcp:tools"] }]
    }
  }
}
```
group.json 沿用现有 `default` 组（servers: `['test-server-1']`，stdio echo）。

**逐个测试激活**：
- **oauth-discovery**：删 `if (status===404) return` 守卫，改严格断言（metadata 符合 RFC9728、无 token 返回 401 + WWW-Authenticate）。
- **oauth-client-credentials**：
  - 正确凭据：删 503 守卫，断言签发 token。
  - 错误凭据：`toBe(400)` → `toBe(401)`（风险决策）。
  - 带 token 访问 tools/list：删 access_token 守卫，断言 200。
- **oauth-audience**：宽松断言 `toContain([401,400,404,503])` → 严格 `toBe(401)`（oauth 配了，无 token/aud 不匹配必拒）。
- **oauth-external-idp**：见 Step 3（需 mock IdP）。

### Step 3: 激活 oauth-external-idp（external profile + fetch stub）

**fixture（external profile 的 system.json）**：
```json
{
  "oauth": {
    "mode": "external",
    "resource": "http://localhost:3000",
    "external": {
      "issuer": "https://mock-idp.example.com",
      "clientId": "test-client",
      "clientSecret": "test-secret",
      "jwksUri": "https://mock-idp.example.com/.well-known/jwks.json",
      "introspectionEndpoint": "https://mock-idp.example.com/introspect",
      "audience": "http://localhost:3000"
    }
  }
}
```

**测试文件 mock**（`beforeAll`）：
```typescript
import { generateKeyPair, SignJWT } from 'jose';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);

vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
  // JWKS 请求 → 返回测试公钥
  if (url.includes('/.well-known/jwks.json')) {
    return { status: 200, json: async () => ({ keys: [jwk] }) } as Response;
  }
  // introspect 请求 → 返回 active
  if (url.includes('/introspect')) {
    return { status: 200, json: async () => ({ active: true, aud: 'http://localhost:3000', scope: 'mcp:tools' }) } as Response;
  }
  return { status: 404 } as Response;
}));

// afterAll: vi.unstubAllGlobals();
```
测试用 `privateKey` 签发测试 token，发给 MCP 端点验证通过。

参考 `token-validator.unit.test.ts:18-50` 的 mock 范式。

### Step 4: 激活 oauth-outbound（outbound profile + api-to-mcp initialize）

**fixture（outbound profile）**：
- `api_tools.json` 加一个 oauth 工具：
```json
{
  "version": "1.0",
  "tools": [{
    "id": "oauth-protected-tool",
    "name": "oauth_protected_tool",
    "description": "测试出站 OAuth",
    "api": { "url": "https://mock-resource.example.com/data", "method": "GET" },
    "parameters": { "type": "object", "properties": {} },
    "response": {},
    "security": {
      "authentication": {
        "type": "oauth",
        "grantType": "client_credentials",
        "clientId": "outbound-client",
        "clientSecret": "outbound-secret",
        "tokenUrl": "https://mock-as.example.com/token",
        "scope": "read"
      }
    }
  }]
}
```

**e2e setup 补 api-to-mcp initialize**：
```typescript
// vitest.e2e.outbound.setup.ts
import { apiToMcpWebService } from '../app.js';  // 或重新导出

beforeAll(async () => {
  setupTestConfig('outbound');
  await apiToMcpWebService.initialize(process.env.CONFIG_PATH + '/api_tools.json');
  await startTestServer(3000);  // 注意端口隔离
});
```
**核查**：`app.ts` 是否 export `apiToMcpWebService`。若未 export，在 app.ts 加 `export { apiToMcpWebService }`（这是最小暴露，不算生产行为改动）。

**测试逻辑**（替换 `oauth-outbound.test.ts` 的 throw 占位）：
```typescript
let fetchCallCount = 0;
vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  fetchCallCount++;
  if (url.includes('/token')) {
    return { status: 200, json: async () => ({ access_token: 'outbound-tok', expires_in: 3600 }) } as Response;
  }
  if (url.includes('/data')) {
    // 校验 Authorization 头，返回数据
    return { status: 200, json: async () => ({ result: 'ok' }) } as Response;
  }
  return { status: 404 } as Response;
}));

// 第一次调用 → fetchToken（token endpoint 调用 1 次）+ 资源调用
const r1 = await callTool(client, 'oauth_protected_tool', {});
expect(r1).toHaveContent('ok');

// 第二次调用 → 缓存命中（token endpoint 不再调）
const tokenCallsBefore = fetchCallCount;
await callTool(client, 'oauth_protected_tool', {});
// token endpoint 调用数应不变（缓存命中）
```

## DoD

- 4 个 vitest project（api-e2e / api-e2e-oauth / api-e2e-validation / api-e2e-outbound）各自独立 setup，配置隔离。
- 6 个 e2e 全部真实运行（无 conditional skip、无宽松 toContain 放行、无 throw 占位）。
- `pnpm test` 全绿（含新增的 oauth/validation/outbound e2e 实际运行）。
- 不改生产代码（除可能加 `export { apiToMcpWebService }`）。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 拆 project 后端口冲突（多 server 抢 3000） | 各 project 用不同端口（3000/3010/3020/3030），或串行跑（fileParallelism: false 保留） |
| external IdP mock 的 fetch stub 影响其他测试 | `afterAll` 严格 `vi.unstubAllGlobals()`；external e2e 独立 project 隔离 |
| outbound 的 api-to-mcp initialize 依赖配置文件路径 | setup 里显式传 configPath，不依赖默认路径 |
| 临时密钥每次生成导致 JWKS 不稳定 | external profile 的 fetch stub 用同一测试密钥派生公钥，不依赖服务端临时密钥 |

## 待实现时确认的细节

- vitest project 拆分的确切 config 写法（参考 `vitest.e2e.config.ts` 现有 `api-e2e` project 定义）。
- `apiToMcpWebService` 是否已 export，未 export 则补（最小改动）。
- 端口分配策略（确认各 project setup 用不同端口，或全局串行复用 3000）。
- external profile 的 token 签发：测试自己用 privateKey 签 JWT，发给 MCP 端点；服务端 introspect 返回 active（或 JWKS 验签，取决于 mode）。
