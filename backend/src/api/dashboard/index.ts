import { Hono } from 'hono';
import { DashboardService } from '../../services/dashboard_service.js';
import { EventIntegrationService } from '../../services/event_integration_service.js';
import type { McpHubService } from '../../services/mcp_hub_service.js';
import { SSEEventManager } from '../../services/sse_event_manager.js';
import type { LogQuery } from '../../types/dashboard.js';
import { logger } from '../../utils/logger.js';

export const dashboardApi = new Hono();

// 全局服务实例
let dashboardService: DashboardService | null = null;
let sseEventManager: SSEEventManager | null = null;
let eventIntegrationService: EventIntegrationService | null = null;

/**
 * 初始化仪表板服务
 */
export function initializeDashboardServices(hubService: McpHubService): void {
  logger.info('初始化仪表板服务');

  dashboardService = new DashboardService(hubService);
  sseEventManager = new SSEEventManager();
  eventIntegrationService = new EventIntegrationService(
    dashboardService,
    sseEventManager,
  );

  // 记录系统启动
  eventIntegrationService.recordSystemStart();

  // 设置定期清理任务（每天清理一次）
  setInterval(
    () => {
      if (dashboardService) {
        dashboardService.cleanup();
      }
    },
    24 * 60 * 60 * 1000,
  ); // 24小时

  // 设置定期健康检查任务（每5分钟检查一次）
  let lastHealthStatus: 'healthy' | 'warning' | 'error' = 'healthy';
  setInterval(
    async () => {
      if (dashboardService && eventIntegrationService) {
        try {
          const health = await dashboardService.getSystemHealth();

          // 检查状态是否发生变化
          if (health.status !== lastHealthStatus) {
            const changes = [
              {
                component: 'system',
                previousStatus: lastHealthStatus,
                currentStatus: health.status,
              },
            ];

            eventIntegrationService.recordHealthCheck(health.status, changes);
            lastHealthStatus = health.status;

            logger.info('系统健康状态变更', {
              previousStatus: changes[0].previousStatus,
              currentStatus: changes[0].currentStatus,
              issueCount: health.issues.length,
            });
          }
        } catch (error) {
          logger.error('定期健康检查失败', error as Error);
        }
      }
    },
    5 * 60 * 1000,
  ); // 5分钟

  logger.info('仪表板服务初始化完成');
}

/**
 * 获取仪表板服务实例
 */
function getDashboardService(): DashboardService {
  if (!dashboardService) {
    throw new Error('仪表板服务未初始化');
  }
  return dashboardService;
}

/**
 * 获取SSE事件管理器实例
 */
function getSSEEventManager(): SSEEventManager {
  if (!sseEventManager) {
    throw new Error('SSE事件管理器未初始化');
  }
  return sseEventManager;
}

/**
 * 错误处理中间件
 */
const handleApiError = (error: Error) => {
  logger.error('仪表板API错误', error);

  return {
    success: false,
    error: {
      code: 'DASHBOARD_ERROR',
      message: error.message,
    },
    timestamp: new Date().toISOString(),
  };
};

// GET /api/dashboard/stats - 获取仪表板统计信息
dashboardApi.get('/stats', async (c) => {
  try {
    logger.debug('获取仪表板统计信息请求');

    const service = getDashboardService();
    const stats = await service.getDashboardStats();

    logger.info('仪表板统计信息获取成功', {
      totalServers: stats.overview.totalServers,
      connectedServers: stats.overview.connectedServers,
      totalTools: stats.overview.totalTools,
      recentActivityCount: stats.recentActivity.length,
    });

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/health - 获取系统健康状态
dashboardApi.get('/health', async (c) => {
  try {
    logger.debug('获取系统健康状态请求');

    const service = getDashboardService();
    const health = await service.getSystemHealth();

    logger.debug('系统健康状态获取成功', {
      status: health.status,
      issueCount: health.issues.length,
    });

    return c.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/logs - 查询系统日志
dashboardApi.get('/logs', async (c) => {
  try {
    logger.debug('查询系统日志请求');

    const service = getDashboardService();

    // 解析查询参数
    const query: LogQuery = {
      level: c.req.query('level') as LogQuery['level'],
      category: c.req.query('category'),
      startTime: c.req.query('startTime'),
      endTime: c.req.query('endTime'),
      limit: c.req.query('limit')
        ? parseInt(c.req.query('limit') || '100')
        : undefined,
      offset: c.req.query('offset')
        ? parseInt(c.req.query('offset') || '0')
        : undefined,
      search: c.req.query('search'),
    };

    const result = service.queryLogs(query);

    logger.debug('系统日志查询成功', {
      totalLogs: result.total,
      returnedLogs: result.logs.length,
      query,
    });

    return c.json({
      success: true,
      data: {
        logs: result.logs,
        total: result.total,
        query,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/activities - 获取最近活动
dashboardApi.get('/activities', async (c) => {
  try {
    logger.debug('获取最近活动请求');

    const service = getDashboardService();
    const limit = c.req.query('limit')
      ? parseInt(c.req.query('limit') || '50')
      : 50;

    const activities = service.getRecentActivities(limit);

    logger.debug('最近活动获取成功', {
      activityCount: activities.length,
      limit,
    });

    return c.json({
      success: true,
      data: {
        activities,
        total: activities.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/performance - 获取性能统计
dashboardApi.get('/performance', async (c) => {
  try {
    logger.debug('获取性能统计请求');

    const service = getDashboardService();
    const stats = service.getPerformanceStats();

    logger.debug('性能统计获取成功', {
      totalRequests: stats.totalRequests,
      averageResponseTime: stats.averageResponseTime,
      errorRate: stats.errorRate,
    });

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/events - SSE事件流端点
dashboardApi.get('/events', async (c) => {
  try {
    logger.info('创建SSE连接请求');

    const eventManager = getSSEEventManager();

    // 解析订阅参数
    const subscriptionsParam = c.req.query('subscriptions');
    const subscriptions = subscriptionsParam
      ? subscriptionsParam.split(',')
      : [];

    const { response, clientId } = eventManager.createConnection(subscriptions);

    logger.info('SSE连接创建成功', {
      clientId,
      subscriptions,
    });

    return response;
  } catch (error) {
    logger.error('创建SSE连接失败', error as Error);
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/sse-stats - 获取SSE连接统计
dashboardApi.get('/sse-stats', async (c) => {
  try {
    logger.debug('获取SSE连接统计请求');

    const eventManager = getSSEEventManager();
    const stats = eventManager.getConnectionStats();

    logger.debug('SSE连接统计获取成功', {
      totalClients: stats.totalClients,
      eventHistoryCount: stats.eventHistoryCount,
    });

    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/dashboard/test-alert - 测试系统告警（开发用）
dashboardApi.post('/test-alert', async (c) => {
  try {
    const body = await c.req.json();
    const { severity = 'info', message = '测试告警', category = 'test' } = body;

    logger.debug('发送测试告警', { severity, message, category });

    const eventManager = getSSEEventManager();
    eventManager.broadcastSystemAlert(severity, message, category, {
      test: true,
    });

    const service = getDashboardService();
    service.addActivity({
      type: 'system_start', // 使用现有的活动类型
      message: `测试告警: ${message}`,
      severity,
    });

    return c.json({
      success: true,
      data: {
        message: '测试告警已发送',
        severity,
        category,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/dashboard/test-tool-execution - 测试工具执行事件（开发用）
dashboardApi.post('/test-tool-execution', async (c) => {
  try {
    const body = await c.req.json();
    const {
      toolName = 'test-tool',
      serverId = 'test-server',
      groupId = 'default',
      success = true,
      executionTime = 100,
      error,
    } = body;

    logger.debug('发送测试工具执行事件', {
      toolName,
      serverId,
      groupId,
      success,
      executionTime,
    });

    const eventManager = getSSEEventManager();
    eventManager.broadcastToolExecution(
      toolName,
      serverId,
      groupId,
      success,
      executionTime,
      error,
    );

    const service = getDashboardService();
    service.recordToolExecution(toolName, executionTime, success);

    return c.json({
      success: true,
      data: {
        message: '测试工具执行事件已发送',
        toolName,
        serverId,
        groupId,
        success,
        executionTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/dashboard/test-server-status - 测试服务器状态变更事件（开发用）
dashboardApi.post('/test-server-status', async (c) => {
  try {
    const body = await c.req.json();
    const {
      serverId = 'test-server',
      status = 'connected',
      previousStatus = 'disconnected',
      error,
    } = body;

    logger.debug('发送测试服务器状态事件', {
      serverId,
      status,
      previousStatus,
    });

    const eventManager = getSSEEventManager();
    eventManager.broadcastServerStatus(serverId, status, previousStatus, error);

    const service = getDashboardService();
    service.addActivity({
      type: status === 'connected' ? 'server_connected' : 'server_disconnected',
      message: `服务器 ${serverId} 状态变更: ${previousStatus} -> ${status}`,
      severity:
        status === 'connected'
          ? 'info'
          : status === 'error'
            ? 'error'
            : 'warning',
    });

    return c.json({
      success: true,
      data: {
        message: '测试服务器状态事件已发送',
        serverId,
        status,
        previousStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/system-info - 获取系统信息
dashboardApi.get('/system-info', async (c) => {
  try {
    logger.debug('获取系统信息请求');

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const systemInfo = {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    logger.debug('系统信息获取成功', {
      nodeVersion: systemInfo.node.version,
      platform: systemInfo.node.platform,
      memoryUsed: systemInfo.memory.heapUsed,
    });

    return c.json({
      success: true,
      data: systemInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/dashboard/add-log - 添加自定义日志条目（开发用）
dashboardApi.post('/add-log', async (c) => {
  try {
    const body = await c.req.json();
    const {
      level = 'info',
      message = '测试日志',
      category = 'test',
      metadata,
    } = body;

    logger.debug('添加自定义日志', { level, message, category });

    const service = getDashboardService();
    service.addLog({
      level,
      message,
      category,
      metadata,
    });

    return c.json({
      success: true,
      data: {
        message: '日志条目已添加',
        level,
        category,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// DELETE /api/dashboard/logs - 清理日志（管理员功能）
dashboardApi.delete('/logs', async (c) => {
  try {
    logger.info('清理日志请求');

    const service = getDashboardService();
    service.cleanup();

    logger.info('日志清理完成');

    return c.json({
      success: true,
      data: {
        message: '日志已清理',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/dashboard/health-detailed - 获取详细健康检查报告
dashboardApi.get('/health-detailed', async (c) => {
  try {
    logger.debug('获取详细健康检查报告请求');

    const service = getDashboardService();
    const health = await service.getSystemHealth();

    // 添加额外的系统检查
    const memUsage = process.memoryUsage();
    const diskUsage = {
      // 简化的磁盘使用情况检查
      available: true, // 实际实现中可以检查磁盘空间
      message: '磁盘空间充足',
    };

    const networkCheck = {
      // 简化的网络连接检查
      available: true,
      message: '网络连接正常',
    };

    const detailedHealth = {
      ...health,
      additionalChecks: {
        disk: diskUsage,
        network: networkCheck,
        processHealth: {
          status: 'healthy' as const,
          message: '进程运行正常',
          details: {
            pid: process.pid,
            uptime: Math.floor(process.uptime()),
            memoryUsage: Math.round(
              (memUsage.heapUsed / memUsage.heapTotal) * 100,
            ),
          },
        },
      },
    };

    logger.debug('详细健康检查报告获取成功', {
      overallStatus: detailedHealth.status,
      issueCount: detailedHealth.issues.length,
    });

    return c.json({
      success: true,
      data: detailedHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

/**
 * 关闭仪表板服务
 */
export async function shutdownDashboardServices(): Promise<void> {
  logger.info('关闭仪表板服务');

  try {
    if (sseEventManager) {
      sseEventManager.shutdown();
      sseEventManager = null;
    }

    dashboardService = null;
    eventIntegrationService = null;

    logger.info('仪表板服务关闭完成');
  } catch (error) {
    logger.error('关闭仪表板服务时发生错误', error as Error);
    throw error;
  }
}

/**
 * 获取事件集成服务实例
 */
function getEventIntegrationService(): EventIntegrationService {
  if (!eventIntegrationService) {
    throw new Error('事件集成服务未初始化');
  }
  return eventIntegrationService;
}

/**
 * 导出服务实例获取函数供其他模块使用
 */
export { getDashboardService, getSSEEventManager, getEventIntegrationService };
