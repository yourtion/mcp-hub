/**
 * API工具集成服务
 * 负责将API转MCP工具集成到现有的MCP Hub中
 */

import {
  type ApiToMcpServiceManager,
  ApiToMcpServiceManagerImpl,
} from '@mcp-core/mcp-hub-core/api-to-mcp';
import type { Tool, ToolResult } from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';

/**
 * API工具集成服务类
 * 作为现有MCP Hub和API转MCP服务之间的桥梁
 */
export class ApiToolIntegrationService {
  private apiServiceManager: ApiToMcpServiceManager;
  private initialized = false;

  constructor() {
    this.apiServiceManager = new ApiToMcpServiceManagerImpl();
  }

  /**
   * 初始化API工具集成服务
   * @param configPath API工具配置文件路径
   */
  async initialize(configPath?: string): Promise<void> {
    if (this.initialized) {
      logger.warn('API工具集成服务已初始化，跳过重复初始化');
      return;
    }

    logger.info('初始化API工具集成服务', { configPath });

    try {
      if (configPath) {
        await this.apiServiceManager.initialize(configPath);
        logger.info('API工具集成服务初始化完成');
      } else {
        logger.info('未提供API工具配置文件，跳过API工具初始化');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('API工具集成服务初始化失败', error as Error);
      throw new Error(`API工具集成服务初始化失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取API生成的工具列表
   * @returns API工具数组
   */
  async getApiTools(): Promise<Tool[]> {
    if (!this.initialized) {
      return [];
    }

    try {
      const apiTools = await this.apiServiceManager.getApiTools();

      // 转换为MCP Hub的Tool格式
      return apiTools.map((apiTool) => ({
        name: apiTool.name,
        description: apiTool.description,
        inputSchema: apiTool.inputSchema,
        serverId: 'api-tools', // 标识这些工具来自API转换
      }));
    } catch (error) {
      logger.error('获取API工具列表失败', error as Error);
      return [];
    }
  }

  /**
   * 执行API工具
   * @param toolName 工具名称
   * @param args 调用参数
   * @returns 工具执行结果
   */
  async executeApiTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    if (!this.initialized) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'API工具集成服务未初始化',
          },
        ],
      };
    }

    logger.debug('执行API工具', { toolName, args });

    try {
      const result = await this.apiServiceManager.executeApiTool(
        toolName,
        args,
      );

      // 转换为MCP Hub的ToolResult格式
      return {
        isError: result.isError,
        content: result.content,
      };
    } catch (error) {
      logger.error('API工具执行失败', error as Error, { toolName });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `API工具执行失败: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * 检查工具是否为API工具
   * @param toolName 工具名称
   * @returns 是否为API工具
   */
  isApiTool(toolName: string): boolean {
    if (!this.initialized) {
      return false;
    }

    const toolDefinition = this.apiServiceManager.getToolDefinition(toolName);
    return toolDefinition !== undefined;
  }

  /**
   * 获取API工具定义
   * @param toolName 工具名称
   * @returns 工具定义或undefined
   */
  getApiToolDefinition(toolName: string): Tool | undefined {
    if (!this.initialized) {
      return undefined;
    }

    const apiTool = this.apiServiceManager.getToolDefinition(toolName);
    if (!apiTool) {
      return undefined;
    }

    return {
      name: apiTool.name,
      description: apiTool.description,
      inputSchema: apiTool.inputSchema,
      serverId: 'api-tools',
    };
  }

  /**
   * 重新加载API工具配置
   */
  async reloadConfig(): Promise<void> {
    if (!this.initialized) {
      logger.warn('API工具集成服务未初始化，无法重新加载配置');
      return;
    }

    logger.info('重新加载API工具配置');

    try {
      await this.apiServiceManager.reloadConfig();
      logger.info('API工具配置重新加载完成');
    } catch (error) {
      logger.error('重新加载API工具配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取API工具统计信息
   */
  async getStats(): Promise<{
    totalApiTools: number;
    initialized: boolean;
  }> {
    if (!this.initialized) {
      return {
        totalApiTools: 0,
        initialized: false,
      };
    }

    try {
      const apiTools = await this.apiServiceManager.getApiTools();
      return {
        totalApiTools: apiTools.length,
        initialized: true,
      };
    } catch (error) {
      logger.error('获取API工具统计信息失败', error as Error);
      return {
        totalApiTools: 0,
        initialized: true,
      };
    }
  }

  /**
   * 关闭API工具集成服务
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('关闭API工具集成服务');

    try {
      await this.apiServiceManager.shutdown();
      this.initialized = false;
      logger.info('API工具集成服务已关闭');
    } catch (error) {
      logger.error('关闭API工具集成服务时发生错误', error as Error);
      throw error;
    }
  }
}
