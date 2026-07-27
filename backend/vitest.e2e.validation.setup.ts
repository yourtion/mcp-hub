/**
 * api-e2e-validation project 的 setup（validation profile）
 *
 * 与 `api-e2e`（open profile）的差异：
 *   - `setupTestConfig('validation')`：设 VALIDATION_KEY_SECRET，default 组追加 validation 块
 *     （validationKey = 运行时加密的 'testValidationKey123'，与 validation-key.test.ts 的
 *      KNOWN_KEY 对齐）
 *   - 不配 oauth（oauth 与 validation 互斥，见 resource-server.ts:68）
 *   - 独立端口（3020）+ 独立临时配置目录
 *
 * Step 1 仅搭基础设施：setup 跑起来，但 validation-key 测试体仍 conditional skip
 * （503/404/400 守卫未拆）。Step 2 才拆守卫激活真实断言。
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

  const port = Number(process.env.E2E_PORT) || 3020;
  const baseUrl = `http://localhost:${port}`;

  // 1. 写入 validation profile 测试配置（default 组启用 validation + 加密 validationKey）
  setupTestConfig('validation');

  // 2. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth(baseUrl))) {
    try {
      await startTestServer(port);
    } catch (error) {
      console.error('[api-e2e-validation setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 3. 等待就绪
  await waitForServer(baseUrl, 25, 200);
}, 60000);
