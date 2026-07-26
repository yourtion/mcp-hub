/**
 * OAuth Metadata 生成（RFC9728 Protected Resource + WWW-Authenticate 头）
 *
 * 注意：外部 IdP 的 RFC8414 AS metadata 发现（拉取 + 缓存）由 token-validator
 * 在需要时按 issuer 直接 fetch，本模块只负责"本 Hub 自己作为 Resource/AS
 * 要对外暴露的 metadata 文档"。
 */
import type { OAuthConfig } from './types.js';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  jwks_uri?: string;
  bearer_methods_supported: string[];
  scopes_supported?: string[];
}

export function getProtectedResourceMetadata(config: OAuthConfig, resource: string): ProtectedResourceMetadata {
  const servers: string[] = [];
  // MCP 规范 MUST：authorization_servers 至少一个
  if (config.mode === 'internal' || config.mode === 'both') {
    servers.push(config.internal?.issuer ?? resource); // 内置 AS issuer 默认 = resource
  }
  if (config.mode === 'external' || config.mode === 'both') {
    if (config.external) servers.push(config.external.issuer);
  }

  return {
    resource,
    authorization_servers: servers,
    jwks_uri: `${resource}/api/oauth/jwks`, // 内置 AS 公钥端点
    bearer_methods_supported: ['header'],
    scopes_supported: config.scopes,
  };
}

/**
 * 构建 401 响应的 WWW-Authenticate 头（MCP 规范 MUST）
 * 格式：Bearer resource_metadata="<url>", scope="<scope>"
 */
export function buildWwwAuthenticateHeader(resourceMetadataUrl: string, scope?: string): string {
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
  if (scope) {
    parts.push(`scope="${scope}"`);
  }
  return parts.join(', ');
}

/**
 * 构建 insufficient_scope 的 403 WWW-Authenticate 头
 * 格式：Bearer error="insufficient_scope", scope="...", resource_metadata="...", error_description="..."
 */
export function buildInsufficientScopeHeader(
  resourceMetadataUrl: string,
  requiredScope: string,
  errorDescription?: string,
): string {
  const parts = [
    `Bearer error="insufficient_scope"`,
    `scope="${requiredScope}"`,
    `resource_metadata="${resourceMetadataUrl}"`,
  ];
  if (errorDescription) {
    parts.push(`error_description="${errorDescription.replace(/"/g, '\\"')}"`);
  }
  return parts.join(', ');
}
