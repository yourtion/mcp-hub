import { getProtectedResourceMetadata } from '../../services/oauth/as-metadata.js';
import { getInternalAsMetadata } from '../../services/oauth/internal-as.js';
/**
 * /.well-known/oauth-protected-resource（RFC9728，MCP MUST）
 * /.well-known/oauth-authorization-server（RFC8414，内置 AS）
 *
 * resource 从请求 Host 头 + OAUTH_PUBLIC_SCHEME 推导（配置未显式给 issuer 时）。
 *
 * 这些路由挂载在根路径（不在 /api 下），由 app.ts 单独挂载。
 */
import { getAllConfig } from '../../utils/config.js';

import type { OAuthConfig } from '../../services/oauth/types.js';
import type { Context, Hono } from 'hono';

/**
 * 从配置 + 请求上下文推导 oauth 配置与对外 resource URL。
 * resource 优先级：oauth.internal?.issuer（显式）> Host 头 + OAUTH_PUBLIC_SCHEME（推导）。
 */
async function loadOAuthAndResource(
  c: Context,
): Promise<{ oauth: OAuthConfig | undefined; resourceUrl: string }> {
  const cfg = await getAllConfig();
  const oauth = cfg.system.oauth as OAuthConfig | undefined;
  const host = c.req.header('host') ?? 'localhost';
  const scheme = process.env.OAUTH_PUBLIC_SCHEME ?? 'https';
  const resourceUrl = oauth?.internal?.issuer ?? `${scheme}://${host}`;
  return { oauth, resourceUrl };
}

export function registerWellKnownRoutes(app: Hono) {
  // RFC9728 根级 Protected Resource metadata
  app.get('/.well-known/oauth-protected-resource', async (c) => {
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth) return c.json({ error: 'OAuth 未配置' }, 404);
    return c.json(getProtectedResourceMetadata(oauth, resourceUrl));
  });

  // RFC9728 按组路径变体（spec §2.1）：/:group/mcp 对应的 resource metadata
  app.get('/.well-known/oauth-protected-resource/:group/mcp', async (c) => {
    const group = c.req.param('group');
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth) return c.json({ error: 'OAuth 未配置' }, 404);
    return c.json(getProtectedResourceMetadata(oauth, `${resourceUrl}/${group}/mcp`));
  });

  // RFC8414 内置 AS metadata（仅 internal/both 模式暴露）
  app.get('/.well-known/oauth-authorization-server', async (c) => {
    const { oauth, resourceUrl } = await loadOAuthAndResource(c);
    if (!oauth || (oauth.mode !== 'internal' && oauth.mode !== 'both')) {
      return c.json({ error: '内置 AS 未启用' }, 404);
    }
    const issuer = oauth.internal?.issuer ?? resourceUrl;
    return c.json(getInternalAsMetadata(issuer));
  });
}
