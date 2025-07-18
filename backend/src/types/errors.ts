// Error Categories
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  CONNECTION = 'connection',
  RUNTIME = 'runtime',
  VALIDATION = 'validation',
}

export enum ErrorCode {
  // Configuration Errors (1000-1999)
  INVALID_SERVER_CONFIG = 1001,
  MISSING_GROUP_REFERENCE = 1002,
  SCHEMA_VALIDATION_FAILED = 1003,

  // Connection Errors (2000-2999)
  SERVER_STARTUP_FAILED = 2001,
  NETWORK_CONNECTIVITY_FAILED = 2002,
  AUTHENTICATION_FAILED = 2003,
  SERVER_UNAVAILABLE = 2004,

  // Runtime Errors (3000-3999)
  TOOL_EXECUTION_FAILED = 3001,
  SERVER_DISCONNECTED = 3002,
  INVALID_TOOL_ARGUMENTS = 3003,
  TOOL_NOT_FOUND = 3004,
  GROUP_NOT_FOUND = 3005,
  TOOL_ACCESS_DENIED = 3006,

  // Validation Errors (4000-4999)
  INVALID_REQUEST_FORMAT = 4001,
  MISSING_REQUIRED_PARAMETER = 4002,
  PARAMETER_TYPE_MISMATCH = 4003,
}

// Base Error Interface
export interface McpHubError extends Error {
  category: ErrorCategory;
  code: ErrorCode;
  context?: Record<string, unknown>;
  serverId?: string;
  groupId?: string;
  toolName?: string;
}

// JSON-RPC Error Response Format
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

// Standardized Error Response Format
export interface ErrorResponse {
  success: false;
  error: {
    category: ErrorCategory;
    code: ErrorCode;
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
  };
}

// Success Response Format
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Error Handler Interface
export interface ErrorHandler {
  handleServerError(serverId: string, error: Error): void;
  handleGroupError(groupId: string, error: Error): void;
  handleToolError(toolName: string, error: Error): ToolResult;
  formatError(error: McpHubError): ErrorResponse;
  formatJsonRpcError(
    error: McpHubError,
    id?: string | number | null,
  ): JsonRpcErrorResponse;
}

// Custom Error Classes
export class ConfigurationError extends Error implements McpHubError {
  category = ErrorCategory.CONFIGURATION as const;

  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ConnectionError extends Error implements McpHubError {
  category = ErrorCategory.CONNECTION as const;

  constructor(
    public code: ErrorCode,
    message: string,
    public serverId?: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class RuntimeError extends Error implements McpHubError {
  category = ErrorCategory.RUNTIME as const;

  constructor(
    public code: ErrorCode,
    message: string,
    public serverId?: string,
    public groupId?: string,
    public toolName?: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

export class ValidationError extends Error implements McpHubError {
  category = ErrorCategory.VALIDATION as const;

  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Import ToolResult from mcp-hub types
import type { ToolResult } from './mcp-hub';
