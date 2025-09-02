/**
 * API执行器
 * 负责执行API调用的完整流程，包括参数处理、认证、HTTP请求和错误处理
 */

import { createLogger } from '../../utils/logger.js';
import type { ApiToolConfig, AuthConfig } from '../types/api-config.js';
import type {
  ApiResponse,
  HttpRequestConfig,
  HttpResponse,
} from '../types/http-client.js';
import { HttpRequestBuilderImpl } from '../utils/http-request-builder.js';
import { ParameterValidatorImpl } from '../utils/parameter-validator.js';
import type { AuthenticationManager } from './authentication.js';
import type { HttpClient } from './http-client.js';

const logger = createLogger({ component: 'ApiExecutor' });

/**
 * API执行器接口
 */
export interface ApiExecutor {
  /**
   * 执行API调用
   * @param config API工具配置
   * @param parameters 调用参数
   */
  executeApiCall(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): Promise<ApiResponse>;

  /**
   * 构建HTTP请求
   * @param config API工具配置
   * @param parameters 调用参数
   */
  buildHttpRequest(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): HttpRequestConfig;

  /**
   * 处理认证
   * @param request HTTP请求配置
   * @param authConfig 认证配置
   */
  applyAuthentication(
    request: HttpRequestConfig,
    authConfig: AuthConfig,
  ): HttpRequestConfig;

  /**
   * 处理超时和重试
   * @param request HTTP请求配置
   */
  handleTimeoutAndRetry(request: HttpRequestConfig): Promise<HttpResponse>;
}

/**
 * API执行器配置
 */
export interface ApiExecutorConfig {
  /** 默认超时时间（毫秒） */
  defaultTimeout: number;
  /** 默认重试次数 */
  defaultRetries: number;
  /** 是否启用请求日志 */
  enableRequestLogging: boolean;
  /** 是否启用响应日志 */
  enableResponseLogging: boolean;
  /** 最大响应体大小（字节），用于日志记录 */
  maxResponseLogSize: number;
}

/**
 * 默认API执行器配置
 */
const DEFAULT_CONFIG: ApiExecutorConfig = {
  defaultTimeout: 30000,
  defaultRetries: 3,
  enableRequestLogging: true,
  enableResponseLogging: true,
  maxResponseLogSize: 10240, // 10KB
};

/**
 * API执行器实现类
 */
export class ApiExecutorImpl implements ApiExecutor {
  private readonly httpClient: HttpClient;
  private readonly authManager: AuthenticationManager;
  private readonly requestBuilder: HttpRequestBuilderImpl;
  private readonly parameterValidator: ParameterValidatorImpl;
  private readonly config: ApiExecutorConfig;

  constructor(
    httpClient: HttpClient,
    authManager: AuthenticationManager,
    config: Partial<ApiExecutorConfig> = {},
  ) {
    this.httpClient = httpClient;
    this.authManager = authManager;
    this.requestBuilder = new HttpRequestBuilderImpl();
    this.parameterValidator = new ParameterValidatorImpl();
    this.config = { ...DEFAULT_CONFIG, ...config };

    logger.info('API执行器初始化完成');
  }

  /**
   * 执行API调用的完整流程
   */
  async executeApiCall(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const startTime = Date.now();

    logger.info(`开始执行API调用: ${config.id}`);

    try {
      // 1. 验证参数
      const validationResult = this.parameterValidator.validate(
        parameters,
        config.parameters,
      );
      if (!validationResult.valid) {
        throw new Error(`参数验证失败: ${validationResult.errors.join(', ')}`);
      }

      // 2. 构建HTTP请求
      let request = this.buildHttpRequest(config, parameters);

      // 3. 应用认证
      if (config.security?.authentication) {
        request = this.applyAuthentication(
          request,
          config.security.authentication,
        );
      }

      // 4. 记录请求日志
      if (this.config.enableRequestLogging) {
        this.logRequest(config.id, request);
      }

      // 5. 执行HTTP请求
      const response = await this.handleTimeoutAndRetry(request);

      // 6. 记录响应日志
      if (this.config.enableResponseLogging) {
        this.logResponse(config.id, response);
      }

      // 7. 构建API响应
      const apiResponse: ApiResponse = {
        raw: response,
        data: response.data,
        success: response.status >= 200 && response.status < 300,
        error:
          response.status >= 400
            ? this.extractErrorMessage(response)
            : undefined,
      };

      const duration = Date.now() - startTime;
      logger.info(
        `API调用完成: ${config.id}, 状态: ${response.status}, 耗时: ${duration}ms`,
      );

      return apiResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('API调用失败', undefined, {
        context: {
          toolId: config.id,
          error: errorMessage,
          duration,
        },
      });

      // 返回错误响应
      return {
        raw: undefined as unknown as HttpResponse,
        data: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 构建HTTP请求
   */
  buildHttpRequest(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): HttpRequestConfig {
    logger.debug(`构建HTTP请求: ${config.id}`);

    // 使用HTTP请求构建器处理模板和参数替换
    const buildResult = this.requestBuilder.buildRequest(config.api, {
      data: parameters,
      env: process.env as Record<string, string>,
    });

    if (!buildResult.success) {
      throw new Error(`构建HTTP请求失败: ${buildResult.error}`);
    }

    if (!buildResult.request) {
      throw new Error('构建HTTP请求失败: 请求对象为空');
    }

    const request = buildResult.request;

    // 设置默认值
    if (!request.timeout) {
      request.timeout = this.config.defaultTimeout;
    }
    if (request.retries === undefined) {
      request.retries = this.config.defaultRetries;
    }

    return request;
  }

  /**
   * 应用认证
   */
  applyAuthentication(
    request: HttpRequestConfig,
    authConfig: AuthConfig,
  ): HttpRequestConfig {
    logger.debug(`应用认证: ${authConfig.type}`);

    // 解析环境变量
    const resolvedAuthConfig =
      this.authManager.resolveEnvironmentVariables(authConfig);

    // 验证环境变量
    const envValidation =
      this.authManager.validateEnvironmentVariables(resolvedAuthConfig);
    if (!envValidation.valid) {
      throw new Error(
        `认证配置中的环境变量未定义: ${envValidation.missingVars.join(', ')}`,
      );
    }

    // 应用认证
    return this.authManager.applyAuthentication(request, resolvedAuthConfig);
  }

  /**
   * 处理超时和重试
   */
  async handleTimeoutAndRetry(
    request: HttpRequestConfig,
  ): Promise<HttpResponse> {
    logger.debug(`执行HTTP请求: ${request.method} ${request.url}`);

    try {
      return await this.httpClient.request(request);
    } catch (error) {
      logger.error(`HTTP请求失败: ${request.method} ${request.url}`);
      throw error;
    }
  }

  /**
   * 记录请求日志
   */
  private logRequest(toolId: string, request: HttpRequestConfig): void {
    logger.debug(`HTTP请求详情: ${toolId} ${request.method} ${request.url}`);
  }

  /**
   * 记录响应日志
   */
  private logResponse(toolId: string, response: HttpResponse): void {
    const responseSize = this.getResponseSize(response.data);
    logger.debug(
      `HTTP响应详情: ${toolId} ${response.status} ${response.statusText} (${responseSize} bytes)`,
    );
  }

  /**
   * 清理敏感的请求头信息
   */
  private sanitizeHeaders(
    headers?: Record<string, string> | Headers,
  ): Record<string, string> {
    if (!headers) return {};

    const result: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'set-cookie',
    ];

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        result[key] = sensitiveHeaders.includes(lowerKey) ? '[已隐藏]' : value;
      });
    } else {
      for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        result[key] = sensitiveHeaders.includes(lowerKey) ? '[已隐藏]' : value;
      }
    }

    return result;
  }

  /**
   * 获取响应体大小
   */
  private getResponseSize(data: unknown): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length;
    if (typeof data === 'object') {
      try {
        return JSON.stringify(data).length;
      } catch {
        return 0;
      }
    }
    return String(data).length;
  }

  /**
   * 从HTTP响应中提取错误信息
   */
  private extractErrorMessage(response: HttpResponse): string {
    // 检查响应是否存在
    if (!response) {
      return '网络错误或请求失败';
    }

    // 尝试从响应体中提取错误信息
    if (response.data && typeof response.data === 'object') {
      const data = response.data as Record<string, unknown>;

      // 常见的错误字段
      const errorFields = [
        'error',
        'message',
        'error_description',
        'detail',
        'msg',
      ];

      for (const field of errorFields) {
        if (data[field] && typeof data[field] === 'string') {
          return data[field] as string;
        }
      }
    }

    // 如果无法提取具体错误信息，返回状态文本
    return (
      response.statusText ||
      (response.status ? `HTTP ${response.status}` : '请求失败')
    );
  }
}

/**
 * 创建API执行器实例
 */
export function createApiExecutor(
  httpClient: HttpClient,
  authManager: AuthenticationManager,
  config?: Partial<ApiExecutorConfig>,
): ApiExecutor {
  return new ApiExecutorImpl(httpClient, authManager, config);
}
