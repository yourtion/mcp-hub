/**
 * MCP 认证中间件测试
 */
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

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
    const res = await makeApp(authenticate).request('/auth/g1', {
      headers: { Authorization: 'Bearer x' },
    });
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
    const res = await makeApp(authenticate).request('/auth/g1', {
      headers: { Authorization: 'Bearer x' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
  });

  it('insufficient_scope 返回 403 + scope', async () => {
    const authenticate = vi.fn().mockResolvedValue({
      ok: false,
      reason: 'insufficient_scope',
      errorCode: 6104,
    });
    const res = await makeApp(authenticate).request('/auth/g1', {
      headers: { Authorization: 'Bearer x' },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('WWW-Authenticate')).toContain('insufficient_scope');
    expect(res.headers.get('WWW-Authenticate')).toContain('scope=');
  });
});
