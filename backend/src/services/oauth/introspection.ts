/**
 * Introspection 生产实现（RFC7662）
 *
 * 将 opaque token / 验签失败的 JWT 转发到外部 IdP 的 introspection 端点，
 * 解析响应判定 token 是否 active。
 *
 * 带基本 client 凭据认证（client_id/client_secret 用 Basic auth）。
 * introspectionEndpoint 优先用配置覆盖，否则用 issuer 推导默认路径。
 */
import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { logger } from '../../utils/logger.js';

import type { IntrospectionResult } from './types.js';
import type { OAuthConfig } from './types.js';

/**
 * 创建生产用 introspectToken 实现。
 * @param oauth 系统级 OAuth 配置（须含 external）
 * @returns (token) => Promise<IntrospectionResult>
 */
export function createIntrospectToken(
  oauth: OAuthConfig,
): (token: string) => Promise<IntrospectionResult> {
  const ext = oauth.external;
  if (!ext) {
    throw new ServiceError(
      ErrorCode.OAUTH_CONFIG_ERROR,
      'createIntrospectToken 需要 oauth.external 配置',
    );
  }

  const endpoint = ext.introspectionEndpoint ?? `${ext.issuer.replace(/\/$/, '')}/oauth/introspect`;
  const basicAuth = Buffer.from(`${ext.clientId}:${ext.clientSecret}`).toString('base64');

  return async (token: string): Promise<IntrospectionResult> => {
    const body = new URLSearchParams({ token });
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body,
      });
    } catch (err) {
      logger.error('Introspection 端点请求失败', err as Error, { endpoint });
      // 网络错误视为 inactive（fail-closed），不抛 500
      return { active: false };
    }

    if (!res.ok) {
      logger.warn('Introspection 端点返回非 2xx', {
        status: res.status,
        endpoint,
      });
      return { active: false };
    }

    const json = (await res.json()) as Partial<IntrospectionResult>;
    return {
      active: Boolean(json.active),
      aud: json.aud,
      scope: json.scope,
      exp: json.exp,
      client_id: json.client_id,
      sub: json.sub,
    };
  };
}
