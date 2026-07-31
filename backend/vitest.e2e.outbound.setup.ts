/**
 * api-e2e-outbound project 的 setup（outbound profile）
 *
 * 与 `api-e2e`（open profile）的差异：
 *   - `setupTestConfig('outbound')`：
 *     · system.json 追加 oauth internal 块（保护 `/:group/mcp` 端点，与 oauth profile 一致——
 *       出站测试要经 MCP 端点调工具，端点必须可达；保留入站 oauth 与 spec Step 4 设计对齐）
 *     · api_tools.json 预置一个 oauth 工具（security.authentication.type=oauth）
 *   - 独立端口（3030）+ 独立临时配置目录
 *
 * Step 4：显式 `apiToMcpWebService.initialize(<api_tools.json>)` 加载 oauth 工具配置。
 *   该单例（app.ts:28 模块级 new）是 `/api/api-to-mcp/*` REST 路由的服务后端，
 *   `POST /api/api-to-mcp/configs/:id/test` 经此单例执行 api 工具 → OAuthStrategy 取 token。
 *
 * ⚠️ 架构核实（与 spec Step 4 初稿的偏差）：
 *   api-to-mcp 工具**不**经 `/:group/mcp` 暴露——`/:group/mcp` 的 GroupMcpService 用
 *   coreServiceManager.getAllTools()（只返回已连接 stdio server 的工具），不加载 api_tools.json。
 *   api-to-mcp 工具只在 `/api/api-to-mcp/*` REST 路由可达（经 app.ts 的 apiToMcpWebService 单例）。
 *   故出站 OAuth 全链路通过 `POST /api/api-to-mcp/configs/:id/test` 验证，不经 MCP 端点。
 *   详见 step-4-report.md 的「架构核实」节。
 *
 * configPath：setupTestConfig 把 system.json 的 apiToolsConfigPath 也指向同一份
 *   `<CONFIG_PATH>/api_tools.json`，但 system.json 那条只被 McpKnotService（不经 /:group/mcp）
 *   读取，不影响 /api/api-to-mcp/* 路径。这里显式传同一文件给单例 initialize，确保
 *   /api/api-to-mcp/configs 列表与 test 端点能加载到 oauth 工具。
 */
import { beforeAll } from 'vitest';

import { apiToMcpWebService } from './src/app.js';
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

  // 1. 写入 outbound profile 测试配置（oauth internal + api_tools 预置 oauth 工具）
  const configDir = setupTestConfig('outbound');

  // 2. 初始化 api-to-mcp web 服务单例：加载 oauth 工具，使 /api/api-to-mcp/* 可用
  //    initialize 内部会校验 api_tools.json 符合 ApiToolsConfigSchema（version + tools[]）。
  const apiToolsPath = `${configDir}/api_tools.json`;
  try {
    await apiToMcpWebService.initialize(apiToolsPath);
  } catch (error) {
    // initialize 失败不阻断 setup——测试体自身的断言会暴露问题，
    // 但日志记录便于诊断（如 fixture schema 不符）
    console.error('[api-e2e-outbound setup] apiToMcpWebService.initialize 失败:', error);
  }

  // 3. 启动 TestServer（worker 内单例）
  if (!(await checkServerHealth(baseUrl))) {
    try {
      await startTestServer(port);
    } catch (error) {
      console.error('[api-e2e-outbound setup] 测试服务器启动失败:', error);
      return;
    }
  }

  // 4. 等待就绪
  await waitForServer(baseUrl, 25, 200);
}, 60000);
