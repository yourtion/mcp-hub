/**
 * SystemConfig 统一 Zod Schema
 */
import { z } from 'zod/v4';

/**
 * 系统配置 Schema
 */
export const SystemConfigSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65535),
    host: z.string().min(1),
  }),
  auth: z.object({
    jwt: z.object({
      secret: z.string().min(32),
      expiresIn: z.string(),
      refreshExpiresIn: z.string(),
      issuer: z.string(),
    }),
    security: z.object({
      maxLoginAttempts: z.number().min(1),
      lockoutDuration: z.number().min(0),
      passwordMinLength: z.number().min(4),
      requireStrongPassword: z.boolean(),
    }),
  }),
  users: z.record(
    z.string(),
    z.object({
      id: z.string(),
      username: z.string(),
      password: z.string().min(1, { error: '密码不能为空' }),
      passwordHash: z.string(),
      role: z.string(),
      groups: z.array(z.string()),
      createdAt: z.string(),
    }),
  ),
  ui: z.object({
    title: z.string(),
    theme: z.string(),
    features: z.object({
      apiToMcp: z.boolean(),
      debugging: z.boolean(),
      monitoring: z.boolean(),
    }),
  }),
  monitoring: z.object({
    metricsEnabled: z.boolean(),
    logLevel: z.string(),
    retentionDays: z.number().min(1),
  }),
});
