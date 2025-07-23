/**
 * MCP服务工厂
 * 提供创建各种MCP服务实例的工厂方法
 */

import { McpServiceManager as McpServiceManagerImpl } from '../services/mcp/service-manager.js';
import type { GroupConfig, McpServerConfig } from '../types/config.js';
import type {
  McpServiceManager,
  ToolInfo,
  ToolResult,
} from '../types/service.js';

/**
 * MCP服务工厂接口
 */
export interface McpServiceFactory {
  /**
   * 创建核心MCP服务管理器
   */
  createCoreService(config: McpServerConfig): McpServiceManager;

  /**
   * 为API创建组特定服务包装器
   */
  createGroupServiceWrapper(
    coreService: McpServiceManager,
    groupConfig: GroupConfig,
  ): GroupMcpService;

  /**
   * 为CLI创建聚合器
   */
  createCliAggregator(coreService: McpServiceManager): CliMcpAggregator;
}

/**
 * 组特定MCP服务接口
 */
export interface GroupMcpService {
  /**
   * 初始化组特定的MCP服务
   */
  initialize(groupConfig: GroupConfig): Promise<void>;

  /**
   * 列出组可用工具
   */
  listTools(): Promise<Tool[]>;

  /**
   * 执行组内工具
   */
  callTool(toolName: string, args: unknown): Promise<ToolResult>;

  /**
   * 关闭服务
   */
  shutdown(): Promise<void>;
}

/**
 * CLI MCP聚合器接口
 */
export interface CliMcpAggregator {
  /**
   * 获取所有聚合的工具
   */
  getAllTools(): Promise<Tool[]>;

  /**
   * 执行工具调用
   */
  executeToolCall(toolName: string, args: unknown): Promise<ToolResult>;
}

/**
 * 工具信息接口（重新导出）
 */
export type Tool = ToolInfo;

/**
 * MCP服务工厂实现
 */
export class McpServiceFactoryImpl implements McpServiceFactory {
  createCoreService(config: McpServerConfig): McpServiceManager {
    return new McpServiceManagerImpl(config);
  }

  createGroupServiceWrapper(
    _coreService: McpServiceManager,
    _groupConfig: GroupConfig,
  ): GroupMcpService {
    // TODO: 实现组服务包装器
    throw new Error('GroupMcpService implementation not yet available');
  }

  createCliAggregator(_coreService: McpServiceManager): CliMcpAggregator {
    // TODO: 实现CLI聚合器
    throw new Error('CliMcpAggregator implementation not yet available');
  }
}

// 导出默认工厂实例
export const mcpServiceFactory = new McpServiceFactoryImpl();
