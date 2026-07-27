/**
 * api-e2e-outbound project 的 setup（outbound profile）
 *
 * 与 `api-e2e`（open profile）的差异：
 *   - `setupTestConfig('outbound')`：
 *     · system.json 追加 oauth internal 块（保护 `/:group/mcp` 端点，与 oauth profile 一致——
 *       出站测试要经 MCP 端点调工具，端点必须可达；保留入站 oauth 与 spec Step 4 设计对齐）
 *     · api_tools.json 预置一个 oauth 工具占位（security.authentication.type=oauth）
 *   - 独立端口（3030）+ 独立临时配置目录
 *
 * Step 1 仅搭基础设施：setup 跑起来，但 oauth-outbound 测试体仍 describe.skipIf 占位
 * （依赖 P3_OAUTH_OUTBOUND_E2E 环境变量）。Step 4 才补 apiToMcpWebService.initialize
 * 并展开真实假 AS + 假受保护资源的端到端验证。
 *
 * 注意：Step 1 此处不调 `apiToMcpWebService.initialize()` —— app.ts:28 模块级 new 但未 initialize，
 * 真正的 initialize + api-to-mcp 单例 export 由 Step 4 处理（spec 决策项）。
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

  const port = Number(process.env.E2E_PORT) || 3030;
  const baseUrl = `http://localhost:${port}`;

  // 1. 写入 outbound profile 测试配置（oauth internal + api_tools 预置 oauth 工具占位）
  setupTestConfig('outbound');

  // 2. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth(baseUrl))) {
    try {
      await startTestServer(port);
    } catch (error) {
      console.error('[api-e2e-outbound setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 3. 等待就绪
  await waitForServer(baseUrl, 25, 200);
}, 60000);
