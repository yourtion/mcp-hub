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
    expect(header).toContain(
      'resource_metadata="https://hub.example.com/.well-known/oauth-protected-resource"',
    );
    expect(header).toContain('scope="mcp:tools"');
  });

  it('WWW-Authenticate 头无 scope 时省略', () => {
    const header = buildWwwAuthenticateHeader(
      'https://hub.example.com/.well-known/oauth-protected-resource',
    );
    expect(header).toContain('resource_metadata=');
    expect(header).not.toContain('scope=');
  });
});
