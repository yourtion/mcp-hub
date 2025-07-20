import { Hono } from 'hono';
import { hubApi } from './api/hub';
import { mcp } from './mcp';
import { sse } from './sse';

export const app = new Hono();
app.route('/', mcp);
app.route('/', sse);
app.route('/api', hubApi);
