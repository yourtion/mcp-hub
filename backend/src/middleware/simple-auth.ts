/**
 * 简单的认证中间件
 * 在完整的JWT认证实现之前，使用此临时解决方案
 */

import type { Context, Next } from 'hono';

/**
 * 临时认证中间件
 * 检查Authorization头部的Bearer token
 * TODO: 替换为完整的JWT认证中间件
 */
export function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  // 检查是否有Authorization头部
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '缺少或无效的Authorization头部',
        },
        timestamp: new Date().toISOString(),
        path: c.req.path,
      },
      401,
    );
  }

  // 提取token（暂不验证，待JWT认证实现）
  const token = authHeader.substring(7);

  // TODO: 验证JWT token的有效性和权限

  // 继续处理请求
  return next();
}
