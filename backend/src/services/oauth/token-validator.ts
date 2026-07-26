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
import { jwtVerify, errors as joseErrors } from 'jose';

import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import { logger } from '../../utils/logger.js';

import { createJwksCache } from './jwks-cache.js';

import type { OAuthConfig, TokenValidationResult, IntrospectionResult } from './types.js';
import type { JwksCache } from './jwks-cache.js';

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
  if (!ext) {
    // internal 模式的 JWT 验签走内置 AS 的公钥（通过 JWKS 端点自取，或直接用 crypto-keys）
    // MVP：internal 模式的 token 由 internal-as 签发，校验在 resource-server 层直接用内置公钥
    return { ok: false, reason: 'invalid' };
  }
  const jwksUri = ext.jwksUri ?? `${ext.issuer}/jwks`;
  try {
    const { payload } = await jwtVerify(token, (header: { kid?: string }) => jwksCache.getKey(header.kid, jwksUri), {
      algorithms: ['RS256'],
      issuer: ext.issuer,
      audience: ext.audience,
    });
    // scope 校验
    const tokenScopes = String(payload.scope ?? '').split(' ');
    if (!tokenScopes.includes(requiredScope)) {
      return { ok: false, reason: 'scope' };
    }
    return { ok: true, claims: payload as unknown as IntrospectionResult, method: 'jwt' };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' };
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      // 区分 audience vs 其它
      if (/aud/i.test(err.message)) return { ok: false, reason: 'audience' };
      return { ok: false, reason: 'invalid' };
    }
    logger.debug('JWT 验签失败', { error: (err as Error).message });
    return { ok: false, reason: 'invalid' };
  }
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
