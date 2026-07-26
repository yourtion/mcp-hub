/**
 * MCP 端点认证中间件
 *
 * 与 Web UI 的 middleware/auth.ts 完全独立：
 *  - Web UI auth 保护 /api/*（HS256 JWT，本地用户库）
 *  - mcp-auth 保护 /:group/mcp（OAuth RS256 / introspection / validationKey）
 *
 * 失败响应带 WWW-Authenticate 头（MCP 规范 MUST），HTTP status 由 errorCode 决定。
 * 注意：401/403 响应不包装成 JSON-RPC，直接返回 HTTP（MCP 客户端按 status 识别挑战）。
 */
import { ErrorCode } from '@mcp-core/mcp-hub-core';

import { buildInsufficientScopeHeader, buildWwwAuthenticateHeader } from '../services/oauth/as-metadata.js';

import type { McpAuthContext } from '../services/oauth/types.js';
import type { ResourceServer } from '../services/oauth/resource-server.js';
import type { Context, Next } from 'hono';

/** 中间件可能返回的 HTTP status（401/403，均为 ContentfulStatusCode） */
type AuthStatus = 401 | 403;

/** MCP 协议端点要求的 scope（与 resource-server REQUIRED_SCOPE 一致） */
const REQUIRED_SCOPE = 'mcp:tools';

// 扩展 Hono context 变量
declare module 'hono' {
  interface ContextVariableMap {
    mcpAuth: McpAuthContext;
  }
}

export interface McpAuthMiddlewareDeps {
  resourceServer: ResourceServer;
  /**
   * Protected Resource Metadata 的路径（相对，如 '/.well-known/oauth-protected-resource'）；
   * 中间件用请求 origin 拼成完整 URL，避免硬编码 host。
   */
  resourceMetadataUrlPath: string;
}

/**
 * 创建 MCP 端点认证中间件。
 *
 * 前置依赖：groupValidationMiddleware 应已向 context 注入 `groupId`。
 */
export function createMcpAuthMiddleware(deps: McpAuthMiddlewareDeps) {
  return async function mcpAuthMiddleware(c: Context, next: Next) {
    const groupId = c.get('groupId') as string | undefined;
    if (!groupId) {
      // groupId 应由前置的 groupValidationMiddleware 注入
      return c.json(
        { jsonrpc: '2.0', error: { code: -32602, message: '缺少 groupId 上下文' }, id: null },
        400,
      );
    }

    const authHeader = c.req.header('Authorization');
    const outcome = await deps.resourceServer.authenticate(groupId, authHeader);

    if (outcome.ok) {
      c.set('mcpAuth', outcome.context);
      await next();
      return;
    }

    // 失败：按 errorCode 映射 HTTP status + WWW-Authenticate
    // 用请求 origin 拼 resource_metadata 完整 URL（不硬编码 host）
    const origin = new URL(c.req.url).origin;
    const resourceMetadataUrl = `${origin}${deps.resourceMetadataUrlPath}`;
    const www = buildChallengeHeader(outcome.errorCode, resourceMetadataUrl);
    const status = httpStatusFor(outcome.errorCode);
    // 用 c.header()/c.status() + c.body(null, status, headers) 三参形式（类型更稳）。
    // 同时赋值给 c.res 并返回：若上游 wrapper 忽略返回值，赋值 c.res 也能让 Hono
    // 把 context 视为 finalized，避免 "Context is not finalized" 错误。
    c.res = c.body(null, status, { 'WWW-Authenticate': www });
    return c.res;
  };
}

function buildChallengeHeader(errorCode: ErrorCode, resourceMetadataUrl: string): string {
  if (errorCode === ErrorCode.OAUTH_INSUFFICIENT_SCOPE) {
    // error_description 须为 ASCII（HTTP 头为 ByteString），用英文描述
    return buildInsufficientScopeHeader(resourceMetadataUrl, REQUIRED_SCOPE, 'insufficient scope');
  }
  return buildWwwAuthenticateHeader(resourceMetadataUrl, REQUIRED_SCOPE);
}

function httpStatusFor(errorCode: ErrorCode): AuthStatus {
  // OAUTH_INSUFFICIENT_SCOPE → 403；其余 OAuth 错误（missing/invalid/expired/audience）→ 401
  if (errorCode === ErrorCode.OAUTH_INSUFFICIENT_SCOPE) return 403;
  return 401;
}
