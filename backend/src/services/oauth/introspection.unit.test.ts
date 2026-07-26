import { describe, expect, it, vi, afterEach } from 'vitest';

import { createIntrospectToken } from './introspection.js';

import type { OAuthConfig } from './types.js';

describe('introspection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const oauth: OAuthConfig = {
    mode: 'external',
    resource: 'https://hub.example.com',
    scopes: ['mcp:tools'],
    external: {
      issuer: 'https://idp.example.com',
      clientId: 'hub-client',
      clientSecret: 'hub-secret',
      audience: 'https://hub.example.com',
      introspectionEndpoint: 'https://idp.example.com/introspect',
    },
  };

  it('active token 返回完整字段', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          active: true,
          aud: 'https://hub.example.com',
          scope: 'mcp:tools',
          exp: 9999999999,
          client_id: 'c1',
          sub: 'u1',
        }),
      }),
    );
    const introspect = createIntrospectToken(oauth);
    const result = await introspect('opaque-token');
    expect(result.active).toBe(true);
    expect(result.aud).toBe('https://hub.example.com');
    expect(result.scope).toBe('mcp:tools');
    expect(result.client_id).toBe('c1');
  });

  it('inactive token 返回 active:false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active: false }),
      }),
    );
    const introspect = createIntrospectToken(oauth);
    const result = await introspect('bad-token');
    expect(result.active).toBe(false);
  });

  it('网络错误 fail-closed 返回 inactive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const introspect = createIntrospectToken(oauth);
    const result = await introspect('any');
    expect(result.active).toBe(false);
  });

  it('非 2xx 响应 fail-closed 返回 inactive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const introspect = createIntrospectToken(oauth);
    const result = await introspect('any');
    expect(result.active).toBe(false);
  });

  it('2xx 但 body 非 JSON fail-closed 返回 inactive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    );
    const introspect = createIntrospectToken(oauth);
    const result = await introspect('any');
    expect(result.active).toBe(false);
  });

  it('请求带 Basic auth + form body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const introspect = createIntrospectToken(oauth);
    await introspect('opaque');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const initObj = init as {
      method: string;
      headers: Record<string, string>;
      body: URLSearchParams;
    };
    expect(initObj.method).toBe('POST');
    expect(initObj.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(initObj.headers.Authorization).toMatch(/^Basic /);
    expect(initObj.body.get('token')).toBe('opaque');
  });
});
