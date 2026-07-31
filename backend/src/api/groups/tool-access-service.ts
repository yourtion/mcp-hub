/**
 * 组工具访问业务逻辑（纯函数模块）
 *
 * 本模块从 index.ts 抽离，负责 4 个 tool-access 端点的业务逻辑：
 * - 获取组的工具列表（GET /:groupId/tools）
 * - 配置组工具过滤（POST /:groupId/tools）
 * - 获取组可用工具（GET /:groupId/available-tools）
 * - 验证工具访问权限（POST /:groupId/validate-tool-access）
 *
 * 设计约束：
 * - 纯函数，不持有 Hono Context，不构造 HTTP 响应。
 * - 依赖（service-registry / config / logger / validation）按现状 import 方式获取。
 * - 校验失败 / 资源不存在等业务错误以结构化 ServiceError 抛出，由 handler
 *   转换为与原实现逐字一致的 HTTP 响应（响应结构沿用 Task 10 的模式）。
 *
 * 注意：原 handler 的 success 响应通过 successResponse(c, data) 构造；
 * 本 service 返回 data 部分（原样），由 handler 包裹。
 */

import {
  getCoreServiceManager,
  reloadCoreServiceManager,
} from '../../services/service-registry.js';
import { getAllConfig, saveConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { estimateToolComplexity, validateGroupId } from './validation.js';

import type { ToolInfo } from '@mcp-core/mcp-knot-core';
import type {
  ConfigureGroupToolsRequest,
  GroupAvailableToolsResponse,
  GroupConfig,
} from '@mcp-core/mcp-knot-share';

/**
 * 业务错误码（与原 handler 的响应 error.code 逐字对应）
 */
export type ToolAccessErrorCode = 'INVALID_GROUP_ID' | 'VALIDATION_ERROR' | 'GROUP_NOT_FOUND';

/**
 * 结构化业务错误。
 * handler 捕获后用 code/message/status 重建原 c.json 响应。
 */
export class ToolAccessServiceError extends Error {
  readonly code: ToolAccessErrorCode;
  readonly status: 400 | 404;

  constructor(code: ToolAccessErrorCode, message: string, status: 400 | 404) {
    super(message);
    this.name = 'ToolAccessServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * 组配置项（与 index.ts 中的 GroupConfigItem 一致，含 servers/tools/validation 字段）
 */
type GroupItem = {
  servers?: string[];
  tools?: string[];
  validation?: {
    enabled: boolean;
    validationKey?: string;
  };
  [key: string]: unknown;
};

/**
 * 所有组配置的类型（与 getAllConfig 返回的 groups 字段一致，DeepReadonly）。
 */
type GroupsConfig = Awaited<ReturnType<typeof getAllConfig>>['groups'];

/**
 * 读取单个组配置，不存在则抛 GROUP_NOT_FOUND（消息逐字保持原 handler）。
 *
 * 入参 groups 为 getAllConfig 返回的 DeepReadonly 结构；
 * 通过 as 转为可索引访问，与 index.ts 原实现访问方式一致。
 */
function requireExistingGroup(groupId: string, groups: GroupsConfig): GroupItem {
  const group = (groups as unknown as Record<string, GroupItem>)[groupId];
  if (!group) {
    throw new ToolAccessServiceError('GROUP_NOT_FOUND', `组 '${groupId}' 不存在`, 404);
  }
  return group;
}

/**
 * 校验组 ID 格式，无效则抛 INVALID_GROUP_ID（消息逐字保持原 handler）。
 */
function assertValidGroupId(groupId: string): void {
  const idValidation = validateGroupId(groupId);
  if (!idValidation.isValid) {
    throw new ToolAccessServiceError('INVALID_GROUP_ID', idValidation.error ?? '', 400);
  }
}

/**
 * 获取组的工具列表（GET /:groupId/tools）
 *
 * 注意：原 handler 不校验组 ID 格式，仅校验组存在性。本函数保持一致——
 * 不调用 assertValidGroupId，直接读配置查组是否存在。
 *
 * 返回原 handler successResponse 的 data 部分。
 */
export async function getGroupTools(groupId: string): Promise<{
  groupId: string;
  tools: Array<{
    name: string;
    description: string;
    serverId: string | undefined;
    parameters: unknown;
    category?: string;
    version?: string;
    deprecated?: boolean;
  }>;
  toolsByServer: Record<string, Record<string, unknown>[]>;
  totalTools: number;
  serverCount: number;
  toolFilter: string[];
}> {
  const config = await getAllConfig();
  const groups = config.groups;
  const groupConfig = requireExistingGroup(groupId, groups);

  const coreServiceManager = await getCoreServiceManager();

  const groupServers = groupConfig.servers || [];
  const allTools = await coreServiceManager.getAllTools();

  // 获取组内工具
  let groupTools = allTools.filter((tool) => groupServers.includes(tool.serverId || ''));

  // 应用组工具过滤
  if (groupConfig.tools && groupConfig.tools.length > 0) {
    groupTools = groupTools.filter((tool) => groupConfig.tools!.includes(tool.name));
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
    {} as Record<string, Record<string, unknown>[]>,
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
  };

  logger.info('组工具列表查询完成', {
    groupId,
    totalTools: response.totalTools,
    serverCount: response.serverCount,
  });

  return response;
}

/**
 * 配置组工具过滤（POST /:groupId/tools）
 *
 * 校验顺序与原 handler 逐字一致：组ID → tools 是数组 → 每项非空字符串 →
 * 不含重复 → 组存在 → （可选）工具可用性警告 → 保存。
 * 返回原 handler successResponse 的 data 部分。
 */
export async function configureGroupTools(
  groupId: string,
  body: ConfigureGroupToolsRequest,
): Promise<{
  groupId: string;
  tools: string[];
  toolCount: number;
  filterMode: 'whitelist' | 'blacklist';
  validation: {
    enabled: boolean;
    requiresKey: boolean | undefined;
  };
  impact: {
    previouslyFilteredTools: number;
    newlyFilteredTools: number;
    change: number;
  };
  accessControl: {
    toolAccessRestricted: boolean;
    unrestrictedAccess: boolean;
  };
  lastUpdated: string;
}> {
  assertValidGroupId(groupId);

  // 验证请求数据
  if (!Array.isArray(body.tools)) {
    throw new ToolAccessServiceError('VALIDATION_ERROR', '工具列表必须是数组', 400);
  }

  // 验证工具名称
  for (let i = 0; i < body.tools.length; i++) {
    const toolName = body.tools[i];
    if (!toolName || typeof toolName !== 'string') {
      throw new ToolAccessServiceError('VALIDATION_ERROR', `工具列表[${i}]必须是非空字符串`, 400);
    }
  }

  // 检查重复的工具名称
  const uniqueTools = new Set(body.tools);
  if (uniqueTools.size !== body.tools.length) {
    throw new ToolAccessServiceError('VALIDATION_ERROR', '工具列表包含重复的工具名称', 400);
  }

  // 检查组是否存在
  const config = await getAllConfig();
  const groups = config.groups;
  const existingGroup = requireExistingGroup(groupId, groups);

  // 验证工具是否在组的服务器中可用
  try {
    const coreServiceManager = await getCoreServiceManager();
    const allTools = await coreServiceManager.getAllTools();
    const groupServers = existingGroup.servers || [];
    const availableTools = allTools.filter((tool) => groupServers.includes(tool.serverId || ''));
    const availableToolNames = availableTools.map((tool) => tool.name);

    const unavailableTools = body.tools.filter(
      (toolName) => !availableToolNames.includes(toolName),
    );

    if (unavailableTools.length > 0) {
      logger.warn('配置的工具在组中不可用', {
        groupId,
        unavailableTools,
        availableTools: availableToolNames,
      });
      // 不阻止配置，但记录警告
    }
  } catch (error) {
    logger.warn('验证工具可用性时出错', {
      groupId,
      error: (error as Error).message,
    });
  }

  // 更新组的工具过滤配置
  const updatedGroup = {
    ...existingGroup,
    tools: body.tools,
  };

  // 保存到配置文件
  const updatedGroups = {
    ...groups,
    [groupId]: updatedGroup,
  };

  await saveConfig('group.json', updatedGroups as GroupConfig);

  // 重新初始化核心服务管理器以应用新配置
  try {
    await reloadCoreServiceManager();
  } catch (error) {
    logger.warn('重新初始化核心服务管理器失败', {
      error: (error as Error).message,
    });
  }

  logger.info('组工具过滤配置成功', {
    groupId,
    toolCount: body.tools.length,
    tools: body.tools,
  });

  return {
    groupId,
    tools: body.tools,
    toolCount: body.tools.length,
    filterMode: body.filterMode || 'whitelist',
    validation: {
      enabled: existingGroup.validation?.enabled || false,
      requiresKey: existingGroup.validation?.enabled && !!existingGroup.validation?.validationKey,
    },
    impact: {
      previouslyFilteredTools: existingGroup.tools?.length || 0,
      newlyFilteredTools: body.tools.length,
      change: body.tools.length - (existingGroup.tools?.length || 0),
    },
    accessControl: {
      toolAccessRestricted: body.tools.length > 0,
      unrestrictedAccess: body.tools.length === 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * 获取组可用工具（GET /:groupId/available-tools，支持过滤）
 *
 * 校验顺序与原 handler 逐字一致：组ID → 组存在。
 * 返回原 handler successResponse 的 data 部分（GroupAvailableToolsResponse）。
 */
export async function getGroupAvailableTools(
  groupId: string,
): Promise<GroupAvailableToolsResponse> {
  assertValidGroupId(groupId);

  // 检查组是否存在
  const config = await getAllConfig();
  const groups = config.groups;
  const groupConfig = requireExistingGroup(groupId, groups);

  const coreServiceManager = await getCoreServiceManager();

  const groupServers = groupConfig.servers || [];
  const allTools = await coreServiceManager.getAllTools();

  // 获取组内所有可用工具
  const availableTools = allTools.filter((tool) => groupServers.includes(tool.serverId || ''));

  // 应用工具过滤
  const toolFilter = groupConfig.tools || [];
  let filteredTools = availableTools;

  if (toolFilter.length > 0) {
    // 白名单模式：只显示配置的工具
    filteredTools = availableTools.filter((tool) => toolFilter.includes(tool.name));
  }

  // 按服务器分组
  const toolsByServer = filteredTools.reduce(
    (acc, tool) => {
      const serverId = tool.serverId || 'unknown';
      if (!acc[serverId]) {
        acc[serverId] = [];
      }
      acc[serverId].push({
        name: tool.name,
        description: tool.description || '',
        serverId: tool.serverId || '',
        serverName: tool.serverId || '',
        inputSchema: { type: 'object' as const, properties: {} },
        status: 'available' as const,
      });
      return acc;
    },
    {} as GroupAvailableToolsResponse['toolsByServer'],
  );

  // 构建响应
  const response: GroupAvailableToolsResponse = {
    groupId,
    tools: filteredTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      serverId: tool.serverId || '',
      serverName: tool.serverId || '',
      inputSchema: { type: 'object' as const, properties: {} },
      status: 'available' as const,
    })),
    toolsByServer,
    totalTools: availableTools.length,
    filteredTools: filteredTools.length,
    toolFilter: [...toolFilter],
    filtering: {
      isFilteringEnabled: toolFilter.length > 0,
      filterRatio:
        availableTools.length > 0
          ? Math.round((filteredTools.length / availableTools.length) * 100)
          : 100,
      excludedTools: availableTools.length - filteredTools.length,
    },
    categories: [...new Set(filteredTools.map((tool) => tool.category || 'general'))],
    serverDistribution: Object.keys(toolsByServer).map((serverId) => ({
      serverId,
      toolCount: toolsByServer[serverId].length,
      percentage:
        filteredTools.length > 0
          ? Math.round((toolsByServer[serverId].length / filteredTools.length) * 100)
          : 0,
    })),
    timestamp: new Date().toISOString(),
  };

  logger.info('组可用工具查询完成', {
    groupId,
    totalTools: response.totalTools,
    filteredTools: response.filteredTools,
    serverCount: Object.keys(toolsByServer).length,
  });

  return response;
}

/**
 * 验证工具访问权限（POST /:groupId/validate-tool-access）
 *
 * 校验顺序与原 handler 逐字一致：组ID → 工具名称非空 → 组存在。
 * 工具不存在时返回 hasAccess:false 的成功响应（不抛错），与原 handler 一致。
 * 返回原 handler successResponse 的 data 部分。
 */
export async function validateToolAccess(
  groupId: string,
  toolName: string | undefined,
): Promise<{
  groupId: string;
  toolName: string;
  hasAccess: boolean;
  reason: string;
  message: string;
  validation?: {
    groupHasValidation: boolean;
    toolInFilterList: boolean;
    filterMode: string;
  };
  toolInfo?: {
    name: string;
    description: string;
    serverId: string | undefined;
    serverName: string;
    category: string;
    version: string;
    deprecated: boolean;
    inputSchema: { type: string; properties: Record<string, never> };
    estimatedComplexity: ReturnType<typeof estimateToolComplexity>;
  };
  alternatives?: Array<{ name: string; description: string }> | undefined;
}> {
  assertValidGroupId(groupId);

  // 验证工具名称
  if (!toolName || typeof toolName !== 'string') {
    throw new ToolAccessServiceError('VALIDATION_ERROR', '工具名称不能为空', 400);
  }

  // 检查组是否存在
  const config = await getAllConfig();
  const groups = config.groups;
  const groupConfig = requireExistingGroup(groupId, groups);

  const coreServiceManager = await getCoreServiceManager();

  // 检查工具是否在组中可用
  const groupServers = groupConfig.servers || [];
  const allTools = await coreServiceManager.getAllTools();

  // 查找工具
  const tool = allTools.find((t) => t.name === toolName && groupServers.includes(t.serverId || ''));

  if (!tool) {
    return {
      groupId,
      toolName,
      hasAccess: false,
      reason: 'TOOL_NOT_FOUND_IN_GROUP',
      message: '工具在组中不可用',
    };
  }

  // 检查工具过滤
  const toolFilter = groupConfig.tools || [];
  let hasAccess = true;
  let reason = 'ACCESS_GRANTED';
  let message = '工具访问已授权';

  if (toolFilter.length > 0) {
    // 白名单模式：工具必须在允许列表中
    if (!toolFilter.includes(toolName)) {
      hasAccess = false;
      reason = 'TOOL_NOT_IN_WHITELIST';
      message = '工具不在组的允许列表中';
    }
  }

  logger.info('工具访问权限验证完成', {
    groupId,
    toolName,
    hasAccess,
    reason,
  });

  return {
    groupId,
    toolName,
    hasAccess,
    reason,
    message,
    validation: {
      groupHasValidation: groupConfig.validation?.enabled || false,
      toolInFilterList: toolFilter.length > 0 ? toolFilter.includes(toolName) : true,
      filterMode: toolFilter.length > 0 ? 'whitelist' : 'none',
    },
    toolInfo: hasAccess
      ? {
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          serverName: tool.serverId || '',
          category: tool.category || 'general',
          version: tool.version || '1.0.0',
          deprecated: tool.deprecated || false,
          inputSchema: { type: 'object', properties: {} },
          estimatedComplexity: estimateToolComplexity({
            type: 'object',
            properties: {},
          }),
        }
      : undefined,
    alternatives:
      !hasAccess && toolFilter.length > 0
        ? allTools
            .filter((t) => toolFilter.includes(t.name))
            .slice(0, 5)
            .map((t) => ({ name: t.name, description: t.description }))
        : undefined,
  };
}

// 保持 ToolInfo 类型引用以明确依赖（与 index.ts 一致），避免被 tree-shake 误判。
export type { ToolInfo };
