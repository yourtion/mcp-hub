/**
 * OAuth 出站认证策略
 * 支持 client_credentials grant + refresh_token 续期
 */

import { createHash } from 'node:crypto';

import { ErrorCode, ServiceError } from '../../errors/index.js';
import { createLogger } from '../../utils/logger.js';

import type { AuthConfig, HttpRequestConfig, OAuthAuthConfig } from '../types/index.js';
import type { AuthenticationStrategy } from './authentication.js';
import type { CacheManager } from './cache-manager.js';
import type { HttpClient } from './http-client.js';

const logger = createLogger({ component: 'OAuthStrategy' });

/**
 * 将过期前的时间缓冲（毫秒）：token 在此窗口内视为将过期，需 refresh/重取
 */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * 缓存的 token 结构
 */
export interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}

/**
 * 计算 token 缓存键
 * 用 hash 是因为即使 key 不进日志，hash 也比明文拼接更安全；
 * clientSecret 故意不参与 key（避免泄漏风险）。
 */
function buildCacheKey(config: OAuthAuthConfig): string {
  const raw = [config.clientId, config.tokenUrl, config.scope ?? '', config.grantType].join('|');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  return `oauth:token:${hash}`;
}

/**
 * OAuth 出站认证策略
 *
 * - client_credentials：首次（或缓存失效）时向 token endpoint 换取 access_token
 * - refresh_token：缓存将过期且有 refreshToken 时，优先尝试 refresh；失败则静默回退 client_credentials
 *
 * clientSecret / refreshToken 原文绝不进日志/错误 context。
 */
export class OAuthStrategy implements AuthenticationStrategy {
  readonly name = 'oauth';

  /**
   * 同 cacheKey 进行中的取 token Promise，防止并发 stampede：
   * 缓存 miss 时，多个并发请求复用同一个 token 获取操作。
   */
  private readonly inflightRequests = new Map<string, Promise<string>>();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly cache: CacheManager,
  ) {
    logger.info('OAuthStrategy 初始化');
  }

  async applyAuth(request: HttpRequestConfig, config: AuthConfig): Promise<HttpRequestConfig> {
    if (config.type !== 'oauth') {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID,
        'OAuth 策略收到非 oauth 配置',
      );
    }

    const accessToken = await this.getAccessToken(config);

    const headerName = config.headerName ?? 'Authorization';
    const tokenPrefix = config.tokenPrefix ?? 'Bearer ';
    const headers = { ...request.headers };
    headers[headerName] = `${tokenPrefix}${accessToken}`;

    logger.debug('应用 OAuth 认证', { context: { headerName, clientId: config.clientId } });
    return { ...request, headers };
  }

  async validateConfig(config: AuthConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.type !== 'oauth') {
      return { valid: false, error: '认证类型不匹配' };
    }
    if (!config.clientId) {
      return { valid: false, error: 'OAuth 需要 clientId' };
    }
    if (!config.clientSecret) {
      return { valid: false, error: 'OAuth 需要 clientSecret' };
    }
    if (!config.tokenUrl) {
      return { valid: false, error: 'OAuth 需要 tokenUrl' };
    }
    if (config.grantType === 'refresh_token' && !config.refreshToken) {
      return { valid: false, error: 'refresh_token grant 需要 refreshToken' };
    }
    return { valid: true };
  }

  /**
   * 获取有效 access token：
   * 1) 缓存未过期 → 直接用
   * 2) 缓存将过期且有 refreshToken → 尝试 refresh（失败静默回退）
   * 3) 否则 client_credentials 重取
   *
   * 路径 2/3 走 in-flight 去重：同 cacheKey 的并发请求复用一次取 token 操作，
   * 避免 token endpoint 被 stampede。
   */
  private async getAccessToken(config: OAuthAuthConfig): Promise<string> {
    const cacheKey = buildCacheKey(config);
    const now = Date.now();

    const cached = (await this.cache.get(cacheKey)) as CachedToken | null;
    if (cached && cached.expiresAt - now > EXPIRY_BUFFER_MS) {
      logger.debug('OAuth token 缓存命中', { context: { clientId: config.clientId } });
      return cached.accessToken;
    }

    // 已有同 cacheKey 的进行中请求 → 复用，避免并发 stampede
    const existing = this.inflightRequests.get(cacheKey);
    if (existing) {
      logger.debug('OAuth token in-flight 去重命中', { context: { clientId: config.clientId } });
      return existing;
    }

    const promise = this.fetchFreshToken(config, cacheKey, cached).finally(() => {
      this.inflightRequests.delete(cacheKey);
    });
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * 获取新 token：缓存将过期且有 refreshToken → 尝试 refresh（失败静默回退）；
   * 否则 client_credentials 重取。由 getAccessToken 经 in-flight map 调度。
   */
  private async fetchFreshToken(
    config: OAuthAuthConfig,
    cacheKey: string,
    cached: CachedToken | null,
  ): Promise<string> {
    if (cached?.refreshToken) {
      try {
        return await this.refreshToken(config, cached.refreshToken, cacheKey);
      } catch (err) {
        logger.warn('OAuth refresh 失败，回退到 client_credentials', {
          context: {
            clientId: config.clientId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
    return this.fetchToken(config, cacheKey);
  }

  /**
   * client_credentials grant 取新 token
   * 失败抛 OAUTH_OUTBOUND_TOKEN_FETCH_FAILED；错误 context 仅含安全字段。
   */
  private async fetchToken(config: OAuthAuthConfig, cacheKey: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    if (config.scope) {
      body.set('scope', config.scope);
    }

    const response = await this.httpClient.request({
      url: config.tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString(),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        `OAuth token endpoint 返回 ${response.status}`,
        undefined,
        {
          clientId: config.clientId,
          tokenUrl: config.tokenUrl,
          scope: config.scope,
          statusCode: response.status,
        },
      );
    }

    const tokenData = response.data as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        'OAuth token endpoint 响应缺 access_token',
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl },
      );
    }

    const expiresIn = tokenData.expires_in ?? 3600;
    const cached: CachedToken = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: tokenData.refresh_token,
    };
    await this.cache.set(cacheKey, cached, Math.max(expiresIn - 60, 60));

    logger.info('OAuth token 获取成功', {
      context: {
        clientId: config.clientId,
        expiresIn,
        hasRefreshToken: !!tokenData.refresh_token,
      },
    });

    return cached.accessToken;
  }

  /**
   * refresh_token 续期（优化路径，失败由调用方静默回退 client_credentials）
   * 错误 context 仅含安全字段（不含 clientSecret / refreshToken 原文）。
   */
  private async refreshToken(
    config: OAuthAuthConfig,
    refreshToken: string,
    cacheKey: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await this.httpClient.request({
      url: config.tokenUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString(),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        `OAuth refresh 返回 ${response.status}`,
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl },
      );
    }

    const tokenData = response.data as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      throw new ServiceError(
        ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED,
        'OAuth refresh 响应缺 access_token',
        undefined,
        { clientId: config.clientId, tokenUrl: config.tokenUrl },
      );
    }

    const expiresIn = tokenData.expires_in ?? 3600;
    const cached: CachedToken = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      refreshToken: tokenData.refresh_token ?? refreshToken,
    };
    await this.cache.set(cacheKey, cached, Math.max(expiresIn - 60, 60));

    logger.info('OAuth token 刷新成功', { context: { clientId: config.clientId, expiresIn } });
    return cached.accessToken;
  }
}
