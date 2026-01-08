/**
 * Types 工具单元测试
 * 测试类型定义和工具类型
 */

import { describe, expect, it } from 'vitest';
import type { DeepReadonly } from './types.js';

describe('DeepReadonly', () => {
  it('应该保持原始类型不变', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const num: DeepReadonly<number> = 42 as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str: DeepReadonly<string> = 'test' as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bool: DeepReadonly<boolean> = true as any;

    expect(num).toBe(42);
    expect(str).toBe('test');
    expect(bool).toBe(true);
  });

  it('应该使数组只读', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: DeepReadonly<number[]> = [1, 2, 3] as any;

    expect(arr).toEqual([1, 2, 3]);
  });

  it('应该使对象只读', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: DeepReadonly<{ a: number; b: string }> = { a: 1, b: 'test' } as any;

    expect(obj).toEqual({ a: 1, b: 'test' });
  });

  it('应该递归使嵌套对象只读', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nested: DeepReadonly<{
      a: number;
      nested: { b: string; deep: { c: boolean } };
    }> = { a: 1, nested: { b: 'test', deep: { c: true } } } as any;

    expect(nested).toEqual({
      a: 1,
      nested: { b: 'test', deep: { c: true } },
    });
  });

  it('应该使对象数组只读', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objArr: DeepReadonly<
      Array<{ a: number; b: string }>
    > = [{ a: 1, b: 'test' }, { a: 2, b: 'test2' }] as any;

    expect(objArr).toEqual([
      { a: 1, b: 'test' },
      { a: 2, b: 'test2' },
    ]);
  });

  it('应该保持函数类型不变', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn: DeepReadonly<(a: number) => string> = ((a: number) =>
      String(a)) as any;

    expect(fn(1)).toBe('1');
  });

  it('应该处理混合类型', () => {
    // 测试类型编译正确
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const complex: DeepReadonly<{
      num: number;
      str: string;
      arr: number[];
      obj: { nested: string };
      fn: (x: number) => number;
    }> = {
      num: 1,
      str: 'test',
      arr: [1, 2, 3],
      obj: { nested: 'value' },
      fn: (x: number) => x * 2,
    } as any;

    expect(complex.num).toBe(1);
    expect(complex.str).toBe('test');
    expect(complex.arr).toEqual([1, 2, 3]);
    expect(complex.obj).toEqual({ nested: 'value' });
    expect(complex.fn(2)).toBe(4);
  });
});
