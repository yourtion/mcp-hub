import type { GroupConfig, ServerConfig } from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { McpHubService } from '../services/mcp_hub_service.js';
import { errorResponse, successResponse } from '../utils/api-response.js';
import { getAllConfig } from '../utils/config.js';
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

// Global hub service instance
let hubService: McpHubService | null = null;

// Initialize the hub service
async function getHubService(): Promise<McpHubService> {
  if (hubService) {
    return hubService;
  }

  try {
    logger.info('Initializing MCP Hub Service for API');

    // Load configurations
    const config = await getAllConfig();

    // Create hub service instance
    hubService = new McpHubService(
      config.mcps.servers as Record<string, ServerConfig>,
      config.groups as GroupConfig,
      config.apiToolsConfigPath,
    );

    // Initialize the service with timeout
    const initPromise = hubService.initialize();
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Service initialization timeout')),
        30000,
      );
      timeoutId.unref?.();
    });

    await Promise.race([initPromise, timeoutPromise]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    logger.info('MCP Hub Service initialized successfully for API');
    return hubService;
  } catch (error) {
    logger.error(
      'Failed to initialize MCP Hub Service for API',
      error as Error,
    );
    // Reset hubService so it can be retried
    hubService = null;
    throw error;
  }
}

// Get hub service with error handling
async function getHubServiceSafe(): Promise<McpHubService | null> {
  try {
    return await getHubService();
  } catch (error) {
    logger.error('Hub service not available', error as Error);
    return null;
  }
}

// GET /api/groups - List all available groups
// POST /api/tools/:toolName/execute - Execute a tool (default group)
// GET /api/health - Get server health status
hubApi.get('/health', async (c) => {
  try {
    const service = await getHubServiceSafe();

    if (!service) {
      const requestId = c.get('requestId');
      return c.json(
        {
          success: false,
          data: {
            service: {
              status: 'initializing',
              isInitialized: false,
              message:
                'MCP Hub Service is still initializing or failed to initialize',
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

    // Determine overall health
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
    const service = await getHubService();
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
    const service = await getHubService();
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
    const service = await getHubService();
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

    // 关闭Hub服务
    if (hubService) {
      logger.info('Shutting down Hub API service');
      await hubService.shutdown();
      hubService = null;
    }

    logger.info('Hub API shutdown completed');
  } catch (error) {
    logger.error('Error during Hub API shutdown', error as Error);
    throw error;
  }
}

// Export the getHubService function for use in other modules
export { getHubService };
