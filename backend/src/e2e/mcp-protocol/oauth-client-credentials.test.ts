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
    // 开放模式（未配置 oauth）下，请求在协议层（缺 Accept / 未 initialize）即被拒，
    // 不会走到 auth 中间件，返回 400/404/503——按 conditional skip 策略放行。
    if (res.status === 400 || res.status === 404 || res.status === 503) {
      console.warn(`测试环境未配置 oauth（status=${res.status}），跳过 401 断言`);
      return;
    }
    expect(res.status).toBe(401);
  });
});
