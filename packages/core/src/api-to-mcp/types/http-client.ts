/**
 * HTTP客户端相关的类型定义
 */

import type { HttpMethod } from './api-config.js';

/**
 * HTTP请求配置
 */
export interface HttpRequestConfig {
  /** 请求URL */
  url: string;
  /** HTTP方法 */
  method: HttpMethod;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 查询参数 */
  params?: Record<string, unknown>;
  /** 请求体数据 */
  data?: unknown;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}

/**
 * HTTP响应
 */
export interface HttpResponse {
  /** 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Headers;
  /** 响应数据 */
  data: unknown;
  /** 原始Response对象 */
  raw: Response;
  /** 请求配置 */
  config: HttpRequestConfig;
}

/**
 * API响应
 */
export interface ApiResponse {
  /** 原始HTTP响应 */
  raw: HttpResponse;
  /** 处理后的数据 */
  data: unknown;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 请求拦截器
 */
export type RequestInterceptor = (
  config: HttpRequestConfig,
) => HttpRequestConfig | Promise<HttpRequestConfig>;

/**
 * 响应拦截器
 */
export type ResponseInterceptor = (
  response: HttpResponse,
) => HttpResponse | Promise<HttpResponse>;

/**
 * HTTP连接
 */
export interface HttpConnection {
  /** 连接ID */
  id: string;
  /** 主机名 */
  host: string;
  /** 是否活跃 */
  active: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 最后使用时间 */
  lastUsedAt: Date;
}
