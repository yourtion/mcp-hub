import path from 'node:path';
import type { DeepReadonly } from '@mcp-core/mcp-hub-share';
import type {
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share/config';
import { JsonStorage } from './json_storage.js';

/**
 * 将 DeepReadonly 类型转换为可变类型
 * 这是一个类型安全的转换，因为我们确信在使用时不会修改原始数据
 */
export function asMutable<T>(obj: DeepReadonly<T>): T {
  return obj as unknown as T;
}

/**
 * 获取配置目录路径（动态计算）
 */
function getConfigDir(): string {
  return process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config');
}

let mcpServerInstance: JsonStorage<McpConfig> | null = null;
let groupConfigInstance: JsonStorage<GroupConfig> | null = null;
let systemConfigInstance: JsonStorage<SystemConfig> | null = null;

/**
 * 获取或创建 MCP 服务器配置实例
 */
function getMcpServerInstance(): JsonStorage<McpConfig> {
  if (!mcpServerInstance) {
    const configDir = getConfigDir();
    const mcpServerPath = path.resolve(configDir, 'mcp_server.json');
    mcpServerInstance = new JsonStorage<McpConfig>(mcpServerPath, {
      servers: {},
    });
  }
  return mcpServerInstance;
}

/**
 * 获取或创建组配置实例
 */
function getGroupConfigInstance(): JsonStorage<GroupConfig> {
  if (!groupConfigInstance) {
    const configDir = getConfigDir();
    const groupPath = path.resolve(configDir, 'group.json');
    groupConfigInstance = new JsonStorage<GroupConfig>(
      groupPath,
      {} as GroupConfig,
    );
  }
  return groupConfigInstance;
}

/**
 * 获取或创建系统配置实例
 */
function getSystemConfigInstance(): JsonStorage<SystemConfig> {
  if (!systemConfigInstance) {
    const configDir = getConfigDir();
    const systemPath = path.resolve(configDir, 'system.json');
    systemConfigInstance = new JsonStorage<SystemConfig>(
      systemPath,
      {} as SystemConfig,
    );
  }
  return systemConfigInstance;
}

// API工具配置路径
function getApiToolsPath(): string {
  const configDir = getConfigDir();
  return path.resolve(configDir, 'api-tools.json');
}

export async function getAllConfig(): Promise<
  DeepReadonly<{
    mcps: McpConfig;
    groups: GroupConfig;
    system: SystemConfig;
    apiToolsConfigPath?: string;
  }>
> {
  const mcps = await getMcpServerInstance().read();
  const groups = await getGroupConfigInstance().read();
  const system = await getSystemConfigInstance().read();

  const apiToolsPath = getApiToolsPath();

  // API工具配置路径：始终返回路径，即使文件不存在
  // 这样服务可以初始化并在创建配置时自动创建文件
  return { mcps, groups, system, apiToolsConfigPath: apiToolsPath };
}

/**
 * 保存配置到指定的配置文件
 * @param configType - 配置文件类型 ('mcp_server.json', 'group.json', 'system.json')
 * @param data - 要保存的配置数据
 */
export async function saveConfig(
  configType: 'mcp_server.json' | 'group.json' | 'system.json',
  data: McpConfig | GroupConfig | SystemConfig,
): Promise<void> {
  switch (configType) {
    case 'mcp_server.json':
      await getMcpServerInstance().write(data as McpConfig);
      break;
    case 'group.json':
      await getGroupConfigInstance().write(data as GroupConfig);
      break;
    case 'system.json':
      await getSystemConfigInstance().write(data as SystemConfig);
      break;
    default:
      throw new Error(`不支持的配置文件类型: ${configType}`);
  }
}
