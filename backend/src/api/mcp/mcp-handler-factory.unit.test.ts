/**
 * mcp-handler-factory 缓存失效钩子单测
 *
 * 验证：
 * - 失效特定 group：handler.close() 与 service.shutdown() 被正确调用，缓存被删除
 * - 失效全部：所有项优雅关闭并清空
 * - 不存在的 group：幂等，不报错
 * - 失效后下次 ensureGroupMcpService 重建（重新初始化）
 *
 * 因 createMcpHandler（来自 @modelcontextprotocol/server）在纯单测环境难以实例化，
 * 本测试聚焦失效函数本身：直接操纵 getGroupServicesCache / getGroupHandlersCache 注入桩。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGroupHandlersCache,
  getGroupServicesCache,
  invalidateAllGroupMcpServices,
  invalidateGroupMcpService,
} from './mcp-handler-factory.js';

// createMcpHandler 不应在失效函数路径中被调用；mock 掉以防意外触发。
// 部分模拟：覆盖 createMcpHandler，其余（含 createRequestStateCodec）走真实实现——
// factory 模块级 `new MrtrRelayService(...)` 在 import 时会调 createRequestStateCodec 构造
// HMAC codec（P5 Task 8 单例），需真实实现而非抛错。
vi.mock('@modelcontextprotocol/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modelcontextprotocol/server')>();
  return {
    ...actual,
    createMcpHandler: vi.fn(() => {
      throw new Error('createMcpHandler 不应在本测试中被调用');
    }),
  };
});

// getCoreServiceManager 不应在失效路径中被调用。
vi.mock('../../services/service-registry.js', () => ({
  getCoreServiceManager: vi.fn(() => {
    throw new Error('getCoreServiceManager 不应在本测试中被调用');
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// 构造桩 handler / service，记录 close/shutdown 调用
function makeHandlerStub() {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn(),
  };
}

function makeServiceStub() {
  return {
    shutdown: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    getMcpServer: vi.fn(),
  };
}

describe('mcp-handler-factory 缓存失效', () => {
  let services: Map<string, ReturnType<typeof makeServiceStub>>;
  let handlers: Map<string, ReturnType<typeof makeHandlerStub>>;

  beforeEach(() => {
    services = getGroupServicesCache() as unknown as Map<
      string,
      ReturnType<typeof makeServiceStub>
    >;
    handlers = getGroupHandlersCache() as unknown as Map<
      string,
      ReturnType<typeof makeHandlerStub>
    >;
    services.clear();
    handlers.clear();
  });

  describe('invalidateGroupMcpService', () => {
    it('缓存命中时调用 handler.close() 与 service.shutdown() 并删除缓存', async () => {
      const service = makeServiceStub();
      const handler = makeHandlerStub();
      services.set('g1', service);
      handlers.set('g1', handler);

      await invalidateGroupMcpService('g1');

      expect(handler.close).toHaveBeenCalledTimes(1);
      expect(service.shutdown).toHaveBeenCalledTimes(1);
      expect(services.has('g1')).toBe(false);
      expect(handlers.has('g1')).toBe(false);
    });

    it('只有 service 命中（无 handler）时仅关闭 service', async () => {
      const service = makeServiceStub();
      services.set('g2', service);

      await invalidateGroupMcpService('g2');

      expect(service.shutdown).toHaveBeenCalledTimes(1);
      expect(services.has('g2')).toBe(false);
      expect(handlers.size).toBe(0);
    });

    it('只有 handler 命中（无 service）时仅关闭 handler', async () => {
      const handler = makeHandlerStub();
      handlers.set('g3', handler);

      await invalidateGroupMcpService('g3');

      expect(handler.close).toHaveBeenCalledTimes(1);
      expect(handlers.has('g3')).toBe(false);
    });

    it('不存在的 group 不报错且不调用任何关闭方法', async () => {
      await expect(invalidateGroupMcpService('nonexistent')).resolves.toBeUndefined();
      expect(services.size).toBe(0);
      expect(handlers.size).toBe(0);
    });

    it('handler.close() 抛错时仍删除缓存并不影响 service 关闭', async () => {
      const service = makeServiceStub();
      const handler = makeHandlerStub();
      handler.close.mockRejectedValue(new Error('handler close boom'));
      services.set('g4', service);
      handlers.set('g4', handler);

      // 不应抛出
      await expect(invalidateGroupMcpService('g4')).resolves.toBeUndefined();

      expect(handler.close).toHaveBeenCalledTimes(1);
      expect(service.shutdown).toHaveBeenCalledTimes(1);
      expect(services.has('g4')).toBe(false);
      expect(handlers.has('g4')).toBe(false);
    });

    it('service.shutdown() 抛错时仍删除缓存', async () => {
      const service = makeServiceStub();
      const handler = makeHandlerStub();
      service.shutdown.mockRejectedValue(new Error('shutdown boom'));
      services.set('g5', service);
      handlers.set('g5', handler);

      await expect(invalidateGroupMcpService('g5')).resolves.toBeUndefined();

      expect(handler.close).toHaveBeenCalledTimes(1);
      expect(service.shutdown).toHaveBeenCalledTimes(1);
      expect(services.has('g5')).toBe(false);
      expect(handlers.has('g5')).toBe(false);
    });

    it('只失效目标 group，其他 group 缓存不受影响', async () => {
      const s1 = makeServiceStub();
      const h1 = makeHandlerStub();
      const s2 = makeServiceStub();
      const h2 = makeHandlerStub();
      services.set('a', s1);
      handlers.set('a', h1);
      services.set('b', s2);
      handlers.set('b', h2);

      await invalidateGroupMcpService('a');

      expect(s2.shutdown).not.toHaveBeenCalled();
      expect(h2.close).not.toHaveBeenCalled();
      expect(services.has('a')).toBe(false);
      expect(handlers.has('a')).toBe(false);
      expect(services.has('b')).toBe(true);
      expect(handlers.has('b')).toBe(true);
    });
  });

  describe('invalidateAllGroupMcpServices', () => {
    it('清空多个 group 的全部缓存，每个都调用 close + shutdown', async () => {
      const s1 = makeServiceStub();
      const h1 = makeHandlerStub();
      const s2 = makeServiceStub();
      const h2 = makeHandlerStub();
      services.set('a', s1);
      handlers.set('a', h1);
      services.set('b', s2);
      handlers.set('b', h2);

      await invalidateAllGroupMcpServices();

      expect(h1.close).toHaveBeenCalledTimes(1);
      expect(h2.close).toHaveBeenCalledTimes(1);
      expect(s1.shutdown).toHaveBeenCalledTimes(1);
      expect(s2.shutdown).toHaveBeenCalledTimes(1);
      expect(services.size).toBe(0);
      expect(handlers.size).toBe(0);
    });

    it('空缓存时也安全（幂等）', async () => {
      await expect(invalidateAllGroupMcpServices()).resolves.toBeUndefined();
      expect(services.size).toBe(0);
      expect(handlers.size).toBe(0);
    });

    it('部分 close/shutdown 抛错时不影响其他项，最终仍全部清空', async () => {
      const s1 = makeServiceStub();
      const h1 = makeHandlerStub();
      h1.close.mockRejectedValue(new Error('h1 boom'));
      const s2 = makeServiceStub();
      s2.shutdown.mockRejectedValue(new Error('s2 boom'));
      const h2 = makeHandlerStub();
      services.set('a', s1);
      handlers.set('a', h1);
      services.set('b', s2);
      handlers.set('b', h2);

      await expect(invalidateAllGroupMcpServices()).resolves.toBeUndefined();

      expect(h1.close).toHaveBeenCalledTimes(1);
      expect(h2.close).toHaveBeenCalledTimes(1);
      expect(s1.shutdown).toHaveBeenCalledTimes(1);
      expect(s2.shutdown).toHaveBeenCalledTimes(1);
      expect(services.size).toBe(0);
      expect(handlers.size).toBe(0);
    });

    it('handler 与 service 数量不一致时也正确清空', async () => {
      // service 有 2 个，handler 只有 1 个
      const s1 = makeServiceStub();
      const s2 = makeServiceStub();
      const h1 = makeHandlerStub();
      services.set('a', s1);
      services.set('b', s2);
      handlers.set('a', h1);

      await invalidateAllGroupMcpServices();

      expect(s1.shutdown).toHaveBeenCalledTimes(1);
      expect(s2.shutdown).toHaveBeenCalledTimes(1);
      expect(h1.close).toHaveBeenCalledTimes(1);
      expect(services.size).toBe(0);
      expect(handlers.size).toBe(0);
    });
  });
});
