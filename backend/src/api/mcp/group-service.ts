/**
 * 组特定MCP服务包装器
 * 使用核心包功能为特定组提供MCP服务
 */

import { ConfigError, ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import { McpServer } from '@modelcontextprotocol/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';

import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';
import type { CallToolResult } from '@modelcontextprotocol/server';
// JSON Schema types
interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

// 读取 package.json
const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

/**
 * 协议层 cacheHint 默认值：tools/list 结果缓存 1 分钟，
 * cacheScope=public（工具列表跨用户一致）。
 * 见 spec §1.2。
 */
const DEFAULT_GROUP_CACHE_HINTS = {
  ttlMs: 60_000,
  cacheScope: 'public' as const,
};

import { getAllConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

import type { Group } from '@mcp-core/mcp-hub-share';

/**
 * 组MCP服务状态
 */
export interface GroupServiceStatus {
  groupId: string;
  isInitialized: boolean;
  serverCount: number;
  connectedServers: number;
  availableTools: number;
  lastUpdate: string;
}

/**
 * 工具信息
 */
export interface GroupToolInfo {
  name: string;
  description?: string;
  serverId: string;
  inputSchema?: Record<string, unknown>;
  status?: 'available' | 'unavailable';
}

/**
 * 组特定MCP服务包装器
 */
export class GroupMcpService {
  private mcpServer!: McpServer;
  private isInitialized = false;
  private groupConfig: Group | null = null;
  private availableTools: GroupToolInfo[] = [];
  /** 解析后的组级 cacheHints（initialize 内 buildMcpServer 时由 resolveCacheHints 覆盖） */
  private groupCacheHints: { ttlMs: number; cacheScope: 'public' | 'private' } = {
    ...DEFAULT_GROUP_CACHE_HINTS,
  };

  constructor(
    private groupId: string,
    private coreServiceManager: McpServiceManagerInterface,
  ) {
    // McpServer 构造延迟到 initialize()，以便读取组配置里的 cacheHints
  }

  /**
   * 初始化组服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('组MCP服务已初始化，跳过重复初始化', {
        groupId: this.groupId,
      });
      return;
    }

    try {
      logger.info('初始化组MCP服务', { groupId: this.groupId });

      // 加载组配置
      await this.loadGroupConfig();

      // 读配置后构造 McpServer（应用组级 cacheHints）
      this.buildMcpServer();

      // 注册组管理工具
      await this.registerGroupManagementTools();

      // 注册组特定的动态工具
      await this.registerGroupDynamicTools();

      this.isInitialized = true;
      logger.info('组MCP服务初始化完成', {
        groupId: this.groupId,
        toolCount: this.availableTools.length,
      });
    } catch (error) {
      logger.error('组MCP服务初始化失败', error as Error, {
        groupId: this.groupId,
      });
      throw error;
    }
  }

  /**
   * 构造 McpServer 并应用组级 cacheHints。
   * 必须在 loadGroupConfig() 之后调用，以便读取组配置里的 cacheHints 覆盖。
   */
  private buildMcpServer(): void {
    this.groupCacheHints = this.resolveCacheHints(this.groupConfig);
    this.mcpServer = new McpServer(
      { name: `${pkg.name}-group-${this.groupId}`, version: pkg.version },
      {
        cacheHints: {
          'tools/list': {
            ttlMs: this.groupCacheHints.ttlMs,
            cacheScope: this.groupCacheHints.cacheScope,
          },
        },
      },
    );
  }

  /**
   * 解析组级 cacheHints，应用默认值。
   * 默认：ttlMs=60_000（1 分钟），cacheScope='public'（工具列表跨用户一致）。
   * 组级覆盖缺失的字段回落到默认值。
   */
  private resolveCacheHints(groupConfig: Group | null): {
    ttlMs: number;
    cacheScope: 'public' | 'private';
  } {
    const overrides = groupConfig?.cacheHints;
    return {
      ttlMs: overrides?.toolsListTtlMs ?? DEFAULT_GROUP_CACHE_HINTS.ttlMs,
      cacheScope: overrides?.toolsListCacheScope ?? DEFAULT_GROUP_CACHE_HINTS.cacheScope,
    };
  }

  /**
   * 获取MCP服务器实例
   */
  getMcpServer(): McpServer {
    if (!this.isInitialized) {
      throw new ServiceError(
        ErrorCode.SERVICE_UNAVAILABLE,
        `组 '${this.groupId}' 的MCP服务未初始化`,
      );
    }
    return this.mcpServer;
  }

  /**
   * 获取组服务状态
   */
  async getStatus(): Promise<GroupServiceStatus> {
    try {
      const _serviceStatus = this.coreServiceManager.getServiceStatus();
      const serverConnections = this.coreServiceManager.getServerConnections();

      // 计算该组的服务器连接状态
      const groupServers = this.groupConfig?.servers || [];
      const connectedServers = Array.from(serverConnections.values()).filter(
        (conn) => groupServers.includes(conn.id) && conn.status === 'connected',
      ).length;

      return {
        groupId: this.groupId,
        isInitialized: this.isInitialized,
        serverCount: groupServers.length,
        connectedServers,
        availableTools: this.availableTools.length,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取组服务状态失败', error as Error, {
        groupId: this.groupId,
      });
      throw error;
    }
  }

  /**
   * 获取组可用工具列表
   */
  async getAvailableTools(): Promise<GroupToolInfo[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return [...this.availableTools];
  }

  /**
   * 关闭组服务
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('关闭组MCP服务', { groupId: this.groupId });

      // 关闭MCP服务器连接
      this.mcpServer.close();

      this.isInitialized = false;
      this.availableTools = [];

      logger.info('组MCP服务关闭完成', { groupId: this.groupId });
    } catch (error) {
      logger.error('关闭组MCP服务时出错', error as Error, {
        groupId: this.groupId,
      });
      throw error;
    }
  }

  /**
   * 加载组配置
   */
  private async loadGroupConfig(): Promise<void> {
    try {
      const config = await getAllConfig();
      this.groupConfig = config.groups[this.groupId] as Group;
      if (!this.groupConfig) {
        throw new ConfigError(ErrorCode.CONFIG_FILE_NOT_FOUND, `组 '${this.groupId}' 的配置未找到`);
      }

      logger.debug('组配置加载成功', {
        groupId: this.groupId,
        serverCount: this.groupConfig.servers?.length || 0,
        toolFilter: this.groupConfig.tools?.length || 0,
      });
    } catch (error) {
      logger.error('加载组配置失败', error as Error, { groupId: this.groupId });
      throw error;
    }
  }

  /**
   * 注册组管理工具
   */
  private async registerGroupManagementTools(): Promise<void> {
    // 组状态工具
    this.mcpServer.registerTool('group_status', { inputSchema: z.object({}) }, async () => {
      try {
        const status = await this.getStatus();
        return {
          content: [
            {
              type: 'text',
              text: `组 '${this.groupId}' 状态:\n${JSON.stringify(status, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        logger.error('获取组状态工具执行失败', error as Error, {
          groupId: this.groupId,
        });
        return {
          content: [
            {
              type: 'text',
              text: `获取组状态失败: ${(error as Error).message}`,
            },
          ],
        };
      }
    });

    // 组工具列表工具
    this.mcpServer.registerTool('list_group_tools', { inputSchema: z.object({}) }, async () => {
      try {
        const tools = await this.getAvailableTools();
        const toolList = tools
          .map((tool) => `- ${tool.name} (来自 ${tool.serverId}): ${tool.description || '无描述'}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `组 '${this.groupId}' 可用工具 (${tools.length} 个):\n${toolList}`,
            },
          ],
        };
      } catch (error) {
        logger.error('列出组工具失败', error as Error, {
          groupId: this.groupId,
        });
        return {
          content: [
            {
              type: 'text',
              text: `列出组工具失败: ${(error as Error).message}`,
            },
          ],
        };
      }
    });

    logger.debug('组管理工具注册完成', { groupId: this.groupId });
  }

  /**
   * 注册组特定的动态工具
   */
  private async registerGroupDynamicTools(): Promise<void> {
    try {
      // 获取组的服务器列表
      const groupServers = this.groupConfig?.servers || [];
      if (groupServers.length === 0) {
        logger.warn('组没有配置服务器', { groupId: this.groupId });
        return;
      }

      // 获取组内所有可用工具
      const allTools = await this.coreServiceManager.getAllTools();
      const groupTools = allTools.filter(
        (tool) => tool.serverId && groupServers.includes(tool.serverId),
      );

      // 应用组工具过滤规则
      const filteredTools = this.applyToolFilter(groupTools as GroupToolInfo[]);

      // 注册每个工具
      for (const tool of filteredTools) {
        await this.registerDynamicTool(tool);
      }

      this.availableTools = filteredTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId,
        inputSchema: tool.inputSchema,
      }));

      logger.info('组动态工具注册完成', {
        groupId: this.groupId,
        totalTools: groupTools.length,
        filteredTools: filteredTools.length,
      });
    } catch (error) {
      logger.error('注册组动态工具失败', error as Error, {
        groupId: this.groupId,
      });
      // 不抛出错误，允许服务继续运行
    }
  }

  /**
   * 应用组工具过滤规则
   */
  private applyToolFilter(tools: GroupToolInfo[]): GroupToolInfo[] {
    const toolFilter = this.groupConfig?.tools;

    // 如果没有配置工具过滤，返回所有工具
    if (!toolFilter || toolFilter.length === 0) {
      return tools;
    }

    // 如果配置了特定工具列表，只返回这些工具
    return tools.filter((tool) => toolFilter.includes(tool.name));
  }

  /**
   * 注册单个动态工具
   */
  private async registerDynamicTool(tool: GroupToolInfo): Promise<void> {
    try {
      // 创建工具名称（避免冲突）
      const toolName = `${tool.serverId}_${tool.name}`;

      // 转换输入模式为Zod模式
      const zodSchema = this.convertToZodSchema(
        (tool.inputSchema || {
          type: 'object',
          properties: {},
        }) as unknown as JsonSchema,
      );

      // 注册工具
      // v2: registerTool(name, { inputSchema }, handler)，zodSchema 是 raw shape 需用 z.object() 包装
      this.mcpServer.registerTool(toolName, { inputSchema: z.object(zodSchema) }, async (args) => {
        try {
          logger.debug('执行组动态工具', {
            groupId: this.groupId,
            toolName: tool.name,
            serverId: tool.serverId,
            args,
          });

          const result = await this.coreServiceManager.executeToolCall(
            tool.name,
            args,
            tool.serverId,
          );

          // 确保返回正确的格式
          if (result && typeof result === 'object' && 'content' in result) {
            return result as unknown as CallToolResult;
          }

          // 转换结果格式
          return {
            content: [
              {
                type: 'text' as const,
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('组动态工具执行失败', error as Error, {
            groupId: this.groupId,
            toolName: tool.name,
            serverId: tool.serverId,
          });

          return {
            content: [
              {
                type: 'text' as const,
                text: `工具执行失败: ${(error as Error).message}`,
              },
            ],
          };
        }
      });

      logger.debug('动态工具注册成功', {
        groupId: this.groupId,
        toolName,
        originalName: tool.name,
        serverId: tool.serverId,
      });
    } catch (error) {
      logger.error('注册动态工具失败', error as Error, {
        groupId: this.groupId,
        toolName: tool.name,
        serverId: tool.serverId,
      });
    }
  }

  /**
   * 转换JSON Schema到Zod Schema
   */
  private convertToZodSchema(inputSchema: JsonSchema): Record<string, z.ZodType> {
    if (!inputSchema || !inputSchema.properties) {
      return {};
    }

    const zodSchema: Record<string, z.ZodType> = {};

    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
      const prop = propDef as JsonSchemaProperty;

      // 基本类型转换
      switch (prop.type) {
        case 'string':
          zodSchema[propName] = z.string();
          break;
        case 'number':
          zodSchema[propName] = z.number();
          break;
        case 'boolean':
          zodSchema[propName] = z.boolean();
          break;
        case 'object':
          zodSchema[propName] = z.record(z.string(), z.any());
          break;
        case 'array':
          zodSchema[propName] = z.array(z.any());
          break;
        default:
          zodSchema[propName] = z.any();
      }

      // 添加描述
      if (prop.description) {
        zodSchema[propName] = zodSchema[propName].describe(prop.description);
      }

      // 处理可选属性
      if (!inputSchema.required || !inputSchema.required.includes(propName)) {
        zodSchema[propName] = zodSchema[propName].optional();
      }
    }

    return zodSchema;
  }
}
