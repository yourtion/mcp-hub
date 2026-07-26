/**
 * MCP 协议合规端到端测试（Task 13）
 *
 * 验证 Hub 在升级到 MCP 2026-07-28（v2）后的 4 个核心协议合规点：
 *   1. server/discover 返回 capabilities（modern 握手真的能跑通）
 *   2. 入站激进升级（legacy: 'reject'）拒绝 2025-era initialize
 *   3. 协议转换 / 桥接（Hub 对外 StreamableHTTP，后端 mock 老 server）
 *      —— 见用例内 TODO：当前基础设施不足，标注 skip
 *   4. 无状态：两个互不相关的请求被独立处理（无 session 粘连）
 *
 * 配置 / 服务器生命周期由 api-e2e 全局 setup（vitest.e2e.setup.ts）统一管理，
 * 本文件只做 console 静默等本地环境准备，不在 afterAll 清理共享状态。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';
import {
  closeMcpClient,
  createMcpTestClient,
  defaultMcpTestConfig,
  ensureTestServerRunning,
} from './mcp-test-config.js';

describe('MCP 协议合规（2026-07-28 / v2）', () => {
  let restoreConsole: () => void;
  let serverReady = false;

  beforeAll(async () => {
    restoreConsole = setupTestEnvironment();
    serverReady = await ensureTestServerRunning();
    if (serverReady) {
      await sleep(200);
    }
  });

  afterAll(() => {
    cleanupTestEnvironment();
    restoreConsole();
  });

  // ------------------------------------------------------------------
  // 用例 1：server/discover 返回 capabilities
  //
  // modern 客户端用 `versionNegotiation: { mode: 'auto' }` 连接时，SDK 会先
  // 探测 server/discover；成功后连接进入 'modern' era。这里验证：
  //   - 连接成功且 era === 'modern'
  //   - getServerCapabilities() 返回非空对象（至少声明 tools）
  //   - client.discover() 可独立调用并返回 DiscoverResult
  // ------------------------------------------------------------------
  describe('用例 1：server/discover 返回 capabilities', () => {
    it('modern 连接应完成 discover 并暴露 tools capability', async () => {
      if (!serverReady) {
        console.warn('服务器未就绪，跳过');
        return;
      }

      const connection = await createMcpTestClient(
        'compliance-discover-client',
        defaultMcpTestConfig,
      );
      const { client, transport } = connection;

      try {
        // era 必须是 modern（探测到 2026-07-28）
        expect(client.getProtocolEra()).toBe('modern');

        // 协议版本应为 2026-07-28+
        const version = client.getNegotiatedProtocolVersion();
        expect(version).toBeTruthy();
        expect(typeof version).toBe('string');

        // capabilities 必须包含 tools（Hub 至少聚合了工具）
        const caps = client.getServerCapabilities();
        expect(caps).toBeDefined();
        expect(caps).toHaveProperty('tools');

        // 独立调用 discover() 也应成功并返回 capabilities 字段
        const discoverResult = await client.discover();
        expect(discoverResult).toBeDefined();
        expect(discoverResult).toHaveProperty('capabilities');

        console.log(
          `✅ discover 通过：era=${client.getProtocolEra()}, version=${version}, ` +
            `capabilities=${Object.keys(caps!).join(',')}`,
        );
      } finally {
        await closeMcpClient(client, transport);
      }
    }, 30000);
  });

  // ------------------------------------------------------------------
  // 用例 2：入站激进升级拒绝 2025-era initialize
  //
  // group-router 用 createMcpHandler({ legacy: 'reject' }) 构造 handler，
  // 所有不带 v2 _meta envelope 的旧式 initialize 必须被拒绝（4xx）。
  // 用进程内 app.request() 直接打 /:group/mcp，避免客户端 SDK 自动加 envelope。
  // ------------------------------------------------------------------
  describe('用例 2：激进升级拒绝 2025-era initialize', () => {
    it('裸 initialize（无 _meta envelope）应返回 4xx JSON-RPC error', async () => {
      const response = await app.request('/default/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'legacy-probe', version: '1.0.0' },
          },
        }),
      });

      // legacy: 'reject' → 4xx（不是 200，也不是 500）
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('jsonrpc', '2.0');
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      // 不应是 -32603 INTERNAL_ERROR（那表示 handler 异常，而非主动拒绝）
      expect(data.error.code).not.toBe(-32603);

      console.log(
        `✅ 2025-era initialize 被拒绝：status=${response.status}, ` +
          `error.code=${data.error.code}`,
      );
    });

    it('2025-era tools/list 请求（无 envelope）应被拒绝', async () => {
      // legacy: 'reject' 针对的是「需要响应的旧式 JSON-RPC 请求」。
      // notifications/initialized 是通知（无 id、无需响应），服务端按 HTTP
      // 语义返回 202 Accepted 属正常行为，不构成「握手」—— 因此激进的拒绝策略
      // 只作用于 request。这里改用旧式 tools/list（带 id，需要响应）来验证：
      // 它没有 v2 _meta envelope，也没有 mcp-protocol-version 头，应被拒绝。
      const response = await app.request('/default/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      });

      // legacy: 'reject' → 4xx（非 200，非 500）
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('jsonrpc', '2.0');
      expect(data).toHaveProperty('error');

      console.log(
        `✅ 2025-era tools/list 被拒绝：status=${response.status}, ` +
          `error.code=${data.error.code}`,
      );
    });
  });

  // ------------------------------------------------------------------
  // 用例 3：协议转换 / 桥接
  //
  // 目标：Hub 对外暴露 StreamableHTTP（2026-07-28），后端接一个只说 2025-era
  // legacy initialize 的 mock MCP server，验证 Hub 的出站 versionNegotiation
  // 能回退并对外仍提供 modern 协议。
  //
  // TODO：当前测试基础设施缺少「在 e2e 内拉起一个独立 mock MCP server 进程」
  // 的工具（test-utils 仅支持 Hub 自身的 TestServer）。要做桥接测试需要：
  //   1. 起一个 http server，对 initialize 返回 2024-11-05 的 InitializeResult
  //   2. 把它写进测试 config 的 servers（指向 mock URL）
  //   3. 用 modern 客户端连 Hub，断言能聚合到 mock 的工具
  // 这块依赖 Task 14（出站兼容实现）完成后才有意义，先 skip 不阻塞。
  // ------------------------------------------------------------------
  describe('用例 3：协议转换 / 桥接（StreamableHTTP ↔ legacy backend）', () => {
    it.skip('Hub 应把 legacy backend 的工具桥接成 modern 协议暴露', async () => {
      // 占位：见上方 TODO。待 Task 14（出站兼容）落地后补全：
      //   - 起 mock legacy MCP server（只回 initialize，版本 2024-11-05）
      //   - 写入测试 config，让 default 组指向该 mock
      //   - modern 客户端连 Hub /default/mcp
      //   - 断言 listTools 能拿到 mock 注册的工具
      expect(true).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 用例 4：无状态
  //
  // group-router 用 createMcpHandler 构造的是无状态 handler：每个 POST 请求
  // 独立处理，不依赖前序请求建立的 session。验证方式：
  //   - 连续发两个互不相关的 modern 请求（各带独立 id），都应成功
  //   - 不带 session 头 / 不先 initialize，直接 tools/list 也能工作
  // （v2 modern 路径本就是 per-request，无 session 概念）
  // ------------------------------------------------------------------
  describe('用例 4：无状态（每个请求独立处理）', () => {
    it('两个独立 modern 请求无需共享 session 即可各自成功', async () => {
      if (!serverReady) {
        console.warn('服务器未就绪，跳过');
        return;
      }

      // 用两个独立客户端连接（各自独立 discover + listTools），互不知道对方
      const conn1 = await createMcpTestClient('stateless-client-a', defaultMcpTestConfig);
      const conn2 = await createMcpTestClient('stateless-client-b', defaultMcpTestConfig);

      try {
        const [tools1, tools2] = await Promise.all([
          conn1.client.listTools(),
          conn2.client.listTools(),
        ]);

        // 两次独立请求都应拿到工具列表（至少 1 个）
        expect(tools1.tools).toBeInstanceOf(Array);
        expect(tools1.tools.length).toBeGreaterThan(0);
        expect(tools2.tools).toBeInstanceOf(Array);
        expect(tools2.tools.length).toBeGreaterThan(0);

        // 同一 default 组的工具集应一致（聚合逻辑无状态、可重现）
        const names1 = tools1.tools.map((t) => t.name).toSorted();
        const names2 = tools2.tools.map((t) => t.name).toSorted();
        expect(names1).toEqual(names2);

        console.log(`✅ 无状态验证通过：两次独立请求都拿到 ${names1.length} 个工具`);
      } finally {
        await closeMcpClient(conn1.client, conn1.transport);
        await closeMcpClient(conn2.client, conn2.transport);
      }
    }, 30000);

    it('modern 连接不建立 session（无 mcp-session-id 响应头）', async () => {
      if (!serverReady) {
        console.warn('服务器未就绪，跳过');
        return;
      }

      // 无状态的 modern handler 不应分配 session id：
      // 任何响应都不带 `mcp-session-id` 头，客户端 transport 也不会记录 sessionId。
      const capturedSessionHeaders: string[] = [];
      const origFetch = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await origFetch(input, init);
        const sid = response.headers.get('mcp-session-id');
        if (sid) {
          capturedSessionHeaders.push(sid);
        }
        return response;
      }) as typeof fetch;

      try {
        const connection = await createMcpTestClient('stateless-no-session', defaultMcpTestConfig);
        const { client, transport } = connection;
        try {
          await client.listTools();
          // 不应捕获到任何 session id 头
          expect(capturedSessionHeaders).toHaveLength(0);
          // transport 也不应持有 sessionId
          const sid = (transport as unknown as { sessionId?: string }).sessionId;
          expect(sid).toBeUndefined();

          console.log('✅ modern 路径无 session（响应头 + transport 均无 sessionId）');
        } finally {
          await closeMcpClient(client, transport);
        }
      } finally {
        globalThis.fetch = origFetch;
      }
    }, 30000);
  });
});
