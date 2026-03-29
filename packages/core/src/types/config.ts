/**
 * 配置相关类型定义
 *
 * 所有类型统一从 share 的 Zod schema 推导
 */

export type {
  CliConfig,
  CliLogging,
  CliServerConfig,
  CliTransport,
  GroupConfig,
  GroupValidation,
  HttpServerConfig,
  McpConfig,
  RetryConfig,
  ServerConfig,
  StdioServerConfig,
  SystemConfig,
  ToolFilter,
} from '@mcp-core/mcp-hub-share/config';

/**
 * MCP 服务器配置 (core 特有的组合类型)
 * 包含 servers + groups + settings
 */
export interface McpServerConfig {
  /** 服务器配置 */
  servers: Record<
    string,
    import('@mcp-core/mcp-hub-share/config').ServerConfig
  >;
  /** 组配置 */
  groups?: import('@mcp-core/mcp-hub-share/config').GroupConfig;
  /** 全局设置 */
  settings?: GlobalSettings;
}

/**
 * 全局设置 (core 特有)
 */
export interface GlobalSettings {
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 连接超时 */
  connectionTimeout?: number;
  /** 最大并发连接数 */
  maxConcurrentConnections?: number;
}
