import type { GroupConfig } from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { McpHubService } from '../services/mcp_hub_service.js';
import { getAllConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { groupsApi, shutdownGroupsApi } from './groups/index.js';

export const hubApi = new Hono();

// 集成组管理API
hubApi.route('/groups', groupsApi);

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
      config.mcps.mcpServers,
      config.groups as GroupConfig,
      config.apiToolsConfigPath,
    );

    // Initialize the service with timeout
    const initPromise = hubService.initialize();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Service initialization timeout')),
        30000,
      );
    });

    await Promise.race([initPromise, timeoutPromise]);

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

// Error handler middleware
const handleApiError = (error: Error) => {
  logger.error('API error', error);

  const errorResponse = McpHubService.formatErrorResponse(error);

  return {
    success: false,
    error: errorResponse.error,
    timestamp: new Date().toISOString(),
  };
};

// GET /api/groups - List all available groups
hubApi.get('/groups', async (c) => {
  try {
    const service = await getHubService();
    const groups = service.getAllGroups();

    const groupList = Array.from(groups.values()).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      serverCount: group.servers.length,
      toolCount: group.tools.length,
    }));

    logger.info('Groups listed successfully', {
      groupCount: groupList.length,
      groups: groupList.map((g) => g.id),
    });

    return c.json({
      success: true,
      data: {
        groups: groupList,
        total: groupList.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/groups/:groupId - Get specific group information
hubApi.get('/groups/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const service = await getHubService();

    const group = service.getGroupInfo(groupId);

    if (!group) {
      return c.json(
        {
          success: false,
          error: {
            code: 'GROUP_NOT_FOUND',
            message: `Group '${groupId}' not found`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // Get additional runtime information
    const serverHealth = service.getServerHealth();
    const connectedServers = group.servers.filter(
      (serverId) => serverHealth.get(serverId) === 'connected',
    );

    logger.info('Group information retrieved', {
      groupId,
      groupName: group.name,
      connectedServers: connectedServers.length,
      totalServers: group.servers.length,
    });

    return c.json({
      success: true,
      data: {
        ...group,
        connectedServers: connectedServers.length,
        serverHealth: Object.fromEntries(
          group.servers.map((serverId) => [
            serverId,
            serverHealth.get(serverId) || 'unknown',
          ]),
        ),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/groups/:groupId/tools - List tools available in a specific group
hubApi.get('/groups/:groupId/tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const service = await getHubService();

    const tools = await service.listTools(groupId);

    logger.info('Tools listed for group', {
      groupId,
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
    });

    return c.json({
      success: true,
      data: {
        groupId,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          inputSchema: tool.inputSchema,
        })),
        total: tools.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools - List all tools (default group)
hubApi.get('/tools', async (c) => {
  try {
    const service = await getHubService();
    const tools = await service.listTools(); // Uses default group

    logger.info('All tools listed', {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
    });

    return c.json({
      success: true,
      data: {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          inputSchema: tool.inputSchema,
        })),
        total: tools.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/groups/:groupId/tools/:toolName/execute - Execute a tool in a specific group
hubApi.post('/groups/:groupId/tools/:toolName/execute', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const toolName = c.req.param('toolName');
    const body = await c.req.json();
    const args = body.arguments || body.args || {};

    const service = await getHubService();

    logger.info('Tool execution requested', {
      groupId,
      toolName,
      args,
    });

    const result = await service.callTool(toolName, args, groupId);

    const status = result.isError ? 'failed' : 'completed';
    logger.info('Tool execution completed', {
      groupId,
      toolName,
      status,
      resultSize: JSON.stringify(result.content).length,
    });

    return c.json({
      success: !result.isError,
      data: {
        toolName,
        groupId,
        result: result.content,
        isError: result.isError,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/tools/:toolName/execute - Execute a tool (default group)
hubApi.post('/tools/:toolName/execute', async (c) => {
  try {
    const toolName = c.req.param('toolName');
    const body = await c.req.json();
    const args = body.arguments || body.args || {};

    const service = await getHubService();

    logger.info('Tool execution requested (default group)', {
      toolName,
      args,
    });

    const result = await service.callTool(toolName, args); // Uses default group

    const status = result.isError ? 'failed' : 'completed';
    logger.info('Tool execution completed (default group)', {
      toolName,
      status,
      resultSize: JSON.stringify(result.content).length,
    });

    return c.json({
      success: !result.isError,
      data: {
        toolName,
        groupId: 'default',
        result: result.content,
        isError: result.isError,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/health - Get server health status
hubApi.get('/health', async (c) => {
  try {
    const service = await getHubServiceSafe();

    if (!service) {
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

    return c.json({
      success: true,
      data: {
        ...healthData,
        service: {
          ...healthData.service,
          status: overallStatus,
        },
      },
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
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

    return c.json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
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

    return c.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/api-tools/reload - Reload API tool configuration
hubApi.post('/api-tools/reload', async (c) => {
  try {
    const service = await getHubService();
    await service.reloadApiToolConfig();

    logger.info('API tool configuration reloaded successfully');

    return c.json({
      success: true,
      data: {
        message: 'API工具配置重新加载完成',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
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
