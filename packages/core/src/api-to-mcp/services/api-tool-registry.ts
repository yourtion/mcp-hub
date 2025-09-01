/**
 * API工具注册表 - 管理动态生成的MCP工具
 */

import { logger } from '../../utils/logger.js';
import type { ApiToolConfig } from '../types/api-config.js';
import type { McpTool, ValidationResult } from '../types/api-tool.js';

/**
 * 工具过滤选项
 */
export interface ToolFilterOptions {
  /** 按工具名称过滤 */
  name?: string;
  /** 按工具ID过滤 */
  id?: string;
  /** 按描述关键词过滤 */
  description?: string;
  /** 是否启用模糊匹配 */
  fuzzy?: boolean;
}

/**
 * 工具注册事件类型
 */
export type ToolRegistryEventType = 'added' | 'updated' | 'removed' | 'cleared';

/**
 * 工具注册事件
 */
export interface ToolRegistryEvent {
  type: ToolRegistryEventType;
  toolId: string;
  tool?: McpTool;
  timestamp: Date;
}

/**
 * 工具注册事件监听器
 */
export type ToolRegistryEventListener = (event: ToolRegistryEvent) => void;

/**
 * 工具注册统计信息
 */
export interface ToolRegistryStats {
  /** 总工具数量 */
  totalTools: number;
  /** 按来源分组的工具数量 */
  toolsBySource: Record<string, number>;
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 注册表创建时间 */
  createdAt: Date;
}

/**
 * API工具注册表类
 * 负责管理动态生成的MCP工具的注册、更新和查询
 */
export class ApiToolRegistry {
  /** 工具存储映射 */
  private tools = new Map<string, McpTool>();

  /** 工具配置映射 */
  private toolConfigs = new Map<string, ApiToolConfig>();

  /** 事件监听器 */
  private eventListeners = new Set<ToolRegistryEventListener>();

  /** 注册表创建时间 */
  private readonly createdAt = new Date();

  /** 最后更新时间 */
  private lastUpdated = new Date();

  /**
   * 注册工具
   * @param tool MCP工具定义
   * @param config 对应的API配置
   * @returns 注册结果
   */
  registerTool(tool: McpTool, config: ApiToolConfig): ValidationResult {
    logger.debug('注册API工具', { context: { toolId: tool.name } });

    try {
      // 验证工具定义
      const validation = this.validateTool(tool);
      if (!validation.valid) {
        logger.warn('工具注册失败：验证不通过', {
          context: {
            toolId: tool.name,
            errors: validation.errors,
          },
        });
        return validation;
      }

      // 检查是否已存在
      const isUpdate = this.tools.has(tool.name);

      // 存储工具和配置
      this.tools.set(tool.name, tool);
      this.toolConfigs.set(tool.name, config);
      this.lastUpdated = new Date();

      // 触发事件
      this.emitEvent({
        type: isUpdate ? 'updated' : 'added',
        toolId: tool.name,
        tool,
        timestamp: new Date(),
      });

      logger.info(`工具${isUpdate ? '更新' : '注册'}成功`, {
        context: {
          toolId: tool.name,
          description: tool.description,
        },
      });

      return { valid: true, errors: [] };
    } catch (error) {
      logger.error('工具注册失败', error as Error, {
        context: { toolId: tool.name },
      });
      return {
        valid: false,
        errors: [
          {
            path: 'tool',
            message: `注册失败: ${(error as Error).message}`,
            code: 'REGISTRATION_FAILED',
          },
        ],
      };
    }
  }

  /**
   * 批量注册工具
   * @param toolsWithConfigs 工具和配置的数组
   * @returns 注册结果统计
   */
  registerTools(
    toolsWithConfigs: Array<{ tool: McpTool; config: ApiToolConfig }>,
  ): {
    successful: number;
    failed: number;
    errors: Array<{ toolId: string; error: string }>;
  } {
    logger.info('批量注册API工具', {
      context: { count: toolsWithConfigs.length },
    });

    let successful = 0;
    let failed = 0;
    const errors: Array<{ toolId: string; error: string }> = [];

    for (const { tool, config } of toolsWithConfigs) {
      const result = this.registerTool(tool, config);
      if (result.valid) {
        successful++;
      } else {
        failed++;
        errors.push({
          toolId: tool.name,
          error: result.errors.map((e) => e.message).join(', '),
        });
      }
    }

    logger.info('批量注册完成', {
      context: {
        successful,
        failed,
        total: toolsWithConfigs.length,
      },
    });

    return { successful, failed, errors };
  }

  /**
   * 注销工具
   * @param toolId 工具ID
   * @returns 是否成功注销
   */
  unregisterTool(toolId: string): boolean {
    logger.debug('注销API工具', { context: { toolId } });

    if (!this.tools.has(toolId)) {
      logger.warn('工具注销失败：工具不存在', { context: { toolId } });
      return false;
    }

    const tool = this.tools.get(toolId);
    this.tools.delete(toolId);
    this.toolConfigs.delete(toolId);
    this.lastUpdated = new Date();

    // 触发事件
    this.emitEvent({
      type: 'removed',
      toolId,
      tool,
      timestamp: new Date(),
    });

    logger.info('工具注销成功', { context: { toolId } });
    return true;
  }

  /**
   * 获取工具
   * @param toolId 工具ID
   * @returns 工具定义或undefined
   */
  getTool(toolId: string): McpTool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取工具配置
   * @param toolId 工具ID
   * @returns API配置或undefined
   */
  getToolConfig(toolId: string): ApiToolConfig | undefined {
    return this.toolConfigs.get(toolId);
  }

  /**
   * 获取所有工具
   * @returns 工具数组
   */
  getAllTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有工具ID
   * @returns 工具ID数组
   */
  getAllToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 检查工具是否存在
   * @param toolId 工具ID
   * @returns 是否存在
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * 获取工具数量
   * @returns 工具数量
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * 过滤工具
   * @param options 过滤选项
   * @returns 匹配的工具数组
   */
  filterTools(options: ToolFilterOptions): McpTool[] {
    const tools = this.getAllTools();

    return tools.filter((tool) => {
      // 按工具名称过滤
      if (options.name) {
        if (options.fuzzy) {
          if (!tool.name.toLowerCase().includes(options.name.toLowerCase())) {
            return false;
          }
        } else {
          if (tool.name !== options.name) {
            return false;
          }
        }
      }

      // 按工具ID过滤（工具ID就是工具名称）
      if (options.id) {
        if (options.fuzzy) {
          if (!tool.name.toLowerCase().includes(options.id.toLowerCase())) {
            return false;
          }
        } else {
          if (tool.name !== options.id) {
            return false;
          }
        }
      }

      // 按描述关键词过滤
      if (options.description) {
        if (options.fuzzy) {
          if (
            !tool.description
              .toLowerCase()
              .includes(options.description.toLowerCase())
          ) {
            return false;
          }
        } else {
          if (tool.description !== options.description) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * 搜索工具
   * @param query 搜索关键词
   * @returns 匹配的工具数组
   */
  searchTools(query: string): McpTool[] {
    const lowerQuery = query.toLowerCase();

    return this.getAllTools().filter((tool) => {
      return (
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * 清空注册表
   */
  clear(): void {
    logger.info('清空工具注册表', { context: { toolCount: this.tools.size } });

    this.tools.clear();
    this.toolConfigs.clear();
    this.lastUpdated = new Date();

    // 触发事件
    this.emitEvent({
      type: 'cleared',
      toolId: '*',
      timestamp: new Date(),
    });

    logger.info('工具注册表已清空');
  }

  /**
   * 获取注册表统计信息
   * @returns 统计信息
   */
  getStats(): ToolRegistryStats {
    const toolsBySource: Record<string, number> = {};

    // 统计按来源分组的工具数量（这里简化为按配置的API URL域名分组）
    for (const config of this.toolConfigs.values()) {
      try {
        const url = new URL(config.api.url);
        const domain = url.hostname;
        toolsBySource[domain] = (toolsBySource[domain] || 0) + 1;
      } catch {
        toolsBySource.unknown = (toolsBySource.unknown || 0) + 1;
      }
    }

    return {
      totalTools: this.tools.size,
      toolsBySource,
      lastUpdated: this.lastUpdated,
      createdAt: this.createdAt,
    };
  }

  /**
   * 添加事件监听器
   * @param listener 事件监听器
   */
  addEventListener(listener: ToolRegistryEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * 移除事件监听器
   * @param listener 事件监听器
   */
  removeEventListener(listener: ToolRegistryEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * 移除所有事件监听器
   */
  removeAllEventListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 验证工具定义
   * @param tool MCP工具定义
   * @returns 验证结果
   */
  private validateTool(tool: McpTool): ValidationResult {
    const errors = [];

    // 验证工具名称
    if (
      !tool.name ||
      typeof tool.name !== 'string' ||
      tool.name.trim() === ''
    ) {
      errors.push({
        path: 'name',
        message: '工具名称不能为空',
        code: 'INVALID_TOOL_NAME',
      });
    }

    // 验证工具名称格式
    if (tool.name && !/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
      errors.push({
        path: 'name',
        message: '工具名称只能包含字母、数字、下划线和连字符',
        code: 'INVALID_TOOL_NAME_FORMAT',
      });
    }

    // 验证工具描述
    if (!tool.description || typeof tool.description !== 'string') {
      errors.push({
        path: 'description',
        message: '工具描述不能为空',
        code: 'INVALID_TOOL_DESCRIPTION',
      });
    }

    // 验证输入schema
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      errors.push({
        path: 'inputSchema',
        message: '输入schema不能为空',
        code: 'INVALID_INPUT_SCHEMA',
      });
    } else if (tool.inputSchema.type !== 'object') {
      errors.push({
        path: 'inputSchema.type',
        message: 'MCP工具输入schema类型必须为object',
        code: 'INVALID_SCHEMA_TYPE',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 触发事件
   * @param event 事件对象
   */
  private emitEvent(event: ToolRegistryEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('工具注册表事件监听器执行失败', error as Error, {
          context: {
            eventType: event.type,
            toolId: event.toolId,
          },
        });
      }
    }
  }
}
