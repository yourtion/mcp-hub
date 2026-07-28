/**
 * 组特定MCP服务包装器
 * 使用核心包功能为特定组提供MCP服务
 */

import { ConfigError, ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';
import { McpServer } from '@modelcontextprotocol/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';

import { extractFromMeta, runWithTraceContext } from '../../middleware/trace-context.js';

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
 *
 * P2 复查钩子：当 P2 入站 OAuth 落地、且 Hub 实现按用户权限过滤工具时，
 * cacheScope 必须改 private，否则会泄露工具元数据给未授权用户（见 spec §3.1）。
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

      // 注册 Hub 元数据 resources（协议层 cacheHint 在 resources/read 的落点）
      await this.registerGroupResources();

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

      // 关闭MCP服务器连接（防御性：未初始化时 mcpServer 可能为 undefined）
      this.mcpServer?.close();

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

      // 确定性排序（先 serverId 后 toolName 字典序），保证 tools/list 顺序稳定，
      // 使客户端能稳定缓存 tools/list 结果、提升 LLM prompt cache 命中率。
      const sortedTools = [...filteredTools].toSorted((a, b) => {
        const byServer = (a.serverId ?? '').localeCompare(b.serverId ?? '');
        if (byServer !== 0) return byServer;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      // 注册每个工具
      for (const tool of sortedTools) {
        await this.registerDynamicTool(tool);
      }

      this.availableTools = sortedTools.map((tool) => ({
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
   * 获取组的服务器列表与连接状态。
   *
   * group://servers resource 的内容源：仅返回本组配置的服务器，
   * 不透传所有上游 server，从而保证 group 隔离边界。
   * 连接状态从 coreServiceManager.getServerConnections() 读取，
   * 缺失条目按 disconnected 处理。
   */
  private async getGroupServersStatus(): Promise<{
    groupId: string;
    servers: Array<{ id: string; status: string }>;
    timestamp: string;
  }> {
    const groupServers = this.groupConfig?.servers ?? [];
    const serverConnections = this.coreServiceManager.getServerConnections();
    return {
      groupId: this.groupId,
      servers: groupServers.map((id) => ({
        id,
        status: serverConnections.get(id)?.status ?? 'disconnected',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 注册 Hub 自身元数据 resources（协议层 cacheHint 在 resources/read 的落点）。
   *
   * 注册 4 个 resource：
   *   - group://{groupId}/status  —— 组运行时状态（短 ttl, private；状态频繁变化，且每用户隔离）
   *   - group://{groupId}/servers —— 服务器列表与连接状态（同上，private 短 ttl）
   *   - hub://config              —— 全局配置概要（长 ttl, public；跨用户/跨组一致）
   *   - hub://version             —— 版本信息（极长 ttl, public；进程生命周期内不变）
   *
   * cacheScope 取值理由：private 短 ttl 用于运行时状态（含连接状态、初始化进度，
   * 因 group 而异、随时间漂移）；public 长 ttl 用于全局静态信息（配置/版本）。
   *
   * 注意：SDK readCallback 签名为 (uri: URL, ctx: ServerContext) => ...；
   * 本实现用闭包内的 uri 字符串构造响应，不读取入参，故 callback 显式声明
   * `_uri: URL` 以匹配 SDK 签名（下划线前缀表示有意未使用）。
   */
  private async registerGroupResources(): Promise<void> {
    const statusUri = `group://${this.groupId}/status`;
    this.mcpServer.registerResource(
      'group_status_resource',
      statusUri,
      {
        description: `组 '${this.groupId}' 的运行时状态`,
        mimeType: 'application/json',
        cacheHint: { ttlMs: 5_000, cacheScope: 'private' },
      },
      async (_uri: URL) => {
        try {
          const status = await this.getStatus();
          return {
            contents: [
              {
                uri: statusUri,
                mimeType: 'application/json',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('读取 group://status resource 失败', error as Error, {
            groupId: this.groupId,
          });
          return {
            contents: [
              {
                uri: statusUri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: (error as Error).message, groupId: this.groupId }),
              },
            ],
          };
        }
      },
    );

    const serversUri = `group://${this.groupId}/servers`;
    this.mcpServer.registerResource(
      'group_servers',
      serversUri,
      {
        description: `组 '${this.groupId}' 的服务器列表与连接状态`,
        mimeType: 'application/json',
        cacheHint: { ttlMs: 5_000, cacheScope: 'private' },
      },
      async (_uri: URL) => {
        try {
          const payload = await this.getGroupServersStatus();
          return {
            contents: [
              {
                uri: serversUri,
                mimeType: 'application/json',
                text: JSON.stringify(payload, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('读取 group://servers resource 失败', error as Error, {
            groupId: this.groupId,
          });
          return {
            contents: [
              {
                uri: serversUri,
                mimeType: 'application/json',
                text: JSON.stringify({ error: (error as Error).message, groupId: this.groupId }),
              },
            ],
          };
        }
      },
    );

    this.mcpServer.registerResource(
      'hub_config',
      'hub://config',
      {
        description: 'Hub 全局配置概要',
        mimeType: 'application/json',
        cacheHint: { ttlMs: 300_000, cacheScope: 'public' },
      },
      async (_uri: URL) => {
        try {
          const config = await getAllConfig();
          const payload = {
            version: pkg.version,
            groups: Object.keys(config.groups ?? {}),
            serverCount: Object.keys(config.mcps?.servers ?? {}).length,
          };
          return {
            contents: [
              {
                uri: 'hub://config',
                mimeType: 'application/json',
                text: JSON.stringify(payload, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('读取 hub://config resource 失败', error as Error);
          return {
            contents: [
              {
                uri: 'hub://config',
                mimeType: 'application/json',
                text: JSON.stringify({ error: (error as Error).message, scope: 'global' }),
              },
            ],
          };
        }
      },
    );

    this.mcpServer.registerResource(
      'hub_version',
      'hub://version',
      {
        description: 'Hub 版本信息',
        mimeType: 'application/json',
        cacheHint: { ttlMs: 86_400_000, cacheScope: 'public' },
      },
      async (_uri: URL) => {
        try {
          return {
            contents: [
              {
                uri: 'hub://version',
                mimeType: 'application/json',
                text: JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error('读取 hub://version resource 失败', error as Error);
          return {
            contents: [
              {
                uri: 'hub://version',
                mimeType: 'application/json',
                text: JSON.stringify({ error: (error as Error).message, scope: 'global' }),
              },
            ],
          };
        }
      },
    );

    logger.debug('组 resources 注册完成', { groupId: this.groupId, count: 4 });
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
      this.mcpServer.registerTool(
        toolName,
        { inputSchema: z.object(zodSchema) },
        async (args, extra) => {
          // P6/SEP-414：从请求 _meta 提取 trace context，注入 AsyncLocalStorage，
          // 使下游 server_manager.executeToolOnServer 的出站 callTool 能读到并注入上游 _meta。
          // SDK v2 (2026-07-28 protocol) handler ctx 为 ServerContext，入站 _meta 在 ctx.mcpReq._meta；
          // optional chaining 防御 ctx 或 mcpReq 缺失（SDK 版本差异）。
          const traceCtx = extractFromMeta(extra?.mcpReq?._meta);
          return runWithTraceContext(traceCtx, async () => {
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
        },
      );

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
