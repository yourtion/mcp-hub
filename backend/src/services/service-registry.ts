import { ErrorCode, ServiceError } from '@mcp-core/mcp-hub-core';

import { logger } from '../utils/logger.js';
import { BackendCoreServiceAdapter } from './backend-core-service-adapter.js';

import type { McpHubService } from './mcp_hub_service.js';
import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';
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

let coreServiceManager: McpServiceManagerInterface | null = null;

/**
 * 初始化 McpServiceManager（从当前配置读取并构建）
 */
export async function initCoreServiceManager(): Promise<McpServiceManagerInterface> {
  if (coreServiceManager) {
    return coreServiceManager;
  }

  // P6 架构修正（spec §10.3）：注入 backend 真实 ServerManager（经 McpHubService），
  // 替代 core 包的 mock McpServiceManager。使 group-service / groups API 拿到真实
  // 连接状态与工具调用，并打通 P6 trace context 链路（Task 2 出站 + Task 3 入站）。
  //
  // 此适配器仅服务于 group-service / groups API（只读状态 + 工具调用）。
  // 新增 core 抽象消费者前需复核 ToolInfo.description 可空性
  // （backend Tool.description 可选，core ToolInfo.description 必填，类型断言已规避）。
  const hubService = getHubService();
  coreServiceManager = new BackendCoreServiceAdapter(hubService.getServerManager());

  logger.info('CoreServiceManager 已注入真实 ServerManager（BackendCoreServiceAdapter）');
  return coreServiceManager;
}

/**
 * 获取已初始化的 McpServiceManager
 * 若尚未初始化，会自动初始化
 */
export async function getCoreServiceManager(): Promise<McpServiceManagerInterface> {
  if (!coreServiceManager) {
    await initCoreServiceManager();
  }
  return coreServiceManager!;
}

/**
 * 重载 McpServiceManager（先关闭旧实例，再从最新配置重建）
 * 用于组/服务器配置变更后热重载
 *
 * 副作用：旧 manager 关闭后，所有 GroupMcpService（按 group 缓存）持有的就是过期引用，
 * 因此这里同时失效全部 group MCP 缓存（service + handler），保证下次请求惰性重建。
 */
export async function reloadCoreServiceManager(): Promise<McpServiceManagerInterface> {
  if (coreServiceManager) {
    try {
      await coreServiceManager.shutdown();
    } catch (error) {
      logger.warn('关闭旧 McpServiceManager 失败', { error: (error as Error).message });
    }
    coreServiceManager = null;

    // 旧 manager 已关闭，使所有 group MCP 缓存失效（优雅关闭 handler + service）
    // 动态导入避免与 mcp-handler-factory → service-registry 的循环依赖
    const { invalidateAllGroupMcpServices } = await import('../api/mcp/mcp-handler-factory.js');
    try {
      await invalidateAllGroupMcpServices();
    } catch (error) {
      logger.warn('失效 group MCP 缓存失败（继续重建）', {
        error: (error as Error).message,
      });
    }
  }

  return initCoreServiceManager();
}

/**
 * 注销并返回 McpServiceManager 实例（用于关闭流程）
 */
export async function shutdownCoreServiceManager(): Promise<McpServiceManagerInterface | null> {
  const manager = coreServiceManager;
  coreServiceManager = null;
  return manager;
}
