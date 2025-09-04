import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// 测试服务器配置验证模式
describe('服务器配置验证', () => {
  const StdioServerConfigSchema = z.object({
    type: z.literal('stdio'),
    command: z.string().min(1, '命令不能为空'),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    enabled: z.boolean().optional().default(true),
  });

  const HttpServerConfigSchema = z.object({
    type: z.enum(['sse', 'streaming']),
    url: z.string().url('必须是有效的URL'),
    headers: z.record(z.string()).optional(),
    env: z.record(z.string()).optional(),
    enabled: z.boolean().optional().default(true),
  });

  const ServerConfigSchema = z.union([
    StdioServerConfigSchema,
    HttpServerConfigSchema,
  ]);

  it('应该验证有效的stdio服务器配置', () => {
    const validConfig = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'test-mcp'],
      enabled: true,
    };

    const result = ServerConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('应该验证有效的SSE服务器配置', () => {
    const validConfig = {
      type: 'sse',
      url: 'https://example.com/mcp',
      headers: {
        Authorization: 'Bearer token',
      },
    };

    const result = ServerConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('应该拒绝无效的配置', () => {
    const invalidConfig = {
      type: 'stdio',
      // 缺少command字段
    };

    const result = ServerConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('应该拒绝无效的URL', () => {
    const invalidConfig = {
      type: 'sse',
      url: 'not-a-url',
    };

    const result = ServerConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('应该设置默认的enabled值', () => {
    const config = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'test-mcp'],
    };

    const result = ServerConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });
});
