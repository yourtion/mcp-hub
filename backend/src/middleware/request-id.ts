/**
 * Request ID 中间件
 * 为每个请求生成唯一 ID，用于追踪和日志关联
 */
import type { Context, Next } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * 生成唯一请求 ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Request ID 中间件
 * 为每个请求生成唯一 ID 并注入到上下文
 */
export async function requestIdMiddleware(
  c: Context,
  next: Next,
): Promise<void> {
  const requestId = c.req.header('X-Request-ID') || generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
}
