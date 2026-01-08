/**
 * 认证系统测试
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthConfig } from '../types/api-config.js';
import type { HttpRequestConfig } from '../types/http-client.js';
import {
  ApiKeyStrategy,
  AuthenticationManager,
  BasicAuthStrategy,
  BearerTokenStrategy,
  createAuthenticationManager,
  defaultAuthManager,
} from './authentication.js';

describe('认证策略', () => {
  describe('BearerTokenStrategy', () => {
    let strategy: BearerTokenStrategy;

    beforeEach(() => {
      strategy = new BearerTokenStrategy();
    });

    it('应该正确应用Bearer Token认证', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
        token: 'test-token-123',
      };

      const result = strategy.applyAuth(request, authConfig);

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token-123',
      });
    });

    it('应该在缺少token时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
      };

      expect(() => strategy.applyAuth(request, authConfig)).toThrow(
        'Bearer token认证需要提供token',
      );
    });

    it('应该验证有效的配置', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: 'valid-token',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该拒绝无效的配置', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bearer认证需要提供token');
    });

    it('应该拒绝空token', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bearer认证需要提供token');
    });

    it('应该拒绝只包含空白字符的token', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '   ',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token必须是非空字符串');
    });
  });

  describe('ApiKeyStrategy', () => {
    let strategy: ApiKeyStrategy;

    beforeEach(() => {
      strategy = new ApiKeyStrategy();
    });

    it('应该使用默认header名称应用API Key认证', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'apikey',
        token: 'api-key-123',
      };

      const result = strategy.applyAuth(request, authConfig);

      expect(result.headers).toEqual({
        'X-API-Key': 'api-key-123',
      });
    });

    it('应该使用自定义header名称应用API Key认证', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'apikey',
        token: 'api-key-123',
        header: 'X-Custom-API-Key',
      };

      const result = strategy.applyAuth(request, authConfig);

      expect(result.headers).toEqual({
        'X-Custom-API-Key': 'api-key-123',
      });
    });

    it('应该在缺少token时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'apikey',
      };

      expect(() => strategy.applyAuth(request, authConfig)).toThrow(
        'API Key认证需要提供token',
      );
    });

    it('应该验证有效的配置', () => {
      const authConfig: AuthConfig = {
        type: 'apikey',
        token: 'valid-api-key',
        header: 'X-API-Key',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空header名称', () => {
      const authConfig: AuthConfig = {
        type: 'apikey',
        token: 'valid-token',
        header: '',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Header名称必须是非空字符串');
    });
  });

  describe('BasicAuthStrategy', () => {
    let strategy: BasicAuthStrategy;

    beforeEach(() => {
      strategy = new BasicAuthStrategy();
    });

    it('应该正确应用Basic认证', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'basic',
        username: 'testuser',
        password: 'testpass',
      };

      const result = strategy.applyAuth(request, authConfig);

      // 验证Base64编码的凭据
      const expectedCredentials =
        Buffer.from('testuser:testpass').toString('base64');
      expect(result.headers).toEqual({
        Authorization: `Basic ${expectedCredentials}`,
      });
    });

    it('应该在缺少用户名时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'basic',
        password: 'testpass',
      };

      expect(() => strategy.applyAuth(request, authConfig)).toThrow(
        'Basic认证需要提供用户名和密码',
      );
    });

    it('应该在缺少密码时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'basic',
        username: 'testuser',
      };

      expect(() => strategy.applyAuth(request, authConfig)).toThrow(
        'Basic认证需要提供用户名和密码',
      );
    });

    it('应该验证有效的配置', () => {
      const authConfig: AuthConfig = {
        type: 'basic',
        username: 'testuser',
        password: 'testpass',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空用户名', () => {
      const authConfig: AuthConfig = {
        type: 'basic',
        username: '',
        password: 'testpass',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Basic认证需要提供用户名');
    });

    it('应该拒绝只包含空白字符的用户名', () => {
      const authConfig: AuthConfig = {
        type: 'basic',
        username: '   ',
        password: 'testpass',
      };

      const result = strategy.validateConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('用户名必须是非空字符串');
    });
  });
});

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;

  beforeEach(() => {
    authManager = new AuthenticationManager();
  });

  describe('策略管理', () => {
    it('应该注册默认认证策略', () => {
      const supportedTypes = authManager.getSupportedTypes();
      expect(supportedTypes).toContain('bearer');
      expect(supportedTypes).toContain('apikey');
      expect(supportedTypes).toContain('basic');
    });

    it('应该能够获取认证策略', () => {
      const bearerStrategy = authManager.getStrategy('bearer');
      expect(bearerStrategy).toBeInstanceOf(BearerTokenStrategy);

      const apiKeyStrategy = authManager.getStrategy('apikey');
      expect(apiKeyStrategy).toBeInstanceOf(ApiKeyStrategy);

      const basicStrategy = authManager.getStrategy('basic');
      expect(basicStrategy).toBeInstanceOf(BasicAuthStrategy);
    });

    it('应该返回undefined对于不存在的策略', () => {
      const strategy = authManager.getStrategy('nonexistent');
      expect(strategy).toBeUndefined();
    });
  });

  describe('认证应用', () => {
    it('应该正确应用Bearer Token认证', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
        token: 'test-token',
      };

      const result = authManager.applyAuthentication(request, authConfig);
      expect(result.headers?.Authorization).toBe('Bearer test-token');
    });

    it('应该在不支持的认证类型时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig = {
        type: 'unsupported',
      } as AuthConfig;

      expect(() =>
        authManager.applyAuthentication(request, authConfig),
      ).toThrow('不支持的认证类型: unsupported');
    });

    it('应该在配置无效时抛出错误', () => {
      const request: HttpRequestConfig = {
        url: 'https://api.example.com/test',
        method: 'GET',
      };

      const authConfig: AuthConfig = {
        type: 'bearer',
        // 缺少token
      };

      expect(() =>
        authManager.applyAuthentication(request, authConfig),
      ).toThrow('认证配置无效: Bearer认证需要提供token');
    });
  });

  describe('配置验证', () => {
    it('应该验证有效的认证配置', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: 'valid-token',
      };

      const result = authManager.validateAuthConfig(authConfig);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝不支持的认证类型', () => {
      const authConfig = {
        type: 'unsupported',
      } as AuthConfig;

      const result = authManager.validateAuthConfig(authConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('不支持的认证类型: unsupported');
    });
  });

  describe('环境变量处理', () => {
    beforeEach(() => {
      // 设置测试环境变量
      process.env.TEST_API_TOKEN = 'env-token-123';
      process.env.TEST_USERNAME = 'env-user';
      process.env.TEST_PASSWORD = 'env-pass';
    });

    afterEach(() => {
      // 清理测试环境变量
      delete process.env.TEST_API_TOKEN;
      delete process.env.TEST_USERNAME;
      delete process.env.TEST_PASSWORD;
    });

    it('应该解析token中的环境变量', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '{{env.TEST_API_TOKEN}}',
      };

      const resolved = authManager.resolveEnvironmentVariables(authConfig);
      expect(resolved.token).toBe('env-token-123');
    });

    it('应该解析用户名和密码中的环境变量', () => {
      const authConfig: AuthConfig = {
        type: 'basic',
        username: '{{env.TEST_USERNAME}}',
        password: '{{env.TEST_PASSWORD}}',
      };

      const resolved = authManager.resolveEnvironmentVariables(authConfig);
      expect(resolved.username).toBe('env-user');
      expect(resolved.password).toBe('env-pass');
    });

    it('应该保持未定义环境变量的原样', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '{{env.UNDEFINED_VAR}}',
      };

      const resolved = authManager.resolveEnvironmentVariables(authConfig);
      expect(resolved.token).toBe('{{env.UNDEFINED_VAR}}');
    });

    it('应该验证环境变量的存在性', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '{{env.TEST_API_TOKEN}}-{{env.UNDEFINED_VAR}}',
      };

      const validation = authManager.validateEnvironmentVariables(authConfig);
      expect(validation.valid).toBe(false);
      expect(validation.missingVars).toContain('UNDEFINED_VAR');
      expect(validation.missingVars).not.toContain('TEST_API_TOKEN');
    });

    it('应该通过所有环境变量都存在的验证', () => {
      const authConfig: AuthConfig = {
        type: 'bearer',
        token: '{{env.TEST_API_TOKEN}}',
      };

      const validation = authManager.validateEnvironmentVariables(authConfig);
      expect(validation.valid).toBe(true);
      expect(validation.missingVars).toHaveLength(0);
    });
  });
});

describe('工厂函数和默认实例', () => {
  it('应该通过工厂函数创建认证管理器', () => {
    const manager = createAuthenticationManager();
    expect(manager).toBeInstanceOf(AuthenticationManager);
    expect(manager.getSupportedTypes()).toContain('bearer');
  });

  it('应该提供默认认证管理器实例', () => {
    expect(defaultAuthManager).toBeInstanceOf(AuthenticationManager);
    expect(defaultAuthManager.getSupportedTypes()).toContain('bearer');
  });
});
