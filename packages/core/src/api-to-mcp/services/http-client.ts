/**
 * HTTP客户端实现
 * 基于axios提供HTTP请求功能，支持连接池、拦截器和重试机制
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { createLogger } from '../../utils/logger.js';
import type {
  HttpConnection,
  HttpRequestConfig,
  HttpResponse,
  RequestInterceptor,
  ResponseInterceptor,
} from '../types/http-client.js';

const logger = createLogger({ component: 'HttpClient' });

/**
 * 连接池配置
 */
interface ConnectionPoolConfig {
  /** 最大连接数 */
  maxConnections: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout: number;
  /** 空闲连接超时时间（毫秒） */
  idleTimeout: number;
  /** 保持连接活跃 */
  keepAlive: boolean;
}

/**
 * HTTP客户端配置
 */
interface HttpClientConfig {
  /** 默认超时时间（毫秒） */
  timeout: number;
  /** 默认重试次数 */
  retries: number;
  /** 连接池配置 */
  connectionPool: ConnectionPoolConfig;
  /** 默认请求头 */
  defaultHeaders: Record<string, string>;
}

/**
 * 默认HTTP客户端配置
 */
const DEFAULT_CONFIG: HttpClientConfig = {
  timeout: 30000,
  retries: 3,
  connectionPool: {
    maxConnections: 100,
    connectionTimeout: 5000,
    idleTimeout: 60000,
    keepAlive: true,
  },
  defaultHeaders: {
    'User-Agent': 'MCP-Hub-API-Client/1.0',
    Accept: 'application/json, text/plain, */*',
  },
};

/**
 * HTTP客户端类
 * 提供HTTP请求功能，支持连接池、拦截器和重试机制
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly config: HttpClientConfig;
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];
  private readonly connections = new Map<string, HttpConnection>();

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 创建axios实例
    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      headers: this.config.defaultHeaders,
      // 启用连接池和保持连接
      httpAgent: this.createHttpAgent(),
      httpsAgent: this.createHttpsAgent(),
    });

    // 设置请求拦截器
    this.axiosInstance.interceptors.request.use(
      async (axiosConfig) => {
        let config = this.convertToHttpRequestConfig(axiosConfig);

        // 应用自定义请求拦截器
        for (const interceptor of this.requestInterceptors) {
          config = await interceptor(config);
        }

        const convertedConfig = this.convertToAxiosConfig(config);
        return convertedConfig as typeof axiosConfig;
      },
      (error) => {
        logger.error('请求拦截器错误:', error);
        return Promise.reject(error);
      },
    );

    // 设置响应拦截器
    this.axiosInstance.interceptors.response.use(
      async (axiosResponse) => {
        let response = this.convertToHttpResponse(axiosResponse);

        // 应用自定义响应拦截器
        for (const interceptor of this.responseInterceptors) {
          response = await interceptor(response);
        }

        return axiosResponse;
      },
      (error) => {
        logger.error('响应拦截器错误:', error);
        return Promise.reject(error);
      },
    );

    logger.info('HTTP客户端初始化完成');
  }

  /**
   * 执行HTTP请求
   */
  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    const retries = config.retries ?? this.config.retries;

    logger.debug(`开始HTTP请求: ${config.method} ${config.url}`);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const axiosConfig = this.convertToAxiosConfig(config);
        const axiosResponse = await this.axiosInstance.request(axiosConfig);
        const response = this.convertToHttpResponse(axiosResponse);

        // 记录连接使用情况
        this.recordConnectionUsage(config.url);

        const _duration = Date.now() - startTime;
        logger.debug(
          `HTTP请求成功: ${config.method} ${config.url} ${response.status}`,
        );

        return response;
      } catch (error) {
        lastError = error as Error;
        const _duration = Date.now() - startTime;

        logger.warn(
          `HTTP请求失败: ${config.method} ${config.url} (尝试 ${attempt + 1}/${retries + 1})`,
        );

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === retries) {
          break;
        }

        // 计算重试延迟（指数退避）
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await this.sleep(delay);
      }
    }

    const _totalDuration = Date.now() - startTime;
    logger.error(`HTTP请求最终失败: ${config.method} ${config.url}`);

    throw lastError;
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
    logger.debug('添加请求拦截器');
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
    logger.debug('添加响应拦截器');
  }

  /**
   * 设置默认配置
   */
  setDefaults(config: Partial<HttpRequestConfig>): void {
    if (config.headers) {
      Object.assign(this.axiosInstance.defaults.headers.common, config.headers);
    }
    if (config.timeout) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }
    logger.debug('更新默认配置');
  }

  /**
   * 获取连接池状态
   */
  getConnectionPoolStatus(): {
    total: number;
    active: number;
    idle: number;
    connections: HttpConnection[];
  } {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    const active = connections.filter(
      (conn) =>
        conn.active &&
        now - conn.lastUsedAt.getTime() <
          this.config.connectionPool.idleTimeout,
    );
    const idle = connections.filter(
      (conn) =>
        !conn.active ||
        now - conn.lastUsedAt.getTime() >=
          this.config.connectionPool.idleTimeout,
    );

    return {
      total: connections.length,
      active: active.length,
      idle: idle.length,
      connections,
    };
  }

  /**
   * 清理空闲连接
   */
  cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      if (
        now - connection.lastUsedAt.getTime() >=
        this.config.connectionPool.idleTimeout
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.connections.delete(id);
    }

    if (toRemove.length > 0) {
      logger.debug(`清理空闲连接: ${toRemove.length}`);
    }
  }

  /**
   * 销毁HTTP客户端
   */
  destroy(): void {
    this.connections.clear();
    logger.info('HTTP客户端已销毁');
  }

  /**
   * 创建HTTP Agent（用于连接池）
   */
  private createHttpAgent(): unknown {
    // 在Node.js环境中使用http.Agent
    if (typeof require !== 'undefined') {
      try {
        const http = require('node:http');
        return new http.Agent({
          keepAlive: this.config.connectionPool.keepAlive,
          maxSockets: this.config.connectionPool.maxConnections,
          timeout: this.config.connectionPool.connectionTimeout,
        });
      } catch {
        // 如果无法创建Agent，返回undefined
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * 创建HTTPS Agent（用于连接池）
   */
  private createHttpsAgent(): unknown {
    // 在Node.js环境中使用https.Agent
    if (typeof require !== 'undefined') {
      try {
        const https = require('node:https');
        return new https.Agent({
          keepAlive: this.config.connectionPool.keepAlive,
          maxSockets: this.config.connectionPool.maxConnections,
          timeout: this.config.connectionPool.connectionTimeout,
        });
      } catch {
        // 如果无法创建Agent，返回undefined
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * 记录连接使用情况
   */
  private recordConnectionUsage(url: string): void {
    try {
      const urlObj = new URL(url);
      const host = urlObj.host;
      const connectionId = `${host}:${urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80)}`;

      let connection = this.connections.get(connectionId);
      if (!connection) {
        connection = {
          id: connectionId,
          host,
          active: true,
          createdAt: new Date(),
          lastUsedAt: new Date(),
        };
        this.connections.set(connectionId, connection);
      } else {
        connection.active = true;
        connection.lastUsedAt = new Date();
      }
    } catch (error) {
      logger.warn('记录连接使用情况失败', {
        context: {
          url,
          errorMessage: (error as Error).message,
        },
      });
    }
  }

  /**
   * 转换HttpRequestConfig到AxiosRequestConfig
   */
  private convertToAxiosConfig(config: HttpRequestConfig): AxiosRequestConfig {
    return {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
      data: config.data,
      timeout: config.timeout,
    };
  }

  /**
   * 转换AxiosRequestConfig到HttpRequestConfig
   */
  private convertToHttpRequestConfig(
    axiosConfig: AxiosRequestConfig,
  ): HttpRequestConfig {
    return {
      url: axiosConfig.url || '',
      method: (
        axiosConfig.method || 'GET'
      ).toUpperCase() as HttpRequestConfig['method'],
      headers: axiosConfig.headers as Record<string, string>,
      params: axiosConfig.params,
      data: axiosConfig.data,
      timeout: axiosConfig.timeout,
    };
  }

  /**
   * 转换AxiosResponse到HttpResponse
   */
  private convertToHttpResponse(axiosResponse: AxiosResponse): HttpResponse {
    // 创建Headers对象
    const headers = new Headers();
    if (axiosResponse.headers) {
      for (const [key, value] of Object.entries(axiosResponse.headers)) {
        if (typeof value === 'string') {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            headers.append(key, String(v));
          }
        } else if (value !== undefined) {
          headers.set(key, String(value));
        }
      }
    }

    return {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers,
      data: axiosResponse.data,
      raw: axiosResponse as unknown as Response,
      config: this.convertToHttpRequestConfig(axiosResponse.config),
    };
  }

  /**
   * 睡眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 创建HTTP客户端实例
 */
export function createHttpClient(
  config?: Partial<HttpClientConfig>,
): HttpClient {
  return new HttpClient(config);
}
