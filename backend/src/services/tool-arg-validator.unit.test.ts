import { describe, expect, it } from 'vitest';

import { validateArgumentType, validateToolArgsWithSchema } from './tool-arg-validator.js';

import type { Tool } from '../types/mcp-hub.js';

// 构造带 schema 的 Tool 对象
function makeTool(schema: Record<string, unknown>): Tool {
  return {
    name: 'test-tool',
    serverId: 'test-server',
    inputSchema: schema,
  };
}

describe('validateArgumentType', () => {
  describe('类型匹配时通过', () => {
    const validCases: Array<{ type: string; value: unknown }> = [
      { type: 'string', value: 'hello' },
      { type: 'number', value: 42 },
      { type: 'number', value: 3.14 },
      { type: 'integer', value: 7 },
      { type: 'boolean', value: true },
      { type: 'boolean', value: false },
      { type: 'array', value: [1, 2, 3] },
      { type: 'object', value: { key: 'val' } },
    ];

    for (const { type, value } of validCases) {
      it(`${type} 类型正确值通过`, () => {
        const result = validateArgumentType('arg', value, { type });
        expect(result.isValid).toBe(true);
      });
    }
  });

  describe('类型不匹配时拒绝', () => {
    const invalidCases: Array<{ type: string; value: unknown; expectedActual: string }> = [
      { type: 'string', value: 42, expectedActual: 'number' },
      { type: 'string', value: true, expectedActual: 'boolean' },
      { type: 'number', value: 'not a number', expectedActual: 'string' },
      { type: 'number', value: true, expectedActual: 'boolean' },
      { type: 'integer', value: 3.14, expectedActual: 'number' },
      { type: 'integer', value: '7', expectedActual: 'string' },
      { type: 'boolean', value: 'true', expectedActual: 'string' },
      { type: 'boolean', value: 1, expectedActual: 'number' },
      { type: 'array', value: 'not array', expectedActual: 'string' },
      { type: 'array', value: { 0: 'a' }, expectedActual: 'object' },
      { type: 'object', value: null, expectedActual: 'object' },
      { type: 'object', value: [1, 2], expectedActual: 'object' },
      { type: 'object', value: 'string', expectedActual: 'string' },
    ];

    for (const { type, value, expectedActual } of invalidCases) {
      it(`${type} 拒绝 ${expectedActual} 值`, () => {
        const result = validateArgumentType('arg', value, { type });
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('arg');
        expect(result.error).toContain(expectedActual);
      });
    }
  });

  it('NaN 不被接受为 number', () => {
    const result = validateArgumentType('arg', NaN, { type: 'number' });
    expect(result.isValid).toBe(false);
  });

  it('schema 中没有 type 字段时允许任何值', () => {
    expect(validateArgumentType('arg', 'anything', {}).isValid).toBe(true);
    expect(validateArgumentType('arg', 42, { description: 'no type' }).isValid).toBe(true);
  });

  it('未知类型允许通过', () => {
    const result = validateArgumentType('arg', 'value', { type: 'custom-unknown-type' });
    expect(result.isValid).toBe(true);
  });
});

describe('validateToolArgsWithSchema', () => {
  describe('无 schema 时', () => {
    it('inputSchema 为空对象时允许所有参数', () => {
      const tool = makeTool({});
      expect(validateToolArgsWithSchema(tool, { anything: 1 }).isValid).toBe(true);
    });

    it('inputSchema 为 null 时允许所有参数', () => {
      const tool = makeTool(null as unknown as Record<string, unknown>);
      expect(validateToolArgsWithSchema(tool, { anything: 1 }).isValid).toBe(true);
    });
  });

  describe('必填字段校验', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['name', 'count'],
    });

    it('所有必填字段提供时通过', () => {
      expect(validateToolArgsWithSchema(tool, { name: 'test', count: 1 }).isValid).toBe(true);
    });

    it('缺少必填字段时拒绝', () => {
      const result = validateToolArgsWithSchema(tool, { name: 'test' });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('count');
      expect(result.error).toContain('Missing required');
    });

    it('必填字段为 null 时拒绝', () => {
      const result = validateToolArgsWithSchema(tool, { name: null, count: 1 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('null');
    });

    it('必填字段为 undefined 时拒绝', () => {
      const result = validateToolArgsWithSchema(tool, { name: undefined, count: 1 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('undefined');
    });
  });

  describe('类型校验', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
    });

    it('类型正确时通过', () => {
      expect(validateToolArgsWithSchema(tool, { name: 'ok', count: 5 }).isValid).toBe(true);
    });

    it('类型错误时拒绝并指出字段名', () => {
      const result = validateToolArgsWithSchema(tool, { name: 123 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('name');
      expect(result.error).toContain('string');
    });

    it('未在 properties 中声明的参数不校验类型（自由通过）', () => {
      expect(validateToolArgsWithSchema(tool, { extra: true }).isValid).toBe(true);
    });
  });

  describe('additionalProperties: false', () => {
    const tool = makeTool({
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    });

    it('只传声明过的属性时通过', () => {
      expect(validateToolArgsWithSchema(tool, { name: 'ok' }).isValid).toBe(true);
    });

    it('传了额外属性时拒绝并列出多余的属性名', () => {
      const result = validateToolArgsWithSchema(tool, { name: 'ok', extra: 1 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('extra');
      expect(result.error).toContain('Additional properties');
    });

    it('额外属性为空对象时不拒绝（additionalProperties 默认允许）', () => {
      const allowTool = makeTool({
        type: 'object',
        properties: { name: { type: 'string' } },
        // additionalProperties 未设置
      });
      expect(validateToolArgsWithSchema(allowTool, { name: 'ok', extra: 1 }).isValid).toBe(true);
    });
  });

  describe('综合场景', () => {
    it('完整有效调用通过所有校验', () => {
      const tool = makeTool({
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'integer' },
          filters: { type: 'object' },
        },
        required: ['query'],
        additionalProperties: false,
      });

      const result = validateToolArgsWithSchema(tool, {
        query: 'search term',
        limit: 10,
        filters: { status: 'active' },
      });
      expect(result.isValid).toBe(true);
    });

    it('同时违反多条规则时报告第一个遇到的错误', () => {
      const tool = makeTool({
        type: 'object',
        properties: {
          a: { type: 'string' },
        },
        required: ['a', 'b'],
        additionalProperties: false,
      });

      // 缺少必填 a 和 b，且传了额外字段 c
      const result = validateToolArgsWithSchema(tool, { c: 1 });
      expect(result.isValid).toBe(false);
      // required 检查按声明顺序，先报 a 缺失
      expect(result.error).toContain('a');
      expect(result.error).toContain('Missing required');
    });
  });
});
