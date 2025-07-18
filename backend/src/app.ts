import { Hono } from 'hono';
import { mcp } from './mcp';
import { sse } from './sse';

export const app = new Hono();
app.route('/', mcp);
app.route('/', sse);
