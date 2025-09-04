import type { ServerConfig } from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { z } from 'zod';
import { ServerManager } from '../../services/server_manager.js';
import { ServerStatus } from '../../types/mcp-hub.js';
import { getAllConfig, saveConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

export const serversApi = new Hono();

// 全局服务器管理器实例
let serverManager: ServerManager | null = null;

// 获取服务器管理器实例
async function getServerManager(): Promise<ServerManager> {
  if (serverManager) {
    return serverManager;
  }

  try {
    logger.info('初始化服务器管理器');

    // 加载配置
    const config = await getAllConfig();

    // 创建服务器管理器实例
    serverManager = new ServerManager(
      config.mcps.mcpServers as Record<string, ServerConfig>,
    );

    // 初始化服务器管理器
    await serverManager.initialize();

    logger.info('服务器管理器初始化成功');
    return serverManager;
  } catch (error) {
    logger.error('服务器管理器初始化失败', error as Error);
    serverManager = null;
    throw error;
  }
}

// 服务器配置验证模式
const StdioServerConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().min(1, '命令不能为空'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

const HttpServerConfigSchema = z.object({
  type: z.enum(['sse', 'streaming']),
  url: z.string().url('必须是有效的URL'),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

const ServerConfigSchema = z.union([
  StdioServerConfigSchema,
  HttpServerConfigSchema,
]);

// 创建服务器请求验证模式
const CreateServerRequestSchema = z.object({
  id: z
    .string()
    .min(1, '服务器ID不能为空')
    .regex(/^[a-zA-Z0-9_-]+$/, '服务器ID只能包含字母、数字、下划线和连字符'),
  config: ServerConfigSchema,
});

// 更新服务器请求验证模式
const UpdateServerRequestSchema = z.object({
  config: ServerConfigSchema,
});

// 错误处理函数
const handleApiError = (error: Error) => {
  logger.error('服务器管理API错误', error);

  return {
    success: false,
    error: {
      code: 'SERVER_API_ERROR',
      message: error.message,
    },
    timestamp: new Date().toISOString(),
  };
};

// GET /api/servers - 获取服务器列表
serversApi.get('/', async (c) => {
  try {
    const manager = await getServerManager();
    const servers = manager.getAllServers();

    const serverList = Array.from(servers.entries()).map(
      ([serverId, serverConnection]) => ({
        id: serverId,
        name: serverId, // 使用ID作为名称，后续可以扩展
        type: serverConnection.config.type,
        status: serverConnection.status,
        config: serverConnection.config,
        tools: serverConnection.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
        lastConnected: serverConnection.lastConnected?.toISOString(),
        lastError: serverConnection.lastError?.message,
        toolCount: serverConnection.tools.length,
      }),
    );

    logger.info('服务器列表获取成功', {
      serverCount: serverList.length,
      connectedServers: serverList.filter(
        (s) => s.status === ServerStatus.CONNECTED,
      ).length,
    });

    return c.json({
      success: true,
      data: {
        servers: serverList,
        total: serverList.length,
        summary: {
          total: serverList.length,
          connected: serverList.filter(
            (s) => s.status === ServerStatus.CONNECTED,
          ).length,
          connecting: serverList.filter(
            (s) => s.status === ServerStatus.CONNECTING,
          ).length,
          disconnected: serverList.filter(
            (s) => s.status === ServerStatus.DISCONNECTED,
          ).length,
          error: serverList.filter((s) => s.status === ServerStatus.ERROR)
            .length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/servers/:id - 获取特定服务器信息
serversApi.get('/:id', async (c) => {
  try {
    const serverId = c.req.param('id');
    const manager = await getServerManager();
    const servers = manager.getAllServers();
    const serverConnection = servers.get(serverId);

    if (!serverConnection) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    const serverInfo = {
      id: serverId,
      name: serverId,
      type: serverConnection.config.type,
      status: serverConnection.status,
      config: serverConnection.config,
      tools: serverConnection.tools,
      lastConnected: serverConnection.lastConnected?.toISOString(),
      lastError: serverConnection.lastError?.message,
      reconnectAttempts: serverConnection.reconnectAttempts,
      toolCount: serverConnection.tools.length,
    };

    logger.info('服务器信息获取成功', {
      serverId,
      status: serverConnection.status,
      toolCount: serverConnection.tools.length,
    });

    return c.json({
      success: true,
      data: serverInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/servers - 创建新服务器配置
serversApi.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // 验证请求数据
    const validationResult = CreateServerRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: validationResult.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const { id: serverId, config } = validationResult.data;

    // 检查服务器ID是否已存在
    const currentConfig = await getAllConfig();
    if (currentConfig.mcps.mcpServers[serverId]) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_EXISTS',
            message: `服务器 '${serverId}' 已存在`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 },
      );
    }

    // 保存新的服务器配置
    const updatedMcpConfig = {
      ...currentConfig.mcps,
      mcpServers: {
        ...currentConfig.mcps.mcpServers,
        [serverId]: config,
      },
    };

    await saveConfig('mcp_server.json', updatedMcpConfig);

    // 重新初始化服务器管理器以包含新服务器
    serverManager = null;
    const manager = await getServerManager();

    logger.info('服务器创建成功', {
      serverId,
      type: config.type,
      enabled: config.enabled,
    });

    return c.json(
      {
        success: true,
        data: {
          id: serverId,
          config,
          message: `服务器 '${serverId}' 创建成功`,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// PUT /api/servers/:id - 更新服务器配置
serversApi.put('/:id', async (c) => {
  try {
    const serverId = c.req.param('id');
    const body = await c.req.json();

    // 验证请求数据
    const validationResult = UpdateServerRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: validationResult.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const { config } = validationResult.data;

    // 检查服务器是否存在
    const currentConfig = await getAllConfig();
    if (!currentConfig.mcps.mcpServers[serverId]) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 更新服务器配置
    const updatedMcpConfig = {
      ...currentConfig.mcps,
      mcpServers: {
        ...currentConfig.mcps.mcpServers,
        [serverId]: config,
      },
    };

    await saveConfig('mcp_server.json', updatedMcpConfig);

    // 重新初始化服务器管理器以应用新配置
    serverManager = null;
    const manager = await getServerManager();

    logger.info('服务器配置更新成功', {
      serverId,
      type: config.type,
      enabled: config.enabled,
    });

    return c.json({
      success: true,
      data: {
        id: serverId,
        config,
        message: `服务器 '${serverId}' 配置更新成功`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// DELETE /api/servers/:id - 删除服务器
serversApi.delete('/:id', async (c) => {
  try {
    const serverId = c.req.param('id');

    // 检查服务器是否存在
    const currentConfig = await getAllConfig();
    if (!currentConfig.mcps.mcpServers[serverId]) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 从配置中删除服务器
    const { [serverId]: removedServer, ...remainingServers } =
      currentConfig.mcps.mcpServers;
    const updatedMcpConfig = {
      ...currentConfig.mcps,
      mcpServers: remainingServers,
    };

    await saveConfig('mcp_server.json', updatedMcpConfig);

    // 重新初始化服务器管理器
    serverManager = null;
    const manager = await getServerManager();

    logger.info('服务器删除成功', {
      serverId,
      type: removedServer.type,
    });

    return c.json({
      success: true,
      data: {
        id: serverId,
        message: `服务器 '${serverId}' 删除成功`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/servers/:id/status - 获取服务器连接状态
serversApi.get('/:id/status', async (c) => {
  try {
    const serverId = c.req.param('id');
    const manager = await getServerManager();
    const servers = manager.getAllServers();
    const serverConnection = servers.get(serverId);

    if (!serverConnection) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    const statusInfo = {
      id: serverId,
      status: serverConnection.status,
      lastConnected: serverConnection.lastConnected?.toISOString(),
      lastError: serverConnection.lastError?.message,
      reconnectAttempts: serverConnection.reconnectAttempts,
      toolCount: serverConnection.tools.length,
      isConnected: serverConnection.status === ServerStatus.CONNECTED,
      isConnecting: serverConnection.status === ServerStatus.CONNECTING,
      hasError: serverConnection.status === ServerStatus.ERROR,
    };

    logger.debug('服务器状态查询成功', {
      serverId,
      status: serverConnection.status,
    });

    return c.json({
      success: true,
      data: statusInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/servers/:id/connect - 连接服务器
serversApi.post('/:id/connect', async (c) => {
  try {
    const serverId = c.req.param('id');
    const manager = await getServerManager();
    const servers = manager.getAllServers();
    const serverConnection = servers.get(serverId);

    if (!serverConnection) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 检查服务器当前状态
    if (serverConnection.status === ServerStatus.CONNECTED) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_ALREADY_CONNECTED',
            message: `服务器 '${serverId}' 已经连接`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 },
      );
    }

    if (serverConnection.status === ServerStatus.CONNECTING) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_CONNECTING',
            message: `服务器 '${serverId}' 正在连接中`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 },
      );
    }

    // 重新初始化服务器管理器以触发连接
    // 注意：当前的ServerManager没有单独的连接方法，需要重新初始化
    serverManager = null;
    await getServerManager();

    logger.info('服务器连接请求已处理', {
      serverId,
    });

    return c.json({
      success: true,
      data: {
        id: serverId,
        message: `服务器 '${serverId}' 连接请求已发送`,
        status: 'connecting',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/servers/:id/disconnect - 断开服务器连接
serversApi.post('/:id/disconnect', async (c) => {
  try {
    const serverId = c.req.param('id');
    const manager = await getServerManager();
    const servers = manager.getAllServers();
    const serverConnection = servers.get(serverId);

    if (!serverConnection) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_NOT_FOUND',
            message: `服务器 '${serverId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 检查服务器当前状态
    if (serverConnection.status === ServerStatus.DISCONNECTED) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_ALREADY_DISCONNECTED',
            message: `服务器 '${serverId}' 已经断开连接`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 409 },
      );
    }

    // 断开连接
    try {
      if (serverConnection.status === ServerStatus.CONNECTED) {
        await serverConnection.client.close();
      }
      serverConnection.status = ServerStatus.DISCONNECTED;
      serverConnection.tools = [];

      logger.info('服务器断开连接成功', {
        serverId,
      });
    } catch (disconnectError) {
      logger.error(
        '服务器断开连接时发生错误，但仍标记为已断开',
        disconnectError as Error,
        {
          serverId,
        },
      );
      serverConnection.status = ServerStatus.DISCONNECTED;
      serverConnection.tools = [];
    }

    return c.json({
      success: true,
      data: {
        id: serverId,
        message: `服务器 '${serverId}' 已断开连接`,
        status: 'disconnected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/servers/test - 测试服务器连接
serversApi.post('/test', async (c) => {
  try {
    const body = await c.req.json();

    // 验证请求数据
    const validationResult = ServerConfigSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '服务器配置验证失败',
            details: validationResult.error.errors,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    const config = validationResult.data;

    logger.info('开始测试服务器连接', {
      type: config.type,
      command: config.type === 'stdio' ? config.command : undefined,
      url: config.type !== 'stdio' ? config.url : undefined,
    });

    // 创建临时的服务器管理器进行测试
    const testServerManager = new ServerManager({ test: config });

    let testResult: {
      success: boolean;
      message: string;
      details?: Record<string, unknown>;
      error?: string;
      executionTime: number;
    };

    const startTime = Date.now();

    try {
      // 初始化测试服务器
      await testServerManager.initialize();

      // 检查连接状态
      const status = testServerManager.getServerStatus('test');
      const servers = testServerManager.getAllServers();
      const testServer = servers.get('test');

      const executionTime = Date.now() - startTime;

      if (status === ServerStatus.CONNECTED && testServer) {
        // 尝试获取工具列表以验证连接
        const tools = await testServerManager.getServerTools('test');

        testResult = {
          success: true,
          message: '服务器连接测试成功',
          details: {
            status,
            toolCount: tools.length,
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
            })),
            lastConnected: testServer.lastConnected?.toISOString(),
          },
          executionTime,
        };

        logger.info('服务器连接测试成功', {
          type: config.type,
          toolCount: tools.length,
          executionTime,
        });
      } else {
        testResult = {
          success: false,
          message: '服务器连接测试失败',
          details: {
            status,
            lastError: testServer?.lastError?.message,
          },
          error: testServer?.lastError?.message || '连接失败',
          executionTime,
        };

        logger.warn('服务器连接测试失败', {
          type: config.type,
          status,
          error: testServer?.lastError?.message,
          executionTime,
        });
      }

      // 清理测试连接
      await testServerManager.shutdown();
    } catch (error) {
      const executionTime = Date.now() - startTime;

      testResult = {
        success: false,
        message: '服务器连接测试异常',
        error: (error as Error).message,
        executionTime,
      };

      logger.error('服务器连接测试异常', error as Error, {
        type: config.type,
        executionTime,
      });

      // 确保清理测试连接
      try {
        await testServerManager.shutdown();
      } catch (shutdownError) {
        logger.warn('测试服务器关闭时发生错误', { error: shutdownError });
      }
    }

    return c.json(
      {
        success: testResult.success,
        data: testResult,
        timestamp: new Date().toISOString(),
      },
      { status: testResult.success ? 200 : 400 },
    );
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/servers/validate - 验证服务器配置
serversApi.post('/validate', async (c) => {
  try {
    const body = await c.req.json();

    // 基础配置验证
    const validationResult = ServerConfigSchema.safeParse(body);

    const validationResponse = {
      isValid: validationResult.success,
      errors: [] as Array<{
        field: string;
        message: string;
        code: string;
      }>,
      warnings: [] as Array<{
        field: string;
        message: string;
        code: string;
      }>,
      suggestions: [] as Array<{
        field: string;
        message: string;
        suggestedValue?: unknown;
      }>,
    };

    if (!validationResult.success) {
      // 转换Zod错误为友好的错误信息
      validationResponse.errors = validationResult.error.errors.map(
        (error) => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code,
        }),
      );
    } else {
      const config = validationResult.data;

      // 额外的业务逻辑验证
      if (config.type === 'stdio') {
        // 检查命令是否可能存在
        if (!config.command.includes('/') && !config.command.includes('\\')) {
          validationResponse.warnings.push({
            field: 'command',
            message: '命令看起来像是一个可执行文件名，请确保它在系统PATH中',
            code: 'COMMAND_PATH_WARNING',
          });
        }

        // 检查常见的命令
        if (
          config.command === 'npx' &&
          (!config.args || config.args.length === 0)
        ) {
          validationResponse.errors.push({
            field: 'args',
            message: 'npx命令需要指定要执行的包名',
            code: 'NPX_MISSING_PACKAGE',
          });
          validationResponse.isValid = false;
        }

        if (
          config.command === 'uvx' &&
          (!config.args || config.args.length === 0)
        ) {
          validationResponse.errors.push({
            field: 'args',
            message: 'uvx命令需要指定要执行的包名',
            code: 'UVX_MISSING_PACKAGE',
          });
          validationResponse.isValid = false;
        }

        // 建议
        if (config.enabled === undefined) {
          validationResponse.suggestions.push({
            field: 'enabled',
            message: '建议明确设置enabled字段',
            suggestedValue: true,
          });
        }
      } else {
        // HTTP/SSE服务器验证
        try {
          const url = new URL(config.url);

          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            validationResponse.errors.push({
              field: 'url',
              message: 'URL协议必须是http或https',
              code: 'INVALID_PROTOCOL',
            });
            validationResponse.isValid = false;
          }

          if (
            url.protocol === 'http:' &&
            url.hostname !== 'localhost' &&
            url.hostname !== '127.0.0.1'
          ) {
            validationResponse.warnings.push({
              field: 'url',
              message: '使用HTTP协议连接非本地服务器可能存在安全风险',
              code: 'HTTP_SECURITY_WARNING',
            });
          }
        } catch (urlError) {
          validationResponse.errors.push({
            field: 'url',
            message: 'URL格式无效',
            code: 'INVALID_URL_FORMAT',
          });
          validationResponse.isValid = false;
        }
      }

      // 环境变量验证
      if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof value !== 'string') {
            validationResponse.errors.push({
              field: `env.${key}`,
              message: '环境变量值必须是字符串',
              code: 'INVALID_ENV_VALUE_TYPE',
            });
            validationResponse.isValid = false;
          }

          if (key.includes(' ')) {
            validationResponse.warnings.push({
              field: `env.${key}`,
              message: '环境变量名包含空格，可能导致问题',
              code: 'ENV_KEY_SPACES_WARNING',
            });
          }
        }
      }
    }

    logger.info('服务器配置验证完成', {
      isValid: validationResponse.isValid,
      errorCount: validationResponse.errors.length,
      warningCount: validationResponse.warnings.length,
    });

    return c.json({
      success: true,
      data: validationResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// 优雅关闭处理
export async function shutdownServersApi(): Promise<void> {
  try {
    if (serverManager) {
      logger.info('关闭服务器管理API');
      await serverManager.shutdown();
      serverManager = null;
    }
    logger.info('服务器管理API关闭完成');
  } catch (error) {
    logger.error('服务器管理API关闭时发生错误', error as Error);
    throw error;
  }
}
