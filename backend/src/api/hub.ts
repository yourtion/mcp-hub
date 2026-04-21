import { Hono } from 'hono';

import { getHubService, getHubServiceSafe } from '../services/service-registry.js';
import { errorResponse, successResponse } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';
import { shutdownGroupsApi } from './groups/index.js';

export const hubApi = new Hono();

// Simple test endpoint that doesn't require service initialization
hubApi.get('/ping', async (c) => {
  return c.json({
    success: true,
    message: 'Hub API is running',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/health - Get server health status
hubApi.get('/health', async (c) => {
  try {
    const service = getHubServiceSafe();

    if (!service) {
      const requestId = c.get('requestId');
      return c.json(
        {
          success: false,
          data: {
            service: {
              status: 'initializing',
              isInitialized: false,
              message: 'MCP Hub Service is still initializing or failed to initialize',
            },
            timestamp: new Date().toISOString(),
          },
          requestId,
        },
        { status: 503 },
      );
    }

    const serverHealth = service.getServerHealth();
    const serviceStatus = await service.getDetailedServiceStatus();
    const apiToolHealth = service.getApiToolServiceHealth();

    const healthData = {
      service: {
        status: 'healthy',
        isInitialized: serviceStatus.isInitialized,
        serverCount: serviceStatus.serverCount,
        connectedServers: serviceStatus.connectedServers,
        groupCount: serviceStatus.groupCount,
        totalTools: serviceStatus.totalTools,
        apiTools: serviceStatus.apiTools,
      },
      servers: Object.fromEntries(serverHealth),
      apiToolService: apiToolHealth,
      timestamp: new Date().toISOString(),
    };

    const hasConnectedServers = serviceStatus.connectedServers > 0;
    const overallStatus = hasConnectedServers ? 'healthy' : 'degraded';

    logger.debug('Health status retrieved', {
      overallStatus,
      connectedServers: serviceStatus.connectedServers,
      totalServers: serviceStatus.serverCount,
      apiTools: serviceStatus.apiTools,
    });

    return successResponse(c, {
      ...healthData,
      service: {
        ...healthData.service,
        status: overallStatus,
      },
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

// GET /api/diagnostics - Get comprehensive service diagnostics
hubApi.get('/diagnostics', async (c) => {
  try {
    const service = getHubService();
    const diagnostics = await service.getServiceDiagnostics();

    logger.info('Service diagnostics retrieved', {
      serverCount: diagnostics.servers.total,
      connectedServers: diagnostics.servers.connected,
      groupCount: diagnostics.groups.total,
      apiTools: diagnostics.apiTools.totalTools,
    });

    return successResponse(c, diagnostics);
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

// GET /api/api-tools/health - Get API tool service health
hubApi.get('/api-tools/health', async (c) => {
  try {
    const service = getHubService();
    const health = await service.performApiToolHealthCheck();

    logger.debug('API tool health check completed', {
      healthy: health.healthy,
      initialized: health.initialized,
    });

    return successResponse(c, health);
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

// POST /api/api-tools/reload - Reload API tool configuration
hubApi.post('/api-tools/reload', async (c) => {
  try {
    const service = getHubService();
    await service.reloadApiToolConfig();

    logger.info('API tool configuration reloaded successfully');

    return successResponse(c, {
      message: 'API工具配置重新加载完成',
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

// Graceful shutdown handler for API
export async function shutdownHubApi(): Promise<void> {
  try {
    // 关闭组管理API
    await shutdownGroupsApi();

    logger.info('Hub API shutdown completed');
  } catch (error) {
    logger.error('Error during Hub API shutdown', error as Error);
    throw error;
  }
}
