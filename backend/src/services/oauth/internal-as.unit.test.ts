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
    expect(payload.client_id).toBe('c1');
    // kid 在 protected header
    void kid;
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
