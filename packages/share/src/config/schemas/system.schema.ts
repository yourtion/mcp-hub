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
  oauth: z
    .object({
      // 模式：internal（内置 AS）/ external（对接外部 IdP）/ both
      mode: z.enum(['internal', 'external', 'both']),
      // Hub 作为 Protected Resource 的规范 URI（RFC8707 audience 标识）
      resource: z.string().url(),
      scopes: z.array(z.string()).default(['mcp:tools', 'mcp:resources']),
      // 内置 AS 配置（mode 为 internal/both 时必填）
      internal: z
        .object({
          issuer: z.string().url().optional(),
          tokenTtlSeconds: z.number().int().positive().default(3600),
          clients: z
            .array(
              z.object({
                clientId: z.string().min(1),
                clientSecret: z.string().min(1), // bcrypt 哈希
                scopes: z.array(z.string()).default(['mcp:tools']),
              }),
            )
            .default([]),
        })
        .optional(),
      // 外部 IdP 配置（mode 为 external/both 时必填）
      external: z
        .object({
          issuer: z.string().url(),
          metadataUrl: z.string().url().optional(),
          clientId: z.string().min(1),
          clientSecret: z.string().min(1),
          introspectionEndpoint: z.string().url().optional(),
          jwksUri: z.string().url().optional(),
          audience: z.string().min(1),
        })
        .optional(),
    })
    .optional(), // 整个 oauth 块可选
});
