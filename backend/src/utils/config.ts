import path from 'node:path';
import type {
  DeepReadonly,
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import { JsonStorage } from './json_storage.js';

const configDir =
  process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config');

const mcpServerPath = path.resolve(configDir, 'mcp_server.json');
const mcpServerInstance = new JsonStorage<McpConfig>(mcpServerPath, {
  mcpServers: {},
}); // Renamed to avoid conflict with imported type

const groupPath = path.resolve(configDir, 'group.json');
const groupConfigInstance = new JsonStorage<GroupConfig>(
  groupPath,
  {} as GroupConfig,
); // Renamed and added type assertion for default value

const systemPath = path.resolve(configDir, 'system.json');
const systemConfigInstance = new JsonStorage<SystemConfig>(
  systemPath,
  {} as SystemConfig,
); // Renamed and added type assertion for default value

// API工具配置路径
const apiToolsPath = path.resolve(configDir, 'api-tools.json');

export async function getAllConfig(): Promise<
  DeepReadonly<{
    mcps: McpConfig;
    groups: GroupConfig;
    system: SystemConfig;
    apiToolsConfigPath?: string;
  }>
> {
  const mcps = await mcpServerInstance.read();
  const groups = await groupConfigInstance.read();
  const system = await systemConfigInstance.read();

  // 检查API工具配置文件是否存在
  let apiToolsConfigPath: string | undefined;
  try {
    const fs = await import('node:fs/promises');
    await fs.access(apiToolsPath);
    apiToolsConfigPath = apiToolsPath;
  } catch {
    // API工具配置文件不存在，这是可选的
    apiToolsConfigPath = undefined;
  }

  return { mcps, groups, system, apiToolsConfigPath };
}
