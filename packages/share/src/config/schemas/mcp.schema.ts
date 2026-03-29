/**
 * McpConfig 统一 Zod Schema
 */
import { z } from 'zod/v4';
import { ServerConfigSchema } from './server.schema.js';

/**
 * MCP 配置 Schema（顶层包含 mcpServers）
 */
export const McpConfigSchema = z.object({
  mcpServers: z
    .record(z.string(), ServerConfigSchema)
    .refine((servers) => Object.keys(servers).length > 0, {
      message: '至少需要配置一个MCP服务器',
    }),
});
