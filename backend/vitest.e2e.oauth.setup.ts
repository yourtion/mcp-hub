/**
 * api-e2e-oauth project 的 setup（oauth internal profile）
 *
 * 与 `api-e2e`（open profile）的差异：
 *   - `setupTestConfig('oauth')`：system.json 追加 oauth internal 块（resource=本端口）
 *   - 独立端口（3010）+ 独立临时配置目录，避免与 open profile 互斥/缓存串
 *
 * Step 1 仅搭基础设施：setup 跑起来，但 4 个 oauth 入站 e2e 测试体仍 conditional skip
 * （返回 503/400 守卫未拆）。Step 2 才拆守卫激活真实断言。
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

  const port = Number(process.env.E2E_PORT) || 3010;
  const baseUrl = `http://localhost:${port}`;

  // 1. 写入 oauth profile 测试配置（system.json 含 oauth internal 块）
  setupTestConfig('oauth');

  // 2. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth(baseUrl))) {
    try {
      await startTestServer(port);
    } catch (error) {
      console.error('[api-e2e-oauth setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 3. 等待就绪
  await waitForServer(baseUrl, 25, 200);
}, 60000);
