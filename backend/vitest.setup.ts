/**
 * Backend 包 Vitest setup 文件
 * 负责 backend 特有的清理逻辑，通用清理由根 vitest.setup.ts 处理
 */
import { afterAll, afterEach } from 'vitest';

/**
 * Backend 专用的清理函数
 * 清理配置实例、dashboard 服务、测试服务器
 * 使用 try-catch 容错，因为测试文件可能 mock 了相关模块
 */
async function cleanupBackendTestState(): Promise<void> {
  const results = await Promise.allSettled([
    import('./src/utils/config.js'),
    import('./src/api/dashboard/index.js'),
    import('./src/e2e/test-server.js'),
  ]);

  // 清理配置实例
  if (results[0].status === 'fulfilled') {
    const configModule = results[0].value;
    if ('resetConfigInstances' in configModule) {
      configModule.resetConfigInstances();
    }
  }

  // 清理 dashboard 服务
  if (results[1].status === 'fulfilled') {
    const dashboardModule = results[1].value;
    dashboardModule.shutdownDashboardServices?.();
  }

  // 停止测试服务器
  if (results[2].status === 'fulfilled') {
    const testServerModule = results[2].value;
    await testServerModule.stopTestServer?.();
  }
}

afterEach(async () => {
  await cleanupBackendTestState();
});

afterAll(async () => {
  await cleanupBackendTestState();
});
