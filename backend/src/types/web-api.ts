/**
 * Web API相关类型的简化定义
 * 用于构建时类型检查，在正式环境中应使用完整的共享类型定义
 */

/**
 * HTTP请求方法
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS';

/**
 * JSON Schema属性定义
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
  pattern?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
}

/**
 * JSON Schema定义
 */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

/**
 * 认证配置
 */
export interface AuthConfig {
  type: 'bearer' | 'apikey' | 'basic';
  token?: string;
  header?: string;
  username?: string;
  password?: string;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  authentication?: AuthConfig;
  allowedDomains?: string[];
  rateLimiting?: {
    windowSeconds: number;
    maxRequests: number;
    enabled: boolean;
  };
}

/**
 * 响应处理配置
 */
export interface ResponseConfig {
  jsonata?: string;
  errorPath?: string;
  successCondition?: string;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize?: number;
}

/**
 * API端点配置
 */
export interface ApiEndpointConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

/**
 * API工具配置
 */
export interface ApiToolConfig {
  id: string;
  name: string;
  description: string;
  api: ApiEndpointConfig;
  parameters: JsonSchema;
  response: ResponseConfig;
  security?: SecurityConfig;
  cache?: CacheConfig;
}

/**
 * API配置信息
 */
export interface ApiConfigInfo {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  api: {
    url: string;
    method: string;
  };
  toolsGenerated: number;
  lastUpdated: string;
}

/**
 * API配置列表响应
 */
export interface ApiConfigListResponse {
  configs: ApiConfigInfo[];
}

/**
 * 创建API配置请求
 */
export interface CreateApiConfigRequest {
  config: ApiToolConfig;
}

/**
 * 测试API配置请求
 */
export interface TestApiConfigRequest {
  parameters: Record<string, unknown>;
}

/**
 * 测试API配置响应
 */
export interface TestApiConfigResponse {
  success: boolean;
  response?: unknown;
  error?: string;
  executionTime: number;
}

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

/**
 * API响应类型
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
