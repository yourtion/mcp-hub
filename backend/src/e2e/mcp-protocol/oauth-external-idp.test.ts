import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
/**
 * e2e：外部 IdP 对接（external profile）
 *   JWT 本地验签路径（mock JWKS 端点）+ introspection 回退路径（mock introspect 端点）
 *
 * 归属 api-e2e-oauth-external project（oauth.mode='external'），独立于 internal profile 的
 * api-e2e-oauth——external 路径需要 system.json 配 oauth.external 指向 mock IdP，与 internal
 * 互斥。外部 IdP 本身不真实起服务，用 `vi.stubGlobal('fetch', ...)` 拦截：
 *   - JWKS 请求（host=mock-idp.example.com + path=/.well-known/jwks.json）→ 返回测试公钥
 *   - introspect 请求（host=mock-idp.example.com + path=/introspect）→ 返回 active
 *   - 其它请求（本地 MCP 端点 localhost:3040）→ 转发真实 fetch（SDK / 裸 fetch 才能连上 Hub）
 *
 * mock 范式参考 services/oauth/token-validator.unit.test.ts:42-49 的 stubJwks 写法。
 *
 * ⚠️ Response-like 对象须同时暴露 `status` 与 `ok`：
 *   - jose v6 createRemoteJWKSet 校验 `response.status === 200`（不是 res.ok）
 *   - introspection.ts 校验 `res.ok`（Response.ok 是 getter，status 200-299 为 true）
 *   故 mock 用 helper fakeResponse(status, json) 同时填两个字段，避免两条路径校验口径不一致。
 *
 * ⚠️ stub 时机：必须在 `beforeEach` 而非 `beforeAll` 重新安装。
 *   vitest.shared.ts 的 `unstubGlobals: true` 会在每个 test 之后自动恢复 globalThis.fetch，
 *   导致 beforeAll 安装的 stub 在第一个 it 即丢失。beforeEach 在每个 test 前重新安装，
 *   保证每个用例运行时 stub 都生效。afterAll 再兜底 unstubAllGlobals。
 */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeMcpClient, defaultMcpTestConfig } from './mcp-test-config.js';

const ISSUER = 'https://mock-idp.example.com';
const JWKS_PATH = '/.well-known/jwks.json';
const INTROSPECT_PATH = '/introspect';
/** external profile 的 audience = resource = http://localhost:<port>（跟随 E2E_PORT）。 */
const AUDIENCE = defaultMcpTestConfig.baseUrl;

/**
 * 模块级密钥与公钥 JWK：整个 describe 复用同一对（beforeAll 生成一次），JWKS mock 返回同一公钥，
 * 避免每次签发都重新生成导致 JWKS 不稳定。
 */
let privateKey: CryptoKey;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jose JWK 是动态 shape
let publicKeyJwk: Record<string, any>;

/**
 * 构造 Response-like 对象（同时填 status + ok + json）。
 *
 * jose 的 createRemoteJWKSet 校验 `response.status === 200`；introspection.ts 校验
 * `res.ok`（Response.ok 是 status 在 200-299 的 getter）。两条路径校验口径不同，
 * 用本 helper 统一构造，避免一处漏填导致 mock 被误判失败。
 */
function fakeResponse(status: number, json: () => Promise<unknown>): Response {
  return { status, ok: status >= 200 && status < 300, json } as Response;
}

/**
 * 安装 fetch stub：拦截 mock IdP 的 JWKS / introspect 请求，本地请求转发真实 fetch。
 *
 * jose 的 createRemoteJWKSet 与 introspection.ts 都用 globalThis.fetch，vi.stubGlobal 直接替换即可。
 * URL 匹配用 `String(url).includes(...)`：fetch 第一参数可能是 string / URL / Request，
 * 统一转 string 再匹配，避免类型分支漏判。
 */
function installFetchStub(): void {
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(
        typeof input === 'string' || input instanceof URL ? input.toString() : input.url,
      );
      // 仅拦截 mock IdP 主机；本地请求（localhost）走真实 fetch
      if (!url.includes('mock-idp.example.com')) {
        return realFetch(input as Parameters<typeof realFetch>[0], init);
      }
      // JWKS 请求 → 返回测试公钥（jose v6 校验 status === 200）
      if (url.includes(JWKS_PATH)) {
        return fakeResponse(200, async () => ({ keys: [publicKeyJwk] }));
      }
      // introspect 请求 → 返回 active + 匹配的 aud/scope（introspection.ts 校验 res.ok）
      if (url.includes(INTROSPECT_PATH)) {
        return fakeResponse(200, async () => ({
          active: true,
          aud: AUDIENCE,
          scope: 'mcp:tools',
          client_id: 'c1',
        }));
      }
      return fakeResponse(404, async () => ({ error: 'not found' }));
    }),
  );
}

/**
 * 用 MCP 客户端 SDK 带有效 Bearer token 访问 /:group/mcp。
 *
 * 成功路径必须走 SDK：MCP 端点用 createMcpHandler({ legacy: 'reject' }) 构造，仅服务
 * 2026-07-28 modern 流量（v2 envelope + Accept 头 + 协议版本头），裸 JSON-RPC 被协议层
 * 拒为 400。auth 失败的场景（无 token / 错 token）在 auth 中间件即被拒（不到协议层），
 * 裸 fetch 直接断言 401 即可。
 */
async function listToolsWithToken(
  accessToken: string,
): Promise<{ ok: true; tools: unknown[] } | { ok: false; status: number }> {
  const mcpUrl = `${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`;
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client(
    { name: 'oauth-external-idp-test-client', version: '1.0.0' },
    {
      capabilities: { tools: {} },
      versionNegotiation: { mode: 'auto' },
    },
  );
  try {
    await client.connect(transport);
    const result = await client.listTools();
    return { ok: true, tools: result.tools };
  } catch (error) {
    // SDK 在收到非 2xx 时抛错；提取 status 用于断言
    const status =
      (error as { status?: number; response?: { status?: number } })?.status ??
      (error as { response?: { status?: number } })?.response?.status ??
      0;
    return { ok: false, status };
  } finally {
    await closeMcpClient(client, transport);
  }
}

describe('OAuth 外部 IdP 对接', () => {
  beforeAll(async () => {
    // 生成测试密钥对（RS256），整个 describe 复用
    const kp = await generateKeyPair('RS256');
    privateKey = kp.privateKey;
    const jwk = await exportJWK(kp.publicKey);
    publicKeyJwk = { ...jwk, kid: 'mock-kid' };
  });

  // unstubGlobals:true 会在每个 test 后恢复 globalThis.fetch，故每个 test 前重新安装。
  beforeEach(() => {
    installFetchStub();
  });

  afterAll(() => {
    // 兜底清理（虽 unstubGlobals 已自动恢复，仍守纪律显式 unstub）
    vi.unstubAllGlobals();
  });

  it('JWT 本地验签通过 mock JWKS（合法 token → 200 tools/list）', async () => {
    // 用测试私钥签一个 iss/aud/scope 全匹配的 token
    const token = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: 'mock-kid' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setSubject('c1')
      .setAudience(AUDIENCE)
      .setExpirationTime('1h')
      .sign(privateKey);

    const result = await listToolsWithToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tools).toBeInstanceOf(Array);
    }
  });

  it('opaque token 触发 introspection 回退（active → 200 tools/list）', async () => {
    // opaque token：不含 2 个 '.'，token-validator 直接走 introspection 路径
    const result = await listToolsWithToken('opaque-mock-token-xyz');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tools).toBeInstanceOf(Array);
    }
  });

  it('aud 不匹配的 JWT 被拒（401）', async () => {
    // 签一个 aud 指向其它 resource 的 token（即使 JWKS 验签通过，aud 校验失败）
    const wrongAudToken = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: 'mock-kid' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setSubject('c1')
      .setAudience('https://other-resource.example.com') // 故意错的 aud
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${wrongAudToken}` },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    // external profile：aud 校验失败在 auth 中间件即被拒（不到协议层），返回 401。
    expect(res.status).toBe(401);
  });

  it('无 token 被拒（401）', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    // external profile：缺 Bearer token，auth 中间件直接 401。
    expect(res.status).toBe(401);
  });
});
