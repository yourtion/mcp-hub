/**
 * API配置相关的类型定义
 */

import { z } from 'zod';

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
 * 缓存配置的Zod schema
 */
export const CacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().positive(),
  maxSize: z.number().positive().optional(),
  keyGenerator: z.function().optional(),
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
 * API端点配置的Zod schema
 */
export const ApiEndpointConfigSchema = z.object({
  url: z.string().url(),
  method: HttpMethodSchema,
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.union([z.string(), z.record(z.any())]).optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().nonnegative().optional(),
});

/**
 * API工具配置的Zod schema
 */
export const ApiToolConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  api: ApiEndpointConfigSchema,
  parameters: z.record(z.any()), // JSON Schema object for parameters
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
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type ResponseConfig = z.infer<typeof ResponseConfigSchema>;
export type ApiEndpointConfig = z.infer<typeof ApiEndpointConfigSchema>;
export type ApiToolsConfig = z.infer<typeof ApiToolsConfigSchema>;

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
  parameters: Record<string, any>;
  /** 响应处理配置 */
  response: ResponseConfig;
  /** 安全配置 */
  security?: SecurityConfig;
  /** 缓存配置 */
  cache?: CacheConfig;
}
