/**
 * e2e：Protected Resource Metadata 发现 + 401 WWW-Authenticate 格式（RFC9728 + MCP MUST）
 */
import { describe, expect, it } from 'vitest';

import { checkServerHealth } from '../test-server.js';
import { defaultMcpTestConfig } from './mcp-test-config.js';

describe('OAuth 发现（oauth-discovery）', () => {
  it('server 健康', async () => {
    await checkServerHealth(defaultMcpTestConfig.baseUrl);
  });

  it('GET /.well-known/oauth-protected-resource 返回符合 RFC9728 的 metadata', async () => {
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}/.well-known/oauth-protected-resource`);
    // oauth profile 已配 oauth internal，端点必须返回 200（不再 conditional skip）
    expect(res.status).toBe(200);
    const doc = await res.json();
    // RFC9728 必备字段（spec Step 2）。
    // resource 由 well-known.ts 按请求 Host 头 + OAUTH_PUBLIC_SCHEME（默认 https）推导
    // （oauth.internal.issuer 未显式配置时），故 scheme 为 https、host 为 localhost:3010。
    expect(doc.resource).toBeTruthy();
    expect(doc.resource).toBe(`https://localhost:${defaultMcpTestConfig.serverPort}`);
    expect(doc.authorization_servers).toBeInstanceOf(Array);
    expect(doc.authorization_servers.length).toBeGreaterThanOrEqual(1);
    expect(doc.jwks_uri).toBeTruthy();
    expect(doc.bearer_methods_supported).toContain('header');
    expect(doc.scopes_supported).toBeInstanceOf(Array);
    expect(doc.scopes_supported).toContain('mcp:tools');
  });

  it('配置了 oauth 后，无 token 访问 MCP 端点返回 401 + WWW-Authenticate', async () => {
    // oauth profile 已配 oauth internal + default 组存在 → 请求必走到 auth 中间件
    // 被拒（missing_token），不再 conditional skip
    const res = await fetch(`${defaultMcpTestConfig.baseUrl}${defaultMcpTestConfig.mcpEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    });
    expect(res.status).toBe(401);
    const www = res.headers.get('WWW-Authenticate');
    expect(www).toBeTruthy();
    expect(www).toContain('Bearer');
    // MCP 规范 MUST：resource_metadata 参数（RFC9728 受保护资源 metadata URL）
    expect(www).toMatch(/resource_metadata=|error=/);
  });
});
