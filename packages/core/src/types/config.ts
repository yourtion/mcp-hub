/**
 * 配置相关类型定义
 */

/**
 * MCP服务器配置
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
 * 单个服务器配置
 */
export interface ServerConfig {
  /** 启动命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 超时设置 */
  timeout?: number;
  /** 重试配置 */
  retry?: RetryConfig;
}

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
