/**
 * MCP Hub 核心包主入口
 * 导出所有公共API和类型定义
 */

// 导出配置
export * from './config/index.js';
export type { ErrorHandler } from './errors/index.js';
// 导出错误处理（避免与types中的ErrorContext和ErrorResponse冲突）
export {
  ConfigError,
  ConnectionError,
  DefaultErrorHandler,
  defaultErrorHandler,
  McpHubCoreError,
  ServiceError,
  ToolExecutionError,
  ValidationError,
} from './errors/index.js';
// 导出工厂
export * from './factory/index.js';
// 导出服务接口和实现
export type {
  McpServiceManagerInterface,
  ServerConnectionManagerInterface,
  ToolRegistryInterface,
} from './services/index.js';
export {
  ConnectionFailedError,
  ConnectionManagerError,
  ConnectionNotFoundError,
  type ConnectionPoolStats,
  ConnectionState,
  DuplicateToolError,
  McpServerNotFoundError,
  McpServiceError,
  McpServiceManager,
  McpToolNotFoundError,
  type ServerConnection,
  type ServerConnectionInfo,
  ServerConnectionManager,
  ServerStatus,
  ServiceNotInitializedError,
  type ToolExecutionContext,
  ToolNotFoundError,
  ToolRegistry,
  ToolRegistryError,
  type ToolStats,
  ToolValidationError,
  type ToolValidationResult,
} from './services/index.js';
// 导出类型
export * from './types/index.js';
// 导出工具函数
export * from './utils/index.js';
