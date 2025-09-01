/**
 * HTTP客户端测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HttpRequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from '../types/http-client.js';
import { createHttpClient, HttpClient } from './http-client.js';

// Mock axios
const mockRequest = vi.fn();
const mockRequestInterceptorUse = vi.fn();
const mockResponseInterceptorUse = vi.fn();
const mockDefaults = {
  headers: {
    common: {},
  },
  timeout: 30000,
};

vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => ({
      request: mockRequest,
      interceptors: {
        request: {
          use: mockRequestInterceptorUse,
        },
        response: {
          use: mockResponseInterceptorUse,
        },
      },
      defaults: mockDefaults,
    })),
  };
  return { default: mockAxios };
});

describe('HttpClient', () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks();
    mockDefaults.headers.common = {};
    mockDefaults.timeout = 30000;

    // 创建HTTP客户端
    httpClient = new HttpClient();
  });

  afterEach(() => {
    httpClient.destroy();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建HTTP客户端', () => {
      const client = new HttpClient();
      expect(client).toBeInstanceOf(HttpClient);
    });

    it('应该使用自定义配置创建HTTP客户端', () => {
      const config = {
        timeout: 5000,
        retries: 1,
        defaultHeaders: {
          'Custom-Header': 'test-value',
        },
      };

      const client = new HttpClient(config);
      expect(client).toBeInstanceOf(HttpClient);
      client.destroy();
    });
  });

  describe('request方法', () => {
    it('应该成功执行HTTP请求', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
        config: {},
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const config: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const response = await httpClient.request(config);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ message: 'success' });
      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: undefined,
        params: undefined,
        data: undefined,
        timeout: undefined,
      });
    });

    it('应该处理请求失败并重试', async () => {
      const error = new Error('Network Error');
      mockRequest
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { message: 'success after retry' },
          config: {},
        });

      const config: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
        retries: 2,
      };

      const response = await httpClient.request(config);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ message: 'success after retry' });
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('应该在所有重试失败后抛出错误', async () => {
      const error = new Error('Network Error');
      mockRequest.mockRejectedValue(error);

      const config: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
        retries: 1,
      };

      await expect(httpClient.request(config)).rejects.toThrow('Network Error');
      expect(mockRequest).toHaveBeenCalledTimes(2); // 1 + 1 retry
    });

    it('应该支持POST请求和请求体', async () => {
      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        data: { id: 1 },
        config: {},
      };

      mockRequest.mockResolvedValueOnce(mockResponse);

      const config: HttpRequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { name: 'John Doe' },
      };

      const response = await httpClient.request(config);

      expect(response.status).toBe(201);
      expect(mockRequest).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        params: undefined,
        data: { name: 'John Doe' },
        timeout: undefined,
      });
    });
  });

  describe('拦截器', () => {
    it('应该支持添加请求拦截器', () => {
      const requestInterceptor: RequestInterceptor = (config) => {
        config.headers = { ...config.headers, 'X-Custom': 'test' };
        return config;
      };

      httpClient.addRequestInterceptor(requestInterceptor);

      // 验证拦截器被添加
      expect(mockRequestInterceptorUse).toHaveBeenCalled();
    });

    it('应该支持添加响应拦截器', () => {
      const responseInterceptor: ResponseInterceptor = (response) => {
        return response;
      };

      httpClient.addResponseInterceptor(responseInterceptor);

      // 验证拦截器被添加
      expect(mockResponseInterceptorUse).toHaveBeenCalled();
    });
  });

  describe('默认配置', () => {
    it('应该支持设置默认配置', () => {
      const defaults = {
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      };

      httpClient.setDefaults(defaults);

      expect(mockDefaults.headers.common).toEqual(
        expect.objectContaining({ Authorization: 'Bearer token' }),
      );
      expect(mockDefaults.timeout).toBe(5000);
    });
  });

  describe('连接池管理', () => {
    it('应该返回连接池状态', () => {
      const status = httpClient.getConnectionPoolStatus();

      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('idle');
      expect(status).toHaveProperty('connections');
      expect(Array.isArray(status.connections)).toBe(true);
    });

    it('应该支持清理空闲连接', () => {
      expect(() => httpClient.cleanupIdleConnections()).not.toThrow();
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建HTTP客户端', () => {
      const client = createHttpClient();
      expect(client).toBeInstanceOf(HttpClient);
      client.destroy();
    });

    it('应该通过工厂函数创建带配置的HTTP客户端', () => {
      const config = { timeout: 10000 };
      const client = createHttpClient(config);
      expect(client).toBeInstanceOf(HttpClient);
      client.destroy();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效URL', async () => {
      const error = new Error('Invalid URL');
      mockRequest.mockRejectedValue(error);

      const config: HttpRequestConfig = {
        url: 'invalid-url',
        method: 'GET',
        retries: 0,
      };

      await expect(httpClient.request(config)).rejects.toThrow('Invalid URL');
    });

    it('应该处理超时错误', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      mockRequest.mockRejectedValue(timeoutError);

      const config: HttpRequestConfig = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeout: 5000,
        retries: 0,
      };

      await expect(httpClient.request(config)).rejects.toThrow(
        'timeout of 5000ms exceeded',
      );
    });
  });

  describe('销毁', () => {
    it('应该正确销毁HTTP客户端', () => {
      expect(() => httpClient.destroy()).not.toThrow();
    });
  });
});
