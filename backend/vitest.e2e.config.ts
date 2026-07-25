import path from 'node:path';
import { mergeConfig } from 'vitest/config';

import configShared from '../vitest.shared.js';

/**
 * e2e 协议/HTTP 测试 project（`api-e2e`）
 *
 * 与 `api-unit`（backend/vitest.config.ts）的区别：
 *   - 仅包含 `src/e2e/**` 下的端到端 / 协议合规测试
 *   - 更长的超时（真实服务器启动 + HTTP 握手）
 *   - 关闭 fileParallelism，单 worker 顺序跑——协议测试依赖共享的
 *     全局 TestServer 单例与配置目录，并行会端口/状态竞争
 *
 * 通过根 `pnpm test:e2e`（= `vitest --run --project api-e2e`）触发，
 * 也在根 `pnpm test`（默认跑全部 project）中自动纳入。
 *
 * 注意：仅纳入 `src/e2e/mcp-protocol/**`。同目录下的 `web-ui-integration.test.ts`
 * 走自建 server（端口 3100）但未初始化 HubService，调 `/api/tools` 等会 500——
 * 这是 P1 传输层升级之前就存在的问题，与本次 Task 12/13（MCP 协议合规）无关，
 * 留给后续单独修复服务初始化后再放开。
 */
export default mergeConfig(configShared, {
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../packages/core/src'),
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../packages/share/src'),
    },
  },
  test: {
    name: 'api-e2e',
    // 关键：不复用 backend/vitest.setup.ts —— 那个文件的 afterEach/afterAll 会
    // 调用 stopTestServer() 把全局 TestServer 关掉，导致同一文件里第二个 it() 起
    // 所有 fetch 都 "fetch failed"。e2e 的服务器生命周期由 vitest.e2e.setup.ts
    // 统一管理（worker 级单例，进程退出时回收）。
    setupFiles: ['./vitest.e2e.setup.ts'],
    include: ['src/e2e/mcp-protocol/**/*.test.ts'],
    // e2e 测试会启动真实 HTTP server、走完整协议握手，给足超时
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    // 全局单例服务器 + 共享配置目录，必须串行
    fileParallelism: false,
    // 注意：不声明 coverage——e2e 测的是协议行为，不纳入单测覆盖率门禁
  },
});
