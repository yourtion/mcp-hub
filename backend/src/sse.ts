import { mcpServer } from './app';
import { streamSSE } from 'hono/streaming';
import { SSETransport } from './utils/sse.js';
import { Hono } from 'hono';

export const sse = new Hono();
// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: Record<string, SSETransport> = {};

sse.get('/sse', (c) => {
  console.log("SSE connection established");
  return streamSSE(c, async (stream) => {
    const transport = new SSETransport('/messages', stream);

    transports[transport.sessionId] = transport;

    const onAbort = new Promise<void>((resolve) => {
      stream.onAbort(() => {
        resolve();
        delete transports[transport.sessionId];
      });
    })

    await mcpServer.connect(transport);

    await onAbort;
    console.log("SSE connection closed");
  });
});

sse.post('/messages', async (c) => {
  const sessionId = c.req.query('sessionId');
  const transport = transports[sessionId ?? ''];

  if (transport == null) {
    return c.text('No transport found for sessionId', 400);
  }

  return transport.handlePostMessage(c);
});