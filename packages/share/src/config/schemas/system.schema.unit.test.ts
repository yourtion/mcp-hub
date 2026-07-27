import { describe, expect, it } from 'vitest';

import { SystemConfigSchema } from './system.schema.js';

describe('SystemConfigSchema oauth 字段', () => {
  const baseValid = {
    server: { port: 8181, host: '0.0.0.0' },
    auth: {
      jwt: { secret: 'a'.repeat(32), expiresIn: '24h', refreshExpiresIn: '7d', issuer: 'hub' },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 900000,
        passwordMinLength: 6,
        requireStrongPassword: false,
      },
    },
    users: {},
    ui: {
      title: 't',
      theme: 'light',
      features: { apiToMcp: true, debugging: false, monitoring: true },
    },
    monitoring: { metricsEnabled: true, logLevel: 'info', retentionDays: 30 },
  };

  it('oauth 字段缺失时通过校验（可选）', () => {
    expect(() => SystemConfigSchema.parse(baseValid)).not.toThrow();
  });

  it('mode=internal 时 internal 配置生效', () => {
    const cfg = {
      ...baseValid,
      oauth: {
        mode: 'internal' as const,
        resource: 'https://hub.example.com',
        internal: {
          tokenTtlSeconds: 3600,
          clients: [{ clientId: 'c1', clientSecret: 'h', scopes: ['mcp:tools'] }],
        },
      },
    };
    expect(() => SystemConfigSchema.parse(cfg)).not.toThrow();
  });

  it('mode=external 时 external 配置生效', () => {
    const cfg = {
      ...baseValid,
      oauth: {
        mode: 'external' as const,
        resource: 'https://hub.example.com',
        external: {
          issuer: 'https://idp.example.com',
          clientId: 'c',
          clientSecret: 's',
          audience: 'https://hub.example.com',
        },
      },
    };
    expect(() => SystemConfigSchema.parse(cfg)).not.toThrow();
  });

  it('resource 必须是合法 URL', () => {
    const cfg = { ...baseValid, oauth: { mode: 'internal' as const, resource: 'not-a-url' } };
    expect(() => SystemConfigSchema.parse(cfg)).toThrow();
  });

  it('mode 枚举校验非法值', () => {
    const cfg = { ...baseValid, oauth: { mode: 'hybrid', resource: 'https://hub.example.com' } };
    expect(() => SystemConfigSchema.parse(cfg)).toThrow();
  });
});
