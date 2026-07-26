import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
/**
 * 内置最小 Authorization Server
 *
 * 仅支持 client_credentials grant（机器对机器，MCP 客户端服务账号场景）。
 * 签发 RS256 JWT，claims 含 RFC9207 iss / RFC8707 aud（=resource）。
 *
 * client 凭据校验：配置里 clientSecret 是 bcrypt 哈希（$2a/$2b/$2y 前缀）；
 * 为兼容测试与简单部署，若配置值不是 bcrypt hash 前缀（$2），按明文比较（带常量时间）。
 */
import { timingSafeEqual } from 'node:crypto';

import { loadOrCreateSigningKey } from './crypto-keys.js';

import type { OAuthConfig } from './types.js';

export interface AsMetadata {
  issuer: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
  resource_parameter_supported: boolean;
  revocation_endpoint?: string;
}

export interface IssueTokenParams {
  clientId: string;
  clientSecret: string;
  scope?: string;
  resource: string;
}

export interface IssueTokenResult {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

export async function issueClientCredentialsToken(
  params: IssueTokenParams,
  config: OAuthConfig,
): Promise<IssueTokenResult> {
  const internal = config.internal;
  if (!internal) {
    throw new ServiceError(
      ErrorCode.OAUTH_CONFIG_ERROR,
      '内置 AS 未配置（mode=internal/both 需 oauth.internal）',
    );
  }

  // 1. 查 client
  const client = internal.clients.find((c) => c.clientId === params.clientId);
  if (!client) {
    throw new ServiceError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'client_id 不存在');
  }

  // 2. 校验 clientSecret（bcrypt 优先，否则明文常量时间比较）
  const secretOk = await verifyClientSecret(params.clientSecret, client.clientSecret);
  if (!secretOk) {
    throw new ServiceError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'client_secret 错误');
  }

  // 3. 校验 scope（请求 scope 必须是 client 配置 scope 的子集；未请求则授予全部配置 scope）
  const requestedScopes = (params.scope ?? '').split(' ').filter(Boolean);
  const allowedScopes = client.scopes;
  const granted = requestedScopes.length === 0 ? allowedScopes : requestedScopes;
  for (const s of granted) {
    if (!allowedScopes.includes(s)) {
      throw new ServiceError(ErrorCode.OAUTH_INSUFFICIENT_SCOPE, `client 未授权 scope: ${s}`);
    }
  }
  const scopeStr = granted.join(' ');

  // 4. 签发 JWT
  const { privateKey, kid } = await loadOrCreateSigningKey();
  const issuer = internal.issuer ?? config.resource;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = internal.tokenTtlSeconds;

  const token = await new SignJWT({ scope: scopeStr, client_id: params.clientId })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt(now)
    .setIssuer(issuer)
    .setSubject(params.clientId)
    .setAudience(params.resource) // RFC8707 audience 绑定
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);

  return { accessToken: token, expiresIn, scope: scopeStr };
}

async function verifyClientSecret(input: string, stored: string): Promise<boolean> {
  // bcrypt hash（$2a/$2b/$2y 前缀）
  if (/^\$2[abcy]/.test(stored)) {
    return bcrypt.compare(input, stored);
  }
  // 明文：常量时间比较
  const a = Buffer.from(input);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getInternalAsMetadata(issuer: string): AsMetadata {
  return {
    issuer,
    token_endpoint: `${issuer}/api/oauth/token`,
    jwks_uri: `${issuer}/api/oauth/jwks`,
    response_types_supported: ['none'],
    grant_types_supported: ['client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'], // 为 MCP 客户端 metadata 验证必须声明
    scopes_supported: ['mcp:tools', 'mcp:resources'],
    resource_parameter_supported: true,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
  };
}
