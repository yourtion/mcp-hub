/**
 * 配置相关类型定义
 */

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  /** 服务器配置 */
  servers: Record<string, ServerConfig>;
  /** 组配置 */
  groups?: Record<string, GroupConfig>;
  /** 全局设置 */
  settings?: GlobalSettings;
}

/**
 * 基础服务器配置
 */
interface BaseServerConfig {
  /** 环境变量 */
  env?: Record<string, string>;
  /** 是否禁用 */
  enabled?: boolean;
  /** 工作目录 */
  cwd?: string;
  /** 超时设置 */
  timeout?: number;
  /** 重试配置 */
  retry?: RetryConfig;
}

/**
 * Stdio 服务器配置
 */
interface StdioServerConfig extends BaseServerConfig {
  /** 服务器类型 */
  type: 'stdio';
  /** 启动命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
}

/**
 * HTTP 服务器配置
 */
interface HTTPServerConfig extends BaseServerConfig {
  /** 服务器类型 */
  type: 'sse' | 'streaming';
  /** 服务器 URL */
  url: string;
  /** HTTP 头 */
  headers?: Record<string, string>;
}

/**
 * 单个服务器配置
 */
export type ServerConfig = StdioServerConfig | HTTPServerConfig;

/**
 * 组配置
 */
export interface GroupConfig {
  /** 组名称 */
  name: string;
  /** 组描述 */
  description?: string;
  /** 包含的服务器ID */
  servers: string[];
  /** 工具过滤规则 */
  toolFilter?: ConfigToolFilter;
  /** 验证配置 */
  validation?: ValidationConfig;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  delay: number;
  /** 是否使用指数退避 */
  exponentialBackoff?: boolean;
}

/**
 * 全局设置
 */
export interface GlobalSettings {
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 连接超时 */
  connectionTimeout?: number;
  /** 最大并发连接数 */
  maxConcurrentConnections?: number;
}

/**
 * 配置中的工具过滤规则
 */
export interface ConfigToolFilter {
  /** 包含的工具名称 */
  include?: string[];
  /** 排除的工具名称 */
  exclude?: string[];
  /** 工具名称模式匹配 */
  patterns?: string[];
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  /** 验证密钥 */
  validationKey?: string;
  /** 是否启用验证 */
  enabled: boolean;
}
