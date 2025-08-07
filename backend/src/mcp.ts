import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { Hono } from 'hono';
import { initializeMcpService, mcpServer } from './services/mcp_service.js';
import { getAllConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

export const mcp = new Hono();

// Track initialization state
let isInitialized = false;
// 核心服务管理器实例（用于管理和调试功能）
let coreServiceManager: McpServiceManager | null = null;

// Initialize the MCP service
async function ensureMcpServiceInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    logger.info('Initializing MCP Service with enhanced features');

    // 初始化传统MCP服务（向后兼容）
    await initializeMcpService();

    // 初始化核心服务管理器（用于管理功能）
    if (!coreServiceManager) {
      const config = await getAllConfig();
      coreServiceManager = new McpServiceManager();
      const coreConfig = {
        servers: config.mcps.mcpServers as Record<string, any>,
        groups: config.groups as Record<string, any>,
      };
      await coreServiceManager.initializeFromConfig(coreConfig);
    }

    isInitialized = true;
    logger.info('Enhanced MCP Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MCP Service', error as Error);
    throw error;
  }
}

mcp.post('/mcp', async (c) => {
  const { req, res } = toReqRes(c.req.raw);

  try {
    // Ensure MCP service is initialized
    await ensureMcpServiceInitialized();

    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    // Use the enhanced MCP server with all registered tools
    await mcpServer.connect(transport);

    await transport.handleRequest(req, res, await c.req.json());

    res.on('close', () => {
      logger.debug('MCP request closed');
      transport.close();
      mcpServer.close();
    });

    return toFetchResponse(res);
  } catch (e) {
    logger.error('MCP endpoint error', e as Error);
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: {
            error: {
              code: 'INTERNAL_ERROR',
              message: (e as Error).message,
            },
          },
        },
        id: null,
      },
      { status: 500 },
    );
  }
});

/**
 * MCP服务状态端点 - 管理和调试功能
 */
mcp.get('/mcp/status', async (c) => {
  try {
    await ensureMcpServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const status = coreServiceManager.getServiceStatus();
    const serverConnections = coreServiceManager.getServerConnections();

    // 构建详细状态信息
    const serverDetails = Array.from(serverConnections.entries()).map(
      ([id, conn]) => ({
        id,
        status: conn.status,
        lastConnected: conn.lastConnected?.toISOString(),
        toolCount: conn.tools?.length || 0,
        error: conn.lastError?.message,
      }),
    );

    const response = {
      service: {
        isInitialized: status.initialized,
        timestamp: new Date().toISOString(),
      },
      servers: {
        total: status.serverCount,
        connected: status.activeConnections,
        details: serverDetails,
      },
      compatibility: {
        legacyMcpEndpoint: true,
        groupRouting: true,
        corePackageIntegration: true,
      },
    };

    logger.debug('MCP状态查询', {
      serverCount: status.serverCount,
      activeConnections: status.activeConnections,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取MCP状态失败', error as Error);
    return c.json(
      {
        error: {
          code: 'STATUS_ERROR',
          message: `获取MCP状态失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * MCP工具列表端点 - 管理和调试功能
 */
mcp.get('/mcp/tools', async (c) => {
  try {
    await ensureMcpServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const allTools = await coreServiceManager.getAllTools();

    // 按服务器分组工具
    const toolsByServer = allTools.reduce(
      (acc, tool) => {
        const serverId = tool.serverId || 'unknown';
        if (!acc[serverId]) {
          acc[serverId] = [];
        }
        acc[serverId].push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const response = {
      totalTools: allTools.length,
      serverCount: Object.keys(toolsByServer).length,
      toolsByServer,
      allTools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId || 'unknown',
        parameters: tool.parameters,
      })),
      timestamp: new Date().toISOString(),
    };

    logger.debug('MCP工具列表查询', {
      totalTools: allTools.length,
      serverCount: Object.keys(toolsByServer).length,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取MCP工具列表失败', error as Error);
    return c.json(
      {
        error: {
          code: 'TOOLS_ERROR',
          message: `获取MCP工具列表失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * MCP服务器详情端点 - 管理和调试功能
 */
mcp.get('/mcp/servers/:serverId', async (c) => {
  try {
    await ensureMcpServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const serverId = c.req.param('serverId');
    const serverConnections = coreServiceManager.getServerConnections();
    const serverConnection = serverConnections.get(serverId);

    if (!serverConnection) {
      return c.json(
        {
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
        },
        { status: 404 },
      );
    }

    // 获取服务器工具
    const serverTools = await coreServiceManager.getServerTools(serverId);

    const response = {
      serverId,
      status: serverConnection.status,
      lastConnected: serverConnection.lastConnected?.toISOString(),
      lastError: serverConnection.lastError?.message,
      tools: serverTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
      toolCount: serverTools.length,
      timestamp: new Date().toISOString(),
    };

    logger.debug('MCP服务器详情查询', {
      serverId,
      status: serverConnection.status,
      toolCount: serverTools.length,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取MCP服务器详情失败', error as Error);
    return c.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: `获取服务器详情失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * MCP工具执行端点 - 管理和调试功能
 */
mcp.post('/mcp/execute', async (c) => {
  try {
    await ensureMcpServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const body = await c.req.json();
    const { toolName, args, serverId } = body;

    if (!toolName) {
      return c.json(
        {
          error: {
            code: 'MISSING_TOOL_NAME',
            message: '缺少工具名称参数',
          },
        },
        { status: 400 },
      );
    }

    logger.info('执行MCP工具', { toolName, serverId, args });

    const result = await coreServiceManager.executeToolCall(
      toolName,
      args || {},
      serverId,
    );

    logger.info('MCP工具执行完成', { toolName, serverId });

    return c.json({
      toolName,
      serverId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('MCP工具执行失败', error as Error);
    return c.json(
      {
        error: {
          code: 'EXECUTION_ERROR',
          message: `工具执行失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * MCP健康检查端点 - 管理和调试功能
 */
mcp.get('/mcp/health', async (c) => {
  try {
    await ensureMcpServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const status = coreServiceManager.getServiceStatus();
    const serverConnections = coreServiceManager.getServerConnections();

    // 计算健康分数
    const totalServers = status.serverCount;
    const activeConnections = status.activeConnections;
    const healthScore =
      totalServers > 0 ? (activeConnections / totalServers) * 100 : 0;

    const isHealthy = healthScore >= 50; // 至少50%的服务器连接才算健康

    const response = {
      healthy: isHealthy,
      healthScore: Math.round(healthScore),
      service: {
        initialized: status.initialized,
        uptime: process.uptime(),
      },
      servers: {
        total: totalServers,
        connected: activeConnections,
        disconnected: totalServers - activeConnections,
      },
      timestamp: new Date().toISOString(),
    };

    const statusCode = isHealthy ? 200 : 503;

    logger.debug('MCP健康检查', {
      healthy: isHealthy,
      healthScore,
      activeConnections,
      totalServers,
    });

    return c.json(response, { status: statusCode });
  } catch (error) {
    logger.error('MCP健康检查失败', error as Error);
    return c.json(
      {
        healthy: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: `健康检查失败: ${(error as Error).message}`,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
});

// Graceful shutdown handler
export async function shutdownMcpService(): Promise<void> {
  if (isInitialized) {
    logger.info('Shutting down enhanced MCP Service');

    // 关闭传统MCP服务
    const { shutdownMcpService: shutdownService } = await import(
      './services/mcp_service.js'
    );
    await shutdownService();

    // 关闭核心服务管理器
    if (coreServiceManager) {
      await coreServiceManager.shutdown();
      coreServiceManager = null;
    }

    isInitialized = false;
    logger.info('Enhanced MCP Service shutdown completed');
  }
}
