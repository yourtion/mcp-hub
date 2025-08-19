import type { ServerConfig } from '@mcp-core/mcp-hub-share';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Server Management Types
export enum ServerStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface ServerConnection {
  id: string;
  config: ServerConfig;
  client: Client;
  status: ServerStatus;
  lastConnected?: Date;
  lastError?: Error;
  tools: Tool[];
  reconnectAttempts: number;
}

export interface ServerManager {
  initialize(): Promise<void>;
  getServerStatus(serverId: string): ServerStatus;
  getAllServers(): Map<string, ServerConnection>;
  executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;
  getServerTools(serverId: string): Promise<Tool[]>;
  shutdown(): Promise<void>;
}

// Group Management Types
export interface Group {
  id: string;
  name: string;
  description?: string;
  servers: string[];
  tools: string[];
  resolvedTools?: Tool[];
}

export interface GroupRuntime {
  config: Group;
  availableServers: string[];
  availableTools: Tool[];
  lastUpdated: Date;
}

export interface GroupManager {
  initialize(): Promise<void>;
  getGroup(groupId: string): Group | undefined;
  getAllGroups(): Map<string, Group>;
  getGroupTools(groupId: string): Promise<Tool[]>;
  validateToolAccess(groupId: string, toolName: string): boolean;
  getGroupServers(groupId: string): string[];
  findToolInGroup(
    groupId: string,
    toolName: string,
  ): Promise<{ tool: Tool; serverId: string } | null>;
  getAvailableGroupServers(groupId: string): string[];
  getGroupStats(groupId: string): {
    totalServers: number;
    availableServers: number;
    configuredTools: number;
  };
  validateGroupHealth(
    groupId: string,
  ): Promise<{ isHealthy: boolean; issues: string[] }>;
  getAllGroupsHealth(): Promise<
    Map<string, { isHealthy: boolean; issues: string[] }>
  >;
  getGroupToolsByServer(groupId: string): Promise<Map<string, Tool[]>>;
}

// Tool Management Types
export interface ToolContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface ToolManager {
  getToolsForGroup(groupId: string): Promise<Tool[]>;
  executeTool(
    groupId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult>;
  findToolServer(toolName: string, groupId: string): string | undefined;
  validateToolArgs(toolName: string, args: Record<string, unknown>): boolean;
}

// MCP Hub Service Types
export interface McpHubService {
  initialize(): Promise<void>;
  listTools(groupId?: string): Promise<Tool[]>;
  callTool(
    toolName: string,
    args: Record<string, unknown>,
    groupId?: string,
  ): Promise<ToolResult>;
  getGroupInfo(groupId: string): Group | undefined;
  getServerHealth(): Map<string, ServerStatus>;
  shutdown(): Promise<void>;
}
