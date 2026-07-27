/**
 * e2e：P3 出站 OAuth 全链路（api-to-mcp 工具用 oauth 认证调外部 API）
 *
 * 验证（Step 4 激活）：
 *   1. 调 oauth 保护的 api-to-mcp 工具 → OAuthStrategy 自动向 token endpoint 取 access_token，
 *      注入 Authorization: Bearer <token> 到受保护资源请求，返回数据。
 *   2. 第二次调同工具 → 出站 token 缓存命中，token endpoint 不再被打；资源端点继续被调。
 *
 * ⚠️ 架构核实（与 spec Step 4 初稿的偏差，已校准）：
 *   api-to-mcp 工具**不**经 `/:group/mcp` 暴露。`/:group/mcp` 的 GroupMcpService 用
 *   coreServiceManager.getAllTools()（只返回已连接 stdio server 的工具），不加载 api_tools.json。
 *   api-to-mcp 工具只在 `/api/api-to-mcp/*` REST 路由可达：
 *     POST /api/api-to-mcp/configs/:id/test → apiToMcpWebService（app.ts 单例）
 *       → ApiToolIntegrationService.executeApiTool → core ApiToMcpServiceManager
 *       → ApiExecutor + OAuthStrategy → HttpClient（globalThis.fetch）。
 *   故本测试经 REST test 端点触发出站 OAuth 全链路，不经 MCP 端点。
 *
 * 入站认证（/api/api-to-mcp/* 的 authMiddleware）用 AuthService 签发的 JWT 用户 token
 *   （POST /api/auth/login admin/admin123），**不是** OAuth resource-server token。
 *   outbound profile 的 system.json oauth internal 块保护的是 `/:group/mcp`，不影响此 REST 路由。
 *
 * fetch stub 双重拦截（参考 Step 3 oauth-external-idp.test.ts 的 realFetch 转发范式）：
 *   - token endpoint（host=mock-as.example.com + path=/token）→ 返回 access_token
 *   - 受保护资源（host=mock-resource.example.com + path=/data）→ 校验 Authorization 头后返回数据
 *   - localhost 请求（Hub 自己的 REST 端点）→ 转发真实 fetch
 *
 * ⚠️ stub 时机：必须在 `beforeEach` 而非 `beforeAll` 重新安装。
 *   vitest.shared.ts 的 `unstubGlobals: true` 会在每个 test 后自动恢复 globalThis.fetch，
 *   导致 beforeAll 安装的 stub 在第一个 it 即丢失。beforeEach 在每个 test 前重新安装，
 *   保证每个用例运行时 stub 都生效。afterAll 再兜底 unstubAllGlobals。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultMcpTestConfig } from './mcp-test-config.js';

const BASE_URL = defaultMcpTestConfig.baseUrl;
const TOOL_ID = 'oauth-protected-tool';

/**
 * 模块级 spy 计数器：在 fetch stub 闭包内递增，跨同一次 callTool 的两次调用累积，
 * 用于验证「第一次取 token，第二次缓存命中（token endpoint 不再被打）」。
 *
 * 因 unstubGlobals 会在每个 test 后恢复 fetch，stub（连同闭包引用的计数器）在每个 test
 * 重建——所以这些计数器只在一个 it 内有效，正好用于单测内的「两次调用对比」。
 */
let tokenCallCount = 0;
let resourceCallCount = 0;
/** 最近一次资源请求的 Authorization 头，用于断言注入了 Bearer token。 */
let lastResourceAuth: string | undefined;

/**
 * 构造真实 Response 对象（status + ok + json 全齐）。
 *
 * HttpClient.request（http-client.ts:145）用 `response.json().catch(() => ({}))` 解析 body，
 * OAuthStrategy 用 `response.status` 判定成败。用原生 Response（而非手搓 Response-like 对象）
 * 避免 undici 内部 "Failed to find Response internal state key" 警告。
 */
function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * 安装 fetch stub：拦截 mock AS / 受保护资源，本地请求转发真实 fetch。
 *
 * HttpClient.request（packages/core/.../http-client.ts:129）用 globalThis.fetch，
 * vi.stubGlobal 直接替换即可。URL 匹配用 String(url).includes(...)：fetch 第一参数
 * 可能是 string / URL / Request，统一转 string 再匹配，避免类型分支漏判。
 */
function installFetchStub(): void {
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(
        typeof input === 'string' || input instanceof URL ? input.toString() : input.url,
      );

      // 出站 OAuth token endpoint → 返回 access_token
      if (url.includes('mock-as.example.com') && url.includes('/token')) {
        tokenCallCount++;
        return jsonResponse(200, { access_token: 'outbound-tok', expires_in: 3600 });
      }

      // 受保护资源 → 校验 Authorization 头后返回数据
      if (url.includes('mock-resource.example.com') && url.includes('/data')) {
        resourceCallCount++;
        const headers = new Headers(init?.headers);
        lastResourceAuth = headers.get('Authorization') ?? undefined;
        if (!lastResourceAuth || !lastResourceAuth.startsWith('Bearer ')) {
          return jsonResponse(401, { error: 'missing_token' });
        }
        return jsonResponse(200, { result: 'ok' });
      }

      // 本地请求（Hub 自己的 REST 端点）走真实 fetch
      return realFetch(input as Parameters<typeof realFetch>[0], init);
    }),
  );
}

/**
 * 登录 admin 拿 JWT access token（/api/api-to-mcp/* 的 authMiddleware 要求）。
 *
 * outbound profile 的 system.json 写了 users.admin (admin/admin123)。
 */
async function loginAdmin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data?: { accessToken?: string } };
  expect(body.data?.accessToken).toBeTruthy();
  return body.data!.accessToken!;
}

/**
 * 调 api-to-mcp 工具测试端点（触发出站 OAuth 全链路）。
 *
 * POST /api/api-to-mcp/configs/:id/test → apiToMcpWebService.testConfig
 *   → executeApiTool → OAuthStrategy.applyAuth → HttpClient.request（fetch stub）。
 * 响应体：{ success, response?, error?, executionTime }（api-to-mcp/index.ts:291 c.json 原样）。
 */
async function callApiTool(jwt: string): Promise<{
  status: number;
  body: { success?: boolean; response?: string; error?: string; executionTime?: number };
}> {
  const res = await fetch(`${BASE_URL}/api/api-to-mcp/configs/${TOOL_ID}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ parameters: {} }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    response?: string;
    error?: string;
    executionTime?: number;
  };
  return { status: res.status, body: json };
}

describe('OAuth 出站（api-to-mcp 工具调外部 API）', () => {
  let jwt: string;

  beforeAll(async () => {
    // outbound profile 的全局 setup（vitest.e2e.outbound.setup.ts）已写入配置、
    // initialize apiToMcpWebService 单例、启动 server。这里只准备入站 JWT。
    // 在 stub 安装前登录（登录请求是 localhost，是否走 stub 都行，但提前拿避免干扰）。
    jwt = await loginAdmin();
  });

  // unstubGlobals:true 会在每个 test 后恢复 globalThis.fetch，故每个 test 前重新安装。
  // 计数器也在安装时归零，使每个用例的「两次调用对比」干净。
  beforeEach(() => {
    tokenCallCount = 0;
    resourceCallCount = 0;
    lastResourceAuth = undefined;
    installFetchStub();
  });

  afterAll(() => {
    // 兜底清理（虽 unstubGlobals 已自动恢复，仍守纪律显式 unstub）
    vi.unstubAllGlobals();
  });

  it('出站 OAuth 全链路：取 token + 注入 Authorization + 缓存命中', async () => {
    // ── 第一次调用：OAuthStrategy 缓存为空 → 打 token endpoint 取 access_token，
    //    注入 Authorization 到资源请求，返回数据。
    //    注意：OAuthStrategy 的 token 缓存挂在 ApiToMcpServiceManager 的单例
    //    AuthenticationManager 上（跨 test 持久）。若前序 test 已预热缓存，第一次调用的
    //    tokenCallCount 可能为 0——故本 test 不对 tokenCallCount 的绝对值断言，只对
    //    「第二次调用相对第一次不变」断言（缓存命中的可证伪信号）。
    const r1 = await callApiTool(jwt);
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);
    // response 是工具执行的 content[0].text（JSON-stringified 的 { result: 'ok' }）
    expect(r1.body.response).toBeTruthy();
    expect(r1.body.response).toContain('ok');
    // 受保护资源被调一次
    expect(resourceCallCount).toBe(1);
    // Authorization 头被注入了出站 token（不是入站 JWT）
    expect(lastResourceAuth).toBe('Bearer outbound-tok');

    const tokenCallsAfterFirst = tokenCallCount;
    const resourceCallsAfterFirst = resourceCallCount;
    // 第一次调用应至少触发一次 token endpoint（除非缓存已热，但 token endpoint 必被调过）
    expect(tokenCallsAfterFirst).toBeGreaterThanOrEqual(1);

    // ── 第二次调用：出站 token 缓存命中 → token endpoint 不再被打；资源照常被调。
    const r2 = await callApiTool(jwt);
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(r2.body.response).toContain('ok');

    // 关键断言（缓存命中信号）：
    //   token endpoint 调用数不变（缓存命中，未再取 token）
    expect(tokenCallCount).toBe(tokenCallsAfterFirst);
    //   资源 endpoint +1（每次调用都打资源）
    expect(resourceCallCount).toBe(resourceCallsAfterFirst + 1);
    //   第二次资源请求同样带上了出站 token
    expect(lastResourceAuth).toBe('Bearer outbound-tok');
  });
});
