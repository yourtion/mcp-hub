/**
 * 性能监控API
 * 提供性能指标查询和分析接口
 */

import { Hono } from 'hono';
import { performanceMonitor } from '../../utils/performance-monitor.js';

export const performanceApi = new Hono();

/**
 * 获取性能统计
 */
performanceApi.get('/stats', (c) => {
  const timeWindow = c.req.query('timeWindow');
  const window = timeWindow ? Number.parseInt(timeWindow, 10) : undefined;

  const stats = performanceMonitor.getStats(window);

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * 获取按端点分组的统计
 */
performanceApi.get('/stats/by-endpoint', (c) => {
  const stats = performanceMonitor.getStatsByEndpoint();

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * 获取慢请求列表
 */
performanceApi.get('/slow-requests', (c) => {
  const thresholdParam = c.req.query('threshold');
  const threshold = thresholdParam ? Number.parseInt(thresholdParam, 10) : 1000;

  const slowRequests = performanceMonitor.getSlowRequests(threshold);

  return c.json({
    success: true,
    data: {
      threshold,
      count: slowRequests.length,
      requests: slowRequests,
    },
  });
});

/**
 * 获取最近的错误请求
 */
performanceApi.get('/recent-errors', (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 10;

  const errors = performanceMonitor.getRecentErrors(limit);

  return c.json({
    success: true,
    data: {
      count: errors.length,
      errors,
    },
  });
});

/**
 * 获取所有性能指标
 */
performanceApi.get('/metrics', (c) => {
  const metrics = performanceMonitor.getMetrics();

  return c.json({
    success: true,
    data: {
      count: metrics.length,
      metrics,
    },
  });
});

/**
 * 清除性能指标
 */
performanceApi.delete('/metrics', (c) => {
  performanceMonitor.clear();

  return c.json({
    success: true,
    message: '性能指标已清除',
  });
});

/**
 * 获取性能报告
 */
performanceApi.get('/report', (c) => {
  const stats = performanceMonitor.getStats();
  const statsByEndpoint = performanceMonitor.getStatsByEndpoint();
  const slowRequests = performanceMonitor.getSlowRequests(1000);
  const recentErrors = performanceMonitor.getRecentErrors(10);

  return c.json({
    success: true,
    data: {
      overview: stats,
      byEndpoint: statsByEndpoint,
      slowRequests: {
        count: slowRequests.length,
        requests: slowRequests.slice(0, 10), // 只返回前10个
      },
      recentErrors: {
        count: recentErrors.length,
        errors: recentErrors,
      },
      generatedAt: new Date().toISOString(),
    },
  });
});
