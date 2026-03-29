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
  enabled: z.boolean().optional().default(true),
});

/**
 * Stdio 类型服务器配置 Schema
 * 注意：type 字段可选（兼容旧配置文件），默认值为 'stdio'
 */
export const StdioServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.literal('stdio').optional().default('stdio'),
  command: z.string().min(1, { error: '命令不能为空' }),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive().optional(),
  disabled: z.boolean().optional(),
  retry: RetryConfigSchema.optional(),
});

/**
 * HTTP 类型服务器配置 Schema（SSE / Streaming）
 */
export const HttpServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.enum(['sse', 'streaming']),
  url: z.string().url({ error: '必须是有效的URL' }),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * 统一的 ServerConfig Schema
 * 使用 z.union 代替 z.discriminatedUnion，兼容 type 字段缺失的旧配置
 */
export const ServerConfigSchema = z.union([
  StdioServerConfigSchema,
  HttpServerConfigSchema,
]);
