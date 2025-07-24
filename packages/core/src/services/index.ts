/**
 * 服务模块导出
 * 包含MCP服务管理、服务器连接管理和工具管理的核心服务
 */

// MCP服务管理器
export type { McpServiceManagerInterface } from './mcp/service-manager';
export {
  McpServiceError,
  McpServiceManager,
  type ServerConnection,
  ServerNotFoundError as McpServerNotFoundError,
  ServerStatus,
  ServiceNotInitializedError,
  ToolNotFoundError as McpToolNotFoundError,
} from './mcp/service-manager';

// 服务器连接管理器
export type { ServerConnectionManagerInterface } from './server/connection-manager';
export {
  ConnectionFailedError,
  ConnectionManagerError,
  ConnectionNotFoundError,
  type ConnectionPoolStats,
  ConnectionState,
  type ServerConnectionInfo,
  ServerConnectionManager,
} from './server/connection-manager';

// 工具注册和管理
export type { ToolRegistryInterface } from './tool/tool-registry';
export {
  DuplicateToolError,
  type ToolExecutionContext,
  ToolNotFoundError,
  ToolRegistry,
  ToolRegistryError,
  type ToolStats,
  ToolValidationError,
  type ToolValidationResult,
} from './tool/tool-registry';
