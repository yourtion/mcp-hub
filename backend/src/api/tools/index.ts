import type { GroupConfig } from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { McpHubService } from '../../services/mcp_hub_service.js';
import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type { GroupToolInfo } from '../mcp/group-service.js';

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

    // 按服务器分组工具
    const toolsByServer = new Map<string, typeof tools>();
    tools.forEach((tool) => {
      if (!toolsByServer.has(tool.serverId)) {
        toolsByServer.set(tool.serverId, []);
      }
      toolsByServer.get(tool.serverId)?.push(tool);
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
        toolsByServer: Object.fromEntries(
          Array.from(toolsByServer.entries()).map(([serverId, serverTools]) => [
            serverId,
            serverTools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            })),
          ]),
        ),
        total: tools.length,
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
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
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

// 工具执行历史记录存储
interface ToolExecutionRecord {
  id: string;
  toolName: string;
  serverId: string;
  groupId: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
  isError: boolean;
  executionTime: number;
  timestamp: string;
}

// 内存中的执行历史记录（生产环境中应使用持久化存储）
const executionHistory: ToolExecutionRecord[] = [];
const MAX_HISTORY_SIZE = 1000; // 最大历史记录数量

// 添加执行记录
function addExecutionRecord(record: ToolExecutionRecord): void {
  executionHistory.unshift(record);

  // 保持历史记录大小限制
  if (executionHistory.length > MAX_HISTORY_SIZE) {
    executionHistory.splice(MAX_HISTORY_SIZE);
  }

  logger.debug('添加工具执行记录', {
    executionId: record.id,
    toolName: record.toolName,
    totalRecords: executionHistory.length,
  });
}

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

// GET /api/tools/history - 获取工具执行历史记录
toolsApi.get('/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const toolName = c.req.query('toolName');
    const serverId = c.req.query('serverId');
    const groupId = c.req.query('groupId');

    let filteredHistory = [...executionHistory];

    // 应用过滤器
    if (toolName) {
      filteredHistory = filteredHistory.filter(
        (record) => record.toolName === toolName,
      );
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.serverId === serverId,
      );
    }
    if (groupId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.groupId === groupId,
      );
    }

    // 分页
    const total = filteredHistory.length;
    const paginatedHistory = filteredHistory.slice(offset, offset + limit);

    logger.info('获取工具执行历史记录', {
      total,
      limit,
      offset,
      returned: paginatedHistory.length,
      filters: { toolName, serverId, groupId },
    });

    return c.json({
      success: true,
      data: {
        history: paginatedHistory.map((record) => ({
          id: record.id,
          toolName: record.toolName,
          serverId: record.serverId,
          groupId: record.groupId,
          isError: record.isError,
          executionTime: record.executionTime,
          timestamp: record.timestamp,
          // 不包含完整的参数和结果以减少响应大小
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/history/:executionId - 获取特定执行记录的详细信息
toolsApi.get('/history/:executionId', async (c) => {
  try {
    const executionId = c.req.param('executionId');

    const record = executionHistory.find((r) => r.id === executionId);

    if (!record) {
      return c.json(
        {
          success: false,
          error: {
            code: 'EXECUTION_NOT_FOUND',
            message: `执行记录 '${executionId}' 未找到`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 },
      );
    }

    logger.info('获取执行记录详细信息', {
      executionId,
      toolName: record.toolName,
    });

    return c.json({
      success: true,
      data: record,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/monitoring - 获取工具状态监控信息
toolsApi.get('/monitoring', async (c) => {
  try {
    const groupId = c.req.query('groupId') || 'default';
    const service = await getHubService();

    // 获取所有工具
    const allTools = await service.listTools(groupId);

    // 获取服务器健康状态
    const serverHealth = service.getServerHealth();

    // 按服务器分组工具并计算状态
    const toolsByServer = new Map<
      string,
      {
        serverId: string;
        serverStatus: string;
        tools: Array<{
          name: string;
          description?: string;
          isAvailable: boolean;
          lastExecution?: string;
          executionCount: number;
          errorCount: number;
          averageExecutionTime: number;
        }>;
      }
    >();

    // 初始化服务器分组
    allTools.forEach((tool) => {
      if (!toolsByServer.has(tool.serverId)) {
        toolsByServer.set(tool.serverId, {
          serverId: tool.serverId,
          serverStatus: serverHealth.get(tool.serverId) || 'unknown',
          tools: [],
        });
      }
    });

    // 计算每个工具的监控信息
    allTools.forEach((tool) => {
      const serverGroup = toolsByServer.get(tool.serverId);
      if (!serverGroup) return;

      // 从执行历史中获取工具统计信息
      const toolExecutions = executionHistory.filter(
        (record) =>
          record.toolName === tool.name && record.serverId === tool.serverId,
      );

      const executionCount = toolExecutions.length;
      const errorCount = toolExecutions.filter(
        (record) => record.isError,
      ).length;
      const averageExecutionTime =
        executionCount > 0
          ? toolExecutions.reduce(
              (sum, record) => sum + record.executionTime,
              0,
            ) / executionCount
          : 0;

      const lastExecution =
        toolExecutions.length > 0
          ? toolExecutions[0].timestamp // 最新的执行记录
          : undefined;

      serverGroup.tools.push({
        name: tool.name,
        description: tool.description,
        isAvailable: serverGroup.serverStatus === 'connected',
        lastExecution,
        executionCount,
        errorCount,
        averageExecutionTime: Math.round(averageExecutionTime),
      });
    });

    // 计算总体监控统计
    const totalTools = allTools.length;
    const availableTools = allTools.filter(
      (tool) => serverHealth.get(tool.serverId) === 'connected',
    ).length;
    const totalServers = toolsByServer.size;
    const connectedServers = Array.from(toolsByServer.values()).filter(
      (server) => server.serverStatus === 'connected',
    ).length;

    logger.info('获取工具状态监控信息', {
      groupId,
      totalTools,
      availableTools,
      totalServers,
      connectedServers,
    });

    return c.json({
      success: true,
      data: {
        overview: {
          totalTools,
          availableTools,
          unavailableTools: totalTools - availableTools,
          totalServers,
          connectedServers,
          disconnectedServers: totalServers - connectedServers,
          availabilityRate:
            totalTools > 0 ? (availableTools / totalTools) * 100 : 0,
        },
        toolsByServer: Object.fromEntries(toolsByServer),
        groupId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/health - 获取工具健康检查信息
toolsApi.get('/health', async (c) => {
  try {
    const groupId = c.req.query('groupId') || 'default';
    const service = await getHubService();

    // 获取服务诊断信息
    const diagnostics = await service.getServiceDiagnostics();

    // 获取所有工具
    const allTools = await service.listTools(groupId);

    // 计算工具健康状态
    const toolHealthChecks = allTools.map((tool) => {
      const serverDetail = diagnostics.servers.details.find(
        (s) => s.id === tool.serverId,
      );
      const serverStatus = serverDetail?.status || 'unknown';
      const isHealthy = serverStatus === 'connected';

      // 从执行历史中获取最近的错误信息
      const recentExecutions = executionHistory
        .filter(
          (record) =>
            record.toolName === tool.name && record.serverId === tool.serverId,
        )
        .slice(0, 10); // 最近10次执行

      const recentErrors = recentExecutions.filter((record) => record.isError);
      const errorRate =
        recentExecutions.length > 0
          ? (recentErrors.length / recentExecutions.length) * 100
          : 0;

      const lastError = recentErrors.length > 0 ? recentErrors[0] : null;

      return {
        toolName: tool.name,
        serverId: tool.serverId,
        serverStatus,
        isHealthy,
        isAvailable: isHealthy,
        recentExecutions: recentExecutions.length,
        recentErrors: recentErrors.length,
        errorRate: Math.round(errorRate),
        lastError: lastError
          ? {
              timestamp: lastError.timestamp,
              executionId: lastError.id,
              error: lastError.result,
            }
          : null,
        issues: [
          ...(serverStatus !== 'connected'
            ? [`服务器 ${tool.serverId} 未连接`]
            : []),
          ...(errorRate > 50 ? [`错误率过高: ${errorRate}%`] : []),
        ],
      };
    });

    // 计算总体健康状态
    const healthyTools = toolHealthChecks.filter(
      (check) => check.isHealthy,
    ).length;
    const totalTools = toolHealthChecks.length;
    const overallHealthy = totalTools > 0 && healthyTools / totalTools >= 0.8; // 80%以上工具健康才算整体健康

    logger.info('获取工具健康检查信息', {
      groupId,
      totalTools,
      healthyTools,
      overallHealthy,
    });

    return c.json({
      success: true,
      data: {
        overall: {
          isHealthy: overallHealthy,
          totalTools,
          healthyTools,
          unhealthyTools: totalTools - healthyTools,
          healthRate: totalTools > 0 ? (healthyTools / totalTools) * 100 : 0,
        },
        tools: toolHealthChecks,
        groupId,
        serverDiagnostics: diagnostics.servers,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/performance - 获取工具性能分析信息
toolsApi.get('/performance', async (c) => {
  try {
    const groupId = c.req.query('groupId');
    const serverId = c.req.query('serverId');
    const timeRange = c.req.query('timeRange') || '1h'; // 1h, 6h, 24h, 7d

    // 计算时间范围
    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    // 过滤执行历史
    let filteredHistory = executionHistory.filter((record) => {
      const recordTime = new Date(record.timestamp);
      return recordTime >= startTime && recordTime <= now;
    });

    // 应用额外过滤器
    if (groupId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.groupId === groupId,
      );
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.serverId === serverId,
      );
    }

    // 计算性能指标
    const totalExecutions = filteredHistory.length;
    const successfulExecutions = filteredHistory.filter(
      (r) => !r.isError,
    ).length;
    const failedExecutions = filteredHistory.filter((r) => r.isError).length;

    // 执行时间统计
    const executionTimes = filteredHistory.map((r) => r.executionTime);
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) /
          executionTimes.length
        : 0;

    const minExecutionTime =
      executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
    const maxExecutionTime =
      executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

    // 计算百分位数
    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    const p50 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.5)]
        : 0;
    const p95 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
        : 0;
    const p99 =
      sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length * 0.99)]
        : 0;

    // 按工具分组性能数据
    const toolPerformance = new Map<
      string,
      {
        executions: number;
        successes: number;
        failures: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
      }
    >();

    filteredHistory.forEach((record) => {
      const toolName = record.toolName;
      if (!toolPerformance.has(toolName)) {
        toolPerformance.set(toolName, {
          executions: 0,
          successes: 0,
          failures: 0,
          averageTime: 0,
          minTime: Number.MAX_VALUE,
          maxTime: 0,
        });
      }

      const perf = toolPerformance.get(toolName);
      if (!perf) return;
      perf.executions++;
      if (record.isError) {
        perf.failures++;
      } else {
        perf.successes++;
      }

      perf.minTime = Math.min(perf.minTime, record.executionTime);
      perf.maxTime = Math.max(perf.maxTime, record.executionTime);
    });

    // 计算平均时间
    toolPerformance.forEach((perf, toolName) => {
      const toolExecutions = filteredHistory.filter(
        (r) => r.toolName === toolName,
      );
      perf.averageTime =
        toolExecutions.reduce((sum, r) => sum + r.executionTime, 0) /
        toolExecutions.length;
      if (perf.minTime === Number.MAX_VALUE) perf.minTime = 0;
    });

    // 时间序列数据（按小时分组）
    const timeSeriesData = new Map<
      string,
      { executions: number; errors: number; averageTime: number }
    >();

    filteredHistory.forEach((record) => {
      const hour = `${new Date(record.timestamp).toISOString().slice(0, 13)}:00:00.000Z`;
      if (!timeSeriesData.has(hour)) {
        timeSeriesData.set(hour, { executions: 0, errors: 0, averageTime: 0 });
      }

      const data = timeSeriesData.get(hour);
      if (!data) return;
      data.executions++;
      if (record.isError) data.errors++;
    });

    // 计算每小时平均执行时间
    timeSeriesData.forEach((data, hour) => {
      const hourExecutions = filteredHistory.filter(
        (r) =>
          `${new Date(r.timestamp).toISOString().slice(0, 13)}:00:00.000Z` ===
          hour,
      );
      data.averageTime =
        hourExecutions.length > 0
          ? hourExecutions.reduce((sum, r) => sum + r.executionTime, 0) /
            hourExecutions.length
          : 0;
    });

    logger.info('获取工具性能分析信息', {
      timeRange,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      toolCount: toolPerformance.size,
      filters: { groupId, serverId },
    });

    return c.json({
      success: true,
      data: {
        timeRange,
        period: {
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
        },
        overview: {
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          successRate:
            totalExecutions > 0
              ? (successfulExecutions / totalExecutions) * 100
              : 0,
          averageExecutionTime: Math.round(averageExecutionTime),
          minExecutionTime,
          maxExecutionTime,
        },
        percentiles: {
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
        },
        toolPerformance: Object.fromEntries(
          Array.from(toolPerformance.entries()).map(([toolName, perf]) => [
            toolName,
            {
              ...perf,
              averageTime: Math.round(perf.averageTime),
              successRate:
                perf.executions > 0
                  ? (perf.successes / perf.executions) * 100
                  : 0,
            },
          ]),
        ),
        timeSeries: Array.from(timeSeriesData.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([timestamp, data]) => ({
            timestamp,
            executions: data.executions,
            errors: data.errors,
            averageTime: Math.round(data.averageTime),
            errorRate:
              data.executions > 0 ? (data.errors / data.executions) * 100 : 0,
          })),
        filters: { groupId, serverId },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/errors - 获取工具错误日志和调试信息
toolsApi.get('/errors', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const toolName = c.req.query('toolName');
    const serverId = c.req.query('serverId');
    const groupId = c.req.query('groupId');
    const severity = c.req.query('severity'); // 'error', 'warning'

    // 过滤错误记录
    let errorRecords = executionHistory.filter((record) => record.isError);

    if (toolName) {
      errorRecords = errorRecords.filter(
        (record) => record.toolName === toolName,
      );
    }
    if (serverId) {
      errorRecords = errorRecords.filter(
        (record) => record.serverId === serverId,
      );
    }
    if (groupId) {
      errorRecords = errorRecords.filter(
        (record) => record.groupId === groupId,
      );
    }

    // 分析错误类型和频率
    const errorAnalysis = new Map<
      string,
      {
        count: number;
        tools: Set<string>;
        servers: Set<string>;
        lastOccurrence: string;
        examples: Array<{
          executionId: string;
          timestamp: string;
          toolName: string;
        }>;
      }
    >();

    errorRecords.forEach((record) => {
      // 尝试从结果中提取错误信息
      let errorMessage = '未知错误';
      if (record.result && Array.isArray(record.result)) {
        const textContent = (
          record.result as Array<{ type: string; text?: string }>
        ).find((content) => content.type === 'text');
        if (textContent?.text) {
          errorMessage = textContent.text;
        }
      }

      // 简化错误消息用于分组
      const errorKey =
        errorMessage.length > 100
          ? `${errorMessage.substring(0, 100)}...`
          : errorMessage;

      if (!errorAnalysis.has(errorKey)) {
        errorAnalysis.set(errorKey, {
          count: 0,
          tools: new Set(),
          servers: new Set(),
          lastOccurrence: record.timestamp,
          examples: [],
        });
      }

      const analysis = errorAnalysis.get(errorKey);
      if (!analysis) return;
      analysis.count++;
      analysis.tools.add(record.toolName);
      analysis.servers.add(record.serverId);

      if (record.timestamp > analysis.lastOccurrence) {
        analysis.lastOccurrence = record.timestamp;
      }

      if (analysis.examples.length < 3) {
        analysis.examples.push({
          executionId: record.id,
          timestamp: record.timestamp,
          toolName: record.toolName,
        });
      }
    });

    // 分页错误记录
    const total = errorRecords.length;
    const paginatedErrors = errorRecords.slice(offset, offset + limit);

    // 转换错误分析结果
    const errorSummary = Array.from(errorAnalysis.entries())
      .sort((a, b) => b[1].count - a[1].count) // 按频率排序
      .slice(0, 20) // 只返回前20个最常见的错误
      .map(([errorMessage, analysis]) => ({
        errorMessage,
        count: analysis.count,
        affectedTools: Array.from(analysis.tools),
        affectedServers: Array.from(analysis.servers),
        lastOccurrence: analysis.lastOccurrence,
        examples: analysis.examples,
      }));

    logger.info('获取工具错误日志', {
      total,
      returned: paginatedErrors.length,
      uniqueErrors: errorSummary.length,
      filters: { toolName, serverId, groupId, severity },
    });

    return c.json({
      success: true,
      data: {
        errors: paginatedErrors.map((record) => ({
          executionId: record.id,
          toolName: record.toolName,
          serverId: record.serverId,
          groupId: record.groupId,
          timestamp: record.timestamp,
          executionTime: record.executionTime,
          arguments: record.arguments,
          result: record.result,
        })),
        errorSummary,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        filters: { toolName, serverId, groupId, severity },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// GET /api/tools/stats - 获取工具执行统计信息
toolsApi.get('/stats', async (c) => {
  try {
    const groupId = c.req.query('groupId');
    const serverId = c.req.query('serverId');

    let filteredHistory = [...executionHistory];

    // 应用过滤器
    if (groupId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.groupId === groupId,
      );
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter(
        (record) => record.serverId === serverId,
      );
    }

    // 计算统计信息
    const totalExecutions = filteredHistory.length;
    const successfulExecutions = filteredHistory.filter(
      (r) => !r.isError,
    ).length;
    const failedExecutions = filteredHistory.filter((r) => r.isError).length;
    const averageExecutionTime =
      filteredHistory.length > 0
        ? filteredHistory.reduce((sum, r) => sum + r.executionTime, 0) /
          filteredHistory.length
        : 0;

    // 按工具统计
    const toolStats = new Map<
      string,
      {
        executions: number;
        successes: number;
        failures: number;
        totalTime: number;
        averageTime: number;
      }
    >();

    filteredHistory.forEach((record) => {
      const toolName = record.toolName;
      if (!toolStats.has(toolName)) {
        toolStats.set(toolName, {
          executions: 0,
          successes: 0,
          failures: 0,
          totalTime: 0,
          averageTime: 0,
        });
      }

      const stats = toolStats.get(toolName);
      if (!stats) return;
      stats.executions++;
      if (record.isError) {
        stats.failures++;
      } else {
        stats.successes++;
      }
      stats.totalTime += record.executionTime;
      stats.averageTime = stats.totalTime / stats.executions;
    });

    // 获取最常用的工具
    const topTools = Array.from(toolStats.entries())
      .sort((a, b) => b[1].executions - a[1].executions)
      .slice(0, 10)
      .map(([toolName, stats]) => ({
        toolName,
        ...stats,
      }));

    logger.info('获取工具执行统计信息', {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      topToolsCount: topTools.length,
      filters: { groupId, serverId },
    });

    return c.json({
      success: true,
      data: {
        overview: {
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          successRate:
            totalExecutions > 0
              ? (successfulExecutions / totalExecutions) * 100
              : 0,
          averageExecutionTime: Math.round(averageExecutionTime),
        },
        topTools,
        filters: { groupId, serverId },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(handleApiError(error as Error), { status: 500 });
  }
});

// 修改工具执行端点以记录历史
// 需要在执行成功后添加记录
// 这将在现有的execute端点中集成

// 优雅关闭处理器
export async function shutdownToolsApi(): Promise<void> {
  try {
    if (hubService) {
      logger.info('关闭工具管理API服务');
      await hubService.shutdown();
      hubService = null;
    }
    logger.info('工具管理API关闭完成');
  } catch (error) {
    logger.error('工具管理API关闭时出错', error as Error);
    throw error;
  }
}
