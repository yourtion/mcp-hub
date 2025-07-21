import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { Hono } from 'hono';
import { initializeMcpService, mcpServer } from './services/mcp_service.js';
import { logger } from './utils/logger.js';

export const mcp = new Hono();

// Track initialization state
let isInitialized = false;

// Initialize the MCP service
async function ensureMcpServiceInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    logger.info('Initializing MCP Service');
    await initializeMcpService();
    isInitialized = true;
    logger.info('MCP Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MCP Service', error as Error);
    throw error;
  }
}

mcp.post('/mcp', async (c) => {
  const { req, res } = toReqRes(c.req.raw);

  try {
    // Ensure MCP service is initialized
    await ensureMcpServiceInitialized();

    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    // Use the enhanced MCP server with all registered tools
    await mcpServer.connect(transport);

    await transport.handleRequest(req, res, await c.req.json());

    res.on('close', () => {
      logger.debug('MCP request closed');
      transport.close();
      mcpServer.close();
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
          data: {
            error: {
              code: 'INTERNAL_ERROR',
              message: (e as Error).message,
            },
          },
        },
        id: null,
      },
      { status: 500 },
    );
  }
});

// Graceful shutdown handler
export async function shutdownMcpService(): Promise<void> {
  if (isInitialized) {
    logger.info('Shutting down MCP Service');
    const { shutdownMcpService: shutdownService } = await import(
      './services/mcp_service.js'
    );
    await shutdownService();
    isInitialized = false;
  }
}
