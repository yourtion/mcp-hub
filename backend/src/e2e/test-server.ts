/**
 * 测试服务器启动器
 * 为端到端测试提供独立的服务器实例
 */

import { serve } from '@hono/node-server';

import { app } from '../app.js';
import { logger } from '../utils/logger.js';

export class TestServer {
  private server: ReturnType<typeof serve> | null = null;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.server) {
      return; // 已经启动
    }

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
