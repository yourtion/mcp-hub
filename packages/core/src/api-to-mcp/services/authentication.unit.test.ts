/**
 * 认证系统单元测试
 * 覆盖 BearerTokenStrategy、ApiKeyStrategy、BasicAuthStrategy、AuthenticationManager
 */

import { Buffer } from 'node:buffer';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthenticationManager,
  BasicAuthStrategy,
  BearerTokenStrategy,
  ApiKeyStrategy,
  createAuthenticationManager,
  defaultAuthManager,
} from './authentication.js';

import type { AuthConfig } from '../types/api-config.js';
import type { HttpRequestConfig } from '../types/http-client.js';
import type { AuthenticationStrategy } from './authentication.js';

vi.mock('../../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

/** 创建基础请求配置的辅助函数 */
function createBaseRequest(): HttpRequestConfig {
  return {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
}

// ============================================================================
// BearerTokenStrategy
// ============================================================================
describe('BearerTokenStrategy', function () {
  let strategy: BearerTokenStrategy;

  beforeEach(function () {
    strategy = new BearerTokenStrategy();
  });

  describe('applyAuth', function () {
    it('应该在请求头中添加 Bearer Token 认证头', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'bearer', token: 'my-secret-token' };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers).toBeDefined();
      expect(result.headers!.Authorization).toBe('Bearer my-secret-token');
      // 保留原有请求头
      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('当未提供 token 时应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'bearer' };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow(
        'Bearer token认证需要提供token',
      );
    });
  });

  describe('validateConfig', function () {
    it('有效的配置应返回 { valid: true }', async function () {
      const config: AuthConfig = { type: 'bearer', token: 'valid-token' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('类型不匹配时应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey', token: 'some-token' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('认证类型不匹配');
    });

    it('缺少 token 时应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bearer认证需要提供token');
    });

    it('空字符串 token 应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer', token: '' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bearer认证需要提供token');
    });

    it('仅包含空白字符的 token 应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer', token: '   ' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token必须是非空字符串');
    });

    it('非字符串的 token 应返回错误', async function () {
      const config = { type: 'bearer' as const, token: 123 as unknown as string };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token必须是字符串');
    });
  });
});

// ============================================================================
// ApiKeyStrategy
// ============================================================================
describe('ApiKeyStrategy', function () {
  let strategy: ApiKeyStrategy;

  beforeEach(function () {
    strategy = new ApiKeyStrategy();
  });

  describe('applyAuth', function () {
    it('应该使用默认 X-API-Key 头添加 API Key', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'apikey', token: 'my-api-key' };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers).toBeDefined();
      expect(result.headers!['X-API-Key']).toBe('my-api-key');
    });

    it('应该使用指定的自定义头名称', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'apikey', token: 'my-api-key', header: 'X-Custom-Auth' };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers).toBeDefined();
      expect(result.headers!['X-Custom-Auth']).toBe('my-api-key');
    });

    it('当未提供 token 时应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'apikey' };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow(
        'API Key认证需要提供token',
      );
    });
  });

  describe('validateConfig', function () {
    it('有效配置应返回 { valid: true }', async function () {
      const config: AuthConfig = { type: 'apikey', token: 'valid-key' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('带自定义 header 的有效配置应返回 { valid: true }', async function () {
      const config: AuthConfig = { type: 'apikey', token: 'valid-key', header: 'X-Custom' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('类型不匹配时应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer', token: 'some-token' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('认证类型不匹配');
    });

    it('缺少 token 时应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API Key认证需要提供token');
    });

    it('空字符串 token 应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey', token: '' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API Key认证需要提供token');
    });

    it('仅包含空白字符的 token 应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey', token: '   ' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API Key必须是非空字符串');
    });

    it('非字符串 token 应返回错误', async function () {
      const config = { type: 'apikey' as const, token: 42 as unknown as string };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API Key必须是非空字符串');
    });

    it('空字符串 header 应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey', token: 'valid-key', header: '' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Header名称必须是非空字符串');
    });

    it('仅包含空白字符的 header 应返回错误', async function () {
      const config: AuthConfig = { type: 'apikey', token: 'valid-key', header: '  ' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Header名称必须是非空字符串');
    });

    it('非字符串 header 应返回错误', async function () {
      const config = {
        type: 'apikey' as const,
        token: 'valid-key',
        header: 99 as unknown as string,
      };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Header名称必须是非空字符串');
    });
  });
});

// ============================================================================
// BasicAuthStrategy
// ============================================================================
describe('BasicAuthStrategy', function () {
  let strategy: BasicAuthStrategy;

  beforeEach(function () {
    strategy = new BasicAuthStrategy();
  });

  describe('applyAuth', function () {
    it('应该添加 base64 编码的 Basic 认证头', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };

      const result = await strategy.applyAuth(request, config);

      expect(result.headers).toBeDefined();
      const expectedEncoded = Buffer.from('user:pass').toString('base64');
      expect(result.headers!.Authorization).toBe(`Basic ${expectedEncoded}`);
    });

    it('缺少用户名时应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'basic', password: 'pass' };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow(
        'Basic认证需要提供用户名和密码',
      );
    });

    it('缺少密码时应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'basic', username: 'user' };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow(
        'Basic认证需要提供用户名和密码',
      );
    });

    it('用户名和密码都缺少时应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'basic' };

      await expect(strategy.applyAuth(request, config)).rejects.toThrow(
        'Basic认证需要提供用户名和密码',
      );
    });
  });

  describe('validateConfig', function () {
    it('有效配置应返回 { valid: true }', async function () {
      const config: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('类型不匹配时应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer', username: 'user', password: 'pass' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('认证类型不匹配');
    });

    it('缺少用户名应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', password: 'pass' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Basic认证需要提供用户名');
    });

    it('缺少密码应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', username: 'user' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Basic认证需要提供密码');
    });

    it('空字符串用户名应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', username: '', password: 'pass' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Basic认证需要提供用户名');
    });

    it('仅包含空白字符的用户名应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', username: '  ', password: 'pass' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('用户名必须是非空字符串');
    });

    it('空字符串密码应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', username: 'user', password: '' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Basic认证需要提供密码');
    });

    it('仅包含空白字符的密码应返回错误', async function () {
      const config: AuthConfig = { type: 'basic', username: 'user', password: '  ' };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('密码必须是非空字符串');
    });

    it('非字符串用户名应返回错误', async function () {
      const config = {
        type: 'basic' as const,
        username: 123 as unknown as string,
        password: 'pass',
      };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('用户名必须是字符串');
    });

    it('非字符串密码应返回错误', async function () {
      const config = {
        type: 'basic' as const,
        username: 'user',
        password: 456 as unknown as string,
      };
      const result = await strategy.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('密码必须是字符串');
    });
  });
});

// ============================================================================
// AuthenticationManager
// ============================================================================
describe('AuthenticationManager', function () {
  let manager: AuthenticationManager;

  beforeEach(function () {
    manager = new AuthenticationManager();
  });

  describe('构造函数', function () {
    it('应该注册 3 个默认策略', function () {
      const types = manager.getSupportedTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain('bearer');
      expect(types).toContain('apikey');
      expect(types).toContain('basic');
    });
  });

  describe('getStrategy', function () {
    it('应该返回正确的 bearer 策略', function () {
      const strategy = manager.getStrategy('bearer');
      expect(strategy).toBeDefined();
      expect(strategy!.name).toBe('bearer');
      expect(strategy).toBeInstanceOf(BearerTokenStrategy);
    });

    it('应该返回正确的 apikey 策略', function () {
      const strategy = manager.getStrategy('apikey');
      expect(strategy).toBeDefined();
      expect(strategy!.name).toBe('apikey');
      expect(strategy).toBeInstanceOf(ApiKeyStrategy);
    });

    it('应该返回正确的 basic 策略', function () {
      const strategy = manager.getStrategy('basic');
      expect(strategy).toBeDefined();
      expect(strategy!.name).toBe('basic');
      expect(strategy).toBeInstanceOf(BasicAuthStrategy);
    });

    it('对不存在的类型应返回 undefined', function () {
      const strategy = manager.getStrategy('unknown');
      expect(strategy).toBeUndefined();
    });
  });

  describe('getSupportedTypes', function () {
    it('应该返回所有支持的认证类型', function () {
      const types = manager.getSupportedTypes();
      expect(types.toSorted()).toEqual(['apikey', 'basic', 'bearer']);
    });
  });

  describe('registerStrategy', function () {
    it('应该能够注册自定义策略', function () {
      const customStrategy: AuthenticationStrategy = {
        name: 'custom',
        async applyAuth(request: HttpRequestConfig) {
          const headers = { ...request.headers, 'X-Custom': 'custom-value' };
          return { ...request, headers };
        },
        async validateConfig() {
          return { valid: true };
        },
      };

      manager.registerStrategy(customStrategy);

      expect(manager.getStrategy('custom')).toBeDefined();
      expect(manager.getSupportedTypes()).toContain('custom');
    });
  });

  describe('applyAuthentication', function () {
    it('应该使用 bearer 策略应用认证', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'bearer', token: 'test-token' };

      const result = await manager.applyAuthentication(request, config);

      expect(result.headers!.Authorization).toBe('Bearer test-token');
    });

    it('应该使用 apikey 策略应用认证', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'apikey', token: 'test-key' };

      const result = await manager.applyAuthentication(request, config);

      expect(result.headers!['X-API-Key']).toBe('test-key');
    });

    it('应该使用 basic 策略应用认证', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };

      const result = await manager.applyAuthentication(request, config);

      const expectedEncoded = Buffer.from('user:pass').toString('base64');
      expect(result.headers!.Authorization).toBe(`Basic ${expectedEncoded}`);
    });

    it('未知的认证类型应该抛出错误', async function () {
      const request = createBaseRequest();
      const config = { type: 'oauth' } as unknown as AuthConfig;

      await expect(manager.applyAuthentication(request, config)).rejects.toThrow(
        '不支持的认证类型: oauth',
      );
    });

    it('无效的配置应该抛出错误', async function () {
      const request = createBaseRequest();
      const config: AuthConfig = { type: 'bearer' };

      await expect(manager.applyAuthentication(request, config)).rejects.toThrow(
        '认证配置无效: Bearer认证需要提供token',
      );
    });
  });

  describe('validateAuthConfig', function () {
    it('有效的 bearer 配置应返回 valid', async function () {
      const config: AuthConfig = { type: 'bearer', token: 'valid-token' };
      const result = await manager.validateAuthConfig(config);

      expect(result.valid).toBe(true);
    });

    it('无效的 bearer 配置应返回错误', async function () {
      const config: AuthConfig = { type: 'bearer' };
      const result = await manager.validateAuthConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bearer认证需要提供token');
    });

    it('未知的认证类型应返回错误', async function () {
      const config = { type: 'oauth' } as unknown as AuthConfig;
      const result = await manager.validateAuthConfig(config);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('不支持的认证类型: oauth');
    });
  });

  describe('resolveEnvironmentVariables', function () {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(function () {
      // 保存原始环境变量
      originalEnv['TEST_AUTH_TOKEN'] = process.env['TEST_AUTH_TOKEN'];
      originalEnv['TEST_AUTH_USER'] = process.env['TEST_AUTH_USER'];
      originalEnv['TEST_AUTH_PASS'] = process.env['TEST_AUTH_PASS'];
      originalEnv['TEST_AUTH_HEADER'] = process.env['TEST_AUTH_HEADER'];
    });

    afterEach(function () {
      // 恢复原始环境变量
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it('应该解析 token 中的 {{env.VAR}} 模式', function () {
      process.env['TEST_AUTH_TOKEN'] = 'resolved-token';
      const config: AuthConfig = { type: 'bearer', token: '{{env.TEST_AUTH_TOKEN}}' };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.token).toBe('resolved-token');
    });

    it('应该解析 username 中的 {{env.VAR}} 模式', function () {
      process.env['TEST_AUTH_USER'] = 'resolved-user';
      const config: AuthConfig = {
        type: 'basic',
        username: '{{env.TEST_AUTH_USER}}',
        password: 'pass',
      };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.username).toBe('resolved-user');
    });

    it('应该解析 password 中的 {{env.VAR}} 模式', function () {
      process.env['TEST_AUTH_PASS'] = 'resolved-pass';
      const config: AuthConfig = {
        type: 'basic',
        username: 'user',
        password: '{{env.TEST_AUTH_PASS}}',
      };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.password).toBe('resolved-pass');
    });

    it('应该解析 header 中的 {{env.VAR}} 模式', function () {
      process.env['TEST_AUTH_HEADER'] = 'X-Resolved-Header';
      const config: AuthConfig = {
        type: 'apikey',
        token: 'key',
        header: '{{env.TEST_AUTH_HEADER}}',
      };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.header).toBe('X-Resolved-Header');
    });

    it('环境变量未定义时应保持原始模板字符串', function () {
      delete process.env['UNDEFINED_VAR_XYZ'];
      const config: AuthConfig = { type: 'bearer', token: '{{env.UNDEFINED_VAR_XYZ}}' };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.token).toBe('{{env.UNDEFINED_VAR_XYZ}}');
    });

    it('不应该修改不包含环境变量的配置', function () {
      const config: AuthConfig = { type: 'bearer', token: 'plain-token' };

      const resolved = manager.resolveEnvironmentVariables(config);

      expect(resolved.token).toBe('plain-token');
      expect(resolved.type).toBe('bearer');
    });
  });

  describe('validateEnvironmentVariables', function () {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(function () {
      originalEnv['EXISTING_VAR'] = process.env['EXISTING_VAR'];
      originalEnv['MISSING_VAR'] = process.env['MISSING_VAR'];
    });

    afterEach(function () {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    it('所有环境变量都存在时应返回 valid', function () {
      process.env['EXISTING_VAR'] = 'some-value';
      const config: AuthConfig = { type: 'bearer', token: '{{env.EXISTING_VAR}}' };

      const result = manager.validateEnvironmentVariables(config);

      expect(result.valid).toBe(true);
      expect(result.missingVars).toHaveLength(0);
    });

    it('应该检测到缺失的环境变量', function () {
      delete process.env['MISSING_VAR'];
      const config: AuthConfig = { type: 'bearer', token: '{{env.MISSING_VAR}}' };

      const result = manager.validateEnvironmentVariables(config);

      expect(result.valid).toBe(false);
      expect(result.missingVars).toContain('MISSING_VAR');
    });

    it('应该去重缺失的环境变量', function () {
      delete process.env['MISSING_VAR'];
      const config: AuthConfig = {
        type: 'basic',
        username: '{{env.MISSING_VAR}}',
        password: '{{env.MISSING_VAR}}',
      };

      const result = manager.validateEnvironmentVariables(config);

      expect(result.valid).toBe(false);
      expect(result.missingVars).toEqual(['MISSING_VAR']);
    });

    it('没有环境变量引用时应返回 valid', function () {
      const config: AuthConfig = { type: 'bearer', token: 'plain-token' };

      const result = manager.validateEnvironmentVariables(config);

      expect(result.valid).toBe(true);
      expect(result.missingVars).toHaveLength(0);
    });
  });
});

// ============================================================================
// 工厂函数和默认导出
// ============================================================================
describe('createAuthenticationManager', function () {
  it('应该创建 AuthenticationManager 实例', function () {
    const instance = createAuthenticationManager();

    expect(instance).toBeInstanceOf(AuthenticationManager);
    expect(instance.getSupportedTypes()).toHaveLength(3);
  });

  it('每次调用应该创建新的实例', function () {
    const instance1 = createAuthenticationManager();
    const instance2 = createAuthenticationManager();

    expect(instance1).not.toBe(instance2);
  });
});

describe('defaultAuthManager', function () {
  it('应该是 AuthenticationManager 实例', function () {
    expect(defaultAuthManager).toBeInstanceOf(AuthenticationManager);
  });

  it('应该包含默认注册的 3 个策略', function () {
    expect(defaultAuthManager.getSupportedTypes()).toHaveLength(3);
  });
});
