/**
 * CLI 专属配置 Zod Schema
 * 包含 servers + logging + transport
 */
import { z } from 'zod/v4';

/**
 * CLI 服务器配置 Schema（仅支持 stdio 类型，无 type 字段）
 * 注意：CLI 配置文件格式不含 type 字段，由 CliConfigManager 自动补充
 */
export const CliServerConfigSchema = z.object({
  command: z.string().min(1, { error: '命令不能为空' }),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  disabled: z.boolean().optional(),
  timeout: z.number().positive().optional(),
});

/**
 * CLI 日志配置 Schema
 */
export const CliLoggingSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  file: z.string().optional(),
});

/**
 * CLI 传输配置 Schema
 */
export const CliTransportSchema = z.object({
  type: z.literal('stdio').default('stdio'),
});

/**
 * CLI 完整配置 Schema
 */
export const CliConfigSchema = z.object({
  servers: z
    .record(z.string(), CliServerConfigSchema)
    .refine((servers) => Object.keys(servers).length > 0, {
      message: '至少需要配置一个服务器',
    }),
  logging: CliLoggingSchema.default({ level: 'info' }),
  transport: CliTransportSchema.default({ type: 'stdio' }),
});
