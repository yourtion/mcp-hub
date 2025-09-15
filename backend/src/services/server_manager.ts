import type { ServerConfig } from '@mcp-core/mcp-hub-share';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  ServerManager as IServerManager,
  ServerConnection,
  Tool,
} from '../types/mcp-hub.js';
import { ServerStatus } from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';

export class ServerManager implements IServerManager {
  private servers: Map<string, ServerConnection> = new Map();
  private serverConfigs: Map<string, ServerConfig> = new Map();

  // Method to track MCP messages (to be set by the hub service)
  private messageTracker:
    | ((
        serverId: string,
        type: 'request' | 'response' | 'notification',
        method: string,
        content: unknown,
      ) => void)
    | null = null;

  // Set the message tracker function
  public setMessageTracker(
    tracker: (
      serverId: string,
      type: 'request' | 'response' | 'notification',
      method: string,
      content: unknown,
    ) => void,
  ): void {
    this.messageTracker = tracker;
  }

  constructor(serverConfigs: Record<string, ServerConfig>) {
    // Store server configurations
    for (const [serverId, config] of Object.entries(serverConfigs)) {
      this.serverConfigs.set(serverId, config);
    }
  }

  async initialize(): Promise<void> {
    logger.info('Initializing ServerManager', {
      serverCount: this.serverConfigs.size,
    });

    const initPromises = Array.from(this.serverConfigs.entries()).map(
      ([serverId, config]) => this.initializeServer(serverId, config),
    );

    // Initialize all servers concurrently, but don't fail if some fail
    await Promise.allSettled(initPromises);

    const connectedCount = Array.from(this.servers.values()).filter(
      (server) => server.status === ServerStatus.CONNECTED,
    ).length;

    logger.info('ServerManager initialization completed', {
      totalServers: this.serverConfigs.size,
      connectedServers: connectedCount,
    });
  }

  private async initializeServer(
    serverId: string,
    config: ServerConfig,
  ): Promise<void> {
    // Skip disabled servers
    if (config.enabled === false) {
      logger.info('Skipping disabled server', { serverId });
      return;
    }

    logger.info('Initializing server', { serverId, type: config.type });

    const serverConnection: ServerConnection = {
      id: serverId,
      config,
      client: new Client(
        {
          name: `mcp-hub-${serverId}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      ),
      status: ServerStatus.CONNECTING,
      tools: [],
      reconnectAttempts: 0,
    };

    this.servers.set(serverId, serverConnection);

    try {
      await this.connectServer(serverConnection);
    } catch (error) {
      logger.error('Failed to initialize server', error as Error, { serverId });
      serverConnection.status = ServerStatus.ERROR;
      serverConnection.lastError = error as Error;
    }
  }

  private async connectServer(
    serverConnection: ServerConnection,
  ): Promise<void> {
    const { id: serverId, config } = serverConnection;

    try {
      serverConnection.status = ServerStatus.CONNECTING;
      logger.info('Server connecting', { serverId });

      if (config.type === 'stdio') {
        await this.connectStdioServer(serverConnection);
      } else {
        throw new Error(`Server type ${config.type} not yet implemented`);
      }

      serverConnection.status = ServerStatus.CONNECTED;
      serverConnection.lastConnected = new Date();
      serverConnection.reconnectAttempts = 0;

      logger.logServerConnection(serverId, 'connected');

      // Discover tools after successful connection
      await this.discoverServerTools(serverConnection);
    } catch (error) {
      serverConnection.status = ServerStatus.ERROR;
      serverConnection.lastError = error as Error;
      logger.logServerConnection(serverId, 'failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async connectStdioServer(
    serverConnection: ServerConnection,
  ): Promise<void> {
    const { config, client } = serverConnection;

    if (config.type !== 'stdio') {
      throw new Error('Invalid server type for stdio connection');
    }

    // Prepare environment variables
    const env: Record<string, string> = {
      ...(Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined),
      ) as Record<string, string>),
      ...config.env,
    };

    // Create stdio transport
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env,
    });

    // Connect the client
    await client.connect(transport);
  }

  private async discoverServerTools(
    serverConnection: ServerConnection,
  ): Promise<void> {
    const { id: serverId, client } = serverConnection;

    try {
      // Track the request
      if (this.messageTracker) {
        this.messageTracker(serverId, 'request', 'listTools', {});
      }

      const startTime = Date.now();
      const response = await client.listTools();
      const executionTime = Date.now() - startTime;

      const tools: Tool[] = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
        serverId,
      }));

      serverConnection.tools = tools;
      logger.logToolDiscovery(serverId, tools.length);

      // Track the response
      if (this.messageTracker) {
        this.messageTracker(serverId, 'response', 'listTools', {
          ...response,
          executionTime,
          toolCount: tools.length,
        });
      }
    } catch (error) {
      logger.error('Failed to discover tools for server', error as Error, {
        serverId,
      });
      serverConnection.tools = [];

      // Track the error response
      if (this.messageTracker) {
        this.messageTracker(serverId, 'response', 'listTools', {
          error: (error as Error).message,
          isError: true,
        });
      }
    }
  }

  getServerStatus(serverId: string): ServerStatus {
    const server = this.servers.get(serverId);
    return server?.status || ServerStatus.DISCONNECTED;
  }

  getAllServers(): Map<string, ServerConnection> {
    return new Map(this.servers);
  }

  async executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status !== ServerStatus.CONNECTED) {
      throw new Error(
        `Server ${serverId} is not connected (status: ${server.status})`,
      );
    }

    try {
      logger.debug('Executing tool on server', {
        serverId,
        toolName,
        args,
      });

      // Track the request
      if (this.messageTracker) {
        this.messageTracker(serverId, 'request', 'callTool', {
          name: toolName,
          arguments: args,
        });
      }

      const startTime = Date.now();
      const response = await server.client.callTool({
        name: toolName,
        arguments: args,
      });
      const executionTime = Date.now() - startTime;

      logger.debug('Tool execution completed', {
        serverId,
        toolName,
        executionTime,
      });

      // Track the response
      if (this.messageTracker) {
        this.messageTracker(serverId, 'response', 'callTool', {
          ...response,
          executionTime,
        });
      }

      return response;
    } catch (error) {
      logger.error('Tool execution failed', error as Error, {
        serverId,
        toolName,
      });

      // Track the error response
      if (this.messageTracker) {
        this.messageTracker(serverId, 'response', 'callTool', {
          error: (error as Error).message,
          isError: true,
        });
      }

      throw error;
    }
  }

  async getServerTools(serverId: string): Promise<Tool[]> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status !== ServerStatus.CONNECTED) {
      return [];
    }

    return [...server.tools];
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down ServerManager');

    const shutdownPromises = Array.from(this.servers.values()).map(
      async (server) => {
        try {
          if (server.status === ServerStatus.CONNECTED) {
            await server.client.close();
            logger.logServerConnection(server.id, 'disconnected');
          }
        } catch (error) {
          logger.error('Error during server shutdown', error as Error, {
            serverId: server.id,
          });
        }
      },
    );

    await Promise.allSettled(shutdownPromises);
    this.servers.clear();
    logger.info('ServerManager shutdown completed');
  }
}
