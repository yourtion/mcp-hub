import path from 'node:path';
import { defineProject, mergeConfig } from 'vitest/config';

import configShared from '../vitest.shared.js';

/**
 * e2e 协议/HTTP 测试 project 矩阵（Step 1 of e2e fixture 激活）
 *
 * 由单一 `api-e2e` project 拆为 4 个独立 project，各自独立 setup + 临时配置目录 +
 * 端口，因 oauth 与 validation 配置互斥（resource-server.ts:68）、不同 profile 需要不同
 * system.json/group.json/api_tools.json fixture，必须隔离才能并行/串行无冲突。
 *
 * 每个 project 的 `test.env` 注入 `E2E_PORT`，被 setup（startTestServer）与
 * mcp-test-config.ts（defaultMcpTestConfig.baseUrl）读取，保证各 project 走自己的 server。
 *
 * - `api-e2e`（改造现有）：open profile（无 oauth/validation），跑非 oauth e2e。
 *   include 排除 oauth/validation/outbound 文件。
 * - `api-e2e-oauth`（新增）：oauth internal profile，跑 4 个 oauth 入站 e2e。
 * - `api-e2e-validation`（新增）：validation profile，跑 validation-key e2e。
 * - `api-e2e-outbound`（新增）：oauth 出站 profile，跑 oauth-outbound e2e。
 *
 * Step 1 完成后 4 个 project 都能启动，但 6 个 oauth/validation/outbound 测试体仍 conditional
 * skip / describe.skipIf 占位（本 step 不改测试体）。Step 2-4 才激活真实断言。
 *
 * 注意：根 vitest.config.ts 通过 `...e2eProjects` 展开本文件导出的数组——vitest 的 project
 * 配置文件经路径引用时必须导出单一对象，故此处不作为可被路径引用的 project 文件，而是导出
 * project 数组供根配置内联消费。内联 project 的 root 默认是仓库根，故显式置为 backend/ 目录
 * （__dirname），让 include 的 `src/e2e/...` 相对 backend/ 解析。
 */
const backendRoot = __dirname;
const resolveAlias = {
  '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../packages/core/src'),
  '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../packages/share/src'),
};

// 所有 e2e project 共享的超时 / 串行约定（协议测试依赖全局 TestServer 单例，
// 必须串行；端口已隔离但仍保留 fileParallelism:false 避免同 project 内多文件抢同一 server）
const e2eTestCommon = {
  testTimeout: 60000,
  hookTimeout: 30000,
  teardownTimeout: 10000,
  fileParallelism: false,
  // 注意：不声明 coverage——e2e 测的是协议行为，不纳入单测覆盖率门禁
} as const;

/**
 * api-e2e（open profile，端口 3000）
 *
 * 现有非 oauth e2e：mcp-basic / hub-aggregation / cache-semantics / mcp-http-api /
 * protocol-compliance。排除 oauth-*.test.ts、validation-key.test.ts、oauth-outbound.test.ts
 * （这些归各自独立 project）。
 *
 * 关键：不复用 backend/vitest.setup.ts —— 那个文件的 afterEach/afterAll 会调用
 * stopTestServer() 把全局 TestServer 关掉。e2e 的服务器生命周期由各自 setup 文件统一管理。
 */
export const apiE2eOpen = defineProject(
  mergeConfig(configShared, {
    resolve: { alias: resolveAlias },
    test: {
      name: 'api-e2e',
      root: backendRoot,
      setupFiles: ['./vitest.e2e.setup.ts'],
      env: { E2E_PORT: '3000' },
      include: ['src/e2e/mcp-protocol/**/*.test.ts'],
      exclude: [
        // 归属其它 project 的 fixture 文件
        'src/e2e/mcp-protocol/oauth-*.test.ts',
        'src/e2e/mcp-protocol/validation-key.test.ts',
      ],
      ...e2eTestCommon,
    },
  }),
);

/**
 * api-e2e-oauth（oauth internal profile，端口 3010）
 *
 * 4 个 oauth 入站 e2e：discovery / client-credentials / audience / external-idp。
 * Step 1 仅搭 setup；测试体仍 conditional skip（503/400 守卫未拆），Step 2 才激活。
 */
export const apiE2eOauth = defineProject(
  mergeConfig(configShared, {
    resolve: { alias: resolveAlias },
    test: {
      name: 'api-e2e-oauth',
      root: backendRoot,
      setupFiles: ['./vitest.e2e.oauth.setup.ts'],
      env: { E2E_PORT: '3010' },
      include: [
        'src/e2e/mcp-protocol/oauth-discovery.test.ts',
        'src/e2e/mcp-protocol/oauth-client-credentials.test.ts',
        'src/e2e/mcp-protocol/oauth-audience.test.ts',
        'src/e2e/mcp-protocol/oauth-external-idp.test.ts',
      ],
      ...e2eTestCommon,
    },
  }),
);

/**
 * api-e2e-validation（validation profile，端口 3020）
 *
 * validation-key e2e。Step 1 仅搭 setup；测试体仍 conditional skip（503/404/400 守卫未拆），
 * Step 2 才激活。
 */
export const apiE2eValidation = defineProject(
  mergeConfig(configShared, {
    resolve: { alias: resolveAlias },
    test: {
      name: 'api-e2e-validation',
      root: backendRoot,
      setupFiles: ['./vitest.e2e.validation.setup.ts'],
      env: { E2E_PORT: '3020' },
      include: ['src/e2e/mcp-protocol/validation-key.test.ts'],
      ...e2eTestCommon,
    },
  }),
);

/**
 * api-e2e-outbound（oauth 出站 profile，端口 3030）
 *
 * oauth-outbound e2e。Step 1 仅搭 setup；测试体仍 describe.skipIf 占位（依赖
 * P3_OAUTH_OUTBOUND_E2E 环境变量），Step 4 才补 initialize + 真实假 AS/受保护资源。
 */
export const apiE2eOutbound = defineProject(
  mergeConfig(configShared, {
    resolve: { alias: resolveAlias },
    test: {
      name: 'api-e2e-outbound',
      root: backendRoot,
      setupFiles: ['./vitest.e2e.outbound.setup.ts'],
      env: { E2E_PORT: '3030' },
      include: ['src/e2e/mcp-protocol/oauth-outbound.test.ts'],
      ...e2eTestCommon,
    },
  }),
);

/**
 * 4 个 e2e project 的内联配置数组，供根 vitest.config.ts 通过 `...e2eProjects` 展开。
 */
export const e2eProjects = [apiE2eOpen, apiE2eOauth, apiE2eValidation, apiE2eOutbound];
