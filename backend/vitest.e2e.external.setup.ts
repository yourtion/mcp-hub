/**
 * api-e2e-oauth-external project 的 setup（oauth external profile）
 *
 * 与 `api-e2e-oauth`（internal profile）的差异：
 *   - `setupTestConfig('external')`：system.json 配 oauth.mode='external' + external 块
 *     （issuer/jwksUri/introspectionEndpoint/audience 指向 mock IdP）。
 *   - 独立端口（3040）+ 独立临时配置目录，避免与 internal profile 的 oauth 配置串。
 *
 * 外部 IdP 本身不真实起服务——测试体（oauth-external-idp.test.ts）在 beforeAll 用
 * `vi.stubGlobal('fetch', ...)` 拦截 JWKS / introspect 请求，afterAll 严格 unstub。
 * 故 setup 仅负责写配置 + 起 Hub server，不挂任何 mock HTTP 服务。
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

  const port = Number(process.env.E2E_PORT) || 3040;
  const baseUrl = `http://localhost:${port}`;

  // 1. 写入 external profile 测试配置（system.json 含 oauth external 块，指向 mock IdP）
  setupTestConfig('external');

  // 2. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth(baseUrl))) {
    try {
      await startTestServer(port);
    } catch (error) {
      console.error('[api-e2e-oauth-external setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 3. 等待就绪
  await waitForServer(baseUrl, 25, 200);
}, 60000);
