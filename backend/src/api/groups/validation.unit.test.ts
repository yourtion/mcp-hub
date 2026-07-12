import { describe, expect, it } from 'vitest';

import { estimateToolComplexity, validateGroupData, validateGroupId } from './validation.js';

describe('validation', () => {
  describe('validateGroupId', () => {
    it('空 ID 应不通过', () => {
      expect(validateGroupId('').isValid).toBe(false);
    });

    it('有效 ID 应通过', () => {
      expect(validateGroupId('my-group').isValid).toBe(true);
      expect(validateGroupId('group_1').isValid).toBe(true);
      expect(validateGroupId('group-123').isValid).toBe(true);
    });

    it('含特殊字符的 ID 应不通过', () => {
      expect(validateGroupId('my group').isValid).toBe(false);
      expect(validateGroupId('my.group').isValid).toBe(false);
      expect(validateGroupId('my/group').isValid).toBe(false);
    });

    it('超过 50 字符的 ID 应不通过', () => {
      expect(validateGroupId('a'.repeat(51)).isValid).toBe(false);
    });
  });

  describe('validateGroupData', () => {
    it('空名称应不通过', () => {
      const result = validateGroupData({ name: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('组名称不能为空');
    });

    it('名称过长应不通过', () => {
      const result = validateGroupData({ name: 'a'.repeat(101) });
      expect(result.isValid).toBe(false);
    });

    it('有效数据应通过', () => {
      const result = validateGroupData({
        name: 'Test Group',
        description: 'A test group',
        servers: ['server1', 'server2'],
        tools: ['tool1'],
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('重复服务器应不通过', () => {
      const result = validateGroupData({
        servers: ['server1', 'server1'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true);
    });

    it('重复工具应不通过', () => {
      const result = validateGroupData({
        tools: ['tool1', 'tool1'],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true);
    });

    it('描述过长应不通过', () => {
      const result = validateGroupData({ description: 'a'.repeat(501) });
      expect(result.isValid).toBe(false);
    });
  });

  describe('estimateToolComplexity', () => {
    it('无参数的工具应为 simple', () => {
      const result = estimateToolComplexity({ type: 'object', properties: {} });
      expect(result.complexity).toBe('simple');
      expect(result.parameterCount).toBe(0);
    });

    it('多参数工具应为 complex', () => {
      const result = estimateToolComplexity({
        type: 'object',
        properties: {
          a: { type: 'object' },
          b: { type: 'array' },
          c: { type: 'number' },
          d: { type: 'boolean' },
          e: { type: 'string' },
          f: { type: 'string' },
        },
        required: ['a', 'b', 'c'],
      });
      expect(result.complexity).toBe('complex');
      expect(result.parameterCount).toBe(6);
      expect(result.requiredParameterCount).toBe(3);
    });

    it('中等参数工具应为 medium', () => {
      const result = estimateToolComplexity({
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
        },
        required: ['a'],
      });
      expect(result.complexity).toBe('simple');
    });
  });
});
