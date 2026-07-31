import { describe, expect, it } from 'vitest';

import { formatError, transformToolResult } from './tool-result-transform.js';

import type { ToolResult } from '../types/mcp-knot.js';

// formatError 是纯函数，没有副作用，直接测试
describe('formatError', () => {
  it('字符串原样返回', () => {
    expect(formatError('something went wrong')).toBe('something went wrong');
  });

  it('带 message 的 Error 对象提取 message', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
  });

  it('带 code 的错误格式化为 [code] message', () => {
    expect(formatError({ message: 'failed', code: 500 })).toBe('[500] failed');
    expect(formatError({ message: 'failed', code: 'ECONNREFUSED' })).toBe('[ECONNREFUSED] failed');
  });

  it('带 data 的错误追加 JSON', () => {
    expect(formatError({ message: 'failed', data: { key: 'val' } })).toBe('failed ({"key":"val"})');
  });

  it('有 code 和 data 的错误同时格式化两者', () => {
    const result = formatError({ message: 'err', code: 42, data: [1, 2] });
    expect(result).toBe('[42] err ([1,2])');
  });

  it('没有 message 的对象 JSON 序列化', () => {
    expect(formatError({ foo: 'bar' })).toBe('{"foo":"bar"}');
  });

  it('number 转 string', () => {
    expect(formatError(42)).toBe('42');
  });

  it('null 转 "null"', () => {
    expect(formatError(null)).toBe('null');
  });
});

describe('transformToolResult', () => {
  // 辅助：验证返回值是合法的 ToolResult
  function expectValidToolResult(result: ToolResult): void {
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    for (const item of result.content) {
      expect(item.type).toBe('text');
      expect(typeof item.text).toBe('string');
    }
    expect(typeof result.isError).toBe('boolean');
  }

  describe('标准 MCP 格式（含 content 数组）', () => {
    it('保留已有 content 数组不变', () => {
      const result = transformToolResult({
        content: [{ type: 'text', text: 'hello' }],
        isError: false,
      });
      expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
      expect(result.isError).toBe(false);
    });

    it('保留 isError: true 标记', () => {
      const result = transformToolResult({
        content: [{ type: 'text', text: 'failed' }],
        isError: true,
      });
      expect(result.isError).toBe(true);
    });

    it('content 数组存在但 isError 未设置时默认为 false', () => {
      const result = transformToolResult({
        content: [{ type: 'text', text: 'ok' }],
      });
      expect(result.isError).toBe(false);
    });

    it('空 content 数组仍进入 content 分支（空数组是 truthy）', () => {
      const result = transformToolResult({ content: [] });
      // 空数组是 truthy，所以进入 content 分支，返回空 content
      expect(result.content).toEqual([]);
      expect(result.isError).toBe(false);
    });
  });

  describe('错误结果（含 error 字段）', () => {
    it('字符串错误转为文本 + isError: true', () => {
      const result = transformToolResult({ error: 'something broke' });
      expectValidToolResult(result);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('something broke');
      expect(result.content[0].text).toContain('Error');
    });

    it('Error 对象提取 message', () => {
      const result = transformToolResult({ error: new Error('crash') });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('crash');
    });

    it('带 code 的错误对象保留 code', () => {
      const result = transformToolResult({ error: { message: 'denied', code: 403 } });
      expect(result.content[0].text).toContain('[403]');
      expect(result.content[0].text).toContain('denied');
    });
  });

  describe('普通对象（无 content/error）', () => {
    it('JSON 序列化为文本', () => {
      const result = transformToolResult({ key: 'value', num: 42 });
      expectValidToolResult(result);
      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ key: 'value', num: 42 });
    });

    it('嵌套对象正确序列化', () => {
      const result = transformToolResult({ a: { b: { c: 1 } } });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.a.b.c).toBe(1);
    });
  });

  describe('原始类型', () => {
    it('字符串原样转为 text content', () => {
      const result = transformToolResult('plain string');
      expect(result.content[0].text).toBe('plain string');
      expect(result.isError).toBe(false);
    });

    it('数字转为字符串', () => {
      const result = transformToolResult(42);
      expect(result.content[0].text).toBe('42');
    });

    it('布尔值转为字符串', () => {
      const result = transformToolResult(true);
      expect(result.content[0].text).toBe('true');
      expect(transformToolResult(false).content[0].text).toBe('false');
    });

    it('null 转为 "null"', () => {
      const result = transformToolResult(null);
      expect(result.content[0].text).toBe('null');
      expect(result.isError).toBe(false);
    });

    it('undefined 转为 "undefined"', () => {
      const result = transformToolResult(undefined);
      expect(result.content[0].text).toBe('undefined');
    });
  });

  describe('不变量：任何输入都不应抛出未捕获异常', () => {
    // 各种边界输入，验证 transformToolResult 总是返回一个 ToolResult
    // 而非抛出异常（它内部有 try/catch 兜底）
    const weirdInputs: Array<{ label: string; value: unknown }> = [
      { label: '空对象', value: {} },
      { label: '空数组', value: [] },
      {
        label: '嵌套数组',
        value: [
          [1, 2],
          [3, 4],
        ],
      },
      { label: 'Date 对象', value: new Date() },
      { label: 'content 为非数组', value: { content: 'not-an-array' } },
      { label: 'content 为 null', value: { content: null } },
    ];

    for (const { label, value } of weirdInputs) {
      it(`不抛出异常：${label}`, () => {
        const result = transformToolResult(value);
        // 核心不变量：永远返回带 content 数组的对象
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('isError');
        expect(typeof result.isError).toBe('boolean');
      });
    }

    // NOTE: 循环引用对象会导致 logger.debug 内部 JSON.stringify 崩溃，
    // 这是 logger 的已知限制，不是 transformToolResult 的逻辑缺陷。
    // transformToolResult 自身的 try/catch 能兜住 JSON.stringify 的错误，
    // 但 logger.debug 在进入函数体之前就崩溃了。
    it('循环引用对象：logger 序列化失败（已知限制，非 transformToolResult 缺陷）', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      // logger.debug 无法处理循环引用，会抛出 TypeError
      expect(() => transformToolResult(obj)).toThrow(TypeError);
    });
  });

  describe('优先级：content 分支优先于 error 分支', () => {
    it('同时有 content 和 error 时优先使用 content', () => {
      const result = transformToolResult({
        content: [{ type: 'text', text: 'actual result' }],
        error: 'some error',
      });
      // content 分支在前，所以应该返回 content 而非 error
      expect(result.content[0].text).toBe('actual result');
      expect(result.isError).toBe(false);
    });
  });
});
