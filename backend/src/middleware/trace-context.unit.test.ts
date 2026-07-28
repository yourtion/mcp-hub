import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';

import {
  type TraceContext,
  extractFromHeaders,
  extractFromMeta,
  getCurrentTraceContext,
  hasTraceContext,
  runWithTraceContext,
} from './trace-context.js';

describe('trace-context', () => {
  describe('extractFromMeta', () => {
    it('从 _meta 提取 trace 三件套', () => {
      const meta = {
        traceparent: '00-traceid-spanid-01',
        tracestate: 'vendor=congo',
        baggage: 'key=value',
      };
      expect(extractFromMeta(meta)).toEqual({
        traceparent: '00-traceid-spanid-01',
        tracestate: 'vendor=congo',
        baggage: 'key=value',
      });
    });

    it('缺失字段返回 undefined', () => {
      expect(extractFromMeta({ traceparent: '00-t-s-01' })).toEqual({
        traceparent: '00-t-s-01',
        tracestate: undefined,
        baggage: undefined,
      });
    });

    it('undefined 入参返回空对象', () => {
      expect(extractFromMeta(undefined)).toEqual({
        traceparent: undefined,
        tracestate: undefined,
        baggage: undefined,
      });
    });

    it('非字符串字段忽略', () => {
      expect(extractFromMeta({ traceparent: 123, tracestate: true })).toEqual({
        traceparent: undefined,
        tracestate: undefined,
        baggage: undefined,
      });
    });
  });

  describe('extractFromHeaders', () => {
    it('从 W3C HTTP header 提取', () => {
      const headers = new Headers();
      headers.set('traceparent', '00-traceid-spanid-01');
      headers.set('tracestate', 'vendor=congo');
      headers.set('baggage', 'key=value');
      expect(extractFromHeaders(headers)).toEqual({
        traceparent: '00-traceid-spanid-01',
        tracestate: 'vendor=congo',
        baggage: 'key=value',
      });
    });

    it('header 缺失返回 undefined', () => {
      const headers = new Headers();
      expect(extractFromHeaders(headers)).toEqual({
        traceparent: undefined,
        tracestate: undefined,
        baggage: undefined,
      });
    });
  });

  describe('hasTraceContext', () => {
    it('三字段全空返回 false', () => {
      expect(hasTraceContext({})).toBe(false);
      expect(
        hasTraceContext({
          traceparent: undefined,
          tracestate: undefined,
          baggage: undefined,
        }),
      ).toBe(false);
    });

    it('任一字段非空返回 true', () => {
      expect(hasTraceContext({ traceparent: '00-t-s-01' })).toBe(true);
      expect(hasTraceContext({ tracestate: 'v=c' })).toBe(true);
      expect(hasTraceContext({ baggage: 'k=v' })).toBe(true);
    });
  });

  describe('runWithTraceContext + getCurrentTraceContext', () => {
    it('scope 内可读取注入的 context', async () => {
      const ctx: TraceContext = {
        traceparent: '00-traceid-spanid-01',
        tracestate: 'vendor=congo',
      };
      await runWithTraceContext(ctx, async () => {
        expect(getCurrentTraceContext()).toEqual(ctx);
      });
    });

    it('scope 外 getCurrentTraceContext 返回空对象（不抛错）', async () => {
      // 不在任何 runWithTraceContext scope 内
      expect(getCurrentTraceContext()).toEqual({});
    });

    it('空 context（三字段全空）不阻断 fn 执行', async () => {
      const result = await runWithTraceContext({}, async () => {
        return 'ran';
      });
      expect(result).toBe('ran');
      expect(hasTraceContext(getCurrentTraceContext())).toBe(false);
    });

    it('并发请求 context 互不串扰（scope 隔离）', async () => {
      const ctxA: TraceContext = { traceparent: '00-A-1-01' };
      const ctxB: TraceContext = { traceparent: '00-B-1-01' };

      const run = (ctx: TraceContext, marker: string) =>
        runWithTraceContext(ctx, async () => {
          // 故意让出事件循环，模拟并发交错
          await new Promise((r) => setTimeout(r, 10));
          return `${marker}:${getCurrentTraceContext().traceparent}`;
        });

      const [a, b] = await Promise.all([run(ctxA, 'A'), run(ctxB, 'B')]);
      expect(a).toBe('A:00-A-1-01');
      expect(b).toBe('B:00-B-1-01');
    });

    it('嵌套 scope 内层覆盖外层', async () => {
      const outer: TraceContext = { traceparent: '00-OUTER-1-01' };
      const inner: TraceContext = { traceparent: '00-INNER-1-01' };
      await runWithTraceContext(outer, async () => {
        expect(getCurrentTraceContext().traceparent).toBe('00-OUTER-1-01');
        await runWithTraceContext(inner, async () => {
          expect(getCurrentTraceContext().traceparent).toBe('00-INNER-1-01');
        });
        expect(getCurrentTraceContext().traceparent).toBe('00-OUTER-1-01');
      });
    });
  });

  it('AsyncLocalStorage 已被 Node 全局支持（环境健康检查）', () => {
    expect(AsyncLocalStorage).toBeDefined();
  });
});
