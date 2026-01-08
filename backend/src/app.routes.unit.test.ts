/**
 * 路由注册验证测试
 * 确保所有必需的路由都已正确注册
 */

import { describe, expect, it } from 'vitest';
import { app } from './app.js';

describe('App Routes Registration', () => {
  it('should have all required routes registered', async () => {
    const requiredRoutes = [
      { path: '/api/groups', method: 'GET', description: 'Groups API' },
      { path: '/api/servers', method: 'GET', description: 'Servers API' },
      { path: '/api/tools', method: 'GET', description: 'Tools API' },
      { path: '/api/auth/login', method: 'POST', description: 'Auth API' },
      { path: '/api/config', method: 'GET', description: 'Config API' },
      {
        path: '/api/dashboard/stats',
        method: 'GET',
        description: 'Dashboard API',
      },
      { path: '/api/ping', method: 'GET', description: 'Health check' },
    ];

    for (const route of requiredRoutes) {
      const response = await app.request(route.path, {
        method: route.method,
      });

      // 404 表示路由未注册，其他状态码（200, 401, 405等）表示已注册
      expect(response.status).not.toBe(404);
    }
  });

  it('should handle /api/groups route correctly', async () => {
    const response = await app.request('/api/groups', {
      method: 'GET',
    });

    // 路由应该存在（不是404）
    // 可能返回 401（需要认证）或其他状态码，但不应该是404
    expect(response.status).not.toBe(404);
  });

  it('should handle /api/servers route correctly', async () => {
    const response = await app.request('/api/servers', {
      method: 'GET',
    });

    // 路由应该存在（不是404）
    expect(response.status).not.toBe(404);
  });

  it('should handle /api/tools route correctly', async () => {
    const response = await app.request('/api/tools', {
      method: 'GET',
    });

    // 路由应该存在（不是404）
    expect(response.status).not.toBe(404);
  });
});
