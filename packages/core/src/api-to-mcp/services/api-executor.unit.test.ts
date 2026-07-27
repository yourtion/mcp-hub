/**
 * API执行器测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode, ServiceError } from '../../errors/index.js';
import { ApiExecutorImpl, createApiExecutor } from './api-executor.js';

import type { ApiToolConfig, AuthConfig } from '../types/api-config.js';
import type { HttpRequestConfig, HttpResponse } from '../types/http-client.js';
import type { AuthenticationManager } from './authentication.js';
import type { HttpClient } from './http-client.js';

const mockBuildRequest = vi.fn().mockImplementation((apiConfig, _context) => ({
  success: true,
  request: {
    url: apiConfig.url,
    method: apiConfig.method,
    headers: apiConfig.headers,
    params: apiConfig.queryParams,
    data: apiConfig.body,
    timeout: apiConfig.timeout,
    retries: apiConfig.retries,
  },
  usedVariables: [],
}));

const mockValidateParameters = vi.fn().mockReturnValue({ valid: true, errors: [] });

// Mock依赖
vi.mock('./http-client.js');
vi.mock('./authentication.js');
vi.mock('../utils/http-request-builder.js', () => ({
  HttpRequestBuilderImpl: vi.fn(
    class MockHttpRequestBuilderImpl {
      buildRequest = mockBuildRequest;
    },
  ),
}));
vi.mock('../utils/parameter-validator.js', () => ({
  ParameterValidatorImpl: vi.fn(
    class MockParameterValidatorImpl {
      validate = mockValidateParameters;
    },
  ),
}));

describe('ApiExecutorImpl', () => {
  let apiExecutor: ApiExecutorImpl;
  let mockHttpClient: HttpClient;
  let mockAuthManager: AuthenticationManager;

  beforeEach(() => {
    // 创建mock实例
    mockHttpClient = {
      request: vi.fn(),
      addRequestInterceptor: vi.fn(),
      addResponseInterceptor: vi.fn(),
      setDefaults: vi.fn(),
      getConnectionPoolStatus: vi.fn(),
      cleanupIdleConnections: vi.fn(),
      destroy: vi.fn(),
    } as unknown as HttpClient;

    mockAuthManager = {
      applyAuthentication: vi.fn(),
      validateAuthConfig: vi.fn(),
      resolveEnvironmentVariables: vi.fn(),
      validateEnvironmentVariables: vi.fn(),
      getSupportedTypes: vi.fn(),
      getStrategy: vi.fn(),
      registerStrategy: vi.fn(),
    } as unknown as AuthenticationManager;

    apiExecutor = new ApiExecutorImpl(mockHttpClient, mockAuthManager);
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建API执行器', () => {
      const executor = new ApiExecutorImpl(mockHttpClient, mockAuthManager);
      expect(executor).toBeInstanceOf(ApiExecutorImpl);
    });

    it('应该使用自定义配置创建API执行器', () => {
      const config = {
        defaultTimeout: 5000,
        defaultRetries: 1,
        enableRequestLogging: false,
      };

      const executor = new ApiExecutorImpl(mockHttpClient, mockAuthManager, config);
      expect(executor).toBeInstanceOf(ApiExecutorImpl);
    });
  });

  describe('buildHttpRequest', () => {
    it('应该构建基本的HTTP请求', () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
          retries: 2,
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
      };

      const parameters = { param1: 'value1' };
      const request = apiExecutor.buildHttpRequest(apiConfig, parameters);

      expect(request.url).toBe('https://api.example.com/test');
      expect(request.method).toBe('GET');
      expect(request.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(request.timeout).toBe(5000);
      expect(request.retries).toBe(2);
    });

    it('应该设置默认超时和重试次数', () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
      };

      const request = apiExecutor.buildHttpRequest(apiConfig, {});

      expect(request.timeout).toBe(30000); // 默认超时
      expect(request.retries).toBe(3); // 默认重试次数
    });
  });

  describe('applyAuthentication', () => {
    it('应该应用认证到HTTP请求', async () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
        token: 'test-token',
      };

      const authenticatedRequest = {
        ...request,
        headers: { Authorization: 'Bearer test-token' },
      };

      // Mock认证管理器方法
      vi.mocked(mockAuthManager.resolveEnvironmentVariables).mockReturnValue(authConfig);
      vi.mocked(mockAuthManager.validateEnvironmentVariables).mockReturnValue({
        valid: true,
        missingVars: [],
      });
      vi.mocked(mockAuthManager.applyAuthentication).mockResolvedValue(authenticatedRequest);

      const result = await apiExecutor.applyAuthentication(request, authConfig);

      expect(mockAuthManager.resolveEnvironmentVariables).toHaveBeenCalledWith(authConfig);
      expect(mockAuthManager.validateEnvironmentVariables).toHaveBeenCalled();
      expect(mockAuthManager.applyAuthentication).toHaveBeenCalledWith(request, authConfig);
      expect(result).toEqual(authenticatedRequest);
    });

    it('应该在环境变量缺失时抛出错误', async () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '{{env.MISSING_TOKEN}}',
      };

      // Mock认证管理器方法
      vi.mocked(mockAuthManager.resolveEnvironmentVariables).mockReturnValue(authConfig);
      vi.mocked(mockAuthManager.validateEnvironmentVariables).mockReturnValue({
        valid: false,
        missingVars: ['MISSING_TOKEN'],
      });

      await expect(apiExecutor.applyAuthentication(request, authConfig)).rejects.toThrow(
        '认证配置中的环境变量未定义: MISSING_TOKEN',
      );
    });

    it('oauth 配置环境变量未定义 → 抛 OAUTH_OUTBOUND_ENV_VAR_MISSING (6203)', async () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      // OAuth 配置：clientSecret 引用了未设置的环境变量
      const authConfig: AuthConfig = {
        type: 'oauth',
        grantType: 'client_credentials',
        clientId: 'test-client-id',
        clientSecret: '{{env.NOT_SET_VAR}}',
        tokenUrl: 'https://as.example.com/token',
      };

      // Mock：resolveEnvironmentVariables 原样返回（未定义的引用保持原样），
      // validateEnvironmentVariables 报告 NOT_SET_VAR 缺失。
      vi.mocked(mockAuthManager.resolveEnvironmentVariables).mockReturnValue(authConfig);
      vi.mocked(mockAuthManager.validateEnvironmentVariables).mockReturnValue({
        valid: false,
        missingVars: ['NOT_SET_VAR'],
      });

      await expect(apiExecutor.applyAuthentication(request, authConfig)).rejects.toMatchObject({
        name: 'ServiceError',
        code: ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING,
        message: 'OAuth 出站环境变量未定义: NOT_SET_VAR',
        context: {
          clientId: 'test-client-id',
          missingVars: ['NOT_SET_VAR'],
        },
      });
      // 同时确认是 ServiceError 实例（而非裸 Error）
      await expect(apiExecutor.applyAuthentication(request, authConfig)).rejects.toBeInstanceOf(
        ServiceError,
      );
    });
  });

  describe('handleTimeoutAndRetry', () => {
    it('应该成功执行HTTP请求', async () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const mockResponse: HttpResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: { message: 'success' },
        raw: {} as Response,
        config: request,
      };

      vi.mocked(mockHttpClient.request).mockResolvedValue(mockResponse);

      const result = await apiExecutor.handleTimeoutAndRetry(request);

      expect(mockHttpClient.request).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResponse);
    });

    it('应该在HTTP请求失败时抛出错误', async () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const error = new Error('Network Error');
      vi.mocked(mockHttpClient.request).mockRejectedValue(error);

      await expect(apiExecutor.handleTimeoutAndRetry(request)).rejects.toThrow('Network Error');
    });
  });

  describe('executeApiCall', () => {
    it('应该成功执行完整的API调用流程', async () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
        },
        response: {},
      };

      const parameters = { param1: 'value1' };

      const mockResponse: HttpResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: { result: 'success' },
        raw: {} as Response,
        config: {} as HttpRequestConfig,
      };

      vi.mocked(mockHttpClient.request).mockResolvedValue(mockResponse);

      const result = await apiExecutor.executeApiCall(apiConfig, parameters);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(result.error).toBeUndefined();
      expect(result.raw).toEqual(mockResponse);
    });

    it('应该处理参数验证失败', async () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {
            required_param: { type: 'string' },
          },
          required: ['required_param'],
        },
        response: {},
      };

      const parameters = {}; // 缺少必需参数

      // 创建一个新的执行器实例，并mock参数验证器返回失败
      const mockValidatorInstance = {
        validate: vi.fn().mockReturnValue({
          valid: false,
          errors: ['required_param is required'],
        }),
      };

      // 创建新的执行器实例
      const _MockParameterValidatorImpl = vi.fn().mockImplementation(() => mockValidatorInstance);

      // 临时替换构造函数中使用的验证器
      const originalValidator = (apiExecutor as unknown as { parameterValidator: unknown })
        .parameterValidator;
      (apiExecutor as unknown as { parameterValidator: unknown }).parameterValidator =
        mockValidatorInstance;

      const result = await apiExecutor.executeApiCall(apiConfig, parameters);

      // 恢复原始验证器
      (apiExecutor as unknown as { parameterValidator: unknown }).parameterValidator =
        originalValidator;

      expect(result.success).toBe(false);
      expect(result.error).toContain('参数验证失败');
    });

    it('应该处理HTTP错误响应', async () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
      };

      const mockResponse: HttpResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        data: { error: 'Resource not found' },
        raw: {} as Response,
        config: {} as HttpRequestConfig,
      };

      vi.mocked(mockHttpClient.request).mockResolvedValue(mockResponse);

      const result = await apiExecutor.executeApiCall(apiConfig, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resource not found');
      expect(result.raw).toEqual(mockResponse);
    });

    it('应该处理带认证的API调用', async () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
        security: {
          authentication: {
            type: 'bearer',
            token: 'test-token',
          },
        },
      };

      const mockResponse: HttpResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        data: { result: 'authenticated success' },
        raw: {} as Response,
        config: {} as HttpRequestConfig,
      };

      // Mock认证相关方法
      vi.mocked(mockAuthManager.resolveEnvironmentVariables).mockReturnValue(
        apiConfig.security?.authentication ?? { type: 'bearer', token: 'test' },
      );
      vi.mocked(mockAuthManager.validateEnvironmentVariables).mockReturnValue({
        valid: true,
        missingVars: [],
      });
      vi.mocked(mockAuthManager.applyAuthentication).mockImplementation(async (req) => ({
        ...req,
        headers: { ...req.headers, Authorization: 'Bearer test-token' },
      }));

      vi.mocked(mockHttpClient.request).mockResolvedValue(mockResponse);

      const result = await apiExecutor.executeApiCall(apiConfig, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'authenticated success' });
      expect(mockAuthManager.applyAuthentication).toHaveBeenCalled();
    });

    it('应该处理网络错误', async () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '测试用API',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
      };

      const networkError = new Error('Network timeout');
      vi.mocked(mockHttpClient.request).mockRejectedValue(networkError);

      const result = await apiExecutor.executeApiCall(apiConfig, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(result.data).toBeNull();
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建API执行器', () => {
      const executor = createApiExecutor(mockHttpClient, mockAuthManager);
      expect(executor).toBeInstanceOf(ApiExecutorImpl);
    });

    it('应该通过工厂函数创建带配置的API执行器', () => {
      const config = { defaultTimeout: 10000 };
      const executor = createApiExecutor(mockHttpClient, mockAuthManager, config);
      expect(executor).toBeInstanceOf(ApiExecutorImpl);
    });
  });
});
