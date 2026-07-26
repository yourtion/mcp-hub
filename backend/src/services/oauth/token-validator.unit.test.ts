import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { _resetForTesting as resetCryptoKeys, loadOrCreateSigningKey } from './crypto-keys.js';
import { issueClientCredentialsToken } from './internal-as.js';
import { createTokenValidator } from './token-validator.js';

import type { OAuthConfig } from './types.js';

describe('token-validator', () => {
  let keypair: { privateKey: CryptoKey; publicKey: CryptoKey; kid: string };

  beforeEach(async () => {
    const kp = await generateKeyPair('RS256');
    keypair = { ...kp, kid: 'test-kid' };
  });

  const externalCfg: OAuthConfig = {
    mode: 'external',
    resource: 'https://hub.example.com',
    scopes: ['mcp:tools'],
    external: {
      issuer: 'https://idp.example.com',
      clientId: 'hub',
      clientSecret: 's',
      jwksUri: 'https://idp.example.com/jwks',
      audience: 'https://hub.example.com',
    },
  };

  async function signToken(overrides: Record<string, unknown> = {}) {
    return new SignJWT({ scope: 'mcp:tools', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('1h')
      .sign(keypair.privateKey);
  }

  function stubJwks() {
    // jose v6 的 createRemoteJWKSet 校验 res.status（=== 200）而非 res.ok，
    // 因此 mock 必须返回 status: 200（参考 jwks-cache.unit.test.ts 的可用写法）。
    vi.stubGlobal('fetch', async () => ({
      status: 200,
      json: async () => ({ keys: [{ ...(await exportJWK(keypair.publicKey)), kid: keypair.kid }] }),
    }));
  }

  it('JWT 本地验签通过（iss/aud/scope 正确）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await signToken();
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('aud 不匹配拒绝（OAUTH_INVALID_AUDIENCE）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await signToken({}).then(() =>
      // 重新签一个 aud 错的
      new SignJWT({ scope: 'mcp:tools' })
        .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
        .setIssuedAt()
        .setIssuer('https://idp.example.com')
        .setSubject('c1')
        .setAudience('https://other.example.com')
        .setExpirationTime('1h')
        .sign(keypair.privateKey),
    );
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('audience');
    vi.unstubAllGlobals();
  });

  it('过期 token 拒绝', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await new SignJWT({ scope: 'mcp:tools' })
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('0s')
      .sign(keypair.privateKey);
    // 等过期
    await new Promise((r) => setTimeout(r, 50));
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
    vi.unstubAllGlobals();
  });

  it('scope 不足拒绝（insufficient_scope）', async () => {
    stubJwks();
    const validator = createTokenValidator(externalCfg);
    const token = await new SignJWT({ scope: 'mcp:resources' }) // 只有 resources
      .setProtectedHeader({ alg: 'RS256', kid: keypair.kid })
      .setIssuedAt()
      .setIssuer('https://idp.example.com')
      .setSubject('c1')
      .setAudience('https://hub.example.com')
      .setExpirationTime('1h')
      .sign(keypair.privateKey);
    const result = await validator.validate(token, 'mcp:tools');
    expect(result.ok).toBe(false);
    // scope 不匹配返回 reason: 'scope'，供中间件层（Task 10）映射为 OAUTH_INSUFFICIENT_SCOPE + 403
    if (!result.ok) expect(result.reason).toBe('scope');
    vi.unstubAllGlobals();
  });

  it('opaque token 触发 introspection 回退', async () => {
    const introspectMock = vi.fn().mockResolvedValue({
      active: true,
      aud: 'https://hub.example.com',
      scope: 'mcp:tools',
      exp: Math.floor(Date.now() / 1000) + 3600,
      client_id: 'c1',
    });
    const validator = createTokenValidator(externalCfg, { introspectToken: introspectMock });
    // opaque token：不是 JWT 格式（少于 3 段 .）
    const result = await validator.validate('opaque-token-xyz', 'mcp:tools');
    expect(introspectMock).toHaveBeenCalledWith('opaque-token-xyz');
    expect(result.ok).toBe(true);
  });

  it('introspection 返回 inactive 拒绝', async () => {
    const introspectMock = vi.fn().mockResolvedValue({ active: false });
    const validator = createTokenValidator(externalCfg, { introspectToken: introspectMock });
    const result = await validator.validate('opaque-token-xyz', 'mcp:tools');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('inactive');
  });

  it('mode=internal 且 JWT 验签失败 → 不回退 introspection，直接 invalid', async () => {
    const internalCfg: OAuthConfig = {
      ...externalCfg,
      mode: 'internal',
      internal: { tokenTtlSeconds: 3600, clients: [] },
    };
    delete (internalCfg as { external?: unknown }).external;
    const introspectMock = vi.fn();
    const validator = createTokenValidator(internalCfg, { introspectToken: introspectMock });
    const result = await validator.validate('malformed-jwt', 'mcp:tools');
    expect(result.ok).toBe(false);
    expect(introspectMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // internal 模式本地验签（load-bearing 修复覆盖）
  //
  // 此前 verifyJwt 在 !ext 分支直接返回 invalid，导致 internal 模式签发的
  // 合法 token 被错误拒绝。修复后用 getInternalPublicKeySet + importJWK 本地验签。
  // ------------------------------------------------------------------
  describe('internal 模式本地验签（load-bearing 修复）', () => {
    const internalResource = 'https://hub.example.com';
    const internalIssuer = 'https://hub.example.com';

    const internalCfg: OAuthConfig = {
      mode: 'internal',
      resource: internalResource,
      scopes: ['mcp:tools', 'mcp:resources'],
      internal: {
        issuer: internalIssuer,
        tokenTtlSeconds: 3600,
        clients: [{ clientId: 'c1', clientSecret: 's3cret', scopes: ['mcp:tools'] }],
      },
    };

    beforeEach(() => {
      // crypto-keys 模块级缓存会影响其它测试，每个 case 前重置
      resetCryptoKeys();
    });

    it('内置 AS 签发的 token 能本地验签通过（iss/aud/scope 正确）', async () => {
      // 用内置 AS 签发（内部会调用 loadOrCreateSigningKey 初始化公钥）
      const { accessToken } = await issueClientCredentialsToken(
        { clientId: 'c1', clientSecret: 's3cret', scope: 'mcp:tools', resource: internalResource },
        internalCfg,
      );
      const validator = createTokenValidator(internalCfg);
      const result = await validator.validate(accessToken, 'mcp:tools');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.method).toBe('jwt');
        expect((result.claims as { sub?: string }).sub).toBe('c1');
      }
    });

    it('aud 与 resource 不匹配 → audience 拒绝', async () => {
      // 手动签一个 aud 错的 token（用内置密钥）
      const { privateKey, kid } = await loadOrCreateSigningKey();
      const token = await new SignJWT({ scope: 'mcp:tools', client_id: 'c1' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setIssuer(internalIssuer)
        .setSubject('c1')
        .setAudience('https://other.example.com') // 错的 resource
        .setExpirationTime('1h')
        .sign(privateKey);
      const validator = createTokenValidator(internalCfg);
      const result = await validator.validate(token, 'mcp:tools');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('audience');
    });

    it('scope 不足 → scope 拒绝', async () => {
      const { privateKey, kid } = await loadOrCreateSigningKey();
      const token = await new SignJWT({ scope: 'mcp:resources', client_id: 'c1' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setIssuer(internalIssuer)
        .setSubject('c1')
        .setAudience(internalResource)
        .setExpirationTime('1h')
        .sign(privateKey);
      const validator = createTokenValidator(internalCfg);
      const result = await validator.validate(token, 'mcp:tools');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('scope');
    });

    it('过期 token → expired 拒绝', async () => {
      const { privateKey, kid } = await loadOrCreateSigningKey();
      const token = await new SignJWT({ scope: 'mcp:tools', client_id: 'c1' })
        .setProtectedHeader({ alg: 'RS256', kid })
        .setIssuedAt()
        .setIssuer(internalIssuer)
        .setSubject('c1')
        .setAudience(internalResource)
        .setExpirationTime('0s')
        .sign(privateKey);
      await new Promise((r) => setTimeout(r, 50));
      const validator = createTokenValidator(internalCfg);
      const result = await validator.validate(token, 'mcp:tools');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('expired');
    });

    it('用未知 kid 签发的 token → invalid 拒绝', async () => {
      // 用一把完全不同的密钥签发（kid 不在内置公钥集里）
      const foreignKp = await generateKeyPair('RS256');
      const token = await new SignJWT({ scope: 'mcp:tools', client_id: 'c1' })
        .setProtectedHeader({ alg: 'RS256', kid: 'unknown-kid' })
        .setIssuedAt()
        .setIssuer(internalIssuer)
        .setSubject('c1')
        .setAudience(internalResource)
        .setExpirationTime('1h')
        .sign(foreignKp.privateKey);
      // 先确保内置密钥已初始化（否则公钥集为空，会走另一条 invalid 分支）
      await loadOrCreateSigningKey();
      const validator = createTokenValidator(internalCfg);
      const result = await validator.validate(token, 'mcp:tools');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('invalid');
    });
  });
});
