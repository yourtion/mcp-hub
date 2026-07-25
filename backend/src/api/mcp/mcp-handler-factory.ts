/**
 * 基于 createMcpHandler 的无状态 MCP HTTP handler 工厂
 *
 * 使用 @modelcontextprotocol/server 的 createMcpHandler（v2 协议 2026-07-28）
 * 构造一个 Web-standard fetch handler，按 groupId 绑定：
 *
 * - 工厂闭包从 groupServices 缓存中取（或惰性创建）GroupMcpService，
 *   返回其已注册好工具的 McpServer 实例。
 * - 入站激进升级：legacy: 'reject' 拒绝所有 2025-era（无 envelope）请求，
 *   仅服务 2026-07-28 modern 流量。
 * - handler.fetch 是 Web-standard face，Hono 端用 c.req.raw 桥接
 *   （预解析 body 经 parsedBody 传入，避免重复读取请求流）。
 *
 * createMcpHandler 的 factory 每个请求都会被调用一次（modern 路径是 per-request
 * serving），与 groupServices 缓存互补：缓存复用 GroupMcpService/McpServer
 * 实例以避免重复初始化与工具注册。
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { McpHttpHandler } from '@modelcontextprotocol/server';

import { getCoreServiceManager } from '../../services/service-registry.js';
import { logger } from '../../utils/logger.js';
import { GroupMcpService } from './group-service.js';

// groupServices 缓存与 group-router 共享（同一模块内单例），统一关闭。
const groupServices: Map<string, GroupMcpService> = new Map();
// 按 groupId 缓存的 McpHttpHandler：handler 设计为构造一次复用
// （其 fetch 每请求内部 per-request serving），避免每请求重建 handler 与 bus。
const groupHandlers: Map<string, McpHttpHandler> = new Map();

/**
 * 暴露 groupServices 缓存，供 group-router 复用与统一关闭。
 */
export function getGroupServicesCache(): Map<string, GroupMcpService> {
  return groupServices;
}

/**
 * 暴露 groupHandlers 缓存，供 group-router 在关闭时统一 close()。
 */
export function getGroupHandlersCache(): Map<string, McpHttpHandler> {
  return groupHandlers;
}

/**
 * 确保指定组的 GroupMcpService 已创建并初始化，放入缓存后返回。
 *
 * 保留原 group-router 的缓存语义：按 groupId 惰性创建、复用、统一关闭。
 */
export async function ensureGroupMcpService(
  groupId: string,
): Promise<GroupMcpService> {
  const existing = groupServices.get(groupId);
  if (existing) {
    return existing;
  }

  logger.info('为组创建MCP服务实例', { groupId });
  const coreServiceManager = await getCoreServiceManager();
  const groupService = new GroupMcpService(groupId, coreServiceManager);
  await groupService.initialize();

  groupServices.set(groupId, groupService);
  return groupService;
}

/**
 * 按 groupId 创建一个绑定到该组的 MCP HTTP handler。
 *
 * 返回的 handler.fetch 接受标准 Request（Hono 的 c.req.raw），并支持通过
 * options.parsedBody 传入预解析的 JSON body（避免重复读取请求流）。
 *
 * 注意：此 handler 不再做组存在性校验——校验由上层 group-router 的
 * groupValidationMiddleware 负责，调用方需在通过校验后再构造 handler。
 */
export async function createGroupMcpHandler(
  groupId: string,
): Promise<McpHttpHandler> {
  // 命中缓存则直接复用，避免每请求重建 handler/bus
  const cached = groupHandlers.get(groupId);
  if (cached) {
    return cached;
  }

  // 确保 service 已初始化并放入缓存（factory 闭包从缓存中取）
  await ensureGroupMcpService(groupId);

  const handler = createMcpHandler(
    // McpServerFactory：按请求返回该组对应的 McpServer
    () => {
      const groupService = groupServices.get(groupId);
      if (!groupService) {
        // 不应发生：上面 ensureGroupMcpService 已放入缓存
        throw new Error(`组 '${groupId}' 的 MCP 服务未初始化`);
      }
      // 复用缓存中已注册工具的 McpServer 实例
      return groupService.getMcpServer();
    },
    {
      // 入站激进升级：拒绝 2025-era（legacy）流量，仅服务 2026-07-28
      legacy: 'reject',
      onerror: (error) => {
        logger.error('组MCP handler 错误', error, { groupId });
      },
    },
  );

  groupHandlers.set(groupId, handler);
  return handler;
}

// ─────────────────────────────────────────────────────────────────────────────
// 缓存失效钩子
//
// 配置变更（组 servers/tools、服务器列表、API 工具）后调用，使下次请求惰性重建
// GroupMcpService + handler，避免客户端看到过期工具列表。
//
// 失效会优雅释放旧实例：
//   - handler.close()  —— 中止在飞的 modern exchanges / 关闭 bus
//   - service.shutdown() —— 调 mcpServer.close() 释放旧 server
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 失效指定组的 service + handler 缓存（先优雅关闭再删除）。
 *
 * 用于"已知受影响 group"的精确失效（如 PUT/DELETE 单个组、配置工具过滤）。
 * 失效后下次请求会通过 ensureGroupMcpService + createGroupMcpHandler 惰性重建。
 *
 * 不存在的 group 不会报错（幂等）。
 */
export async function invalidateGroupMcpService(groupId: string): Promise<void> {
  const handler = groupHandlers.get(groupId);
  if (handler) {
    try {
      await handler.close();
    } catch (error) {
      logger.error('关闭组MCP handler 失败（失效流程）', error as Error, { groupId });
    }
    groupHandlers.delete(groupId);
  }

  const service = groupServices.get(groupId);
  if (service) {
    try {
      await service.shutdown();
    } catch (error) {
      logger.error('关闭组MCP service 失败（失效流程）', error as Error, { groupId });
    }
    groupServices.delete(groupId);
  }
}

/**
 * 失效所有 group 的 service + handler 缓存（先优雅关闭再删除）。
 *
 * 用于"无法精确判断受影响 group"的场景（如全局 coreServiceManager 重建，
 * 因为所有 GroupMcpService 都持有旧的 coreServiceManager 引用，必须全部重建）。
 */
export async function invalidateAllGroupMcpServices(): Promise<void> {
  // 先关闭所有 handler
  const handlerEntries = Array.from(groupHandlers.entries());
  await Promise.allSettled(
    handlerEntries.map(async ([groupId, handler]) => {
      try {
        await handler.close();
      } catch (error) {
        logger.error('关闭组MCP handler 失败（失效全部）', error as Error, { groupId });
      }
    }),
  );
  groupHandlers.clear();

  // 再关闭所有 service
  const serviceEntries = Array.from(groupServices.entries());
  await Promise.allSettled(
    serviceEntries.map(async ([groupId, service]) => {
      try {
        await service.shutdown();
      } catch (error) {
        logger.error('关闭组MCP service 失败（失效全部）', error as Error, { groupId });
      }
    }),
  );
  groupServices.clear();

  logger.info('所有组MCP缓存已失效', {
    handlerCount: handlerEntries.length,
    serviceCount: serviceEntries.length,
  });
}
