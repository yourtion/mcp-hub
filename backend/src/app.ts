import { Hono } from 'hono';
import { hubApi } from './api/hub';
import { groupMcpRouter } from './api/mcp/group-router.js';
import { mcp } from './mcp';
import { sse } from './sse';

export const app = new Hono();
app.route('/', mcp);
app.route('/', sse);
app.route('/', groupMcpRouter); // 组特定MCP路由
app.route('/api', hubApi);
