/**
 * HTTP客户端
 * 基于fetch API的HTTP客户端实现
 */

import type {
  HttpRequestConfig,
  HttpResponse,
  RequestInterceptor,
  ResponseInterceptor,
} from '../types/http-client.js';

/**
 * HTTP客户端接口
 */
export interface HttpClient {
  /**
   * 执行HTTP请求
   * @param config 请求配置
   */
  request(config: HttpRequestConfig): Promise<HttpResponse>;

  /**
   * 设置默认配置
   * @param config 默认配置
   */
  setDefaults(config: Partial<HttpRequestConfig>): void;

  /**
   * 添加请求拦截器
   * @param interceptor 请求拦截器
   */
  addRequestInterceptor(interceptor: RequestInterceptor): void;

  /**
   * 添加响应拦截器
   * @param interceptor 响应拦截器
   */
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
}

/**
 * HTTP客户端实现类
 */
export class HttpClientImpl implements HttpClient {
  private defaults: Partial<HttpRequestConfig> = {};
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  async request(config: HttpRequestConfig): Promise<HttpResponse> {
    // 合并默认配置
    const finalConfig = { ...this.defaults, ...config };

    // 应用请求拦截器
    let processedConfig = finalConfig;
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    // TODO: 实现基于fetch的HTTP请求逻辑
    const response = await this.performRequest(processedConfig);

    // 应用响应拦截器
    let processedResponse = response;
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }

    return processedResponse;
  }

  setDefaults(config: Partial<HttpRequestConfig>): void {
    this.defaults = { ...this.defaults, ...config };
  }

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  private async performRequest(
    _config: HttpRequestConfig,
  ): Promise<HttpResponse> {
    // TODO: 实现实际的fetch请求逻辑
    throw new Error('未实现');
  }
}
