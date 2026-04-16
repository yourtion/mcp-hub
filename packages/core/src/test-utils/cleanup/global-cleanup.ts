/**
 * 测试清理工具函数
 * 注意：全局 afterEach 钩子已移至根 vitest.setup.ts + TestContext
 */

/**
 * 等待所有异步操作完成
 */
export async function waitForAsyncOperations(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * 安全地清理服务
 */
export async function safeCleanup(
  cleanupFn: () => Promise<void> | void,
  retries: number = 3,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await cleanupFn();
      await waitForAsyncOperations();
      return;
    } catch (error) {
      if (i === retries - 1) {
        console.warn('Cleanup failed (ignoring):', error);
      }
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
