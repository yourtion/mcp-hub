import { ErrorCode } from '@mcp-core/mcp-knot-core';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createResourceServer } from './resource-server.js';

const errorCodeLabels: Record<number, string> = Object.entries(ErrorCode).reduce(
  (acc, [label, code]) => {
    if (typeof code === 'number') acc[code] = label;
    return acc;
  },
  {} as Record<number, string>,
);

describe('resource-server 编排', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未配置 oauth + 组未启用 validation → 放行（开放模式，warn）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: false } } },
      }),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(true);
  });

  it('未配置 oauth + 组启用 validation + 无 token → 拒绝（MISSING_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(true),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(reasonOrCode(outcome)).toMatch(/MISSING/);
  });

  it('未配置 oauth + 组启用 validation + 错误 key → 拒绝（INVALID_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(false),
    });
    const outcome = await rs.authenticate('g1', 'Bearer wrongkey');
    expect(outcome.ok).toBe(false);
  });

  it('未配置 oauth + 组启用 validation + 正确 key → 放行', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: undefined,
        groups: { g1: { validation: { enabled: true, validationKey: 'enc' } } },
      }),
      verifyValidationKey: vi.fn().mockReturnValue(true),
    });
    const outcome = await rs.authenticate('g1', 'Bearer correctkey');
    expect(outcome.ok).toBe(true);
  });

  it('配置 oauth（internal）+ 无 token → 拒绝（MISSING_TOKEN）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: { mode: 'internal', resource: 'https://hub.example.com', scopes: ['mcp:tools'] },
        groups: {},
      }),
    });
    const outcome = await rs.authenticate('g1', undefined);
    expect(outcome.ok).toBe(false);
  });

  it('配置 oauth + token 校验通过 → 放行（method=oauth）', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: { mode: 'internal', resource: 'https://hub.example.com', scopes: ['mcp:tools'] },
        groups: {},
      }),
      createTokenValidator: () => ({
        validate: vi.fn().mockResolvedValue({
          ok: true,
          claims: { sub: 'c1', scope: 'mcp:tools' },
          method: 'jwt',
        }),
      }),
    });
    const outcome = await rs.authenticate('g1', 'Bearer sometoken');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.context.method).toBe('oauth');
  });

  it('mode=both + OAuth 失败 + 组启用 validation + key 正确 → 回退 validationKey 放行', async () => {
    // 覆盖 spec §6 真值表"both + validation 开 → OAuth 优先失败回退 validationKey"分支
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: {
          mode: 'both',
          resource: 'https://hub.example.com',
          scopes: ['mcp:tools'],
          internal: { tokenTtlSeconds: 3600, clients: [] },
          external: {
            issuer: 'https://idp.example.com',
            clientId: 'c',
            clientSecret: 's',
            audience: 'https://hub.example.com',
          },
        },
        groups: { g1: { validation: { enabled: true, validationKey: 'enc-key' } } },
      }),
      // OAuth 路径返回 invalid（模拟 JWT 验签失败）
      createTokenValidator: () => ({
        validate: vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' }),
      }),
      // validationKey 路径返回 true
      verifyValidationKey: vi.fn().mockReturnValue(true),
    });
    const outcome = await rs.authenticate('g1', 'Bearer correctkey');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.context.method).toBe('validationKey');
  });

  it('mode=both + OAuth 失败 + validationKey 也失败 → 返回 OAuth 失败', async () => {
    const rs = createResourceServer({
      getConfig: async () => ({
        oauth: {
          mode: 'both',
          resource: 'https://hub.example.com',
          scopes: ['mcp:tools'],
          internal: { tokenTtlSeconds: 3600, clients: [] },
          external: {
            issuer: 'https://idp.example.com',
            clientId: 'c',
            clientSecret: 's',
            audience: 'https://hub.example.com',
          },
        },
        groups: { g1: { validation: { enabled: true, validationKey: 'enc-key' } } },
      }),
      createTokenValidator: () => ({
        validate: vi.fn().mockResolvedValue({ ok: false, reason: 'expired' }),
      }),
      verifyValidationKey: vi.fn().mockReturnValue(false),
    });
    const outcome = await rs.authenticate('g1', 'Bearer wrongkey');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('expired');
  });
});

// 辅助：从失败 outcome 取可读标识（errorCode 的枚举名标签，如 OAUTH_MISSING_TOKEN；缺省时回退到 reason）
function reasonOrCode(o: { ok: false; reason?: string; errorCode?: number }): string {
  if (o.errorCode !== undefined && errorCodeLabels[o.errorCode])
    return errorCodeLabels[o.errorCode]!;
  return o.reason ?? `code_${o.errorCode ?? 'unknown'}`;
}
