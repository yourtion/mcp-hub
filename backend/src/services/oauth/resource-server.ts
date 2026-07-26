/**
 * Protected Resource 校验编排
 *
 * 按 SystemConfig.oauth 是否配置 + 组级 validation.enabled 决定走哪条路径：
 * （见 spec §6 真值表）
 *
 *  - oauth 未配置 + validation 关 → 放行（开放，warn）
 *  - oauth 未配置 + validation 开 → validationKey 校验
 *  - oauth 配置（internal/external）→ OAuth 校验（validationKey 禁用）
 *  - oauth 配置（both）→ OAuth 优先，失败回退 validationKey（若组启用）
 */
import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { logger } from '../../utils/logger.js';
import { verifyValidationKey } from './validation-key.js';
import { createTokenValidator } from './token-validator.js';

import type { OAuthConfig, McpAuthContext, TokenValidationResult } from './types.js';
import type { SystemConfig } from '@mcp-core/mcp-hub-share';

export type AuthOutcome =
  | { ok: true; context: McpAuthContext }
  | {
      ok: false;
      reason: 'missing_token' | 'invalid_token' | 'expired' | 'audience' | 'insufficient_scope' | 'config_error';
      errorCode: ErrorCode;
    };

export interface ResourceServerDeps {
  /** 注入配置读取（生产用 getAllConfig；测试用 mock） */
  getConfig: () => Promise<
    Pick<SystemConfig, 'oauth'> & {
      groups: Record<string, { validation?: { enabled?: boolean; validationKey?: string } }>;
    }
  >;
  /** 注入 validationKey 校验（默认用真实实现） */
  verifyValidationKey?: (input: string, encrypted: string) => boolean;
  /** 注入 token validator 工厂（测试用） */
  createTokenValidator?: (
    config: OAuthConfig,
  ) => { validate: (token: string, scope: string) => Promise<TokenValidationResult> };
}

export interface ResourceServer {
  authenticate(groupId: string, authHeader: string | undefined): Promise<AuthOutcome>;
}

const REQUIRED_SCOPE = 'mcp:tools';

export function createResourceServer(deps: ResourceServerDeps): ResourceServer {
  const verifyVk = deps.verifyValidationKey ?? verifyValidationKey;

  return {
    async authenticate(groupId, authHeader) {
      const cfg = await deps.getConfig();
      const oauth = cfg.oauth;
      const group = cfg.groups[groupId];
      const validationEnabled = group?.validation?.enabled === true;

      // 路径 A：未配置 oauth
      if (!oauth) {
        if (!validationEnabled) {
          logger.warn('MCP 端点完全开放（未配置 OAuth 且组未启用 validationKey），生产环境不推荐', { groupId });
          return { ok: true, context: { method: 'oauth', principal: 'anonymous', scope: 'mcp:tools' } };
        }
        return verifyValidationKeyPath(authHeader, group!.validation!.validationKey!, verifyVk);
      }

      // 路径 B：配置了 oauth
      const token = extractBearer(authHeader);
      if (!token) {
        return { ok: false, reason: 'missing_token', errorCode: ErrorCode.OAUTH_MISSING_TOKEN };
      }

      const validatorFactory = deps.createTokenValidator ?? ((c: OAuthConfig) => createTokenValidator(c));
      const validator = validatorFactory(oauth);
      const result = await validator.validate(token, REQUIRED_SCOPE);

      if (result.ok) {
        const principal =
          (result.claims as { sub?: string; client_id?: string }).sub ??
          (result.claims as { client_id?: string }).client_id ??
          'unknown';
        return {
          ok: true,
          context: { method: 'oauth', principal, scope: REQUIRED_SCOPE },
        };
      }

      // OAuth 失败：both 模式 + 组启用 validation → 回退
      if (oauth.mode === 'both' && validationEnabled && group?.validation?.validationKey) {
        const vkResult = verifyValidationKeyPath(authHeader, group.validation.validationKey, verifyVk);
        if (vkResult.ok) return vkResult;
      }

      return mapValidationFailure(result);
    },
  };
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] ?? null;
}

function verifyValidationKeyPath(
  authHeader: string | undefined,
  encryptedStored: string,
  verifyVk: (input: string, encrypted: string) => boolean,
): AuthOutcome {
  const token = extractBearer(authHeader);
  if (!token) {
    return { ok: false, reason: 'missing_token', errorCode: ErrorCode.OAUTH_MISSING_TOKEN };
  }
  if (verifyVk(token, encryptedStored)) {
    return {
      ok: true,
      context: { method: 'validationKey', principal: 'validation-key', scope: 'mcp:tools mcp:resources' },
    };
  }
  return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
}

function mapValidationFailure(r: { ok: false; reason: string }): AuthOutcome {
  switch (r.reason) {
    case 'expired':
      return { ok: false, reason: 'expired', errorCode: ErrorCode.OAUTH_TOKEN_EXPIRED };
    case 'audience':
      return { ok: false, reason: 'audience', errorCode: ErrorCode.OAUTH_INVALID_AUDIENCE };
    case 'scope':
      return { ok: false, reason: 'insufficient_scope', errorCode: ErrorCode.OAUTH_INSUFFICIENT_SCOPE };
    case 'inactive':
    case 'invalid':
      return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
    default:
      return { ok: false, reason: 'invalid_token', errorCode: ErrorCode.OAUTH_INVALID_TOKEN };
  }
}

// 保留 ServiceError 引用避免 unused（实际错误由中间件抛出）
export type { ServiceError };
