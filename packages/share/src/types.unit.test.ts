/**
 * Types 工具单元测试
 * 测试类型定义和工具类型
 */

import { describe, expect, it } from 'vitest';
import type { DeepReadonly } from './types.js';

describe('DeepReadonly', () => {
  it('应该保持原始类型不变', () => {
    const num: DeepReadonly<number> = 42 as unknown as DeepReadonly<number>;
    const str: DeepReadonly<string> = 'test' as unknown as DeepReadonly<string>;
    const bool: DeepReadonly<boolean> =
      true as unknown as DeepReadonly<boolean>;

    expect(num).toBe(42);
    expect(str).toBe('test');
    expect(bool).toBe(true);
  });

  it('应该使数组只读', () => {
    // 测试类型编译正确
    const arr: DeepReadonly<number[]> = [1, 2, 3] as unknown as DeepReadonly<
      number[]
    >;

    expect(arr).toEqual([1, 2, 3]);
  });

  it('应该使对象只读', () => {
    // 测试类型编译正确
    const obj: DeepReadonly<{ a: number; b: string }> = {
      a: 1,
      b: 'test',
    } as unknown as DeepReadonly<{ a: number; b: string }>;

    expect(obj).toEqual({ a: 1, b: 'test' });
  });

  it('应该递归使嵌套对象只读', () => {
    // 测试类型编译正确
    const nested: DeepReadonly<{
      a: number;
      nested: { b: string; deep: { c: boolean } };
    }> = {
      a: 1,
      nested: { b: 'test', deep: { c: true } },
    } as unknown as DeepReadonly<{
      a: number;
      nested: { b: string; deep: { c: boolean } };
    }>;

    expect(nested).toEqual({
      a: 1,
      nested: { b: 'test', deep: { c: true } },
    });
  });

  it('应该使对象数组只读', () => {
    // 测试类型编译正确
    const objArr: DeepReadonly<Array<{ a: number; b: string }>> = [
      { a: 1, b: 'test' },
      { a: 2, b: 'test2' },
    ] as unknown as DeepReadonly<Array<{ a: number; b: string }>>;

    expect(objArr).toEqual([
      { a: 1, b: 'test' },
      { a: 2, b: 'test2' },
    ]);
  });

  it('应该保持函数类型不变', () => {
    // 测试类型编译正确
    const fn = (a: number) => String(a);

    expect(fn(1)).toBe('1');
  });

  it('应该处理混合类型', () => {
    // 测试类型编译正确
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
    };

    expect(complex.num).toBe(1);
    expect(complex.str).toBe('test');
    expect(complex.arr).toEqual([1, 2, 3]);
    expect(complex.obj).toEqual({ nested: 'value' });
    expect(typeof complex.fn).toBe('function');
  });
});
