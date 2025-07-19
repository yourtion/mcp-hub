import { group } from 'console';
import { ServerConfig } from './mcp';

export interface McpConfig {
  mcpServers: {
    [key: string]: ServerConfig; // Key-value pairs of server names and their configurations
  };
}

interface Group {
  id: string; // group UUID
  name: string; // name of the group
  description?: string; // description of the group
  servers: string[]; // Array of server names that belong to this group
  tools: string[]; // Array of tool names that are available in this group
}

export interface GroupConfig {
  [group: string]: Group; // Key-value pairs of group names and their configurations
}

export interface SystemConfig {
  users: {
    [username: string]: {
      password: string;
      groups: string[];
    };
  };
}
