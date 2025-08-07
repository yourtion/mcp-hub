/**
 * 组特定MCP路由处理器
 * 处理 /:group/mcp 路由，提供基于组的MCP服务访问
 */

import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { Hono } from 'hono';
import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { GroupMcpService } from './group-service.js';

export const groupMcpRouter = new Hono();

// 全局核心服务管理器实例
let coreServiceManager: McpServiceManager | null = null;
const groupServices: Map<string, GroupMcpService> = new Map();

/**
 * 确保核心服务管理器已初始化
 */
async function ensureCoreServiceInitialized(): Promise<void> {
  if (coreServiceManager) {
    return;
  }

  try {
    logger.info('初始化组路由的核心服务管理器');
    const config = await getAllConfig();

    coreServiceManager = new McpServiceManager();
    const coreConfig = {
      servers: config.mcps.mcpServers as Record<string, any>,
      groups: config.groups as Record<string, any>,
    };
    await coreServiceManager.initializeFromConfig(coreConfig);

    logger.info('组路由核心服务管理器初始化成功');
  } catch (error) {
    logger.error('组路由核心服务管理器初始化失败', error as Error);
    throw error;
  }
}

/**
 * 获取或创建组特定的MCP服务
 */
async function getGroupMcpService(groupId: string): Promise<GroupMcpService> {
  await ensureCoreServiceInitialized();

  if (!coreServiceManager) {
    throw new Error('核心服务管理器未初始化');
  }

  // 检查是否已存在该组的服务实例
  let groupService = groupServices.get(groupId);
  if (groupService) {
    return groupService;
  }

  // 创建新的组服务实例
  logger.info('为组创建MCP服务实例', { groupId });
  groupService = new GroupMcpService(groupId, coreServiceManager);
  await groupService.initialize();

  groupServices.set(groupId, groupService);
  return groupService;
}

/**
 * 验证组是否存在
 */
async function validateGroupExists(groupId: string): Promise<boolean> {
  try {
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    return groupId in groups;
  } catch (error) {
    logger.error('验证组存在性时出错', error as Error, { groupId });
    return false;
  }
}

/**
 * 组验证中间件
 */
async function groupValidationMiddleware(c: any, next: () => Promise<void>) {
  const groupId = c.req.param('group');

  if (!groupId) {
    logger.warn('组路由请求缺少组ID参数');
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: '无效参数：缺少组ID',
          data: {
            error: {
              code: 'MISSING_GROUP_ID',
              message: '请求路径中必须包含组ID',
            },
          },
        },
        id: null,
      },
      { status: 400 },
    );
  }

  // 验证组是否存在
  const groupExists = await validateGroupExists(groupId);
  if (!groupExists) {
    logger.warn('请求的组不存在', { groupId });
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: `组 '${groupId}' 不存在`,
          data: {
            error: {
              code: 'GROUP_NOT_FOUND',
              message: `指定的组 '${groupId}' 在配置中不存在`,
            },
          },
        },
        id: null,
      },
      { status: 404 },
    );
  }

  // 将组ID添加到上下文中
  c.set('groupId', groupId);
  await next();
}

/**
 * 处理组特定的MCP请求
 */
groupMcpRouter.post('/:group/mcp', groupValidationMiddleware, async (c) => {
  const { req, res } = toReqRes(c.req.raw);
  const groupId = c.req.param('group');

  try {
    logger.info('处理组特定MCP请求', { groupId });

    // 获取组特定的MCP服务
    const groupService = await getGroupMcpService(groupId);

    // 创建传输层
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // 添加错误处理
    transport.onerror = (error) => {
      logger.error('组MCP传输层错误', error, { groupId });
    };

    // 连接到组服务的MCP服务器
    const mcpServer = groupService.getMcpServer();
    await mcpServer.connect(transport);

    // 处理请求
    await transport.handleRequest(req, res, await c.req.json());

    // 清理连接
    res.on('close', () => {
      logger.debug('组MCP请求连接关闭', { groupId });
      transport.close();
      mcpServer.close();
    });

    return toFetchResponse(res);
  } catch (error) {
    logger.error('组MCP端点错误', error as Error, { groupId });
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: '内部服务器错误',
          data: {
            error: {
              code: 'INTERNAL_ERROR',
              message: (error as Error).message,
              groupId,
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
 * 获取组状态信息
 */
groupMcpRouter.get('/:group/status', groupValidationMiddleware, async (c) => {
  const groupId = c.req.param('group');

  try {
    logger.debug('获取组状态信息', { groupId });

    const groupService = await getGroupMcpService(groupId);
    const status = await groupService.getStatus();

    return c.json({
      groupId,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取组状态失败', error as Error, { groupId });
    return c.json(
      {
        error: {
          code: 'STATUS_ERROR',
          message: `获取组 '${groupId}' 状态失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取组可用工具列表
 */
groupMcpRouter.get('/:group/tools', groupValidationMiddleware, async (c) => {
  const groupId = c.req.param('group');

  try {
    logger.debug('获取组工具列表', { groupId });

    const groupService = await getGroupMcpService(groupId);
    const tools = await groupService.getAvailableTools();

    return c.json({
      groupId,
      tools,
      count: tools.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取组工具列表失败', error as Error, { groupId });
    return c.json(
      {
        error: {
          code: 'TOOLS_ERROR',
          message: `获取组 '${groupId}' 工具列表失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 优雅关闭组路由服务
 */
export async function shutdownGroupMcpRouter(): Promise<void> {
  try {
    logger.info('关闭组MCP路由服务');

    // 关闭所有组服务实例
    const shutdownPromises = Array.from(groupServices.values()).map(
      async (service) => {
        try {
          await service.shutdown();
        } catch (error) {
          logger.error('关闭组服务时出错', error as Error);
        }
      },
    );

    await Promise.allSettled(shutdownPromises);
    groupServices.clear();

    // 关闭核心服务管理器
    if (coreServiceManager) {
      await coreServiceManager.shutdown();
      coreServiceManager = null;
    }

    logger.info('组MCP路由服务关闭完成');
  } catch (error) {
    logger.error('关闭组MCP路由服务时出错', error as Error);
    throw error;
  }
}
