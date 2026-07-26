import { ErrorCode, McpServiceManager, ServiceError } from '@mcp-core/mcp-hub-core';

import { toMcpServerConfig } from '../types/config-helpers.js';
import { asMutable, getAllConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

import type { McpHubService } from './mcp_hub_service.js';
import type { DeepReadonly, GroupConfig, McpConfig, ServerConfig } from '@mcp-core/mcp-hub-share';

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
    throw new ServiceError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'HubService already registered. Call shutdownHubService() first.',
    );
  }
  hubService = service;
}

/**
 * 获取已初始化的 Hub 服务实例
 * @throws 如果服务尚未初始化
 */
export function getHubService(): McpHubService {
  if (!hubService) {
    throw new ServiceError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'HubService not initialized. Service must be initialized at startup.',
    );
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

// ─────────────────────────────────────────────────────────────────────────────
// McpServiceManager 注册表
//
// 统一管理 McpServiceManager 实例，替代之前 4 个模块各自的模块级 `new`。
// 所有需要 McpServiceManager 的模块应通过 getCoreServiceManager() 获取。
// 配置变更后调用 reloadCoreServiceManager() 热重载。
// ─────────────────────────────────────────────────────────────────────────────

let coreServiceManager: McpServiceManager | null = null;

/**
 * 初始化 McpServiceManager（从当前配置读取并构建）
 */
export async function initCoreServiceManager(): Promise<McpServiceManager> {
  if (coreServiceManager) {
    return coreServiceManager;
  }

  const config = await getAllConfig();
  coreServiceManager = new McpServiceManager();
  const coreConfig = toMcpServerConfig({
    mcps: asMutable<McpConfig>(config.mcps as DeepReadonly<McpConfig>),
    groups: asMutable<GroupConfig>(config.groups as DeepReadonly<GroupConfig>),
  });
  await coreServiceManager.initializeFromConfig(coreConfig);

  logger.info('McpServiceManager 初始化成功');
  return coreServiceManager;
}

/**
 * 获取已初始化的 McpServiceManager
 * 若尚未初始化，会自动初始化
 */
export async function getCoreServiceManager(): Promise<McpServiceManager> {
  if (!coreServiceManager) {
    await initCoreServiceManager();
  }
  return coreServiceManager!;
}

/**
 * 重载 McpServiceManager（先关闭旧实例，再从最新配置重建）
 * 用于组/服务器配置变更后热重载
 */
export async function reloadCoreServiceManager(): Promise<McpServiceManager> {
  if (coreServiceManager) {
    try {
      await coreServiceManager.shutdown();
    } catch (error) {
      logger.warn('关闭旧 McpServiceManager 失败', { error: (error as Error).message });
    }
    coreServiceManager = null;
  }

  return initCoreServiceManager();
}

/**
 * 注销并返回 McpServiceManager 实例（用于关闭流程）
 */
export async function shutdownCoreServiceManager(): Promise<McpServiceManager | null> {
  const manager = coreServiceManager;
  coreServiceManager = null;
  return manager;
}
