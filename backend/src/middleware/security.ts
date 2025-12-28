/**
 * 安全头中间件
 * 添加 Hono 推荐的安全响应头
 */

import type { Context, Next } from 'hono';

/**
 * 安全头中间件
 * 添加安全相关的 HTTP 响应头
 */
export function secureHeadersMiddleware() {
  return async function secureHeaders(c: Context, next: Next) {
    // 基本安全头
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (基础版本)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    c.header('Content-Security-Policy', csp);

    // 权限策略
    c.header(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()',
    );

    await next();
  };
}
