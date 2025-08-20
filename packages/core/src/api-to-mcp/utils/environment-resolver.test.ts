/**
 * 环境变量解析器测试
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnvironmentResolverImpl } from './environment-resolver.js';

describe('EnvironmentResolverImpl', () => {
  const resolver = new EnvironmentResolverImpl();
  const originalEnv = process.env;

  beforeEach(() => {
    // 设置测试环境变量
    process.env = {
      ...originalEnv,
      TEST_API_KEY: 'test-key-123',
      TEST_BASE_URL: 'https://api.test.com',
      TEST_TIMEOUT: '5000',
    };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('resolve', () => {
    it('应该解析字符串中的环境变量引用', () => {
      const template = 'Bearer {{env.TEST_API_KEY}}';
      const result = resolver.resolve(template);
      expect(result).toBe('Bearer test-key-123');
    });

    it('应该解析多个环境变量引用', () => {
      const template =
        '{{env.TEST_BASE_URL}}/api/v1?timeout={{env.TEST_TIMEOUT}}';
      const result = resolver.resolve(template);
      expect(result).toBe('https://api.test.com/api/v1?timeout=5000');
    });

    it('应该保持未定义环境变量的原始值', () => {
      const template = 'Bearer {{env.UNDEFINED_VAR}}';
      const result = resolver.resolve(template);
      expect(result).toBe('Bearer {{env.UNDEFINED_VAR}}');
    });

    it('应该处理非字符串输入', () => {
      const result = resolver.resolve(123 as unknown as string);
      expect(result).toBe(123);
    });
  });

  describe('resolveObject', () => {
    it('应该递归解析对象中的环境变量', () => {
      const config = {
        api: {
          url: '{{env.TEST_BASE_URL}}/users',
          headers: {
            Authorization: 'Bearer {{env.TEST_API_KEY}}',
            'Content-Type': 'application/json',
          },
          timeout: '{{env.TEST_TIMEOUT}}',
        },
        metadata: {
          version: '1.0',
        },
      };

      const result = resolver.resolveObject(config);
      expect(result).toEqual({
        api: {
          url: 'https://api.test.com/users',
          headers: {
            Authorization: 'Bearer test-key-123',
            'Content-Type': 'application/json',
          },
          timeout: '5000',
        },
        metadata: {
          version: '1.0',
        },
      });
    });

    it('应该处理数组中的环境变量', () => {
      const config = {
        servers: [
          '{{env.TEST_BASE_URL}}/api/v1',
          '{{env.TEST_BASE_URL}}/api/v2',
        ],
      };

      const result = resolver.resolveObject(config);
      expect(result).toEqual({
        servers: ['https://api.test.com/api/v1', 'https://api.test.com/api/v2'],
      });
    });

    it('应该处理null和undefined值', () => {
      expect(resolver.resolveObject(null)).toBe(null);
      expect(resolver.resolveObject(undefined)).toBe(undefined);
    });
  });

  describe('validateRequiredVariables', () => {
    it('应该返回缺失的环境变量', () => {
      const requiredVars = ['TEST_API_KEY', 'MISSING_VAR', 'ANOTHER_MISSING'];
      const missing = resolver.validateRequiredVariables(requiredVars);
      expect(missing).toEqual(['MISSING_VAR', 'ANOTHER_MISSING']);
    });

    it('应该在所有变量都存在时返回空数组', () => {
      const requiredVars = ['TEST_API_KEY', 'TEST_BASE_URL'];
      const missing = resolver.validateRequiredVariables(requiredVars);
      expect(missing).toEqual([]);
    });
  });

  describe('extractEnvironmentVariables', () => {
    it('应该从字符串中提取环境变量名', () => {
      const template = 'Bearer {{env.API_KEY}} from {{env.BASE_URL}}';
      const variables = resolver.extractEnvironmentVariables(template);
      expect(variables).toEqual(['API_KEY', 'BASE_URL']);
    });

    it('应该处理重复的环境变量引用', () => {
      const template = '{{env.API_KEY}}-{{env.API_KEY}}';
      const variables = resolver.extractEnvironmentVariables(template);
      expect(variables).toEqual(['API_KEY', 'API_KEY']);
    });

    it('应该处理非字符串输入', () => {
      const variables = resolver.extractEnvironmentVariables(
        123 as unknown as string,
      );
      expect(variables).toEqual([]);
    });
  });

  describe('extractAllEnvironmentVariables', () => {
    it('应该从复杂对象中提取所有环境变量', () => {
      const config = {
        api: {
          url: '{{env.BASE_URL}}/api',
          headers: {
            Authorization: 'Bearer {{env.API_KEY}}',
          },
        },
        database: {
          host: '{{env.DB_HOST}}',
          port: '{{env.DB_PORT}}',
        },
        features: ['{{env.FEATURE_1}}', '{{env.FEATURE_2}}'],
      };

      const variables = resolver.extractAllEnvironmentVariables(config);
      expect(variables.sort()).toEqual([
        'API_KEY',
        'BASE_URL',
        'DB_HOST',
        'DB_PORT',
        'FEATURE_1',
        'FEATURE_2',
      ]);
    });

    it('应该去重环境变量名', () => {
      const config = {
        url1: '{{env.API_KEY}}',
        url2: '{{env.API_KEY}}',
        url3: '{{env.BASE_URL}}',
      };

      const variables = resolver.extractAllEnvironmentVariables(config);
      expect(variables.sort()).toEqual(['API_KEY', 'BASE_URL']);
    });

    it('应该处理空对象', () => {
      const variables = resolver.extractAllEnvironmentVariables({});
      expect(variables).toEqual([]);
    });
  });
});
