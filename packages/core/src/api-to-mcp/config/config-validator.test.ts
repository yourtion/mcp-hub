/**
 * 配置验证器测试
 */

import { describe, expect, it } from 'vitest';
import type { ApiToolConfig, ApiToolsConfig } from '../types/api-config.js';
import { ConfigValidatorImpl } from './config-validator.js';

describe('ConfigValidatorImpl', () => {
  const validator = new ConfigValidatorImpl();

  describe('validateApiToolsConfig', () => {
    it('应该验证有效的API工具配置文件', () => {
      const validConfig: ApiToolsConfig = {
        version: '1.0',
        tools: [
          {
            id: 'test-tool',
            name: '测试工具',
            description: '这是一个测试工具',
            api: {
              url: 'https://api.example.com/test',
              method: 'GET',
              headers: {
                Authorization: 'Bearer {{env.API_TOKEN}}',
              },
              timeout: 5000,
            },
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '查询参数',
                },
              },
              required: ['query'],
            },
            response: {
              jsonata: 'data.result',
            },
          },
        ],
      };

      const result = validator.validateApiToolsConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validConfig);
    });

    it('应该拒绝无效的配置格式', () => {
      const invalidConfig = {
        version: '1.0',
        tools: [
          {
            id: '', // 空ID应该被拒绝
            name: '测试工具',
            description: '这是一个测试工具',
            api: {
              url: 'invalid-url', // 无效URL
              method: 'INVALID_METHOD', // 无效HTTP方法
            },
            parameters: {
              type: 'object',
              properties: {},
            },
            response: {},
          },
        ],
      };

      const result = validator.validateApiToolsConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateApiToolConfig', () => {
    it('应该验证有效的单个工具配置', () => {
      const validTool: ApiToolConfig = {
        id: 'weather-tool',
        name: '天气查询',
        description: '获取天气信息',
        api: {
          url: 'https://api.weather.com/v1/current',
          method: 'GET',
          queryParams: {
            city: '{{data.city}}',
          },
        },
        parameters: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: '城市名称',
            },
          },
          required: ['city'],
        },
        response: {
          jsonata:
            '{ "temperature": current.temp_c, "condition": current.condition.text }',
        },
      };

      const result = validator.validateApiToolConfig(validTool);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validTool);
    });
  });

  describe('validateJsonataExpression', () => {
    it('应该验证有效的JSONata表达式', () => {
      const validExpressions = [
        'data.result',
        '{ "name": name, "age": age }',
        'items[price > 100]',
        '$sum(items.price)',
        'data.users.name',
      ];

      for (const expression of validExpressions) {
        const result = validator.validateJsonataExpression(expression);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('应该拒绝无效的JSONata表达式', () => {
      const invalidExpressions = [
        '', // 空字符串
        '{{data.name}}', // 包含模板语法
        'data.[invalid syntax', // 语法错误
        'data.}invalid', // 语法错误
      ];

      for (const expression of invalidExpressions) {
        const result = validator.validateJsonataExpression(expression);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('应该拒绝非字符串类型', () => {
      const result = validator.validateJsonataExpression(
        null as unknown as string,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });
  });

  describe('validateUrl', () => {
    it('应该验证有效的URL', () => {
      const validUrls = [
        'https://api.example.com',
        'http://localhost:3000/api',
        'https://api.example.com/v1/users?limit=10',
      ];

      for (const url of validUrls) {
        const result = validator.validateUrl(url);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('应该拒绝无效的URL', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com', // 虽然是有效URL，但可能不适合HTTP API
        '',
        'http://',
      ];

      for (const url of invalidUrls) {
        const result = validator.validateUrl(url);
        if (url === 'ftp://example.com') {
          // FTP URL实际上是有效的URL格式
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('validateWithSchema', () => {
    it('应该使用自定义schema验证数据', async () => {
      const { z } = await import('zod');
      const testSchema = z.object({
        name: z.string(),
        age: z.number().positive(),
      });

      const validData = { name: 'John', age: 30 };
      const result = validator.validateWithSchema(testSchema, validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(validData);
    });

    it('应该拒绝不符合schema的数据', async () => {
      const { z } = await import('zod');
      const testSchema = z.object({
        name: z.string(),
        age: z.number().positive(),
      });

      const invalidData = { name: 'John', age: -5 }; // 负数年龄
      const result = validator.validateWithSchema(testSchema, invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
