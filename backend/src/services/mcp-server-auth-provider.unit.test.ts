import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServerAuthProvider } from './mcp-server-auth-provider.js';

// mock SDK 的 ClientCredentialsProvider（避免真实 OAuth 流程）
vi.mock('@modelcontextprotocol/client', () => ({
  ClientCredentialsProvider: vi.fn(function (this: any, opts: any) {
    this.opts = opts;
  }),
}));

import { ClientCredentialsProvider } from '@modelcontextprotocol/client';

describe('createServerAuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TEST_SECRET;
  });

  it('无 auth 返回 undefined', () => {
    expect(createServerAuthProvider(undefined)).toBeUndefined();
  });

  it('bearer 返回 AuthProvider，token() 返回配置 token', async () => {
    const provider = createServerAuthProvider({ type: 'bearer', token: 'my-token' })!;
    expect(await provider.token!()).toBe('my-token');
  });

  it('bearer + ${VAR} 解析环境变量', async () => {
    process.env.TEST_SECRET = 'env-token';
    const provider = createServerAuthProvider({ type: 'bearer', token: '${TEST_SECRET}' })!;
    expect(await provider.token!()).toBe('env-token');
  });

  it('bearer + ${VAR} 环境变量未定义抛 ConfigError', () => {
    expect(() => createServerAuthProvider({ type: 'bearer', token: '${UNDEFINED_VAR}' })).toThrow();
  });

  it('oauth 返回 ClientCredentialsProvider 实例，options 正确', () => {
    createServerAuthProvider({
      type: 'oauth',
      clientId: 'c-id',
      clientSecret: 'secret',
      scope: 'read',
    });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith({
      clientId: 'c-id',
      clientSecret: 'secret',
      scope: 'read',
    });
  });

  it('oauth + ${VAR} 解析 secret 环境变量', () => {
    process.env.TEST_SECRET = 'env-secret';
    createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: '${TEST_SECRET}' });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'env-secret' }),
    );
  });

  it('oauth + ${VAR} 环境变量未定义抛错', () => {
    expect(() =>
      createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: '${UNDEFINED}' }),
    ).toThrow();
  });

  it('明文 secret（非 ${VAR} 形式）直接使用', () => {
    createServerAuthProvider({ type: 'oauth', clientId: 'c-id', clientSecret: 'plain-secret' });
    expect(ClientCredentialsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'plain-secret' }),
    );
  });
});
