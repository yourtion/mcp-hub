/**
 * POST /api/oauth/token —— 内置 AS 的 client_credentials 签发端点
 *
 * 支持 application/x-www-form-urlencoded（OAuth 标准）。
 * 响应 RFC6749 §5.1 格式；错误响应 RFC6749 §5.2 格式。
 */
import { ErrorCode, McpHubCoreError } from '@mcp-core/mcp-hub-core';

import { getAllConfig } from '../../utils/config.js';
import { issueClientCredentialsToken } from '../../services/oauth/internal-as.js';

import type { OAuthConfig } from '../../services/oauth/types.js';
import type { Hono } from 'hono';

/**
 * OAuth error 响应使用的 HTTP 状态码字面量联合（与 Hono ContentfulStatusCode 兼容）。
 */
type OAuthErrorStatus = 400 | 401 | 503;

/**
 * 将 internal-as 抛出的错误 code 映射为 RFC6749 §5.2 OAuth error。
 * - AUTH_INVALID_CREDENTIALS / OAUTH_CONFIG_ERROR → invalid_client（401）
 * - OAUTH_INSUFFICIENT_SCOPE → invalid_scope（400）
 * - 其余未知错误 → server_error（503）
 */
function mapErrorToOAuthResponse(err: unknown): {
  error: string;
  error_description: string;
  status: OAuthErrorStatus;
} {
  if (err instanceof McpHubCoreError) {
    if (err.code === ErrorCode.OAUTH_INSUFFICIENT_SCOPE) {
      return { error: 'invalid_scope', error_description: err.message, status: 400 };
    }
    if (
      err.code === ErrorCode.AUTH_INVALID_CREDENTIALS ||
      err.code === ErrorCode.OAUTH_CONFIG_ERROR
    ) {
      return { error: 'invalid_client', error_description: err.message, status: 401 };
    }
  }
  return {
    error: 'server_error',
    error_description: err instanceof Error ? err.message : '未知错误',
    status: 503,
  };
}

export function registerTokenRoutes(app: Hono) {
  app.post('/token', async (c) => {
    const form = await c.req.formData();
    const grantType = form.get('grant_type');
    if (grantType !== 'client_credentials') {
      return c.json(
        {
          error: 'unsupported_grant_type',
          error_description: '仅支持 client_credentials grant',
        },
        400,
      );
    }

    const clientId = String(form.get('client_id') ?? '');
    const clientSecret = String(form.get('client_secret') ?? '');
    const scope = form.get('scope') ? String(form.get('scope')) : undefined;
    const resource = String(form.get('resource') ?? '');

    if (!clientId || !resource) {
      return c.json(
        { error: 'invalid_request', error_description: '缺少 client_id 或 resource' },
        400,
      );
    }

    const cfg = await getAllConfig();
    const oauth = cfg.system.oauth as OAuthConfig | undefined;
    if (!oauth || !oauth.internal) {
      return c.json(
        { error: 'server_error', error_description: '内置 AS 未配置' },
        503,
      );
    }

    try {
      const result = await issueClientCredentialsToken(
        { clientId, clientSecret, scope, resource },
        oauth,
      );
      return c.json({
        access_token: result.accessToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        scope: result.scope,
      });
    } catch (err) {
      const { error, error_description, status } = mapErrorToOAuthResponse(err);
      return c.json({ error, error_description }, status);
    }
  });
}
