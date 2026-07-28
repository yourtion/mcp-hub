/**
 * OTel trace context 请求作用域透传（P6 / SEP-414）
 *
 * Hub 作为网关，从 MCP 客户端请求的 _meta 提取 W3C trace context
 * （traceparent/tracestate/baggage），用 AsyncLocalStorage 在请求异步链内透传，
 * 调用上游 server 时注入回 _meta。纯字符串透传：不解析、不采样、不生成 span。
 *
 * _meta 是 SEP-414 的唯一 MCP 协议载体（transport-agnostic：stdio 无 HTTP header，
 * _meta 是所有 transport 共有的扩展点）。
 *
 * 零 OTel SDK 依赖。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** W3C Trace Context 三件套（纯字符串透传，不解析） */
export interface TraceContext {
  traceparent?: string;
  tracestate?: string;
  baggage?: string;
}

const traceContextStore = new AsyncLocalStorage<TraceContext>();

/**
 * 从 MCP 请求 _meta 提取 trace context（SEP-414 官方载体）。
 * 非字符串字段忽略，缺失字段返回 undefined。
 */
export function extractFromMeta(meta?: Record<string, unknown>): TraceContext {
  if (!meta) {
    return { traceparent: undefined, tracestate: undefined, baggage: undefined };
  }
  return {
    traceparent: typeof meta.traceparent === 'string' ? meta.traceparent : undefined,
    tracestate: typeof meta.tracestate === 'string' ? meta.tracestate : undefined,
    baggage: typeof meta.baggage === 'string' ? meta.baggage : undefined,
  };
}

/**
 * 从 W3C HTTP header 提取 trace context（兼容非 MCP 标准客户端）。
 */
export function extractFromHeaders(headers: Headers): TraceContext {
  return {
    traceparent: headers.get('traceparent') ?? undefined,
    tracestate: headers.get('tracestate') ?? undefined,
    baggage: headers.get('baggage') ?? undefined,
  };
}

/**
 * 判断 context 是否含有效字段（决定是否注入）。
 */
export function hasTraceContext(ctx: TraceContext): boolean {
  return Boolean(ctx.traceparent || ctx.tracestate || ctx.baggage);
}

/**
 * 在请求作用域内运行 fn，注入 context 到 AsyncLocalStorage。
 *
 * 三字段全空时仍正常执行 fn（以空对象进 scope），不阻断流程。
 */
export function runWithTraceContext<T>(ctx: TraceContext, fn: () => Promise<T>): Promise<T> {
  return traceContextStore.run(hasTraceContext(ctx) ? ctx : {}, fn);
}

/**
 * 出站读取当前请求作用域的 context（无 scope 则返回空对象，不抛错）。
 */
export function getCurrentTraceContext(): TraceContext {
  return traceContextStore.getStore() ?? {};
}
