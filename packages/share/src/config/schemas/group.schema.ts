/**
 * Group / GroupConfig 统一 Zod Schema
 * 合并了 share 的 Group（有 id、tools）和 core 的 GroupConfig（有 toolFilter）
 */
import { z } from 'zod/v4';

/**
 * 工具过滤规则 Schema
 */
export const ToolFilterSchema = z.object({
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
});

/**
 * 组验证配置 Schema
 */
export const GroupValidationSchema = z.object({
  enabled: z.boolean(),
  validationKey: z.string().optional(),
  createdAt: z.string().optional(),
  lastUpdated: z.string().optional(),
});

/**
 * 单个 Group Schema
 */
export const GroupSchema = z.object({
  id: z.string().min(1, { error: '组ID不能为空' }),
  name: z.string().min(1, { error: '组名称不能为空' }),
  description: z.string().optional(),
  servers: z
    .array(z.string().min(1, { error: '服务器名称不能为空' }))
    .min(1, { error: '每个组至少需要包含一个服务器' }),
  tools: z.array(z.string()),
  toolFilter: ToolFilterSchema.optional(),
  validation: GroupValidationSchema.optional(),
});

/**
 * GroupConfig Schema（组名到组的映射）
 */
export const GroupConfigSchema = z.record(z.string(), GroupSchema);
