/**
 * P4 缓存语义 e2e — tools/list
 *
 * 验证 P4 实现的两条协议层改动通过真实 HTTP（`/:group/mcp`）传到客户端：
 *
 * 1. **cacheHint**（spec §1.2）：GroupMcpService 构造 McpServer 时传入
 *    `cacheHints: { 'tools/list': { ttlMs: 60_000, cacheScope: 'public' } }`，
 *    服务端在 2026-07-28 协议下把这两个字段填到 result 上（fillCacheFields
 *    契约），客户端 ListToolsResultSchema 用 `$loose` catchall 让它们
 *    透传到运行时 body。断言这两个字段在结果顶层。
 *
 * 2. **确定性排序**：GroupMcpService 注册工具时按 `${serverId}_${toolName}`
 *    字典序注册。断言两次连续 listTools 顺序一致，且是字典序。
 *
 * ---
 *
 * **探测结论**（写本测试前用 console.log 打印 `await client.listTools()` 验证）：
 * cacheHint 在 wire 层附在 result 顶层（`result.ttlMs` / `result.cacheScope`），
 * 不在 `_meta`。SDK TS 类型 `ListToolsResult` 不显式声明这两个字段（loose
 * schema 透传），因此运行时按 `as Record<string, unknown>` 读取。默认 `cacheMode='use'` 与
 * `cacheMode='bypass'` 都能读到——客户端把 wire 字段抄一份给调用方，再单
 * 独用 `_freshness()` 提取 ttlMs/cacheScope 维护 response cache。我们这里
 * 仍用 `bypass` 让请求强制走 wire，更稳定地反映服务端实际下发值，避免任何
 * 客户端 cache 优化（如合并 result）干扰断言。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanupTestEnvironment, setupTestEnvironment, sleep } from '../test-utils.js';
import {
  cleanupMcpTestConfig,
  closeMcpClient,
  createResilientMcpClient,
  ensureTestServerRunning,
} from './mcp-test-config.js';

describe('P4 缓存语义 e2e - tools/list', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning();
    if (serverReady) await sleep(2000);
  });

  afterAll(() => {
    cleanupMcpTestConfig();
    cleanupTestEnvironment();
    restoreConsole();
  });

  it('tools/list 响应带 ttlMs=60_000 与 cacheScope=public（顶层字段）', async () => {
    if (!serverReady) return; // 自我跳过：全局 setup 没起服务器
    const conn = await createResilientMcpClient('cache-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      // cacheMode='bypass' 强制走 wire，避免客户端 cache 干扰，最直接反映服务端下发值。
      // cacheHint 在 wire 层附在 result 顶层（ListToolsResultSchema loose catchall 透传）。
      const result = (await client.listTools(undefined, { cacheMode: 'bypass' })) as Record<
        string,
        unknown
      >;

      expect(result.ttlMs).toBe(60_000);
      expect(result.cacheScope).toBe('public');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('tools/list 确定性排序（连续两次顺序一致且字典序）', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('sort-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const r1 = await client.listTools(undefined, { cacheMode: 'bypass' });
      const r2 = await client.listTools(undefined, { cacheMode: 'bypass' });
      const names1 = r1.tools.map((t) => t.name);
      const names2 = r2.tools.map((t) => t.name);

      // 两次调用顺序稳定
      expect(names1).toEqual(names2);

      // 服务端按 `${serverId}_${toolName}` 注册名字的字典序下发
      const sorted = names1.toSorted();
      expect(names1).toEqual(sorted);
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);
});

/**
 * P4 缓存语义 e2e — resources/list + resources/read
 *
 * 验证 Task 5 注册的 4 个 Hub 元数据 resource 能通过真实 HTTP 连接被客户端
 * 列出（listResources）与读取（readResource）：
 *
 *   - group://default/status   —— 组运行时状态 JSON（getStatus）
 *   - group://default/servers  —— 组服务器列表与连接状态 JSON
 *   - hub://config             —— 全局配置概要 JSON（version, groups, serverCount）
 *   - hub://version            —— 版本信息 JSON（name, version）
 *
 * 与 tools/list describe 平行，独立 beforeAll/afterAll，不共享状态。
 */
describe('P4 缓存语义 e2e - resources', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning();
    if (serverReady) await sleep(2000);
  });

  afterAll(() => {
    cleanupMcpTestConfig();
    cleanupTestEnvironment();
    restoreConsole();
  });

  it('resources/list 返回 4 个 Hub 元数据 resource', async () => {
    if (!serverReady) return; // 自我跳过：全局 setup 没起服务器
    const conn = await createResilientMcpClient('res-list-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.listResources();
      const uris = result.resources.map((r) => r.uri);
      expect(uris).toContain('group://default/status');
      expect(uris).toContain('group://default/servers');
      expect(uris).toContain('hub://config');
      expect(uris).toContain('hub://version');
      expect(result.resources.length).toBeGreaterThanOrEqual(4);
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('resources/read hub://version 返回版本 JSON', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('res-version-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.readResource({ uri: 'hub://version' });
      expect(result.contents.length).toBeGreaterThan(0);
      const text = (result.contents[0] as { text?: string }).text;
      const parsed = JSON.parse(text ?? '{}');
      expect(parsed).toHaveProperty('version');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);

  it('resources/read group://default/status 返回状态 JSON', async () => {
    if (!serverReady) return;
    const conn = await createResilientMcpClient('res-status-test');
    if (!conn) return;
    const { client, transport } = conn;
    try {
      const result = await client.readResource({ uri: 'group://default/status' });
      expect(result.contents.length).toBeGreaterThan(0);
      const text = (result.contents[0] as { text?: string }).text;
      const parsed = JSON.parse(text ?? '{}');
      expect(parsed).toHaveProperty('groupId', 'default');
      expect(parsed).toHaveProperty('availableTools');
    } finally {
      await closeMcpClient(client, transport);
    }
  }, 30000);
});
