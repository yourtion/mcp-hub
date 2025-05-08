import { Hono } from 'hono'
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcp }from './mcp';
import { sse }from './sse';
import * as pkg from '../package.json';

export const app = new Hono();
app.route('/', mcp);
app.route('/', sse);
export const mcpServer = new McpServer(
  {
    name: pkg.name,
    version: pkg.version,
  }
);

mcpServer.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);
