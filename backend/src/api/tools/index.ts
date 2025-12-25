import type { GroupConfig } from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { McpHubService } from '../../services/mcp_hub_service.js';
import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type { GroupToolInfo } from '../mcp/group-service.js';
import { addExecutionRecord, type ToolExecutionRecord } from '../tools-admin/index.js';

export const toolsApi = new Hono();

// 全局hub服务实例
let hubService: McpHubService | null = null;

// 初始化hub服务
async function getHubService(): Promise<McpHubService> {
  if (hubService) {
    return hubService;
  }

  try {
    logger.info('初始化工具管理API的MCP Hub服务');

    // 加载配置
    const config = await getAllConfig();

    // 创建hub服务实例
    hubService = new McpHubService(
      config.mcps.mcpServers,
      config.groups as GroupConfig,
      config.apiToolsConfigPath,
    );

    // 初始化服务
    const initPromise = hubService.initialize();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('服务初始化超时')), 30000);
    });

    await Promise.race([initPromise, timeoutPromise]);

    logger.info('工具管理API的MCP Hub服务初始化成功');
    return hubService;
  } catch (error) {
    logger.error('工具管理API的MCP Hub服务初始化失败', error as Error);
    hubService = null;
    throw error;
  }
}

// 安全获取hub服务
async function _getHubServiceSafe(): Promise<McpHubService | null> {
  try {
    return await getHubService();
  } catch (error) {
    logger.error('Hub服务不可用', error as Error);
    return null;
  }
}

// 错误处理中间件
const handleApiError = (error: Error) => {
  logger.error('工具API错误', error);

  const errorResponse = McpHubService.formatErrorResponse(error);

  return {
    success: false,
    error: errorResponse.error,
    timestamp: new Date().toISOString(),
  };
};

// GET /api/tools - 获取所有工具列表
toolsApi.get('/', async (c) => {
  try {
    const service = await getHubService();

    // 获取查询参数
    const serverId = c.req.query('serverId');
    const groupId = c.req.query('groupId') || 'default';

    let tools: GroupToolInfo[];

    if (serverId) {
      // 按服务器过滤工具
      const allTools = await service.listTools(groupId);
      tools = allTools.filter((tool) => tool.serverId === serverId);

      logger.info('按服务器过滤工具列表', {
        serverId,
        groupId,
        toolCount: tools.length,
      });
    } else {
      // 获取所有工具
      tools = await service.listTools(groupId);

      logger.info('获取所有工具列表', {
        groupId,
        toolCount: tools.length,
      });
    }

    // 获取服务器健康状态
    const serverHealth = service.getServerHealth();

    // 为工具添加状态信息
    const toolsWithStatus = tools.map((tool) => ({
      ...tool,
      status: serverHealth.get(tool.serverId) === 'connected'
        ? 'available' as const
        : 'unavailable' as const,
    }));

    // 按服务器分组工具
    const toolsByServer = new Map<string, typeof toolsWithStatus>();
    toolsWithStatus.forEach((tool) => {
      if (!toolsByServer.has(tool.serverId)) {
        toolsByServer.set(tool.serverId, []);
      }
      toolsByServer.get(tool.serverId)?.push(tool);
    });

    return c.json({
      success: true,
      data: {
        tools: toolsWithStatus.map((tool) => ({
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          status: tool.status,
          inputSchema: tool.inputSchema,
        })),
        toolsByServer: Object.fromEntries(
          Array.from(toolsByServer.entries()).map(([serverId, serverTools]) => [
            serverId,
            serverTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              status: tool.status,
              inputSchema: tool.inputSchema,
            })),
          ]),
        ),
        total: toolsWithStatus.length,
        groupId,
        serverId: serverId || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/server/:serverId - 按服务器过滤工具
toolsApi.get('/server/:serverId', async (c) => {
  try {
    const serverId = c.req.param('serverId');
    const groupId = c.req.query('groupId') || 'default';

    const service = await getHubService();

    // 获取所有工具并按服务器过滤
    const allTools = await service.listTools(groupId);
    const tools = allTools.filter((tool) => tool.serverId === serverId);

    // 验证服务器是否存在
    const serverHealth = service.getServerHealth();
    const serverStatus = serverHealth.get(serverId);

    if (!serverStatus) {
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

    // 为工具添加状态信息
    const toolsWithStatus = tools.map((tool) => ({
      ...tool,
      status: serverStatus === 'connected' ? 'available' as const : 'unavailable' as const,
    }));

    logger.info('按服务器获取工具列表', {
      serverId,
      groupId,
      toolCount: tools.length,
      serverStatus,
    });

    return c.json({
      success: true,
      data: {
        serverId,
        serverStatus,
        groupId,
        tools: toolsWithStatus.map((tool) => ({
          name: tool.name,
          description: tool.description,
          status: tool.status,
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

// GET /api/tools/:toolName - 获取工具详细信息
toolsApi.get('/:toolName', async (c) => {
  try {
    const toolName = c.req.param('toolName');
    const groupId = c.req.query('groupId') || 'default';

    const service = await getHubService();

    // 获取所有工具并查找指定工具
    const allTools = await service.listTools(groupId);
    const tool = allTools.find((t) => t.name === toolName);

    if (!tool) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `工具 '${toolName}' 在组 '${groupId}' 中未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 获取服务器状态
    const serverHealth = service.getServerHealth();
    const serverStatus = serverHealth.get(tool.serverId);

    logger.info('获取工具详细信息', {
      toolName,
      serverId: tool.serverId,
      groupId,
      serverStatus,
    });

    return c.json({
      success: true,
      data: {
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId,
        serverStatus,
        inputSchema: tool.inputSchema,
        groupId,
        // 添加工具可用性状态
        isAvailable: serverStatus === 'connected',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/tools/:toolName/execute - 执行工具
toolsApi.post('/:toolName/execute', async (c) => {
  try {
    const toolName = c.req.param('toolName');
    const body = await c.req.json();
    const args = body.arguments || body.args || {};
    const groupId = body.groupId || c.req.query('groupId') || 'default';
    const serverId = body.serverId || c.req.query('serverId');

    const service = await getHubService();

    // 验证工具是否存在
    const allTools = await service.listTools(groupId);
    const tool = allTools.find((t) => t.name === toolName);

    if (!tool) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `工具 '${toolName}' 在组 '${groupId}' 中未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 如果指定了serverId，验证工具是否在该服务器上
    if (serverId && tool.serverId !== serverId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOOL_SERVER_MISMATCH',
            message: `工具 '${toolName}' 不在服务器 '${serverId}' 上，实际在服务器 '${tool.serverId}' 上`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
      );
    }

    // 验证服务器状态
    const serverHealth = service.getServerHealth();
    const serverStatus = serverHealth.get(tool.serverId);

    if (serverStatus !== 'connected') {
      return c.json(
        {
          success: false,
          error: {
            code: 'SERVER_UNAVAILABLE',
            message: `服务器 '${tool.serverId}' 不可用，状态: ${serverStatus || 'unknown'}`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    const executionId = `${groupId}-${toolName}-${Date.now()}`;

    logger.info('工具执行请求', {
      executionId,
      toolName,
      serverId: tool.serverId,
      groupId,
      args,
    });

    const startTime = Date.now();
    const result = await service.callTool(toolName, args, groupId);
    const executionTime = Date.now() - startTime;

    const status = result.isError ? 'failed' : 'completed';
    const timestamp = new Date().toISOString();

    // 记录执行历史
    const executionRecord: ToolExecutionRecord = {
      id: executionId,
      toolName,
      serverId: tool.serverId,
      groupId,
      arguments: args,
      result: result.content as unknown as Record<string, unknown>,
      isError: result.isError || false,
      executionTime,
      timestamp,
    };

    addExecutionRecord(executionRecord);

    logger.info('工具执行完成', {
      executionId,
      toolName,
      serverId: tool.serverId,
      groupId,
      status,
      executionTime,
      resultSize: JSON.stringify(result.content).length,
    });

    return c.json({
      success: !result.isError,
      data: {
        executionId,
        toolName,
        serverId: tool.serverId,
        groupId,
        result: result.content as unknown as Record<string, unknown>,
        isError: result.isError,
        executionTime,
        timestamp,
      },
      timestamp,
    });
  } catch (error) {
    logger.error('工具执行失败', error as Error, {
      toolName: c.req.param('toolName'),
    });
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// POST /api/tools/:toolName/test - 测试工具（验证参数但不执行）
toolsApi.post('/:toolName/test', async (c) => {
  try {
    const toolName = c.req.param('toolName');
    const body = await c.req.json();
    const args = body.arguments || body.args || {};
    const groupId = body.groupId || c.req.query('groupId') || 'default';

    const service = await getHubService();

    // 验证工具是否存在
    const allTools = await service.listTools(groupId);
    const tool = allTools.find((t) => t.name === toolName);

    if (!tool) {
      return c.json(
        {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `工具 '${toolName}' 在组 '${groupId}' 中未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    // 验证服务器状态
    const serverHealth = service.getServerHealth();
    const serverStatus = serverHealth.get(tool.serverId);

    logger.info('工具测试请求', {
      toolName,
      serverId: tool.serverId,
      groupId,
      args,
      serverStatus,
    });

    // 执行参数验证
    const validationResult = await validateToolArguments(tool, args);

    const testResult = {
      toolName,
      serverId: tool.serverId,
      groupId,
      serverStatus,
      isAvailable: serverStatus === 'connected',
      validation: validationResult,
      canExecute: validationResult.isValid && serverStatus === 'connected',
    };

    logger.info('工具测试完成', {
      toolName,
      serverId: tool.serverId,
      groupId,
      isValid: validationResult.isValid,
      canExecute: testResult.canExecute,
    });

    return c.json({
      success: true,
      data: testResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('工具测试失败', error as Error, {
      toolName: c.req.param('toolName'),
    });
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// 参数验证函数
async function validateToolArguments(
  tool: GroupToolInfo,
  args: Record<string, unknown>,
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 如果没有输入模式，跳过验证
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      warnings.push('工具没有定义输入模式，跳过参数验证');
      return { isValid: true, errors, warnings };
    }

    const schema = tool.inputSchema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };

    // 验证必需字段
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in args)) {
          errors.push(`缺少必需参数: ${requiredField}`);
        } else if (
          args[requiredField] === null ||
          args[requiredField] === undefined
        ) {
          errors.push(`必需参数 '${requiredField}' 不能为空`);
        }
      }
    }

    // 验证参数类型
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [argName, argValue] of Object.entries(args)) {
        const propSchema = schema.properties[argName];
        if (propSchema && typeof propSchema === 'object') {
          const typeValidation = validateArgumentType(
            argName,
            argValue,
            propSchema as Record<string, unknown>,
          );
          if (!typeValidation.isValid && typeValidation.error) {
            errors.push(typeValidation.error);
          }
        }
      }
    }

    // 检查额外属性
    if (schema.additionalProperties === false && schema.properties) {
      const allowedProps = Object.keys(schema.properties);
      const providedProps = Object.keys(args);
      const extraProps = providedProps.filter(
        (prop) => !allowedProps.includes(prop),
      );

      if (extraProps.length > 0) {
        warnings.push(`提供了额外的参数: ${extraProps.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    logger.error('参数验证时出错', error as Error, {
      toolName: tool.name,
      args,
    });

    warnings.push(`参数验证时出错: ${(error as Error).message}`);
    return { isValid: true, errors, warnings }; // 验证出错时允许执行
  }
}

// 类型验证辅助函数
function validateArgumentType(
  argName: string,
  argValue: unknown,
  propSchema: Record<string, unknown>,
): { isValid: boolean; error?: string } {
  if (!propSchema.type) {
    return { isValid: true }; // 没有指定类型，允许任何值
  }

  const expectedType = propSchema.type;
  const actualType = typeof argValue;

  switch (expectedType) {
    case 'string':
      if (actualType !== 'string') {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是字符串，实际类型: ${actualType}`,
        };
      }
      break;

    case 'number':
      if (actualType !== 'number' || Number.isNaN(argValue as number)) {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是数字，实际类型: ${actualType}`,
        };
      }
      break;

    case 'integer':
      if (actualType !== 'number' || !Number.isInteger(argValue as number)) {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是整数，实际类型: ${actualType}`,
        };
      }
      break;

    case 'boolean':
      if (actualType !== 'boolean') {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是布尔值，实际类型: ${actualType}`,
        };
      }
      break;

    case 'array':
      if (!Array.isArray(argValue)) {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是数组，实际类型: ${actualType}`,
        };
      }
      break;

    case 'object':
      if (
        actualType !== 'object' ||
        argValue === null ||
        Array.isArray(argValue)
      ) {
        return {
          isValid: false,
          error: `参数 '${argName}' 必须是对象，实际类型: ${actualType}`,
        };
      }
      break;

    default:
      // 未知类型，允许通过
      logger.debug('未知的参数类型，允许通过', {
        argName,
        expectedType,
      });
      break;
  }

  return { isValid: true };
}

