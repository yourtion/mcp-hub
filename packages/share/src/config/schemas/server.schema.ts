/**
 * ServerConfig 统一 Zod Schema
 * 合并了 share、core、CLI、Backend 中所有 ServerConfig 的字段
 */
import { z } from 'zod/v4';

/**
 * 重试配置 Schema
 */
export const RetryConfigSchema = z.object({
  maxRetries: z.number().nonnegative(),
  delay: z.number().nonnegative(),
  exponentialBackoff: z.boolean().optional(),
});

/**
 * 基础服务器配置 Schema（Stdio 和 HTTP 共享的字段）
 */
export const BaseServerConfigSchema = z.object({
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Stdio 类型服务器配置 Schema
 * 注意：type 字段可选（兼容旧配置文件），默认值为 'stdio'
 */
export const StdioServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.literal('stdio').optional(),
  command: z.string().min(1, { error: '命令不能为空' }),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive().optional(),
  disabled: z.boolean().optional(),
  retry: RetryConfigSchema.optional(),
});

/**
 * MCP server 出站认证配置（仅 sse/streaming 类型有意义）
 * - bearer：静态 token，直接用，无刷新
 * - oauth：client_credentials 机器认证，SDK 自动发现 + 获取 + 刷新
 */
export const ServerAuthConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bearer'),
    token: z.string().min(1, { error: 'bearer token 不能为空' }),
  }),
  z.object({
    type: z.literal('oauth'),
    clientId: z.string().min(1, { error: 'clientId 不能为空' }),
    clientSecret: z.string().min(1, { error: 'clientSecret 不能为空' }),
    scope: z.string().optional(),
    clientName: z.string().optional(),
  }),
]);

export type ServerAuthConfig = z.infer<typeof ServerAuthConfigSchema>;

/**
 * HTTP 类型服务器配置 Schema（SSE / Streaming）
 */
export const HttpServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.enum(['sse', 'streaming']),
  url: z.string().url({ error: '必须是有效的URL' }),
  headers: z.record(z.string(), z.string()).optional(),
  auth: ServerAuthConfigSchema.optional(),
});

/**
 * 统一的 ServerConfig Schema
 * 使用 z.union 代替 z.discriminatedUnion，兼容 type 字段缺失的旧配置
 */
export const ServerConfigSchema = z.union([StdioServerConfigSchema, HttpServerConfigSchema]);
