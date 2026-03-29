/**
 * API Tools 配置 Zod Schema
 * 从 core/api-to-mcp/types/api-config.ts 迁移
 */
import { z } from 'zod/v4';

/**
 * HTTP 请求方法 Schema
 */
export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
]);

/**
 * 认证配置 Schema
 */
export const AuthConfigSchema = z.object({
  type: z.enum(['bearer', 'apikey', 'basic']),
  token: z.string().optional(),
  header: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

/**
 * 频率限制配置 Schema
 */
export const RateLimitConfigSchema = z.object({
  windowSeconds: z.number().positive(),
  maxRequests: z.number().positive(),
  enabled: z.boolean(),
});

/**
 * 安全配置 Schema
 */
export const SecurityConfigSchema = z.object({
  authentication: AuthConfigSchema.optional(),
  allowedDomains: z.array(z.string()).optional(),
  rateLimiting: RateLimitConfigSchema.optional(),
});

/**
 * 缓存配置 Schema
 */
export const CacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().positive(),
  maxSize: z.number().positive().optional(),
});

/**
 * 响应处理配置 Schema
 */
export const ResponseConfigSchema = z.object({
  jsonata: z.string().optional(),
  errorPath: z.string().optional(),
  successCondition: z.string().optional(),
});

/**
 * API 端点配置 Schema
 */
export const ApiEndpointConfigSchema = z.object({
  url: z.string().url(),
  method: HttpMethodSchema,
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().nonnegative().optional(),
});

/**
 * JSON Schema Property Schema（递归定义）
 */
const JsonSchemaPropertySchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']),
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
    format: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
    pattern: z.string().optional(),
    items: JsonSchemaPropertySchema.optional(),
    properties: z.record(z.string(), JsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z
      .union([z.boolean(), JsonSchemaPropertySchema])
      .optional(),
  }),
);

/**
 * JSON Schema 对象 Schema
 */
export const JsonSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), JsonSchemaPropertySchema),
  additionalProperties: z.boolean().optional(),
  description: z.string().optional(),
});

/**
 * API 工具配置 Schema
 */
export const ApiToolConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  api: ApiEndpointConfigSchema,
  parameters: JsonSchemaSchema,
  response: ResponseConfigSchema,
  security: SecurityConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
});

/**
 * API 工具配置文件 Schema（顶层）
 */
export const ApiToolsConfigSchema = z.object({
  version: z.string(),
  tools: z.array(ApiToolConfigSchema),
});
