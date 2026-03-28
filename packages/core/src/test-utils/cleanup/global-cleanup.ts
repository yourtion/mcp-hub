/**
 * 全局测试清理工具
 * 确保测试后没有资源泄漏
 */

import { afterEach } from 'vitest';

/**
 * 全局资源清理钩子
 * 在每个测试后执行，确保没有资源泄漏
 */
afterEach(async () => {
  // 1. 等待所有微任务完成
  await new Promise((resolve) => setImmediate(resolve));

  // 2. 等待一个事件循环，让异步清理完成
  await new Promise((resolve) => setTimeout(resolve, 10));

  // 3. 清除所有 mocks
  vi.restoreAllMocks();
  vi.clearAllMocks();

  // 4. 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc();
    // 等待 GC 完成
    await new Promise((resolve) => setImmediate(resolve));
  }
});

/**
 * 等待所有异步操作完成
 * 用于测试中的异步清理
 */
export async function waitForAsyncOperations(): Promise<void> {
  // 等待多个事件循环，确保所有异步操作完成
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * 安全地清理服务
 * 确保服务完全关闭，即使抛出错误也不会影响测试
 */
export async function safeCleanup(
  cleanupFn: () => Promise<void> | void,
  retries: number = 3,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await cleanupFn();
      // 等待清理真正完成
      await waitForAsyncOperations();
      return;
    } catch (error) {
      if (i === retries - 1) {
        // 最后一次尝试失败，忽略错误
        console.warn('Cleanup failed (ignoring):', error);
      }
      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/**
 * 创建一个带超时的清理操作
 */
export function cleanupWithTimeout(
  cleanupFn: () => Promise<void> | void,
  timeout: number = 5000,
): Promise<void> {
  return Promise.race<void>([
    cleanupFn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Cleanup timeout after ${timeout}ms`)),
        timeout,
      ),
    ),
  ]);
}
