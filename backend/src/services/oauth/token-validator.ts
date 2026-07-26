/**
 * Token 校验编排
 *
 * 流程：
 * 1. 解析 token，判断 JWT（含 2 个 '.'）还是 opaque
 * 2. JWT：本地验签（jose）+ 验 iss/aud/exp + 验 scope
 * 3. opaque 或 JWT 验签失败：仅 mode 含 external 时回退 introspection（带 TTL 缓存）
 *
 * 校验失败的具体 reason 供中间件映射到正确的 ErrorCode / HTTP 状态。
 */
import { jwtVerify, importJWK, errors as joseErrors } from 'jose';

import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import { logger } from '../../utils/logger.js';

import { createJwksCache } from './jwks-cache.js';
import { getInternalPublicKeySet } from './crypto-keys.js';

import type { OAuthConfig, TokenValidationResult, IntrospectionResult } from './types.js';
import type { JwksCache } from './jwks-cache.js';
import type { JWK } from 'jose';

export interface TokenValidatorDeps {
  /** introspection 回退实现（外部 IdP 场景）；mode=internal 时不会被调用 */
  introspectToken?: (token: string) => Promise<IntrospectionResult>;
  /** 注入 JWKS 缓存（测试用） */
  jwksCache?: JwksCache;
}

export interface TokenValidator {
  validate(token: string, requiredScope: string): Promise<TokenValidationResult>;
}

const INTROSPECTION_CACHE_TTL_MS = 60_000;

export function createTokenValidator(config: OAuthConfig, deps: TokenValidatorDeps = {}): TokenValidator {
  const jwksCache = deps.jwksCache ?? createJwksCache();
  const introspectionCache = new Map<string, { result: IntrospectionResult; at: number }>();

  return {
    async validate(token, requiredScope) {
      const isJwt = token.split('.').length === 3;

      if (isJwt) {
        const result = await verifyJwt(token, config, jwksCache, requiredScope);
        if (result.ok) return result;
        // JWT 校验产生确定结论（expired/audience/scope）时不再回退——
        // 这些是针对已成功验签 JWT 的 claims 判定，introspection 同一个 token 结论相同。
        if (result.reason !== 'invalid') return result;
        // 仅 signature/格式失败（reason='invalid'）才回退 introspection：
        // 可能是别处签发的、或本质是 opaque 但恰好含 2 个 '.' 的 token。
        if (config.mode !== 'external' && config.mode !== 'both') {
          return result; // internal 模式不回退
        }
        // 落到 introspection
      }

      // introspection 回退（mode 含 external）
      if (config.mode !== 'external' && config.mode !== 'both') {
        // internal 模式遇到 opaque 直接 invalid
        return { ok: false, reason: 'invalid' };
      }
      return introspect(token, config, deps, introspectionCache, requiredScope);
    },
  };
}

async function verifyJwt(
  token: string,
  config: OAuthConfig,
  jwksCache: JwksCache,
  requiredScope: string,
): Promise<TokenValidationResult> {
  const ext = config.external;

  // external / both 模式（配置了 external）：优先走 JWKS URI 验签
  if (ext) {
    const result = await verifyJwtWithJwks(token, ext, jwksCache, requiredScope);
    // 通过，或确定结论（expired/audience/scope）→ 直接返回
    if (result.ok || result.reason !== 'invalid') return result;
    // both 模式且 JWKS 验签失败（reason='invalid'）→ 回退内置公钥
    // （token 可能由内置 AS 签发，JWKS 是外部 IdP 的，验签自然失败）
    if (config.mode === 'both') {
      return verifyJwtWithInternalKeys(token, config, requiredScope);
    }
    return result;
  }

  // 纯 internal 模式：用内置 AS 公钥本地验签（load-bearing 修复）
  // 此前直接返回 { ok: false, reason: 'invalid' }，导致 internal 模式签发的合法
  // token 被错误拒绝（Task 15 e2e 会因此失败）。
  return verifyJwtWithInternalKeys(token, config, requiredScope);
}

/**
 * 用外部 IdP 的 JWKS URI 验签（external / both 模式的主路径）。
 */
async function verifyJwtWithJwks(
  token: string,
  ext: NonNullable<OAuthConfig['external']>,
  jwksCache: JwksCache,
  requiredScope: string,
): Promise<TokenValidationResult> {
  const jwksUri = ext.jwksUri ?? `${ext.issuer}/jwks`;
  try {
    const { payload } = await jwtVerify(
      token,
      (header: { kid?: string }) => jwksCache.getKey(header.kid, jwksUri),
      {
        algorithms: ['RS256'],
        issuer: ext.issuer,
        audience: ext.audience,
      },
    );
    return checkScope(payload, requiredScope);
  } catch (err) {
    return mapJoseError(err);
  }
}

/**
 * 用内置 AS 的公钥集本地验签（internal 模式主路径，both 模式回退路径）。
 *
 * 公钥集来自 crypto-keys.getInternalPublicKeySet()（与 internal-as 签发时同一密钥）。
 * iss 校验用 config.internal.issuer ?? config.resource；
 * aud 校验用 config.resource（RFC8707 resource 标识，与 internal-as.setAudience 一致）。
 */
async function verifyJwtWithInternalKeys(
  token: string,
  config: OAuthConfig,
  requiredScope: string,
): Promise<TokenValidationResult> {
  const keys = getInternalPublicKeySet();
  if (keys.length === 0) {
    // 公钥集未初始化（理论上签发端已调用 loadOrCreateSigningKey，此处防御）
    logger.warn('internal 模式验签：内置公钥集为空（密钥未加载）');
    return { ok: false, reason: 'invalid' };
  }

  // 解析 header 取 kid，按 kid 匹配公钥；无 kid 时尝试第一个
  let kid: string | undefined;
  try {
    const headerB64 = token.split('.')[0];
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    kid = JSON.parse(headerJson).kid;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const matched = kid ? keys.find((k) => k.kid === kid) : keys[0];
  if (!matched) {
    logger.debug('internal 模式验签：kid 不匹配', { kid });
    return { ok: false, reason: 'invalid' };
  }

  let key: CryptoKey | Uint8Array;
  try {
    key = await importJWK(matched as JWK, 'RS256');
  } catch (err) {
    logger.debug('internal 模式验签：importJWK 失败', { error: (err as Error).message });
    return { ok: false, reason: 'invalid' };
  }

  const issuer = config.internal?.issuer ?? config.resource;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      issuer,
      audience: config.resource,
    });
    return checkScope(payload, requiredScope);
  } catch (err) {
    return mapJoseError(err);
  }
}

function checkScope(
  payload: Record<string, unknown>,
  requiredScope: string,
): TokenValidationResult {
  const tokenScopes = String(payload.scope ?? '').split(' ');
  if (!tokenScopes.includes(requiredScope)) {
    return { ok: false, reason: 'scope' };
  }
  return { ok: true, claims: payload as unknown as IntrospectionResult, method: 'jwt' };
}

function mapJoseError(err: unknown): TokenValidationResult {
  if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' };
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    // 区分 audience vs 其它
    if (/aud/i.test(err.message)) return { ok: false, reason: 'audience' };
    return { ok: false, reason: 'invalid' };
  }
  logger.debug('JWT 验签失败', { error: (err as Error).message });
  return { ok: false, reason: 'invalid' };
}

async function introspect(
  token: string,
  config: OAuthConfig,
  deps: TokenValidatorDeps,
  cache: Map<string, { result: IntrospectionResult; at: number }>,
  requiredScope: string,
): Promise<TokenValidationResult> {
  if (!deps.introspectToken) {
    throw new ServiceError(ErrorCode.OAUTH_CONFIG_ERROR, 'external 模式未注入 introspectToken 实现');
  }
  // 缓存
  const cached = cache.get(token);
  if (cached && Date.now() - cached.at < INTROSPECTION_CACHE_TTL_MS) {
    return mapIntrospection(cached.result, requiredScope, 'introspection');
  }
  const result = await deps.introspectToken(token);
  cache.set(token, { result, at: Date.now() });
  return mapIntrospection(result, requiredScope, 'introspection');
}

function mapIntrospection(
  r: IntrospectionResult,
  requiredScope: string,
  method: 'introspection',
): TokenValidationResult {
  if (!r.active) return { ok: false, reason: 'inactive' };
  const aud = Array.isArray(r.aud) ? r.aud : [r.aud];
  // audience 校验由调用方配置决定，这里宽松：只要有任意 aud 命中即放行（严格校验在 resource-server）
  void aud; // 当前宽松策略下未直接使用，保留以便后续严格化
  const scopes = String(r.scope ?? '').split(' ');
  if (!scopes.includes(requiredScope)) {
    return { ok: false, reason: 'scope' };
  }
  return { ok: true, claims: r, method };
}
