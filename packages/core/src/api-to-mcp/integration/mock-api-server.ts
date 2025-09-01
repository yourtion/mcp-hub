/**
 * Mock API服务器
 * 用于集成测试
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockEndpoint {
  path: string;
  method: string;
  response: {
    status: number;
    headers?: Record<string, string>;
    body: unknown;
  };
  delay?: number;
}

export interface RequestLog {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
  timestamp: Date;
}

/**
 * Mock API服务器类
 */
export class MockApiServer {
  private server: ReturnType<typeof createServer> | null = null;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private requestLogs: RequestLog[] = [];
  private port = 0;

  /**
   * 启动Mock服务器
   */
  async start(port = 0): Promise<number> {
    if (this.server) {
      throw new Error('服务器已经启动');
    }

    this.server = createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          this.port = (this.server!.address() as AddressInfo).port;
          resolve(this.port);
        }
      });
    });
  }

  /**
   * 停止Mock服务器
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * 获取服务器端口
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 获取服务器基础URL
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * 设置API端点
   */
  setupEndpoint(endpoint: MockEndpoint): void {
    const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    this.endpoints.set(key, endpoint);
  }

  /**
   * 模拟错误响应
   */
  simulateError(
    path: string,
    method = 'GET',
    error: { status: number; message: string },
  ): void {
    this.setupEndpoint({
      path,
      method,
      response: {
        status: error.status,
        body: { error: error.message },
      },
    });
  }

  /**
   * 模拟延迟响应
   */
  simulateDelay(
    path: string,
    method = 'GET',
    delay: number,
    response: unknown,
  ): void {
    this.setupEndpoint({
      path,
      method,
      response: {
        status: 200,
        body: response,
      },
      delay,
    });
  }

  /**
   * 获取请求日志
   */
  getRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  /**
   * 清空请求日志
   */
  clearRequestLogs(): void {
    this.requestLogs.length = 0;
  }

  /**
   * 清空所有端点
   */
  clearEndpoints(): void {
    this.endpoints.clear();
  }

  /**
   * 重置服务器状态
   */
  reset(): void {
    this.clearEndpoints();
    this.clearRequestLogs();
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const method = req.method || 'GET';
    const url = req.url || '/';
    const path = new URL(url, 'http://localhost').pathname;

    // 记录请求
    const requestLog: RequestLog = {
      method,
      url,
      headers: req.headers,
      timestamp: new Date(),
    };

    // 读取请求体
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const body = await this.readRequestBody(req);
        requestLog.body = body;
      } catch (error) {
        console.error('读取请求体失败:', error);
      }
    }

    this.requestLogs.push(requestLog);

    // 查找匹配的端点
    const key = `${method} ${path}`;
    const endpoint = this.endpoints.get(key);

    if (!endpoint) {
      // 返回404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
      return;
    }

    // 模拟延迟
    if (endpoint.delay && endpoint.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, endpoint.delay));
    }

    // 设置响应头
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...endpoint.response.headers,
    };

    res.writeHead(endpoint.response.status, headers);

    // 发送响应体
    if (typeof endpoint.response.body === 'string') {
      res.end(endpoint.response.body);
    } else {
      res.end(JSON.stringify(endpoint.response.body));
    }
  }

  /**
   * 读取请求体
   */
  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }
}

/**
 * 创建Mock API服务器实例
 */
export function createMockApiServer(): MockApiServer {
  return new MockApiServer();
}

/**
 * 常用的Mock响应
 */
export const MockResponses = {
  /**
   * 成功响应
   */
  success: (data: unknown) => ({
    status: 200,
    body: { success: true, data },
  }),

  /**
   * 错误响应
   */
  error: (status: number, message: string) => ({
    status,
    body: { error: message },
  }),

  /**
   * JSON响应
   */
  json: (data: unknown) => ({
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: data,
  }),

  /**
   * 文本响应
   */
  text: (text: string) => ({
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: text,
  }),

  /**
   * 认证成功响应
   */
  authenticated: (token: string) => ({
    status: 200,
    body: { authenticated: true, token },
  }),

  /**
   * 认证失败响应
   */
  unauthorized: () => ({
    status: 401,
    body: { error: 'Unauthorized' },
  }),

  /**
   * 分页响应
   */
  paginated: (items: unknown[], page = 1, limit = 10) => ({
    status: 200,
    body: {
      data: items.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: items.length,
        pages: Math.ceil(items.length / limit),
      },
    },
  }),
};
