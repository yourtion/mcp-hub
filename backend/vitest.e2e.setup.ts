/**
 * api-e2e setup（setupFiles，单 worker 内每个测试文件前各跑一次）
 *
 * 用模块级布尔守卫保证「写配置 + 启动 TestServer」在整个 worker 生命周期内
 * 只发生一次。后续文件复用同一运行中的服务器与同一份配置，避免：
 *   - 文件 A 的 afterAll cleanupTestConfig 删了临时目录，文件 B 的请求读到旧路径
 *   - JsonStorage 实例缓存指向已删目录导致 getAllConfig 失败
 *
 * 协议测试文件因此在 afterAll 不应清理配置/停服务器（cleanupMcpTestConfig 已是 no-op）。
 *
 * 不在 afterAll 里 teardown：TestServer 已 unref，worker 退出时进程自动回收。
 */
import { beforeAll } from 'vitest';

import { checkServerHealth, startTestServer, waitForServer } from './src/e2e/test-server.js';
import { setupTestConfig } from './src/e2e/test-utils.js';

// 模块级守卫：整个 worker 只初始化一次
let initialized = false;

beforeAll(async () => {
  if (initialized) {
    return;
  }
  initialized = true;

  // 1. 写入测试配置（含 `default` 组，CONFIG_PATH 指向临时目录）
  setupTestConfig();

  // 2. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth('http://localhost:3000'))) {
    try {
      await startTestServer(3000);
    } catch (error) {
      console.error('[api-e2e setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 3. 等待就绪
  await waitForServer('http://localhost:3000', 25, 200);
}, 60000);
