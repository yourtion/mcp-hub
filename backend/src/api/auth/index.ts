/**
 * 认证API路由
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthService } from '../../services/auth.js';

/**
 * 登录请求验证模式
 */
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

/**
 * 刷新token请求验证模式
 */
const refreshSchema = z.object({
  refreshToken: z.string().min(1, '刷新token不能为空'),
});

/**
 * 创建认证API路由
 */
export function createAuthApi(authService: AuthService) {
  const authApi = new Hono();

  /**
   * POST /api/auth/login - 用户登录
   */
  authApi.post('/login', zValidator('json', loginSchema), async (c) => {
    try {
      const { username, password } = c.req.valid('json');

      // 获取客户端信息
      const ip =
        c.req.header('X-Forwarded-For') ||
        c.req.header('X-Real-IP') ||
        c.req.header('CF-Connecting-IP') ||
        'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';

      // 执行登录
      const result = await authService.login(username, password, ip, userAgent);

      // 记录成功登录日志
      console.log(`[AUTH] 用户登录成功: ${username} (${ip})`);

      return c.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';

      // 记录失败登录日志
      const { username } = c.req.valid('json');
      const ip =
        c.req.header('X-Forwarded-For') ||
        c.req.header('X-Real-IP') ||
        'unknown';
      console.warn(
        `[AUTH] 用户登录失败: ${username} (${ip}) - ${errorMessage}`,
      );

      // 根据错误类型返回不同的错误码
      let errorCode = 'AUTH_LOGIN_FAILED';
      let statusCode: 401 | 423 | 500 = 401;

      if (errorMessage.includes('locked')) {
        errorCode = 'AUTH_ACCOUNT_LOCKED';
        statusCode = 423; // Locked
      } else if (errorMessage.includes('Invalid username or password')) {
        errorCode = 'AUTH_INVALID_CREDENTIALS';
      } else if (errorMessage.includes('not initialized')) {
        errorCode = 'AUTH_SERVICE_ERROR';
        statusCode = 500;
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
        statusCode,
      );
    }
  });

  /**
   * POST /api/auth/refresh - 刷新访问token
   */
  authApi.post('/refresh', zValidator('json', refreshSchema), async (c) => {
    try {
      const { refreshToken } = c.req.valid('json');

      const result = await authService.refreshAccessToken(refreshToken);

      console.log('[AUTH] Token刷新成功');

      return c.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Token刷新失败';

      console.warn(`[AUTH] Token刷新失败: ${errorMessage}`);

      let errorCode = 'AUTH_REFRESH_FAILED';
      if (errorMessage.includes('Invalid refresh token')) {
        errorCode = 'AUTH_INVALID_REFRESH_TOKEN';
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
  });

  /**
   * POST /api/auth/logout - 用户登出
   */
  authApi.post('/logout', async (c) => {
    try {
      // 从Authorization头获取token
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

      const accessToken = parts[1];
      if (!accessToken) {
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

      // 执行登出
      await authService.logout(accessToken);

      console.log('[AUTH] 用户登出成功');

      return c.json({
        success: true,
        message: '登出成功',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登出失败';

      console.warn(`[AUTH] 用户登出失败: ${errorMessage}`);

      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_LOGOUT_FAILED',
            message: errorMessage,
          },
          timestamp: new Date().toISOString(),
          path: c.req.path,
        },
        500,
      );
    }
  });

  /**
   * GET /api/auth/me - 获取当前用户信息（需要认证）
   */
  authApi.get('/me', async (c) => {
    try {
      // 从Authorization头获取token
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

      const accessToken = parts[1];
      if (!accessToken) {
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

      // 验证token并获取用户信息
      const payload = await authService.verifyAccessToken(accessToken);
      const user = authService.getUserById(payload.sub);

      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              code: 'AUTH_USER_NOT_FOUND',
              message: 'User not found',
            },
            timestamp: new Date().toISOString(),
            path: c.req.path,
          },
          404,
        );
      }

      return c.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            groups: user.groups,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '获取用户信息失败';

      let errorCode = 'AUTH_INVALID_TOKEN';
      const statusCode = 401;

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
        statusCode,
      );
    }
  });

  return authApi;
}
