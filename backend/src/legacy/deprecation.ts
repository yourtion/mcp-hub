import type { MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger.js';

/**
 * Deprecation 中间件 - 为 legacy 端点添加弃用标记
 *
 * 根据 RFC 8594，添加以下响应头：
 * - Deprecation: true - 标记端点已弃用
 * - Sunset: <date> - 标记计划移除日期
 * - Link: <replacement> - 指向替代端点
 */
export function deprecationMiddleware(
  sunsetDate: string,
  replacementPath?: string,
): MiddlewareHandler {
  const headers: Record<string, string> = {
    Deprecation: 'true',
    Sunset: sunsetDate,
  };

  if (replacementPath) {
    headers.Link = `<${replacementPath}>; rel="successor-version"`;
  }

  return async (c, next) => {
    logger.warn('使用了已弃用的 legacy 端点', {
      path: c.req.path,
      method: c.req.method,
      sunsetDate,
      replacement: replacementPath,
    });

    await next();

    for (const [key, value] of Object.entries(headers)) {
      c.header(key, value);
    }
  };
}
