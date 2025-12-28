/**
 * 配置类型辅助工具
 * 提供类型安全的配置转换函数
 */

import type { McpServerConfig } from '@mcp-core/mcp-hub-core';
import type {
  GroupConfig,
  McpConfig,
  ServerConfig,
} from '@mcp-core/mcp-hub-share';

/**
 * 将配置转换为 McpServerConfig 格式
 */
export function toMcpServerConfig(config: {
  mcps: McpConfig;
  groups: GroupConfig;
}): McpServerConfig {
  return {
    servers: config.mcps.mcpServers as unknown as Record<
      string,
      Record<string, unknown>
    >,
    groups: config.groups as unknown as Record<string, GroupConfig>,
    settings: undefined,
  } as unknown as McpServerConfig;
}
