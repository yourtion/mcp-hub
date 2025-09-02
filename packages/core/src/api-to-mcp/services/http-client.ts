/**
 * HTTP客户端实现
 * 基于fetch提供HTTP请求功能，支持连接池、拦截器和重试机制
 */

// 基于fetch的HTTP客户端不需要额外导入
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
  private readonly config: HttpClientConfig;
  private readonly requestInterceptors: RequestInterceptor[] = [];
  private readonly responseInterceptors: ResponseInterceptor[] = [];
  private readonly connections = new Map<string, HttpConnection>();

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

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
        // 应用请求拦截器
        let processedConfig = { ...config };
        for (const interceptor of this.requestInterceptors) {
          processedConfig = await interceptor(processedConfig);
        }

        // 构建fetch请求选项
        const fetchOptions: RequestInit = {
          method: processedConfig.method,
          headers: {
            ...this.config.defaultHeaders,
            ...processedConfig.headers,
          },
        };

        // 添加请求体（如果存在）
        if (processedConfig.data) {
          if (typeof processedConfig.data === 'string') {
            fetchOptions.body = processedConfig.data;
          } else {
            fetchOptions.body = JSON.stringify(processedConfig.data);
            // 确保Content-Type是application/json
            (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
          }
        }

        // 设置超时
        const timeout = processedConfig.timeout ?? this.config.timeout;
        
        // 执行请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;

        let response: Response;
        try {
          response = await fetch(processedConfig.url, fetchOptions);
          clearTimeout(timeoutId);
        } catch (error) {
          clearTimeout(timeoutId);
          // 检查是否是超时错误
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Network timeout');
          }
          throw error;
        }

        // 构建HttpResponse对象
        const httpResponse: HttpResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: await response.json().catch(() => ({})), // 尝试解析JSON，失败则返回空对象
        };

        // 记录连接使用情况
        this.recordConnectionUsage(processedConfig.url);

        const _duration = Date.now() - startTime;
        logger.debug(
          `HTTP请求成功: ${processedConfig.method} ${processedConfig.url} ${httpResponse.status}`,
        );

        // 应用响应拦截器
        let finalResponse = httpResponse;
        for (const interceptor of this.responseInterceptors) {
          finalResponse = await interceptor(finalResponse);
        }

        return finalResponse;
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
  setDefaults(config: Partial<HttpClientConfig>): void {
    Object.assign(this.config, config);
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
