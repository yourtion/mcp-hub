/**
 * API配置相关的类型定义
 */

import { z } from 'zod';

/**
 * JSON Schema 基础类型定义
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
}

/**
 * JSON Schema 对象定义
 */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

/**
 * HTTP请求方法的Zod schema
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
 * 认证配置的Zod schema
 */
export const AuthConfigSchema = z.object({
  type: z.enum(['bearer', 'apikey', 'basic']),
  token: z.string().optional(),
  header: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

/**
 * 频率限制配置的Zod schema
 */
export const RateLimitConfigSchema = z.object({
  windowSeconds: z.number().positive(),
  maxRequests: z.number().positive(),
  enabled: z.boolean(),
});

/**
 * 安全配置的Zod schema
 */
export const SecurityConfigSchema = z.object({
  authentication: AuthConfigSchema.optional(),
  allowedDomains: z.array(z.string()).optional(),
  rateLimiting: RateLimitConfigSchema.optional(),
});

/**
 * 缓存键生成函数类型
 */
export type CacheKeyGenerator = (
  toolId: string,
  parameters: Record<string, unknown>,
) => string;

/**
 * 缓存配置的Zod schema
 */
export const CacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().positive(),
  maxSize: z.number().positive().optional(),
});

/**
 * 响应处理配置的Zod schema
 */
export const ResponseConfigSchema = z.object({
  jsonata: z.string().optional(),
  errorPath: z.string().optional(),
  successCondition: z.string().optional(),
});

/**
 * 请求体类型定义
 */
export type RequestBody = string | Record<string, unknown>;

/**
 * API端点配置的Zod schema
 */
export const ApiEndpointConfigSchema = z.object({
  url: z.string().url(),
  method: HttpMethodSchema,
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.unknown())]).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().nonnegative().optional(),
});

/**
 * JSON Schema 验证器
 */
const JsonSchemaPropertySchema: z.ZodSchema<JsonSchemaProperty> = z.lazy(() =>
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
    properties: z.record(JsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z
      .union([z.boolean(), JsonSchemaPropertySchema])
      .optional(),
  }),
);

/**
 * JSON Schema 对象验证器
 */
export const JsonSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(JsonSchemaPropertySchema),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
  description: z.string().optional(),
});

/**
 * API工具配置的Zod schema
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
 * API工具配置文件的Zod schema
 */
export const ApiToolsConfigSchema = z.object({
  version: z.string(),
  tools: z.array(ApiToolConfigSchema),
});

/**
 * 从Zod schema推断的类型
 */
export type HttpMethod = z.infer<typeof HttpMethodSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type ResponseConfig = z.infer<typeof ResponseConfigSchema>;
export type ApiEndpointConfig = z.infer<typeof ApiEndpointConfigSchema>;
export type ApiToolsConfig = z.infer<typeof ApiToolsConfigSchema>;

/**
 * 扩展的频率限制配置（用于安全模块）
 */
export interface RateLimitConfig {
  /** 时间窗口（秒） */
  windowSeconds: number;
  /** 最大请求数 */
  maxRequests: number;
  /** 是否启用 */
  enabled: boolean;
  /** 工具特定配置 */
  toolSpecific?: Record<
    string,
    {
      windowSeconds: number;
      maxRequests: number;
    }
  >;
}

/**
 * 缓存配置接口（运行时使用）
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存生存时间（秒） */
  ttl: number;
  /** 最大缓存条目数 */
  maxSize?: number;
  /** 缓存键生成函数 */
  keyGenerator?: CacheKeyGenerator;
}

/**
 * API工具配置接口（用于运行时）
 */
export interface ApiToolConfig {
  /** 工具唯一标识 */
  id: string;
  /** 工具显示名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** API端点配置 */
  api: ApiEndpointConfig;
  /** 参数schema（JSON Schema格式） */
  parameters: JsonSchema;
  /** 响应处理配置 */
  response: ResponseConfig;
  /** 安全配置 */
  security?: SecurityConfig;
  /** 缓存配置 */
  cache?: CacheConfig;
}
