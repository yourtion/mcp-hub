/**
 * 外部 IdP JWKS 拉取与缓存
 *
 * 按 jwksUri 索引，带 TTL（默认 1 小时）。TTL 到期时直接重建底层
 * createRemoteJWKSet 实例，强制下次访问重新拉取（而非依赖 jose 内部
 * cooldownDuration/cacheMaxAge 双层缓存），使刷新行为可被测试稳定验证。
 *
 * 实现说明（相对 brief 的偏离）：
 * 1. brief 的 `entry.remote(kid)` 直接传 kid 字符串；jose v6 的 resolver
 *    调用签名为 `(protectedHeader?: JWSHeaderParameters)`，内部
 *    `getKtyFromAlg(protectedHeader.alg)` 在 alg 缺失时抛 JOSENotSupported。
 *    改为封装 `{ kid, alg: 'RS256' }` 调用（P2 子系统仅支持 RS256 签名）。
 * 2. jose v6 不再导出 KeyLike 类型；返回类型用 `CryptoKey | Uint8Array`
 *    （resolver 实际返回 CryptoKey，留 Uint8Array 兼容 HMAC 场景）。
 * 3. TTL 刷新：当 `now - fetchedAt > ttlMs` 时，本实现直接覆盖 entry，
 *    新建 createRemoteJWKSet —— 这等价于 brief 风险提示中建议的
 *    `cache.delete(jwksUri)` + 重建 fallback，且更直接。
 */
import { createRemoteJWKSet } from 'jose';

import { logger } from '../../utils/logger.js';

import type { JWSHeaderParameters } from 'jose';

/** resolver 返回的验证公钥类型 */
export type VerifyKey = CryptoKey | Uint8Array;

interface JwksCacheEntry {
  /** jose remote resolver；按 { kid, alg } 调用 */
  remote: ReturnType<typeof createRemoteJWKSet>;
  /** 入缓存时刻（ms） */
  fetchedAt: number;
}

export interface JwksCacheOptions {
  /** 缓存 TTL（毫秒），过期后下次访问重建 remote JWKSet。默认 1h */
  ttlMs?: number;
  /** 解析 kid 时使用的 alg。默认 'RS256'（P2 子系统唯一签名算法） */
  alg?: string;
}

export interface JwksCache {
  /**
   * 按 kid + jwksUri 取验证公钥。
   * - TTL 内命中缓存：复用底层 remote 实例
   * - TTL 过期：重建 remote 实例，下次访问强制重新拉取
   */
  getKey(kid: string | undefined, jwksUri: string): Promise<VerifyKey>;
  /** 测试/管理用：清空缓存 */
  clear(): void;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

export function createJwksCache(options: JwksCacheOptions = {}): JwksCache {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const alg = options.alg ?? 'RS256';
  const cache = new Map<string, JwksCacheEntry>();

  return {
    async getKey(kid, jwksUri) {
      const now = Date.now();
      const existing = cache.get(jwksUri);
      // TTL 到期：直接重建 entry（等价于 delete + 新建，强制底层 remote 重新拉取）。
      // 用 `>=` 而非 `>`：ttlMs=0 时每次访问都应判过期（now - fetchedAt === 0）；
      // 配合"过期即重建 createRemoteJWKSet 实例"，避开 jose 内部 cacheMaxAge 默认 10min
      // 的双层缓存，使刷新可被 fetch 调用次数稳定验证。
      if (!existing || now - existing.fetchedAt >= ttlMs) {
        logger.debug('JWKS 缓存未命中或已过期，重建 remote JWKSet', { jwksUri });
        const entry: JwksCacheEntry = {
          remote: createRemoteJWKSet(new URL(jwksUri)),
          fetchedAt: now,
        };
        cache.set(jwksUri, entry);
      }
      const entry = cache.get(jwksUri);
      if (!entry) {
        // 理论不可达（刚 set）；防御性兜底
        throw new Error(`JWKS cache entry missing for ${jwksUri}`);
      }
      // jose v6 resolver 需要 { kid, alg } 形式调用以推断 kty
      const protectedHeader: JWSHeaderParameters = { kid, alg };
      return entry.remote(protectedHeader);
    },
    clear() {
      cache.clear();
    },
  };
}
