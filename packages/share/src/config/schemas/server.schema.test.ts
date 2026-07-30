import { describe, it, expect } from 'vitest';

import { ServerConfigSchema } from './server.schema.js';

describe('HttpServerConfigSchema auth 字段', () => {
  it('bearer auth 合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'bearer', token: 'abc123' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('oauth auth 合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: {
        type: 'oauth',
        clientId: 'my-client',
        clientSecret: '${MY_SECRET}',
        scope: 'read',
      },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('oauth 缺 clientId 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientSecret: 'x' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('oauth 缺 clientSecret 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientId: 'x' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('oauth 空 clientId 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientId: '', clientSecret: 'x' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('bearer 缺 token 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'bearer' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('bearer 空 token 不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'bearer', token: '' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('auth.type 非法值不合法', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: { type: 'basic', user: 'u', pass: 'p' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('无 auth 仍合法（向后兼容）', () => {
    const config = { type: 'streaming', url: 'https://example.com/mcp' };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('oauth 可选字段省略仍合法', () => {
    const config = {
      type: 'sse',
      url: 'https://example.com/mcp',
      auth: { type: 'oauth', clientId: 'c', clientSecret: 's' },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('auth 解析后保留 clientName/scope', () => {
    const config = {
      type: 'streaming',
      url: 'https://example.com/mcp',
      auth: {
        type: 'oauth',
        clientId: 'c',
        clientSecret: 's',
        scope: 'read write',
        clientName: 'my-app',
      },
    };
    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth).toMatchObject({
        type: 'oauth',
        clientId: 'c',
        clientSecret: 's',
        scope: 'read write',
        clientName: 'my-app',
      });
    }
  });

  it('stdio server + auth 行为（实测确认）', () => {
    // ServerConfigSchema = z.union([StdioServerConfigSchema, HttpServerConfigSchema])
    // stdio 分支不含 auth 字段；z.union 默认行为会对未定义字段 strip。
    // 这里记录实测行为：见 task-1-report.md。
    const config = {
      type: 'stdio',
      command: 'echo',
      auth: { type: 'bearer', token: 'x' },
    };
    const result = ServerConfigSchema.safeParse(config);
    // 实测：放行（success=true），auth 被 strip 掉。
    expect(result.success).toBe(true);
  });
});
