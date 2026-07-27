import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
/**
 * e2e：内置 AS client_credentials 完整流程
 *   1. POST /api/oauth/token 拿 token
 *   2. 带 token 调 /:group/mcp tools/list 成功
 *   3. 错误 token 被拒
 *
 * 前置：测试环境配置 oauth.mode=internal + 一个测试 client（oauth profile setup）。
 *
 * 注意 MCP 端点请求格式：
 *   - /:group/mcp 用 createMcpHandler({ legacy: 'reject' }) 构造，仅服务 2026-07-28
 *     modern 流量（带 v2 _meta envelope + Accept 头 + mcp-protocol-version 头）。
 *     裸 JSON-RPC（如 tools/list 无 envelope）会被协议层拒绝为 400。
 *   - 因此「带有效 token 访问 tools/list」用 MCP 客户端 SDK（StreamableHTTPClientTransport
 *     注入 Authorization 头），而非裸 fetch。auth 失败的场景（无 token / 错 token）
 *     请求在 auth 中间件即被拒（不到协议层），裸 fetch 直接断言 401 即可。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeMcpClient, defaultMcpTestConfig } from './mcp-test-config.js';

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

/**
 * 用 MCP 客户端 SDK 带有效 Bearer token 访问 /:group/mcp。
 *
 * transport 的 requestInit 注入 Authorization 头（SDK 会在每个请求带上），
 * versionNegotiation: { mode: 'auto' } 自动探测 modern 协议版本 + 加 v2 envelope。
 */
async function listToolsWithToken(accessToken: string) {
  const mcpUrl = `${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`;
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client(
    { name: 'oauth-cc-test-client', version: '1.0.0' },
    {
      capabilities: { tools: {} },
      versionNegotiation: { mode: 'auto' },
    },
  );
  await client.connect(transport);
  try {
    const result = await client.listTools();
    return { ok: true as const, tools: result.tools };
  } finally {
    await closeMcpClient(client, transport);
  }
}

describe('OAuth client_credentials 流程', () => {
  beforeAll(() => {
    // oauth profile 的全局 setup（vitest.e2e.oauth.setup.ts）已写入 oauth internal 配置
    // 并启动 server，这里无额外准备。
  });

  afterAll(() => {
    // 配置 / server 生命周期由全局 setup 管理，单测不清理。
  });

  it('正确凭据签发 token', async () => {
    const { status, json } = await fetchToken('test-client', 'test-secret');
    expect(status).toBe(200);
    expect(json.access_token).toBeTruthy();
    expect(json.token_type).toBe('Bearer');
    expect(json.expires_in).toBeGreaterThan(0);
  });

  it('错误凭据拒绝（401 invalid_client）', async () => {
    const { status, json } = await fetchToken('test-client', 'wrong-secret');
    // token.ts mapErrorToOAuthResponse：AUTH_INVALID_CREDENTIALS → invalid_client / 401
    expect(status).toBe(401);
    expect(json.error).toBe('invalid_client');
  });

  it('带有效 token 访问 MCP tools/list 成功', async () => {
    const { status: tokenStatus, json: tokenJson } = await fetchToken('test-client', 'test-secret');
    expect(tokenStatus).toBe(200);
    expect(tokenJson.access_token).toBeTruthy();

    // 用 MCP 客户端 SDK 带 token 访问（处理 v2 envelope + Accept 头 + 协议版本）
    const result = await listToolsWithToken(tokenJson.access_token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tools).toBeInstanceOf(Array);
    }
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
    // oauth profile：无效 token 在 auth 中间件即被拒（不到协议层），返回 401。
    expect(res.status).toBe(401);
  });
});
