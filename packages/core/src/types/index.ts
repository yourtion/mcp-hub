/**
 * 类型定义模块导出
 */

export * from './connection.js';
export * from './error.js';
export * from './service.js';
export * from './tool.js';

// 从 config.ts 选择性导出 (避免与 share 的 ToolFilter 冲突)
export type {
  McpServerConfig,
  GlobalSettings,
} from './config.js';

// 从 share 重新导出 config 类型
export type {
  ServerConfig,
  StdioServerConfig,
  HttpServerConfig,
  RetryConfig,
  GroupConfig,
  McpConfig,
  SystemConfig,
  ToolFilter,
  GroupValidation,
  Group,
} from '@mcp-core/mcp-hub-share/config';
