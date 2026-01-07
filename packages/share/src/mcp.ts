interface BaseServerConfig {
  env?: Record<string, string>; // Environment variables
  enabled?: boolean; // Flag to enable/disable the server
}

interface StdioServerConfig extends BaseServerConfig {
  type: 'stdio'; // Type of the server
  command: string; // Command to execute for stdio-based servers
  args?: string[]; // Arguments for the command
}

interface HTTPServerConfig extends BaseServerConfig {
  type: 'sse' | 'streaming'; // Type of the server
  url: string; // URL for SSE-based servers
  headers?: Record<string, string>; // Headers for the request
}

export type ServerConfig = StdioServerConfig | HTTPServerConfig;
