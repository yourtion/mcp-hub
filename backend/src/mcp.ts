import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { Hono } from 'hono';
import { McpHubService } from './services/mcp_hub_service.js';
import { getAllConfig } from './utils/config.js';
import { logger } from './utils/logger.js';

export const mcp = new Hono();

// Global hub service instance
let hubService: McpHubService | null = null;

// Initialize the hub service
async function initializeHubService(): Promise<McpHubService> {
  if (hubService) {
    return hubService;
  }

  try {
    logger.info('Initializing MCP Hub Service');

    // Load configurations
    const config = await getAllConfig();

    // Create hub service instance
    hubService = new McpHubService(
      config.mcps.mcpServers as Record<string, any>,
      config.groups as any,
    );

    // Initialize the service
    await hubService.initialize();

    logger.info('MCP Hub Service initialized successfully');
    return hubService;
  } catch (error) {
    logger.error('Failed to initialize MCP Hub Service', error as Error);
    throw error;
  }
}

mcp.post('/mcp', async (c) => {
  const { req, res } = toReqRes(c.req.raw);

  try {
    // Ensure hub service is initialized
    const service = await initializeHubService();

    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    // Create a simple MCP server that provides basic hub info
    const { McpServer } = await import(
      '@modelcontextprotocol/sdk/server/mcp.js'
    );
    const { z } = await import('zod');

    const delegateServer = new McpServer({
      name: 'mcp-hub',
      version: '1.0.0',
    });

    // Add a basic tool to show hub status
    delegateServer.tool(
      'hub_status',
      {
        groupId: z.string().optional().describe('Group ID to check status for'),
      },
      async ({ groupId }) => {
        try {
          const status = service.getServiceStatus();
          const groups = service.getAllGroups();

          let result = `MCP Hub Status:
- Initialized: ${status.isInitialized}
- Connected Servers: ${status.connectedServers}/${status.serverCount}
- Groups: ${status.groupCount}
- Available Groups: ${Array.from(groups.keys()).join(', ')}`;

          if (groupId) {
            const groupInfo = service.getGroupInfo(groupId);
            if (groupInfo) {
              result += `\n\nGroup '${groupId}' Details:
- Name: ${groupInfo.name}
- Description: ${groupInfo.description || 'N/A'}
- Servers: ${groupInfo.servers.join(', ')}
- Tools: ${groupInfo.tools.length > 0 ? groupInfo.tools.join(', ') : 'All tools from servers'}`;
            } else {
              result += `\n\nGroup '${groupId}' not found.`;
            }
          }

          return {
            content: [{ type: 'text', text: result }],
          };
        } catch (error) {
          logger.error('Error getting hub status', error as Error);
          return {
            content: [
              {
                type: 'text',
                text: `Error getting hub status: ${(error as Error).message}`,
              },
            ],
          };
        }
      },
    );

    await delegateServer.connect(transport);

    await transport.handleRequest(req, res, await c.req.json());

    res.on('close', () => {
      logger.debug('MCP request closed');
      transport.close();
      delegateServer.close();
    });

    return toFetchResponse(res);
  } catch (e) {
    logger.error('MCP endpoint error', e as Error);
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: McpHubService.formatErrorResponse(e as Error),
        },
        id: null,
      },
      { status: 500 },
    );
  }
});

// Graceful shutdown handler
export async function shutdownMcpService(): Promise<void> {
  if (hubService) {
    logger.info('Shutting down MCP Hub Service');
    await hubService.shutdown();
    hubService = null;
  }
}
