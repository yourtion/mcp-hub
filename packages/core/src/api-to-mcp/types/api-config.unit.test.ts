import { describe, expect, it } from 'vitest';

import { AuthConfigSchema } from './api-config.js';

describe('AuthConfigSchema（discriminated union）', () => {
  it('接受有效的 bearer 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'bearer', token: 'xxx' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 apikey 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'apikey', token: 'xxx', header: 'X-Key' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 basic 配置', () => {
    const result = AuthConfigSchema.safeParse({ type: 'basic', username: 'u', password: 'p' });
    expect(result.success).toBe(true);
  });

  it('接受有效的 oauth client_credentials 配置', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
      scope: 'read',
    });
    expect(result.success).toBe(true);
  });

  it('oauth 缺 clientId 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
    });
    expect(result.success).toBe(false);
  });

  it('oauth tokenUrl 非 URL 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'client_credentials',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('oauth 非法 grantType 被拒', () => {
    const result = AuthConfigSchema.safeParse({
      type: 'oauth',
      grantType: 'password',
      clientId: 'cid',
      clientSecret: 'secret',
      tokenUrl: 'https://as.example.com/token',
    });
    expect(result.success).toBe(false);
  });

  it('未知 type 被拒', () => {
    const result = AuthConfigSchema.safeParse({ type: 'unknown', token: 'x' });
    expect(result.success).toBe(false);
  });
});
