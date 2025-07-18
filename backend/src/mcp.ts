import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { Hono } from 'hono';
import { mcpServer } from './services/mcp_service';

export const mcp = new Hono();

mcp.post('/mcp', async (c) => {
  const { req, res } = toReqRes(c.req.raw);

  try {
    const transport: StreamableHTTPServerTransport =
      new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

    // Added for extra debuggability
    transport.onerror = console.error.bind(console);

    await mcpServer.connect(transport);

    await transport.handleRequest(req, res, await c.req.json());

    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      mcpServer.close();
    });

    return toFetchResponse(res);
  } catch (e) {
    console.error(e);
    return c.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      },
      { status: 500 },
    );
  }
});
