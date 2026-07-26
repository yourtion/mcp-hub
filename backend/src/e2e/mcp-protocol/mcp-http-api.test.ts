/**
 * MCP HTTP API 端到端测试
 *
 * 在协议传输层升级（v2 / 2026-07-28）后，验证 HTTP 层的关键不变量：
 *   - 基础 health/ping 路由可用
 *   - 已删除的 SSE/legacy 端点（/sse、/messages、/mcp POST）不再可达（返回 404）
 *   - 组 MCP 端点 /:group/mcp 的入站激进升级（legacy: 'reject'）：
 *       * 裸 2025-era initialize 请求被拒绝
 *       * 不存在的组返回 404（组校验中间件）
 *
 * 通过 Hono 的 `app.request()` 做进程内请求，无需启动真实 TCP 服务器。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../../app.js';
import {
  cleanupTestEnvironment,
  safeJsonParse,
  setupTestEnvironment,
  sleep,
} from '../test-utils.js';

describe('MCP HTTP API端到端测试', () => {
  let testApp: typeof app;
  let restoreConsole: () => void;

  beforeAll(async () => {
    testApp = app;
    // 测试配置（含 `default` 组）由 api-e2e 全局 setup 写入并跨文件复用，
    // 这里仅做 console 静默等本地环境准备。
    restoreConsole = setupTestEnvironment();
    await sleep(10);
  });

  afterAll(async () => {
    // 不清理配置 / 不失效 group 缓存：全局 setup 管理配置生命周期，
    // 单文件清理会破坏后续文件复用的运行中服务器。
    cleanupTestEnvironment();
    restoreConsole();
  });

  describe('基础 HTTP 端点', () => {
    it('应该能够响应 ping', async () => {
      const response = await testApp.request('/api/ping');

      expect(response.status).toBe(200);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('success', true);

      console.log('✅ Ping 端点正常');
    });

    it('应该对不存在的端点返回 404', async () => {
      const response = await testApp.request('/api/__nonexistent__');
      expect(response.status).toBe(404);
    });
  });

  describe('已删除的 SSE / legacy 端点（Task 6 移除）', () => {
    it('GET /sse 应当不再可达（返回 404）', async () => {
      const response = await testApp.request('/sse', {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      });

      // SSE 端点已删除：不再是 200/101，而是 404
      expect(response.status).toBe(404);

      console.log(`✅ /sse 已移除（状态码: ${response.status}）`);
    });

    it('POST /messages 应当不再可达（返回 404）', async () => {
      const response = await testApp.request('/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'message' }),
      });

      // 旧的 SSE 消息端点已删除：不再返回 "No transport found" 400，而是 404
      expect(response.status).toBe(404);

      console.log(`✅ /messages 已移除（状态码: ${response.status}）`);
    });

    it('POST /mcp（无 group 段）应当不再可达（返回 404）', async () => {
      // 组路由是 /:group/mcp，裸 /mcp 不匹配
      const response = await testApp.request('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'x', version: '1' },
          },
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('/:group/mcp 组路由校验', () => {
    it('不存在的组应返回 404（组校验中间件）', async () => {
      const response = await testApp.request('/__no_such_group__/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
        }),
      });

      expect(response.status).toBe(404);

      const data = await safeJsonParse(response);
      expect(data).toHaveProperty('error');
      expect(data.error.data.error.code).toBe('GROUP_NOT_FOUND');

      console.log('✅ 不存在组的 MCP 端点正确返回 404');
    });

    it('2025-era 裸 initialize 请求应被激进升级拒绝（legacy: reject）', async () => {
      // 裸 JSON-RPC initialize（无 v2 _meta envelope）—— 入站 legacy: 'reject'
      const response = await testApp.request('/default/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'legacy-client', version: '1.0.0' },
          },
        }),
      });

      // legacy: 'reject' 拒绝旧式握手——非 200
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);

      const data = await safeJsonParse(response);
      // 应当是 JSON-RPC error 响应
      expect(data).toHaveProperty('jsonrpc', '2.0');
      expect(data).toHaveProperty('error');

      console.log(`✅ legacy initialize 被拒绝（状态码: ${response.status}）`);
    });
  });
});
