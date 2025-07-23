/**
 * 服务相关类型定义
 */

/**
 * 服务状态
 */
export interface ServiceStatus {
  /** 是否已初始化 */
  initialized: boolean;
  /** 服务器数量 */
  serverCount: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 最后更新时间 */
  lastUpdated?: Date;
  /** 错误信息 */
  error?: string;
}

/**
 * 服务指标
 */
export interface ServiceMetrics {
  /** 请求数量 */
  requestCount: number;
  /** 错误数量 */
  errorCount: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 工具使用统计 */
  toolUsageStats: Record<string, number>;
}

// 重新导出工具相关类型
export type { ToolInfo, ToolResult } from './tool.js';

/**
 * MCP服务管理器接口
 */
export interface McpServiceManager {
  /** 从配置初始化MCP服务 */
  initializeFromConfig(
    config: import('./config.js').McpServerConfig,
  ): Promise<void>;

  /** 注册MCP服务器 */
  registerServer(
    serverId: string,
    config: import('./config.js').ServerConfig,
  ): Promise<void>;

  /** 获取所有可用工具 */
  getAllTools(): Promise<import('./tool.js').ToolInfo[]>;

  /** 执行工具调用 */
  executeToolCall(
    toolName: string,
    args: unknown,
    serverId?: string,
  ): Promise<import('./tool.js').ToolResult>;

  /** 获取服务状态 */
  getServiceStatus(): ServiceStatus;

  /** 关闭所有连接 */
  shutdown(): Promise<void>;
}
