import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as pkg from '../../package.json';

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