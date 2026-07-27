/**
 * OAuth 子系统类型定义
 *
 * 与 Web UI 的 auth（services/auth.ts）完全独立，保护 /:group/mcp 协议端点。
 */
import type { SystemConfig } from '@mcp-core/mcp-hub-share';

/** 从 SystemConfig.oauth 提取的非可选强类型（oauth 已配置时） */
export type OAuthConfig = NonNullable<SystemConfig['oauth']>;

/** 内置 AS 签发的 JWT claims（RS256） */
export interface TokenClaims {
  iss: string; // RFC9207，防 mix-up
  sub: string; // client_id
  aud: string | string[]; // RFC8707，resource 标识
  exp: number;
  iat: number;
  nbf?: number;
  scope: string;
  client_id: string;
}

/** introspection（RFC7662）响应（关注的字段子集） */
export interface IntrospectionResult {
  active: boolean;
  aud?: string | string[];
  scope?: string;
  exp?: number;
  client_id?: string;
  sub?: string;
}

/** 中间件注入到 Hono context 的 MCP 认证上下文 */
export interface McpAuthContext {
  /** 认证方式：oauth（JWT/introspection）或 validationKey（组级 AES key） */
  method: 'oauth' | 'validationKey';
  /** 客户端标识（oauth: client_id / sub；validationKey: 'validation-key'） */
  principal: string;
  /** 授权 scope（空格分隔，oauth 路径有；validationKey 路径为 'mcp:tools mcp:resources'） */
  scope?: string;
  /** 原始 token（仅日志/审计用，不回传客户端） */
  tokenHash?: string;
}

/** token 校验结果 */
export type TokenValidationResult =
  | { ok: true; claims: TokenClaims | IntrospectionResult; method: 'jwt' | 'introspection' }
  | { ok: false; reason: 'invalid' | 'expired' | 'audience' | 'inactive' | 'scope' };
