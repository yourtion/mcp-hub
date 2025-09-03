/**
 * 认证中间件
 */

import type { Context, Next } from 'hono';
import type { AuthService } from '../services/auth.js';
import type { AuthContext } from '../types/auth.js';

// 扩展Hono的Context类型以包含认证信息
declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

/**
 * 认证中间件工厂
 */
export function createAuthMiddleware(authService: AuthService) {
  /**
   * JWT认证中间件
   */
  return async function authMiddleware(c: Context, next: Next) {
    try {
      // 获取Authorization头
      const authHeader = c.req.header('Authorization');
      if (!authHeader) {
        return c.json(
          {
            success: false,
            error: {
              code: 'AUTH_MISSING_TOKEN',
              message: 'Authorization header is required',
            },
            timestamp: new Date().toISOString(),
            path: c.req.path,
          },
          401,
        );
      }

      // 解析Bearer token
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return c.json(
          {
            success: false,
            error: {
              code: 'AUTH_INVALID_FORMAT',
              message: 'Authorization header must be in format: Bearer <token>',
            },
            timestamp: new Date().toISOString(),
            path: c.req.path,
          },
          401,
        );
      }

      const token = parts[1];
      if (!token) {
        return c.json(
          {
            success: false,
            error: {
              code: 'AUTH_MISSING_TOKEN',
              message: 'Token is required',
            },
            timestamp: new Date().toISOString(),
            path: c.req.path,
          },
          401,
        );
      }

      // 验证token
      const payload = await authService.verifyAccessToken(token);

      // 设置认证上下文
      const authContext: AuthContext = {
        user: {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
        },
        payload,
      };

      c.set('auth', authContext);

      await next();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';

      let errorCode = 'AUTH_INVALID_TOKEN';
      if (errorMessage.includes('expired')) {
        errorCode = 'AUTH_TOKEN_EXPIRED';
      } else if (errorMessage.includes('revoked')) {
        errorCode = 'AUTH_TOKEN_REVOKED';
      }

      return c.json(
        {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        401,
      );
    }
  };
}

/**
 * 角色权限中间件工厂
 */
export function createRoleMiddleware(requiredRoles: string[]) {
  return async function roleMiddleware(c: Context, next: Next) {
    const auth = c.get('auth');

    if (!auth) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_CONTEXT_MISSING',
            message: 'Authentication context is missing',
          },
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        401,
      );
    }

    if (!requiredRoles.includes(auth.user.role)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_INSUFFICIENT_PERMISSIONS',
            message: `Required role: ${requiredRoles.join(' or ')}, current role: ${auth.user.role}`,
          },
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        403,
      );
    }

    await next();
  };
}

/**
 * 可选认证中间件工厂（不强制要求认证）
 */
export function createOptionalAuthMiddleware(authService: AuthService) {
  return async function optionalAuthMiddleware(c: Context, next: Next) {
    try {
      const authHeader = c.req.header('Authorization');
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
          try {
            const payload = await authService.verifyAccessToken(parts[1]);
            const authContext: AuthContext = {
              user: {
                id: payload.sub,
                username: payload.username,
                role: payload.role,
              },
              payload,
            };
            c.set('auth', authContext);
          } catch {
            // 忽略认证错误，继续处理请求
          }
        }
      }
      await next();
    } catch {
      // 忽略所有错误，继续处理请求
      await next();
    }
  };
}

/**
 * CORS中间件（用于处理跨域请求）
 */
export function corsMiddleware() {
  return async function cors(c: Context, next: Next) {
    // 设置CORS头
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Max-Age', '86400');

    // 处理预检请求
    if (c.req.method === 'OPTIONS') {
      c.status(204);
      return c.body(null);
    }

    await next();
  };
}

/**
 * 请求日志中间件
 */
export function requestLogMiddleware() {
  return async function requestLog(c: Context, next: Next) {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const userAgent = c.req.header('User-Agent') || 'Unknown';
    const ip =
      c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'Unknown';

    // 获取用户信息（如果已认证）
    let username = 'Anonymous';
    try {
      const auth = c.get('auth');
      if (auth) {
        username = auth.user.username;
      }
    } catch {
      // 忽略错误
    }

    console.log(
      `[${new Date().toISOString()}] ${method} ${path} - ${username} (${ip})`,
    );

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    console.log(
      `[${new Date().toISOString()}] ${method} ${path} - ${status} (${duration}ms) - ${username}`,
    );
  };
}

/**
 * 错误处理中间件
 */
export function errorHandlerMiddleware() {
  return async function errorHandler(c: Context, next: Next) {
    try {
      await next();
    } catch (error) {
      console.error('Unhandled error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';

      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        500,
      );
    }
  };
}
