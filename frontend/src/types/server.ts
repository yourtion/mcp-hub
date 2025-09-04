// 服务器管理相关的类型定义

export type ServerStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error';

export type ServerType = 'stdio' | 'sse' | 'websocket';

export interface ServerConfig {
  type: ServerType;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId?: string;
}

export interface ServerInfo {
  id: string;
  name: string;
  type: ServerType;
  status: ServerStatus;
  config: ServerConfig;
  tools: ToolInfo[];
  lastConnected?: string;
  lastError?: string;
  reconnectAttempts?: number;
  toolCount: number;
}

export interface ServerListResponse {
  servers: ServerInfo[];
  total: number;
  summary: {
    total: number;
    connected: number;
    connecting: number;
    disconnected: number;
    error: number;
  };
}

export interface ServerStatusInfo {
  id: string;
  status: ServerStatus;
  lastConnected?: string;
  reconnectAttempts: number;
  toolCount: number;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
}

export interface CreateServerRequest {
  id: string;
  config: ServerConfig;
}

export interface UpdateServerRequest {
  config: ServerConfig;
}

export interface TestServerRequest extends ServerConfig {}

export interface TestServerResponse {
  success: boolean;
  message: string;
  details: {
    status: ServerStatus;
    toolCount: number;
    tools: ToolInfo[];
    lastConnected: string;
  };
  executionTime: number;
}

export interface ValidateServerRequest extends ServerConfig {}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  suggestedValue: unknown;
}

export interface ValidateServerResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ServerOperationResponse {
  id: string;
  message: string;
  status?: ServerStatus;
}
