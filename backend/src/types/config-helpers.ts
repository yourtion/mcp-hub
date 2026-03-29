/**
 * 配置类型辅助工具
 * 提供类型安全的配置转换函数
 */

import type { McpServerConfig } from '@mcp-core/mcp-hub-core';
import type { GroupConfig, McpConfig } from '@mcp-core/mcp-hub-share/config';

/**
 * 将配置转换为 McpServerConfig 格式
 */
export function toMcpServerConfig(config: {
  mcps: McpConfig;
  groups: GroupConfig;
}): McpServerConfig {
  return {
    servers: config.mcps.servers,
    groups: config.groups,
  } as McpServerConfig;
}
