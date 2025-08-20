/**
 * 参数验证器测试
 */

import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '../types/api-config.js';
import { ParameterValidatorImpl } from './parameter-validator.js';

describe('ParameterValidatorImpl', () => {
  const validator = new ParameterValidatorImpl();

  describe('validate', () => {
    it('应该验证简单的字符串参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '用户名',
          },
        },
        required: ['name'],
      };

      const parameters = { name: 'Alice' };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ name: 'Alice' });
    });

    it('应该验证数字参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          age: {
            type: 'number',
            minimum: 0,
            maximum: 150,
          },
        },
        required: ['age'],
      };

      const parameters = { age: 25 };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ age: 25 });
    });

    it('应该验证布尔参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          active: {
            type: 'boolean',
          },
        },
      };

      const parameters = { active: true };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ active: true });
    });

    it('应该验证数组参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            minItems: 1,
            maxItems: 5,
          },
        },
      };

      const parameters = { tags: ['tag1', 'tag2'] };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual({ tags: ['tag1', 'tag2'] });
    });

    it('应该验证嵌套对象参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name'],
          },
        },
      };

      const parameters = {
        user: {
          name: 'Bob',
          age: 30,
        },
      };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.data).toEqual(parameters);
    });

    it('应该拒绝非对象参数', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {},
      };

      const result = validator.validate('not an object', schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
      expect(result.errors[0].path).toBe('root');
    });

    it('应该检查必需字段', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      };

      const parameters = { name: 'Alice' };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(result.errors[0].path).toBe('email');
    });

    it('应该应用默认值', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          active: { type: 'boolean', default: true },
          count: { type: 'number', default: 0 },
        },
        required: ['name'],
      };

      const parameters = { name: 'Alice' };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({
        name: 'Alice',
        active: true,
        count: 0,
      });
    });

    it('应该处理额外属性', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };

      const parameters = { name: 'Alice', extra: 'value' };
      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('ADDITIONAL_PROPERTY_NOT_ALLOWED');
      expect(result.errors[0].path).toBe('extra');
    });

    it('应该移除额外属性（当选项启用时）', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const parameters = { name: 'Alice', extra: 'value' };
      const result = validator.validate(parameters, schema, {
        removeAdditionalProperties: true,
      });

      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ name: 'Alice' });
    });
  });

  describe('字符串验证', () => {
    it('应该验证字符串长度', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 2,
            maxLength: 10,
          },
        },
      };

      // 太短
      let result = validator.validate({ name: 'A' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MIN_LENGTH_VIOLATION');

      // 太长
      result = validator.validate({ name: 'This is too long' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_LENGTH_VIOLATION');

      // 正确长度
      result = validator.validate({ name: 'Alice' }, schema);
      expect(result.valid).toBe(true);
    });

    it('应该验证字符串模式', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            pattern: '^[A-Z]{2}\\d{3}$',
          },
        },
      };

      // 无效模式
      let result = validator.validate({ code: 'abc123' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('PATTERN_MISMATCH');

      // 有效模式
      result = validator.validate({ code: 'AB123' }, schema);
      expect(result.valid).toBe(true);
    });

    it('应该验证邮箱格式', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
        },
      };

      // 无效邮箱
      let result = validator.validate({ email: 'invalid-email' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EMAIL_FORMAT');

      // 有效邮箱
      result = validator.validate({ email: 'user@example.com' }, schema);
      expect(result.valid).toBe(true);
    });

    it('应该验证URL格式', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          website: {
            type: 'string',
            format: 'url',
          },
        },
      };

      // 无效URL
      let result = validator.validate({ website: 'not-a-url' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_URL_FORMAT');

      // 有效URL
      result = validator.validate({ website: 'https://example.com' }, schema);
      expect(result.valid).toBe(true);
    });

    it('应该验证日期格式', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          birthDate: {
            type: 'string',
            format: 'date',
          },
        },
      };

      // 无效日期
      let result = validator.validate({ birthDate: '2023-13-01' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_DATE_FORMAT');

      // 有效日期
      result = validator.validate({ birthDate: '2023-12-01' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('数字验证', () => {
    it('应该验证数字范围', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          score: {
            type: 'number',
            minimum: 0,
            maximum: 100,
          },
        },
      };

      // 小于最小值
      let result = validator.validate({ score: -1 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MINIMUM_VIOLATION');

      // 大于最大值
      result = validator.validate({ score: 101 }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MAXIMUM_VIOLATION');

      // 在范围内
      result = validator.validate({ score: 85 }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('数组验证', () => {
    it('应该验证数组长度', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 3,
          },
        },
      };

      // 太少元素
      let result = validator.validate({ items: [] }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MIN_ITEMS_VIOLATION');

      // 太多元素
      result = validator.validate({ items: ['a', 'b', 'c', 'd'] }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_ITEMS_VIOLATION');

      // 正确数量
      result = validator.validate({ items: ['a', 'b'] }, schema);
      expect(result.valid).toBe(true);
    });

    it('应该验证数组元素类型', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          numbers: {
            type: 'array',
            items: { type: 'number' },
          },
        },
      };

      // 错误的元素类型
      const result = validator.validate({ numbers: [1, 'two', 3] }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('TYPE_MISMATCH');
      expect(result.errors[0].path).toBe('numbers[1]');
    });
  });

  describe('枚举验证', () => {
    it('应该验证枚举值', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      };

      // 无效枚举值
      let result = validator.validate({ status: 'unknown' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('ENUM_VALIDATION_FAILED');

      // 有效枚举值
      result = validator.validate({ status: 'active' }, schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('类型验证', () => {
    it('应该验证类型不匹配', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
      };

      const parameters = {
        name: 123, // 应该是字符串
        age: 'thirty', // 应该是数字
        active: 'yes', // 应该是布尔值
      };

      const result = validator.validate(parameters, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.every((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
    });
  });

  describe('applyDefaults', () => {
    it('应该应用默认值', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          active: { type: 'boolean', default: true },
          count: { type: 'number', default: 0 },
          tags: { type: 'array', default: [] },
        },
      };

      const parameters = { name: 'Alice' };
      const result = validator.applyDefaults(parameters, schema);

      expect(result).toEqual({
        name: 'Alice',
        active: true,
        count: 0,
        tags: [],
      });
    });

    it('不应该覆盖已存在的值', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          active: { type: 'boolean', default: true },
          count: { type: 'number', default: 0 },
        },
      };

      const parameters = { active: false, count: 5 };
      const result = validator.applyDefaults(parameters, schema);

      expect(result).toEqual({
        active: false,
        count: 5,
      });
    });
  });

  describe('checkRequiredFields', () => {
    it('应该检查必需字段', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'email'],
      };

      const parameters = { name: 'Alice' };
      const errors = validator.checkRequiredFields(parameters, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REQUIRED_FIELD_MISSING');
      expect(errors[0].path).toBe('email');
    });

    it('应该处理null值作为缺失字段', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };

      const parameters = { name: null };
      const errors = validator.checkRequiredFields(parameters, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('REQUIRED_FIELD_MISSING');
    });
  });
});
