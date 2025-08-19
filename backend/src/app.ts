import { Hono } from 'hono';
import { hubApi } from './api/hub.js';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { mcp } from './mcp.js';
import { sse } from './sse.js';

export const app = new Hono();
app.route('/', mcp);
app.route('/', sse);
app.route('/', groupMcpRouter); // 组特定MCP路由
app.route('/api', hubApi);
