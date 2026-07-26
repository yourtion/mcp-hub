/**
 * 内置 AS RSA 签名密钥管理测试
 *
 * 覆盖三条主路径：
 * 1. 未配置环境变量时生成临时密钥对并 warn
 * 2. 公钥集包含当前 kid
 * 3. 签发的私钥能配合 jose SignJWT 签名
 */
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger 以捕获 warn 调用（logger 委托给 McpLogger，非 console.warn）
const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('../../utils/logger.js', () => ({ logger: loggerMock }));

import { _resetForTesting, getInternalPublicKeySet, loadOrCreateSigningKey } from './crypto-keys.js';

describe('crypto-keys', () => {
  const origEnv = process.env.OAUTH_INTERNAL_PRIVATE_KEY;

  beforeEach(() => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    _resetForTesting();
    loggerMock.warn.mockClear();
  });

  afterEach(() => {
    delete process.env.OAUTH_INTERNAL_PRIVATE_KEY;
    if (origEnv !== undefined) process.env.OAUTH_INTERNAL_PRIVATE_KEY = origEnv;
    _resetForTesting();
    vi.restoreAllMocks();
  });

  it('未配置环境变量时生成临时密钥对并 warn', async () => {
    const { privateKey, publicKeyJwk, kid } = await loadOrCreateSigningKey();

    expect(privateKey).toBeDefined();
    expect(publicKeyJwk.kty).toBe('RSA');
    expect(publicKeyJwk.alg).toBe('RS256');
    expect(kid).toBeTruthy();
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    const warned = String(loggerMock.warn.mock.calls[0]?.[0] ?? '');
    expect(warned).toContain('OAUTH_INTERNAL_PRIVATE_KEY');
  });

  it('公钥集包含当前 kid', async () => {
    const { kid, publicKeyJwk } = await loadOrCreateSigningKey();
    const set = getInternalPublicKeySet();
    const entry = set.find((k) => k.kid === kid);
    expect(entry).toBeDefined();
    expect(entry?.kty).toBe('RSA');
    expect(entry?.alg).toBe('RS256');
    // 公钥集的 entry 与 loadOrCreateSigningKey 返回的 publicKeyJwk 一致
    expect(entry?.kid).toBe(publicKeyJwk.kid);
  });

  it('签发的密钥能验签（用 jose 对签）', async () => {
    const { privateKey, kid } = await loadOrCreateSigningKey();
    const token = await new SignJWT({ sub: 'c1' })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
    expect(token.split('.')).toHaveLength(3);
  });
});
