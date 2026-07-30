import { ConfigError, ErrorCode } from '@mcp-core/mcp-hub-core';
import { ClientCredentialsProvider, type AuthProvider } from '@modelcontextprotocol/client';

import type { ServerAuthConfig } from '@mcp-core/mcp-hub-share/config';

const ENV_VAR_PATTERN = /^\$\{(\w+)\}$/;

/**
 * 解析 secret 值：完整匹配 `${VAR}` 形式则从 process.env 取，否则当明文。
 * 环境变量未定义则抛 ConfigError。
 *
 * 注意：secret 原文仅在此函数内部处理，绝不进入日志/错误 context。
 */
export function resolveSecret(value: string): string {
  const match = value.match(ENV_VAR_PATTERN);
  if (!match) return value; // 明文
  const envVar = match[1];
  const resolved = process.env[envVar];
  if (resolved === undefined) {
    throw new ConfigError(
      ErrorCode.INVALID_SERVER_CONFIG,
      `环境变量 ${envVar} 未定义（server auth secret 引用了 \${${envVar}}）`,
    );
  }
  return resolved;
}

/**
 * 从 server 配置的 auth 字段构造 SDK authProvider。
 * - bearer：最小 AuthProvider { token }，无刷新（静态 token 无法刷新，401 重试失败则 SDK 抛 UnauthorizedError）。
 * - oauth：SDK 现成 ClientCredentialsProvider（metadata 发现 + client_credentials + 自动刷新）。
 * - undefined：返回 undefined（沿用现状，仅 requestInit.headers）。
 */
export function createServerAuthProvider(
  auth: ServerAuthConfig | undefined,
): AuthProvider | ClientCredentialsProvider | undefined {
  if (!auth) return undefined;
  if (auth.type === 'bearer') {
    return createBearerProvider(auth.token);
  }
  return new ClientCredentialsProvider({
    clientId: auth.clientId,
    clientSecret: resolveSecret(auth.clientSecret),
    scope: auth.scope,
    clientName: auth.clientName,
  });
}

function createBearerProvider(rawToken: string): AuthProvider {
  const token = resolveSecret(rawToken);
  return {
    token: async () => token,
    // 无 onUnauthorized：静态 token 无法刷新。
  };
}
