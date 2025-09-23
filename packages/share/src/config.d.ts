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
  validation?: {
    enabled: boolean;
    validationKey?: string;
    createdAt?: string;
    lastUpdated?: string;
  };
}

export interface GroupConfig {
  [group: string]: Group; // Key-value pairs of group names and their configurations
}

export interface SystemConfig {
  server: {
    port: number;
    host: string;
  };
  auth: {
    jwt: {
      secret: string;
      expiresIn: string;
      refreshExpiresIn: string;
      issuer: string;
    };
    security: {
      maxLoginAttempts: number;
      lockoutDuration: number;
      passwordMinLength: number;
      requireStrongPassword: boolean;
    };
  };
  users: {
    [username: string]: {
      id: string;
      username: string;
      password: string;
      passwordHash: string;
      role: string;
      groups: string[];
      createdAt: string;
    };
  };
  ui: {
    title: string;
    theme: string;
    features: {
      apiToMcp: boolean;
      debugging: boolean;
      monitoring: boolean;
    };
  };
  monitoring: {
    metricsEnabled: boolean;
    logLevel: string;
    retentionDays: number;
  };
}
