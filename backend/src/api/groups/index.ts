/**
 * 组管理API端点
 * 提供组列表、组详情、组健康检查等API
 */

import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { Hono } from 'hono';
import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

export const groupsApi = new Hono();

// 全局核心服务管理器实例
let coreServiceManager: McpServiceManager | null = null;

/**
 * 确保核心服务管理器已初始化
 */
async function ensureCoreServiceInitialized(): Promise<void> {
  if (coreServiceManager) {
    return;
  }

  try {
    logger.info('初始化组管理API的核心服务管理器');
    const config = await getAllConfig();

    coreServiceManager = new McpServiceManager();
    const coreConfig = {
      servers: config.mcps.mcpServers as Record<string, any>,
      groups: config.groups as Record<string, any>,
    };
    await coreServiceManager.initializeFromConfig(coreConfig);

    logger.info('组管理API核心服务管理器初始化成功');
  } catch (error) {
    logger.error('组管理API核心服务管理器初始化失败', error as Error);
    throw error;
  }
}

/**
 * 获取所有组列表
 */
groupsApi.get('/', async (c) => {
  try {
    logger.debug('获取所有组列表');

    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;

    await ensureCoreServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const serverConnections = coreServiceManager.getServerConnections();

    // 构建组列表，包含运行时状态
    const groupList = await Promise.all(
      Object.entries(groups).map(async ([groupId, groupConfig]) => {
        try {
          // 计算组内服务器连接状态
          const groupServers = groupConfig.servers || [];
          const connectedServers = groupServers.filter((serverId: string) => {
            const connection = serverConnections.get(serverId);
            return connection && connection.status === 'connected';
          });

          // 获取组内工具数量
          let toolCount = 0;
          try {
            const allTools = await coreServiceManager?.getAllTools();
            toolCount =
              allTools?.filter((tool) => groupServers.includes(tool.serverId))
                .length || 0;
          } catch (error) {
            logger.warn('获取组工具数量失败', {
              groupId,
              error: (error as Error).message,
            });
          }

          return {
            id: groupId,
            name: groupConfig.name || groupId,
            description: groupConfig.description || '',
            servers: groupServers,
            serverCount: groupServers.length,
            connectedServers: connectedServers.length,
            toolCount,
            tools: groupConfig.tools || [],
            isHealthy: connectedServers.length > 0,
            healthScore:
              groupServers.length > 0
                ? Math.round(
                    (connectedServers.length / groupServers.length) * 100,
                  )
                : 0,
          };
        } catch (error) {
          logger.error('处理组信息时出错', error as Error, { groupId });
          return {
            id: groupId,
            name: groupConfig.name || groupId,
            description: groupConfig.description || '',
            servers: groupConfig.servers || [],
            serverCount: (groupConfig.servers || []).length,
            connectedServers: 0,
            toolCount: 0,
            tools: groupConfig.tools || [],
            isHealthy: false,
            healthScore: 0,
            error: (error as Error).message,
          };
        }
      }),
    );

    const response = {
      groups: groupList,
      totalGroups: groupList.length,
      healthyGroups: groupList.filter((g) => g.isHealthy).length,
      totalServers: groupList.reduce((sum, g) => sum + g.serverCount, 0),
      connectedServers: groupList.reduce(
        (sum, g) => sum + g.connectedServers,
        0,
      ),
      totalTools: groupList.reduce((sum, g) => sum + g.toolCount, 0),
      timestamp: new Date().toISOString(),
    };

    logger.info('组列表查询完成', {
      totalGroups: response.totalGroups,
      healthyGroups: response.healthyGroups,
      totalTools: response.totalTools,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取组列表失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUPS_LIST_ERROR',
          message: `获取组列表失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取特定组的详细信息
 */
groupsApi.get('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组详细信息', { groupId });

    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const groupConfig = groups[groupId];

    if (!groupConfig) {
      return c.json(
        {
          error: {
            code: 'GROUP_NOT_FOUND',
            message: `组 '${groupId}' 不存在`,
          },
        },
        { status: 404 },
      );
    }

    await ensureCoreServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const serverConnections = coreServiceManager.getServerConnections();
    const groupServers = groupConfig.servers || [];

    // 获取服务器详细状态
    const serverDetails = groupServers.map((serverId: string) => {
      const connection = serverConnections.get(serverId);
      return {
        id: serverId,
        status: connection?.status || 'unknown',
        lastConnected: connection?.lastConnected?.toISOString(),
        toolCount: connection?.tools?.length || 0,
        error: connection?.lastError?.message,
      };
    });

    // 获取组内所有工具
    let groupTools: any[] = [];
    try {
      const allTools = await coreServiceManager.getAllTools();
      groupTools = allTools
        .filter((tool) => groupServers.includes(tool.serverId))
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          parameters: tool.parameters,
          category: tool.category,
        }));

      // 如果组配置了特定工具过滤，应用过滤
      if (groupConfig.tools && groupConfig.tools.length > 0) {
        groupTools = groupTools.filter((tool) =>
          groupConfig.tools.includes(tool.name),
        );
      }
    } catch (error) {
      logger.warn('获取组工具失败', {
        groupId,
        error: (error as Error).message,
      });
    }

    const connectedServers = serverDetails.filter(
      (s: any) => s.status === 'connected',
    );

    const response = {
      id: groupId,
      name: groupConfig.name || groupId,
      description: groupConfig.description || '',
      servers: serverDetails,
      serverCount: groupServers.length,
      connectedServers: connectedServers.length,
      tools: groupTools,
      toolCount: groupTools.length,
      toolFilter: groupConfig.tools || [],
      isHealthy: connectedServers.length > 0,
      healthScore:
        groupServers.length > 0
          ? Math.round((connectedServers.length / groupServers.length) * 100)
          : 0,
      validation: {
        enabled: groupConfig.validation?.enabled || false,
        validationKey: groupConfig.validation?.validationKey
          ? '***'
          : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    logger.info('组详细信息查询完成', {
      groupId,
      serverCount: response.serverCount,
      connectedServers: response.connectedServers,
      toolCount: response.toolCount,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取组详细信息失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_DETAIL_ERROR',
          message: `获取组详细信息失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取组的健康检查状态
 */
groupsApi.get('/:groupId/health', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('执行组健康检查', { groupId });

    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const groupConfig = groups[groupId];

    if (!groupConfig) {
      return c.json(
        {
          error: {
            code: 'GROUP_NOT_FOUND',
            message: `组 '${groupId}' 不存在`,
          },
        },
        { status: 404 },
      );
    }

    await ensureCoreServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const serverConnections = coreServiceManager.getServerConnections();
    const groupServers = groupConfig.servers || [];

    // 检查服务器连接状态
    const serverHealth = groupServers.map((serverId: string) => {
      const connection = serverConnections.get(serverId);
      const isHealthy = connection && connection.status === 'connected';

      return {
        serverId,
        healthy: isHealthy,
        status: connection?.status || 'unknown',
        lastConnected: connection?.lastConnected?.toISOString(),
        error: connection?.lastError?.message,
        toolCount: connection?.tools?.length || 0,
      };
    });

    const healthyServers = serverHealth.filter((s: any) => s.healthy);
    const healthScore =
      groupServers.length > 0
        ? Math.round((healthyServers.length / groupServers.length) * 100)
        : 0;

    // 检查工具可用性
    let toolHealth = { available: 0, total: 0 };
    try {
      const allTools = await coreServiceManager.getAllTools();
      const groupTools = allTools.filter((tool) =>
        groupServers.includes(tool.serverId || ''),
      );

      toolHealth = {
        available: groupTools.length,
        total: groupConfig.tools?.length || groupTools.length,
      };
    } catch (error) {
      logger.warn('检查组工具健康状态失败', {
        groupId,
        error: (error as Error).message,
      });
    }

    const isHealthy = healthyServers.length > 0 && toolHealth.available > 0;
    const statusCode = isHealthy ? 200 : 503;

    const response = {
      groupId,
      healthy: isHealthy,
      healthScore,
      servers: {
        total: groupServers.length,
        healthy: healthyServers.length,
        unhealthy: groupServers.length - healthyServers.length,
        details: serverHealth,
      },
      tools: toolHealth,
      issues: [
        ...(healthyServers.length === 0 ? ['没有可用的服务器连接'] : []),
        ...(toolHealth.available === 0 ? ['没有可用的工具'] : []),
        ...(healthScore < 50 ? [`服务器健康度较低: ${healthScore}%`] : []),
      ],
      timestamp: new Date().toISOString(),
    };

    logger.info('组健康检查完成', {
      groupId,
      healthy: isHealthy,
      healthScore,
      healthyServers: healthyServers.length,
      totalServers: groupServers.length,
    });

    return c.json(response, { status: statusCode });
  } catch (error) {
    logger.error('组健康检查失败', error as Error);
    return c.json(
      {
        groupId: c.req.param('groupId'),
        healthy: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: `组健康检查失败: ${(error as Error).message}`,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
});

/**
 * 获取组的工具列表
 */
groupsApi.get('/:groupId/tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组工具列表', { groupId });

    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const groupConfig = groups[groupId];

    if (!groupConfig) {
      return c.json(
        {
          error: {
            code: 'GROUP_NOT_FOUND',
            message: `组 '${groupId}' 不存在`,
          },
        },
        { status: 404 },
      );
    }

    await ensureCoreServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const groupServers = groupConfig.servers || [];
    const allTools = await coreServiceManager.getAllTools();

    // 获取组内工具
    let groupTools = allTools.filter((tool) =>
      groupServers.includes(tool.serverId || ''),
    );

    // 应用组工具过滤
    if (groupConfig.tools && groupConfig.tools.length > 0) {
      groupTools = groupTools.filter((tool) =>
        groupConfig.tools.includes(tool.name),
      );
    }

    // 按服务器分组
    const toolsByServer = groupTools.reduce(
      (acc, tool) => {
        const serverId = tool.serverId || 'unknown';
        if (!acc[serverId]) {
          acc[serverId] = [];
        }
        acc[serverId].push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          category: tool.category,
          version: tool.version,
          deprecated: tool.deprecated,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const response = {
      groupId,
      tools: groupTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId,
        parameters: tool.parameters,
        category: tool.category,
        version: tool.version,
        deprecated: tool.deprecated,
      })),
      toolsByServer,
      totalTools: groupTools.length,
      serverCount: Object.keys(toolsByServer).length,
      toolFilter: groupConfig.tools || [],
      timestamp: new Date().toISOString(),
    };

    logger.info('组工具列表查询完成', {
      groupId,
      totalTools: response.totalTools,
      serverCount: response.serverCount,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取组工具列表失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_TOOLS_ERROR',
          message: `获取组工具列表失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取组的服务器列表
 */
groupsApi.get('/:groupId/servers', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组服务器列表', { groupId });

    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const groupConfig = groups[groupId];

    if (!groupConfig) {
      return c.json(
        {
          error: {
            code: 'GROUP_NOT_FOUND',
            message: `组 '${groupId}' 不存在`,
          },
        },
        { status: 404 },
      );
    }

    await ensureCoreServiceInitialized();

    if (!coreServiceManager) {
      throw new Error('核心服务管理器未初始化');
    }

    const serverConnections = coreServiceManager.getServerConnections();
    const groupServers = groupConfig.servers || [];

    // 获取服务器详细信息
    const serverDetails = await Promise.all(
      groupServers.map(async (serverId: string) => {
        const connection = serverConnections.get(serverId);

        // 获取服务器工具
        let serverTools: any[] = [];
        try {
          serverTools =
            (await coreServiceManager?.getServerTools(serverId)) || [];
        } catch (error) {
          logger.warn('获取服务器工具失败', {
            serverId,
            error: (error as Error).message,
          });
        }

        return {
          id: serverId,
          status: connection?.status || 'unknown',
          lastConnected: connection?.lastConnected?.toISOString(),
          lastError: connection?.lastError?.message,
          tools: serverTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            category: tool.category,
          })),
          toolCount: serverTools.length,
          isHealthy: connection?.status === 'connected',
        };
      }),
    );

    const connectedServers = serverDetails.filter((s) => s.isHealthy);

    const response = {
      groupId,
      servers: serverDetails,
      totalServers: serverDetails.length,
      connectedServers: connectedServers.length,
      disconnectedServers: serverDetails.length - connectedServers.length,
      totalTools: serverDetails.reduce((sum, s) => sum + s.toolCount, 0),
      healthScore:
        serverDetails.length > 0
          ? Math.round((connectedServers.length / serverDetails.length) * 100)
          : 0,
      timestamp: new Date().toISOString(),
    };

    logger.info('组服务器列表查询完成', {
      groupId,
      totalServers: response.totalServers,
      connectedServers: response.connectedServers,
      totalTools: response.totalTools,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取组服务器列表失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_SERVERS_ERROR',
          message: `获取组服务器列表失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 优雅关闭组管理API服务
 */
export async function shutdownGroupsApi(): Promise<void> {
  try {
    logger.info('关闭组管理API服务');

    if (coreServiceManager) {
      await coreServiceManager.shutdown();
      coreServiceManager = null;
    }

    logger.info('组管理API服务关闭完成');
  } catch (error) {
    logger.error('关闭组管理API服务时出错', error as Error);
    throw error;
  }
}
