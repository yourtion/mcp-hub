import type { McpHubService } from './mcp_hub_service.js';
import type { GroupConfig, ServerConfig } from '@mcp-core/mcp-hub-share';

/**
 * 全局服务注册表
 *
 * 在启动时（index.ts）一次性初始化 McpHubService，
 * 所有 API 模块通过此注册表获取共享实例。
 * 禁止在请求路径中创建新的服务实例。
 */

let hubService: McpHubService | null = null;

/**
 * 设置已初始化的 Hub 服务实例（仅在启动时调用）
 */
export function setHubService(service: McpHubService): void {
  if (hubService) {
    throw new Error('HubService already registered. Call shutdownHubService() first.');
  }
  hubService = service;
}

/**
 * 获取已初始化的 Hub 服务实例
 * @throws 如果服务尚未初始化
 */
export function getHubService(): McpHubService {
  if (!hubService) {
    throw new Error('HubService not initialized. Service must be initialized at startup.');
  }
  return hubService;
}

/**
 * 安全获取 Hub 服务实例（不抛异常）
 */
export function getHubServiceSafe(): McpHubService | null {
  return hubService;
}

/**
 * 注销并返回 Hub 服务实例（用于关闭流程）
 */
export async function shutdownHubService(): Promise<McpHubService | null> {
  const service = hubService;
  hubService = null;
  return service;
}

/**
 * 从配置创建服务实例的工厂方法（仅用于启动编排）
 */
export async function createHubService(config: {
  servers: Record<string, ServerConfig>;
  groups: GroupConfig;
  apiToolsConfigPath?: string;
}): Promise<McpHubService> {
  // 动态导入避免循环依赖
  const { McpHubService } = await import('./mcp_hub_service.js');

  const service = new McpHubService(config.servers, config.groups, config.apiToolsConfigPath);

  return service;
}
