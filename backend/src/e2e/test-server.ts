/**
 * 测试服务器启动器
 * 为端到端测试提供独立的服务器实例
 */

import { serve } from '@hono/node-server';

import { initializeDashboardServices, shutdownDashboardServices } from '../api/dashboard/index.js';
import { app } from '../app.js';
import {
  createHubService,
  setHubService,
  shutdownHubService,
} from '../services/service-registry.js';
import { getAllConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

import type { GroupConfig, McpConfig } from '@mcp-core/mcp-hub-share/config';

export class TestServer {
  private server: ReturnType<typeof serve> | null = null;
  private port: number;
  private servicesInitialized = false;

  constructor(port: number = 3000) {
    this.port = port;
  }

  /**
   * 初始化业务服务（HubService + Dashboard）。
   *
   * 复用 production（index.ts startServer）的初始化原语：读取 setup 写入的
   * CONFIG_PATH 配置 → createHubService → initialize → setHubService → dashboard。
   * 不初始化会导致 MCP 端点（/:group/mcp 的 tools/list 等）抛 500
   * "HubService not initialized"，所有 e2e 协议测试失败。
   *
   * 幂等：servicesInitialized 标志位防重复初始化（多个 beforeAll 共享单例 server）。
   */
  private async initializeServices(): Promise<void> {
    if (this.servicesInitialized) {
      return;
    }

    const config = await getAllConfig();
    // getAllConfig 返回 DeepReadonly，createHubService 期望可变 Record。
    // DeepReadonly 的递归 brand 使 asMutable 嵌套断言不稳定，这里对业务字段做显式可变类型断言。
    const service = await createHubService({
      servers: config.mcps.servers as McpConfig['servers'],
      groups: config.groups as GroupConfig,
      apiToolsConfigPath: config.apiToolsConfigPath,
    });
    await service.initialize();
    setHubService(service);
    initializeDashboardServices(service);
    this.servicesInitialized = true;
    logger.info('测试服务器业务服务初始化完成（HubService + Dashboard）');
  }

  async start(): Promise<void> {
    if (this.server) {
      return; // 已经启动
    }

    // 先初始化业务服务（依赖 setup 已设置的 CONFIG_PATH），再监听端口。
    await this.initializeServices();

    return new Promise((resolve, reject) => {
      try {
        this.server = serve({
          fetch: app.fetch,
          port: this.port,
        });
        // 注意：不对 listener 调用 unref()。
        // unref 会让进程在「只剩 server 句柄」时退出，但在 vitest worker 内，
        // 第一个流式响应（如 MCP StreamableHTTP 的 SSE/POST 流）处理完后，
        // 事件循环短暂只剩 listener，触发进程退出 → 后续请求全部 "fetch failed"。
        // vitest 会在 teardownTimeout 后强制回收 worker，无需 unref 也能退出。

        // 等待服务器启动
        const startupTimer = setTimeout(() => {
          logger.info(`测试服务器已启动在端口 ${this.port}`);
          resolve();
        }, 1000);
        startupTimer.unref?.();
      } catch (error) {
        logger.error('测试服务器启动失败', error as Error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      try {
        const server = this.server as { close?: (cb?: () => void) => void };
        if (typeof server.close === 'function') {
          await new Promise<void>((resolve) => {
            server.close?.(() => resolve());
          });
        }
        this.server = null;

        // 清理业务服务（与 production cleanupResources 对齐）
        if (this.servicesInitialized) {
          await shutdownDashboardServices().catch((error) => {
            logger.error('测试服务器 Dashboard 关闭失败', error);
          });
          const hubService = await shutdownHubService();
          await hubService?.shutdown().catch((error) => {
            logger.error('测试服务器 HubService 关闭失败', error);
          });
          this.servicesInitialized = false;
        }

        logger.info('测试服务器已停止');
      } catch (error) {
        logger.error('测试服务器停止失败', error as Error);
      }
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

// 全局测试服务器实例
let globalTestServer: TestServer | null = null;

/**
 * 获取或创建全局测试服务器实例
 */
export function getTestServer(port: number = 3000): TestServer {
  if (!globalTestServer) {
    globalTestServer = new TestServer(port);
  }
  return globalTestServer;
}

/**
 * 启动测试服务器（如果尚未启动）
 */
export async function startTestServer(port: number = 3000): Promise<TestServer> {
  const server = getTestServer(port);
  if (!server.isRunning()) {
    await server.start();
  }
  return server;
}

/**
 * 停止测试服务器
 */
export async function stopTestServer(): Promise<void> {
  if (globalTestServer) {
    await globalTestServer.stop();
    globalTestServer = null;
  }
}

/**
 * 检查服务器是否可用
 */
export async function checkServerHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/ping`);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

/**
 * 等待服务器就绪
 */
export async function waitForServer(
  baseUrl: string,
  maxAttempts: number = 10,
  delay: number = 1000,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await checkServerHealth(baseUrl)) {
      return true;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, delay);
        timer.unref?.();
      });
    }
  }

  return false;
}
