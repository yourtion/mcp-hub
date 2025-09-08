/**
 * 组管理API端点
 * 提供组列表、组详情、组健康检查等API
 */

import {
  createCipher,
  createDecipher,
  createHash,
  randomBytes,
} from 'node:crypto';
import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import type {
  ConfigureGroupToolsRequest,
  CreateGroupRequest,
  GroupAvailableToolsResponse,
  GroupConfig,
  GroupValidationConfig,
  SetGroupValidationKeyRequest,
  UpdateGroupRequest,
} from '@mcp-core/mcp-hub-share';
import { Hono } from 'hono';
import { getAllConfig, saveConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

// 定义组配置类型
interface GroupConfigItem {
  id: string;
  name: string;
  description?: string;
  servers: string[];
  tools: string[];
  validation?: {
    enabled: boolean;
    validationKey?: string;
    createdAt?: string;
    lastUpdated?: string;
  };
}

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
      servers: config.mcps.mcpServers as Record<string, unknown>,
      groups: config.groups as Record<string, GroupConfigItem>,
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

    // 构建组列表，包含运行时状态和详细信息
    const groupList = await Promise.all(
      Object.entries(groups).map(async ([groupId, groupConfig]) => {
        try {
          // 计算组内服务器连接状态
          const groupServers = groupConfig.servers || [];
          const connectedServers = groupServers.filter((serverId: string) => {
            const connection = serverConnections.get(serverId);
            return connection && connection.status === 'connected';
          });

          // 获取组内工具数量和详细信息
          let toolCount = 0;
          let availableTools: any[] = [];
          try {
            const allTools = await coreServiceManager?.getAllTools();
            availableTools =
              allTools?.filter((tool) =>
                groupServers.includes(tool.serverId),
              ) || [];
            toolCount = availableTools.length;
          } catch (error) {
            logger.warn('获取组工具数量失败', {
              groupId,
              error: (error as Error).message,
            });
          }

          // 应用工具过滤
          const toolFilter = groupConfig.tools || [];
          let filteredTools = availableTools;
          if (toolFilter.length > 0) {
            filteredTools = availableTools.filter((tool) =>
              toolFilter.includes(tool.name),
            );
          }

          return {
            id: groupId,
            name: groupConfig.name || groupId,
            description: groupConfig.description || '',
            servers: groupServers,
            serverCount: groupServers.length,
            connectedServers: connectedServers.length,
            toolCount,
            filteredToolCount: filteredTools.length,
            tools: groupConfig.tools || [],
            toolFilterMode: toolFilter.length > 0 ? 'whitelist' : 'none',
            isHealthy: connectedServers.length > 0,
            healthScore:
              groupServers.length > 0
                ? Math.round(
                    (connectedServers.length / groupServers.length) * 100,
                  )
                : 0,
            validation: {
              enabled: groupConfig.validation?.enabled || false,
              hasKey: !!groupConfig.validation?.validationKey,
              createdAt: groupConfig.validation?.createdAt,
              lastUpdated: groupConfig.validation?.lastUpdated,
            },
            stats: {
              totalServers: groupServers.length,
              availableServers: connectedServers.length,
              totalTools: toolCount,
              filteredTools: filteredTools.length,
              healthPercentage:
                groupServers.length > 0
                  ? Math.round(
                      (connectedServers.length / groupServers.length) * 100,
                    )
                  : 0,
            },
            lastUpdated:
              groupConfig.validation?.lastUpdated || new Date().toISOString(),
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
            filteredToolCount: 0,
            tools: groupConfig.tools || [],
            toolFilterMode: 'none',
            isHealthy: false,
            healthScore: 0,
            validation: {
              enabled: false,
              hasKey: false,
            },
            stats: {
              totalServers: (groupConfig.servers || []).length,
              availableServers: 0,
              totalTools: 0,
              filteredTools: 0,
              healthPercentage: 0,
            },
            lastUpdated: new Date().toISOString(),
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
      filteredTools: groupList.reduce((sum, g) => sum + g.filteredToolCount, 0),
      averageHealthScore:
        groupList.length > 0
          ? Math.round(
              groupList.reduce((sum, g) => sum + g.healthScore, 0) /
                groupList.length,
            )
          : 0,
      groupsWithValidation: groupList.filter((g) => g.validation.enabled)
        .length,
      groupsWithToolFilter: groupList.filter((g) => g.toolFilterMode !== 'none')
        .length,
      summary: {
        status:
          groupList.filter((g) => g.isHealthy).length === groupList.length &&
          groupList.length > 0
            ? 'healthy'
            : groupList.filter((g) => g.isHealthy).length > 0
              ? 'partial'
              : 'unhealthy',
        issues: [
          ...(groupList.some((g) => g.healthScore < 50)
            ? ['部分组健康度较低']
            : []),
          ...(groupList.filter((g) => g.error).length > 0
            ? ['部分组存在错误']
            : []),
        ],
      },
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
      toolFilterMode:
        groupConfig.tools && groupConfig.tools.length > 0
          ? 'whitelist'
          : 'none',
      isHealthy: connectedServers.length > 0,
      healthScore:
        groupServers.length > 0
          ? Math.round((connectedServers.length / groupServers.length) * 100)
          : 0,
      validation: {
        enabled: groupConfig.validation?.enabled || false,
        hasKey: !!groupConfig.validation?.validationKey,
        validationKey: groupConfig.validation?.validationKey
          ? '***'
          : undefined,
        createdAt: groupConfig.validation?.createdAt,
        lastUpdated: groupConfig.validation?.lastUpdated,
      },
      stats: {
        totalServers: groupServers.length,
        availableServers: connectedServers.length,
        totalTools: groupTools.length,
        healthPercentage:
          groupServers.length > 0
            ? Math.round((connectedServers.length / groupServers.length) * 100)
            : 0,
      },
      performance: {
        averageResponseTime: 0, // TODO: 实现响应时间统计
        totalRequests: 0, // TODO: 实现请求统计
        successRate: 100, // TODO: 实现成功率统计
      },
      accessControl: {
        requiresValidation: groupConfig.validation?.enabled || false,
        toolAccessRestricted: groupConfig.tools && groupConfig.tools.length > 0,
      },
      lastUpdated:
        groupConfig.validation?.lastUpdated || new Date().toISOString(),
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
 * 加密密钥
 */
function encryptValidationKey(key: string): string {
  try {
    // 使用系统密钥进行加密（在实际生产环境中应该使用更安全的密钥管理）
    const systemKey =
      process.env.VALIDATION_KEY_SECRET || 'mcp-hub-default-secret-key';
    const hash = createHash('sha256')
      .update(systemKey)
      .digest('hex')
      .substring(0, 32);

    const cipher = createCipher('aes-256-cbc', hash);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  } catch (error) {
    logger.error('加密验证密钥失败', error as Error);
    throw new Error('密钥加密失败');
  }
}

/**
 * 解密密钥
 */
function decryptValidationKey(encryptedKey: string): string {
  try {
    const systemKey =
      process.env.VALIDATION_KEY_SECRET || 'mcp-hub-default-secret-key';
    const hash = createHash('sha256')
      .update(systemKey)
      .digest('hex')
      .substring(0, 32);

    const decipher = createDecipher('aes-256-cbc', hash);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('解密验证密钥失败', error as Error);
    throw new Error('密钥解密失败');
  }
}

/**
 * 生成随机验证密钥
 */
function generateValidationKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 评估密钥复杂度
 */
function assessKeyComplexity(key: string): 'weak' | 'medium' | 'strong' {
  let score = 0;

  // 长度评分
  if (key.length >= 16) score += 2;
  else if (key.length >= 12) score += 1;

  // 字符类型评分
  const hasLower = /[a-z]/.test(key);
  const hasUpper = /[A-Z]/.test(key);
  const hasNumbers = /[0-9]/.test(key);
  const hasSpecial = /[^a-zA-Z0-9]/.test(key);

  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecial) score += 2;

  // 模式检测（避免简单模式）
  const hasRepeatedChars = /(.)\1{2,}/.test(key);
  const hasSequentialChars =
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(
      key,
    );
  const hasCommonPatterns = /(password|qwerty|asdf|zxcv|1234|admin|user)/i.test(
    key,
  );

  if (hasRepeatedChars) score -= 1;
  if (hasSequentialChars) score -= 1;
  if (hasCommonPatterns) score -= 2;

  // 确定复杂度
  if (score >= 6) return 'strong';
  if (score >= 3) return 'medium';
  return 'weak';
}

/**
 * 计算密钥熵值
 */
function calculateEntropy(key: string): number {
  const charSet = new Set(key);
  const _charSetSize = charSet.size;

  // 估算字符集大小
  let estimatedCharSetSize = 0;
  if (/[a-z]/.test(key)) estimatedCharSetSize += 26;
  if (/[A-Z]/.test(key)) estimatedCharSetSize += 26;
  if (/[0-9]/.test(key)) estimatedCharSetSize += 10;
  if (/[^a-zA-Z0-9]/.test(key)) estimatedCharSetSize += 32; // 特殊字符

  // 计算熵值：log2(字符集大小^长度)
  if (estimatedCharSetSize <= 1) return 0;
  return Math.round(key.length * Math.log2(estimatedCharSetSize) * 100) / 100;
}

/**
 * 生成安全建议
 */
function generateSecurityRecommendations(key: string): string[] {
  const recommendations: string[] = [];
  const complexity = assessKeyComplexity(key);

  if (complexity === 'weak') {
    recommendations.push('使用大小写字母、数字和特殊字符的组合');
    recommendations.push('避免使用常见词汇或重复字符');
    recommendations.push('建议使用至少16个字符的长度');
  }

  if (key.length < 16) {
    recommendations.push('增加密钥长度至至少16个字符');
  }

  if (!/[A-Z]/.test(key)) {
    recommendations.push('添加大写字母');
  }

  if (!/[a-z]/.test(key)) {
    recommendations.push('添加小写字母');
  }

  if (!/[0-9]/.test(key)) {
    recommendations.push('添加数字');
  }

  if (!/[^a-zA-Z0-9]/.test(key)) {
    recommendations.push('添加特殊字符');
  }

  if (/(.)\1{2,}/.test(key)) {
    recommendations.push('避免重复字符');
  }

  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i.test(
      key,
    )
  ) {
    recommendations.push('避免连续字符');
  }

  return recommendations;
}

/**
 * 验证密钥格式
 */
function validateKeyFormat(key: string): { isValid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, error: '密钥不能为空' };
  }

  if (key.length < 8) {
    return { isValid: false, error: '密钥长度至少为8个字符' };
  }

  if (key.length > 128) {
    return { isValid: false, error: '密钥长度不能超过128个字符' };
  }

  // 检查密钥复杂度（至少包含字母和数字）
  const hasLetter = /[a-zA-Z]/.test(key);
  const hasNumber = /[0-9]/.test(key);

  if (!hasLetter || !hasNumber) {
    return { isValid: false, error: '密钥必须包含字母和数字' };
  }

  return { isValid: true };
}

/**
 * 验证组配置数据
 */
function validateGroupData(data: CreateGroupRequest | UpdateGroupRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证名称
  if ('name' in data && data.name !== undefined) {
    if (
      !data.name ||
      typeof data.name !== 'string' ||
      data.name.trim().length === 0
    ) {
      errors.push('组名称不能为空');
    } else if (data.name.length > 100) {
      errors.push('组名称长度不能超过100个字符');
    }
  }

  // 验证描述
  if ('description' in data && data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('组描述必须是字符串类型');
    } else if (data.description.length > 500) {
      errors.push('组描述长度不能超过500个字符');
    }
  }

  // 验证服务器列表
  if ('servers' in data && data.servers !== undefined) {
    if (!Array.isArray(data.servers)) {
      errors.push('服务器列表必须是数组');
    } else {
      for (let i = 0; i < data.servers.length; i++) {
        const serverId = data.servers[i];
        if (!serverId || typeof serverId !== 'string') {
          errors.push(`服务器列表[${i}]必须是非空字符串`);
        }
      }

      // 检查重复的服务器ID
      const uniqueServers = new Set(data.servers);
      if (uniqueServers.size !== data.servers.length) {
        errors.push('服务器列表包含重复的服务器ID');
      }
    }
  }

  // 验证工具列表
  if ('tools' in data && data.tools !== undefined) {
    if (!Array.isArray(data.tools)) {
      errors.push('工具列表必须是数组');
    } else {
      for (let i = 0; i < data.tools.length; i++) {
        const toolName = data.tools[i];
        if (!toolName || typeof toolName !== 'string') {
          errors.push(`工具列表[${i}]必须是非空字符串`);
        }
      }

      // 检查重复的工具名称
      const uniqueTools = new Set(data.tools);
      if (uniqueTools.size !== data.tools.length) {
        errors.push('工具列表包含重复的工具名称');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 验证组ID格式
 */
function validateGroupId(groupId: string): {
  isValid: boolean;
  error?: string;
} {
  if (!groupId || typeof groupId !== 'string') {
    return { isValid: false, error: '组ID不能为空' };
  }

  if (groupId.length < 1 || groupId.length > 50) {
    return { isValid: false, error: '组ID长度必须在1-50个字符之间' };
  }

  // 组ID只能包含字母、数字、连字符和下划线
  const validIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validIdPattern.test(groupId)) {
    return { isValid: false, error: '组ID只能包含字母、数字、连字符和下划线' };
  }

  return { isValid: true };
}

/**
 * 估算工具复杂度
 */
function estimateToolComplexity(schema: JsonSchema): {
  complexity: 'simple' | 'medium' | 'complex';
  parameterCount: number;
  requiredParameterCount: number;
  estimatedExecutionTime: 'fast' | 'medium' | 'slow';
} {
  const properties = schema.properties || {};
  const required = schema.required || [];
  const parameterCount = Object.keys(properties).length;
  const requiredParameterCount = required.length;

  // 计算复杂度得分
  let complexityScore = 0;

  // 基于参数数量
  complexityScore += parameterCount * 2;
  complexityScore += requiredParameterCount * 3;

  // 基于参数类型复杂度
  Object.values(properties).forEach((prop) => {
    switch (prop.type) {
      case 'object':
        complexityScore += 5;
        break;
      case 'array':
        complexityScore += 4;
        break;
      case 'number':
        complexityScore += 2;
        break;
      case 'boolean':
        complexityScore += 1;
        break;
      default:
        complexityScore += 1;
    }
  });

  // 确定复杂度级别
  let complexity: 'simple' | 'medium' | 'complex';
  let estimatedExecutionTime: 'fast' | 'medium' | 'slow';

  if (complexityScore <= 10) {
    complexity = 'simple';
    estimatedExecutionTime = 'fast';
  } else if (complexityScore <= 25) {
    complexity = 'medium';
    estimatedExecutionTime = 'medium';
  } else {
    complexity = 'complex';
    estimatedExecutionTime = 'slow';
  }

  return {
    complexity,
    parameterCount,
    requiredParameterCount,
    estimatedExecutionTime,
  };
}

/**
 * 创建新组
 */
groupsApi.post('/', async (c) => {
  try {
    const body = (await c.req.json()) as CreateGroupRequest;
    logger.debug('创建新组请求', { body });

    // 验证请求数据
    const validation = validateGroupData(body);
    if (!validation.isValid) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: validation.errors,
          },
        },
        { status: 400 },
      );
    }

    // 验证组ID
    const idValidation = validateGroupId(body.id);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否已存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, unknown>;

    if (groups[body.id]) {
      return c.json(
        {
          error: {
            code: 'GROUP_ALREADY_EXISTS',
            message: `组 '${body.id}' 已存在`,
          },
        },
        { status: 409 },
      );
    }

    // 验证服务器是否存在
    const mcpServers = config.mcps.mcpServers as Record<string, unknown>;
    const invalidServers = body.servers.filter(
      (serverId) => !mcpServers[serverId],
    );

    if (invalidServers.length > 0) {
      logger.warn('创建组时发现不存在的服务器', {
        groupId: body.id,
        invalidServers,
      });
      // 不阻止创建，但记录警告
    }

    // 创建新组配置
    const newGroup = {
      id: body.id,
      name: body.name,
      description: body.description || '',
      servers: body.servers || [],
      tools: body.tools || [],
    };

    // 保存到配置文件
    const updatedGroups = {
      ...groups,
      [body.id]: newGroup,
    };

    await saveConfig('group.json', updatedGroups as GroupConfig);

    // 重新初始化核心服务管理器以应用新配置
    if (coreServiceManager) {
      try {
        await coreServiceManager.shutdown();
        coreServiceManager = null;
        await ensureCoreServiceInitialized();
      } catch (error) {
        logger.warn('重新初始化核心服务管理器失败', {
          error: (error as Error).message,
        });
      }
    }

    logger.info('组创建成功', {
      groupId: body.id,
      groupName: body.name,
      serverCount: body.servers.length,
      toolCount: body.tools.length,
    });

    return c.json({
      success: true,
      data: {
        id: body.id,
        name: body.name,
        description: body.description || '',
        servers: body.servers || [],
        tools: body.tools || [],
        toolFilterMode:
          body.tools && body.tools.length > 0 ? 'whitelist' : 'none',
        validation: {
          enabled: false,
          hasKey: false,
        },
        stats: {
          totalServers: body.servers.length,
          availableServers: 0, // 需要连接后重新计算
          totalTools: body.tools.length,
          filteredTools: body.tools.length,
          healthPercentage: 0, // 需要连接后重新计算
        },
        accessControl: {
          requiresValidation: false,
          toolAccessRestricted: body.tools && body.tools.length > 0,
        },
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('创建组失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_CREATE_ERROR',
          message: `创建组失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 更新组配置
 */
groupsApi.put('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as UpdateGroupRequest;
    logger.debug('更新组配置请求', { groupId, body });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 验证请求数据
    const validation = validateGroupData(body);
    if (!validation.isValid) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据验证失败',
            details: validation.errors,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 验证服务器是否存在（如果提供了服务器列表）
    if (body.servers) {
      const mcpServers = config.mcps.mcpServers as Record<string, unknown>;
      const invalidServers = body.servers.filter(
        (serverId) => !mcpServers[serverId],
      );

      if (invalidServers.length > 0) {
        logger.warn('更新组时发现不存在的服务器', {
          groupId,
          invalidServers,
        });
        // 不阻止更新，但记录警告
      }
    }

    // 更新组配置
    const updatedGroup = {
      ...existingGroup,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.servers !== undefined && { servers: body.servers }),
      ...(body.tools !== undefined && { tools: body.tools }),
    };

    // 保存到配置文件
    const updatedGroups = {
      ...groups,
      [groupId]: updatedGroup,
    };

    await saveConfig('group.json', updatedGroups as GroupConfig);

    // 重新初始化核心服务管理器以应用新配置
    if (coreServiceManager) {
      try {
        await coreServiceManager.shutdown();
        coreServiceManager = null;
        await ensureCoreServiceInitialized();
      } catch (error) {
        logger.warn('重新初始化核心服务管理器失败', {
          error: (error as Error).message,
        });
      }
    }

    logger.info('组更新成功', {
      groupId,
      groupName: updatedGroup.name,
      serverCount: updatedGroup.servers.length,
      toolCount: updatedGroup.tools.length,
    });

    return c.json({
      success: true,
      data: {
        id: groupId,
        name: updatedGroup.name,
        description: updatedGroup.description || '',
        servers: updatedGroup.servers || [],
        tools: updatedGroup.tools || [],
        toolFilterMode:
          updatedGroup.tools && updatedGroup.tools.length > 0
            ? 'whitelist'
            : 'none',
        validation: {
          enabled: updatedGroup.validation?.enabled || false,
          hasKey: !!updatedGroup.validation?.validationKey,
          createdAt: updatedGroup.validation?.createdAt,
          lastUpdated: updatedGroup.validation?.lastUpdated,
        },
        stats: {
          totalServers: updatedGroup.servers.length,
          availableServers: 0, // 需要重新计算
          totalTools: updatedGroup.tools.length,
          filteredTools: updatedGroup.tools.length,
          healthPercentage: 0, // 需要重新计算
        },
        accessControl: {
          requiresValidation: updatedGroup.validation?.enabled || false,
          toolAccessRestricted:
            updatedGroup.tools && updatedGroup.tools.length > 0,
        },
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('更新组失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_UPDATE_ERROR',
          message: `更新组失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 删除组
 */
groupsApi.delete('/:groupId', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('删除组请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 检查是否为默认组（可选的保护机制）
    if (groupId === 'default') {
      return c.json(
        {
          error: {
            code: 'CANNOT_DELETE_DEFAULT_GROUP',
            message: '不能删除默认组',
          },
        },
        { status: 403 },
      );
    }

    // 从配置中删除组
    const updatedGroups = { ...groups };
    delete updatedGroups[groupId];

    await saveConfig('group.json', updatedGroups as GroupConfig);

    // 重新初始化核心服务管理器以应用新配置
    if (coreServiceManager) {
      try {
        await coreServiceManager.shutdown();
        coreServiceManager = null;
        await ensureCoreServiceInitialized();
      } catch (error) {
        logger.warn('重新初始化核心服务管理器失败', {
          error: (error as Error).message,
        });
      }
    }

    logger.info('组删除成功', {
      groupId,
      groupName: existingGroup.name,
    });

    return c.json({
      success: true,
      data: {
        id: groupId,
        name: existingGroup.name,
        deleted: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('删除组失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_DELETE_ERROR',
          message: `删除组失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 配置组工具过滤
 */
groupsApi.post('/:groupId/tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as ConfigureGroupToolsRequest;
    logger.debug('配置组工具过滤请求', { groupId, body });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 验证请求数据
    if (!Array.isArray(body.tools)) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '工具列表必须是数组',
          },
        },
        { status: 400 },
      );
    }

    // 验证工具名称
    for (let i = 0; i < body.tools.length; i++) {
      const toolName = body.tools[i];
      if (!toolName || typeof toolName !== 'string') {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `工具列表[${i}]必须是非空字符串`,
            },
          },
          { status: 400 },
        );
      }
    }

    // 检查重复的工具名称
    const uniqueTools = new Set(body.tools);
    if (uniqueTools.size !== body.tools.length) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '工具列表包含重复的工具名称',
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 验证工具是否在组的服务器中可用
    await ensureCoreServiceInitialized();
    if (coreServiceManager) {
      try {
        const allTools = await coreServiceManager.getAllTools();
        const groupServers = existingGroup.servers || [];
        const availableTools = allTools.filter((tool) =>
          groupServers.includes(tool.serverId || ''),
        );
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
    if (coreServiceManager) {
      try {
        await coreServiceManager.shutdown();
        coreServiceManager = null;
        await ensureCoreServiceInitialized();
      } catch (error) {
        logger.warn('重新初始化核心服务管理器失败', {
          error: (error as Error).message,
        });
      }
    }

    logger.info('组工具过滤配置成功', {
      groupId,
      toolCount: body.tools.length,
      tools: body.tools,
    });

    return c.json({
      success: true,
      data: {
        groupId,
        tools: body.tools,
        toolCount: body.tools.length,
        filterMode: body.filterMode || 'whitelist',
        validation: {
          enabled: existingGroup.validation?.enabled || false,
          requiresKey:
            existingGroup.validation?.enabled &&
            !!existingGroup.validation?.validationKey,
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
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('配置组工具过滤失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_TOOLS_CONFIG_ERROR',
          message: `配置组工具过滤失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取组可用工具（支持过滤）
 */
groupsApi.get('/:groupId/available-tools', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组可用工具请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
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

    // 获取组内所有可用工具
    const availableTools = allTools.filter((tool) =>
      groupServers.includes(tool.serverId || ''),
    );

    // 应用工具过滤
    const toolFilter = groupConfig.tools || [];
    let filteredTools = availableTools;

    if (toolFilter.length > 0) {
      // 白名单模式：只显示配置的工具
      filteredTools = availableTools.filter((tool) =>
        toolFilter.includes(tool.name),
      );
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
          serverName: serverId, // 可以从服务器配置中获取实际名称
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          status: 'available' as const,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    // 构建响应
    const response = {
      groupId,
      tools: filteredTools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        serverId: tool.serverId || '',
        serverName: tool.serverId || '', // 可以从服务器配置中获取实际名称
        inputSchema: tool.inputSchema || { type: 'object', properties: {} },
        status: 'available' as const,
        category: tool.category || 'general',
        deprecated: tool.deprecated || false,
        version: tool.version || '1.0.0',
      })),
      toolsByServer,
      totalTools: availableTools.length,
      filteredTools: filteredTools.length,
      toolFilter,
      toolFilterMode: toolFilter.length > 0 ? 'whitelist' : 'none',
      filtering: {
        isFilteringEnabled: toolFilter.length > 0,
        filterRatio:
          availableTools.length > 0
            ? Math.round((filteredTools.length / availableTools.length) * 100)
            : 100,
        excludedTools: availableTools.length - filteredTools.length,
      },
      categories: [
        ...new Set(filteredTools.map((tool) => tool.category || 'general')),
      ],
      serverDistribution: Object.keys(toolsByServer).map((serverId) => ({
        serverId,
        toolCount: toolsByServer[serverId].length,
        percentage:
          filteredTools.length > 0
            ? Math.round(
                (toolsByServer[serverId].length / filteredTools.length) * 100,
              )
            : 0,
      })),
      timestamp: new Date().toISOString(),
    } as GroupAvailableToolsResponse;

    logger.info('组可用工具查询完成', {
      groupId,
      totalTools: response.totalTools,
      filteredTools: response.filteredTools,
      serverCount: Object.keys(toolsByServer).length,
    });

    return c.json(response);
  } catch (error) {
    logger.error('获取组可用工具失败', error as Error);
    return c.json(
      {
        error: {
          code: 'GROUP_AVAILABLE_TOOLS_ERROR',
          message: `获取组可用工具失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 验证工具访问权限
 */
groupsApi.post('/:groupId/validate-tool-access', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as { toolName: string };
    logger.debug('验证工具访问权限请求', { groupId, toolName: body.toolName });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 验证工具名称
    if (!body.toolName || typeof body.toolName !== 'string') {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '工具名称不能为空',
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
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

    // 检查工具是否在组中可用
    const groupServers = groupConfig.servers || [];
    const allTools = await coreServiceManager.getAllTools();

    // 查找工具
    const tool = allTools.find(
      (t) =>
        t.name === body.toolName && groupServers.includes(t.serverId || ''),
    );

    if (!tool) {
      return c.json({
        success: true,
        data: {
          groupId,
          toolName: body.toolName,
          hasAccess: false,
          reason: 'TOOL_NOT_FOUND_IN_GROUP',
          message: '工具在组中不可用',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 检查工具过滤
    const toolFilter = groupConfig.tools || [];
    let hasAccess = true;
    let reason = 'ACCESS_GRANTED';
    let message = '工具访问已授权';

    if (toolFilter.length > 0) {
      // 白名单模式：工具必须在允许列表中
      if (!toolFilter.includes(body.toolName)) {
        hasAccess = false;
        reason = 'TOOL_NOT_IN_WHITELIST';
        message = '工具不在组的允许列表中';
      }
    }

    logger.info('工具访问权限验证完成', {
      groupId,
      toolName: body.toolName,
      hasAccess,
      reason,
    });

    return c.json({
      success: true,
      data: {
        groupId,
        toolName: body.toolName,
        hasAccess,
        reason,
        message,
        validation: {
          groupHasValidation: groupConfig.validation?.enabled || false,
          toolInFilterList:
            toolFilter.length > 0 ? toolFilter.includes(body.toolName) : true,
          filterMode: toolFilter.length > 0 ? 'whitelist' : 'none',
        },
        toolInfo: hasAccess
          ? {
              name: tool.name,
              description: tool.description,
              serverId: tool.serverId,
              serverName: tool.serverId || '', // TODO: 获取实际服务器名称
              category: tool.category || 'general',
              version: tool.version || '1.0.0',
              deprecated: tool.deprecated || false,
              inputSchema: tool.inputSchema || {
                type: 'object',
                properties: {},
              },
              estimatedComplexity: estimateToolComplexity(
                tool.inputSchema || {},
              ),
            }
          : undefined,
        alternatives:
          !hasAccess && toolFilter.length > 0
            ? allTools
                .filter((t) => toolFilter.includes(t.name))
                .slice(0, 5)
                .map((t) => ({ name: t.name, description: t.description }))
            : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('验证工具访问权限失败', error as Error);
    return c.json(
      {
        error: {
          code: 'TOOL_ACCESS_VALIDATION_ERROR',
          message: `验证工具访问权限失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 设置组验证密钥
 */
groupsApi.post('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as SetGroupValidationKeyRequest;
    logger.debug('设置组验证密钥请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 验证密钥格式
    const keyValidation = validateKeyFormat(body.validationKey);
    if (!keyValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_VALIDATION_KEY',
            message: keyValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 加密密钥
    const encryptedKey = encryptValidationKey(body.validationKey);
    const now = new Date().toISOString();

    // 更新组配置，添加验证配置
    const validationConfig: GroupValidationConfig = {
      enabled: body.enabled !== false, // 默认启用
      validationKey: encryptedKey,
      createdAt: existingGroup.validation?.createdAt || now,
      lastUpdated: now,
    };

    const updatedGroup = {
      ...existingGroup,
      validation: validationConfig,
    };

    // 保存到配置文件
    const updatedGroups = {
      ...groups,
      [groupId]: updatedGroup,
    };

    await saveConfig('group.json', updatedGroups as GroupConfig);

    // 记录密钥设置日志（不记录实际密钥内容）
    logger.info('组验证密钥设置成功', {
      groupId,
      enabled: validationConfig.enabled,
      keyLength: body.validationKey.length,
      keyComplexity: assessKeyComplexity(body.validationKey),
      isFirstKey: !existingGroup.validation?.validationKey,
      timestamp: now,
    });

    return c.json({
      success: true,
      data: {
        groupId,
        validation: {
          enabled: validationConfig.enabled,
          hasKey: true,
          createdAt: validationConfig.createdAt,
          lastUpdated: validationConfig.lastUpdated,
        },
      },
      timestamp: now,
    });
  } catch (error) {
    logger.error('设置组验证密钥失败', error as Error);
    return c.json(
      {
        error: {
          code: 'VALIDATION_KEY_SET_ERROR',
          message: `设置组验证密钥失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 获取组验证密钥状态
 */
groupsApi.get('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('获取组验证密钥状态请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
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

    const validation = groupConfig.validation || {};

    return c.json({
      success: true,
      data: {
        groupId,
        validation: {
          enabled: validation.enabled || false,
          hasKey: !!validation.validationKey,
          createdAt: validation.createdAt,
          lastUpdated: validation.lastUpdated,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('获取组验证密钥状态失败', error as Error);
    return c.json(
      {
        error: {
          code: 'VALIDATION_KEY_STATUS_ERROR',
          message: `获取组验证密钥状态失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 验证组密钥
 */
groupsApi.post('/:groupId/validate-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const body = (await c.req.json()) as { validationKey: string };
    logger.debug('验证组密钥请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 验证请求数据
    if (!body.validationKey || typeof body.validationKey !== 'string') {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '验证密钥不能为空',
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
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

    const validation = groupConfig.validation || {};

    // 检查是否启用了验证
    if (!validation.enabled) {
      return c.json({
        success: true,
        data: {
          groupId,
          valid: true,
          reason: 'VALIDATION_DISABLED',
          message: '组未启用验证',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 检查是否设置了密钥
    if (!validation.validationKey) {
      return c.json({
        success: true,
        data: {
          groupId,
          valid: false,
          reason: 'NO_KEY_SET',
          message: '组未设置验证密钥',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 验证密钥
    let isValid = false;
    let reason = 'INVALID_KEY';
    let message = '验证密钥不正确';

    try {
      const storedKey = decryptValidationKey(validation.validationKey);
      isValid = storedKey === body.validationKey;

      if (isValid) {
        reason = 'KEY_VALID';
        message = '验证密钥正确';
      }
    } catch (error) {
      logger.error('解密存储的验证密钥失败', error as Error, { groupId });
      reason = 'DECRYPTION_ERROR';
      message = '密钥验证过程出错';
    }

    // 记录验证尝试（不记录实际密钥）
    logger.info('组密钥验证尝试', {
      groupId,
      valid: isValid,
      reason,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      success: true,
      data: {
        groupId,
        valid: isValid,
        reason,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('验证组密钥失败', error as Error);
    return c.json(
      {
        error: {
          code: 'KEY_VALIDATION_ERROR',
          message: `验证组密钥失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 删除组验证密钥
 */
groupsApi.delete('/:groupId/validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('删除组验证密钥请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 删除验证配置
    const updatedGroup = { ...existingGroup };
    delete updatedGroup.validation;

    // 保存到配置文件
    const updatedGroups = {
      ...groups,
      [groupId]: updatedGroup,
    };

    await saveConfig('group.json', updatedGroups as GroupConfig);

    logger.info('组验证密钥删除成功', {
      groupId,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      success: true,
      data: {
        groupId,
        validation: {
          enabled: false,
          hasKey: false,
        },
        deleted: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('删除组验证密钥失败', error as Error);
    return c.json(
      {
        error: {
          code: 'VALIDATION_KEY_DELETE_ERROR',
          message: `删除组验证密钥失败: ${(error as Error).message}`,
        },
      },
      { status: 500 },
    );
  }
});

/**
 * 生成新的验证密钥
 */
groupsApi.post('/:groupId/generate-validation-key', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    logger.debug('生成组验证密钥请求', { groupId });

    // 验证组ID
    const idValidation = validateGroupId(groupId);
    if (!idValidation.isValid) {
      return c.json(
        {
          error: {
            code: 'INVALID_GROUP_ID',
            message: idValidation.error,
          },
        },
        { status: 400 },
      );
    }

    // 检查组是否存在
    const config = await getAllConfig();
    const groups = config.groups as Record<string, any>;
    const existingGroup = groups[groupId];

    if (!existingGroup) {
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

    // 生成新密钥
    const newKey = generateValidationKey();
    const encryptedKey = encryptValidationKey(newKey);
    const now = new Date().toISOString();

    // 更新组配置
    const validationConfig: GroupValidationConfig = {
      enabled: true,
      validationKey: encryptedKey,
      createdAt: existingGroup.validation?.createdAt || now,
      lastUpdated: now,
    };

    const updatedGroup = {
      ...existingGroup,
      validation: validationConfig,
    };

    // 保存到配置文件
    const updatedGroups = {
      ...groups,
      [groupId]: updatedGroup,
    };

    await saveConfig('group.json', updatedGroups as GroupConfig);

    logger.info('组验证密钥生成成功', {
      groupId,
      keyLength: newKey.length,
      timestamp: now,
    });

    return c.json({
      success: true,
      data: {
        groupId,
        validationKey: newKey, // 返回明文密钥供用户保存
        validation: {
          enabled: true,
          hasKey: true,
          createdAt: validationConfig.createdAt,
          lastUpdated: validationConfig.lastUpdated,
        },
        security: {
          keyComplexity: assessKeyComplexity(newKey),
          keyLength: newKey.length,
          entropy: calculateEntropy(newKey),
          recommendations: generateSecurityRecommendations(newKey),
        },
        warnings: [
          ...(assessKeyComplexity(newKey) === 'weak'
            ? ['密钥强度较弱，建议使用更复杂的密钥']
            : []),
          ...(newKey.length < 16 ? ['密钥长度较短，建议至少16个字符'] : []),
        ],
      },
      timestamp: now,
    });
  } catch (error) {
    logger.error('生成组验证密钥失败', error as Error);
    return c.json(
      {
        error: {
          code: 'VALIDATION_KEY_GENERATE_ERROR',
          message: `生成组验证密钥失败: ${(error as Error).message}`,
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
