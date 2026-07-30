/**
 * P5 Task 8：mcp-handler-factory MRTR 启用接线单测。
 *
 * 验证 factory 在创建 GroupMcpService 时传入了 MrtrRelayService 实例（3 参构造）。
 * 隔离到独立文件，避免与 mcp-handler-factory.unit.test.ts（失效路径，getCoreServiceManager
 * 被桩成抛错）的 vi.mock 冲突。
 *
 * SDK 事实核实（见 task-8-report）：requestState.verify 注入点是 McpServer 构造（ServerOptions），
 * 不是 createMcpHandler options——后者根本不读 requestState。McpServer 构造断言见
 * group-service.unit.test.ts 的「requestState.verify 注入」describe 块。本文件聚焦 factory 层：
 * 断言 MrtrRelayService 被实例化（单例），且 GroupMcpService 构造收到它。
 *
 * 注意：MrtrRelayService 是 factory 模块级单例——在 factory 模块首次 import 时构造一次，
 * 早于任何 beforeEach。故 relayCtorCalls 不在 beforeEach 中清空（否则会丢掉那次唯一构造）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 捕获数组必须用 vi.hoisted 提升——vi.mock 工厂会被 hoist 到模块顶部，
// 而 factory 模块导入时立即触发模块级 `new MrtrRelayService(...)`（在 mock 工厂内 push）。
// 普通常量声明此时还未初始化，会 ReferenceError。vi.hoisted 保证声明先于任何 mock 执行。
const { groupCtorCalls, relayCtorCalls } = vi.hoisted(() => ({
  groupCtorCalls: [] as Array<{
    groupId: unknown;
    coreServiceManager: unknown;
    mrtrRelay?: unknown;
  }>,
  // relayCtorCalls 不在 beforeEach 清空：模块级单例只在 factory 首次 import 时构造一次，
  // 那次构造早于所有测试的 beforeEach。清空会让后续测试看不到这次构造。
  relayCtorCalls: [] as Array<{ key: unknown; ttlSeconds: unknown }>,
}));

vi.mock('./group-service.js', () => ({
  GroupMcpService: vi.fn(function (
    this: unknown,
    groupId: unknown,
    coreServiceManager: unknown,
    mrtrRelay?: unknown,
  ) {
    groupCtorCalls.push({ groupId, coreServiceManager, mrtrRelay });
    this.initialize = vi.fn().mockResolvedValue(undefined);
    this.shutdown = vi.fn().mockResolvedValue(undefined);
    this.getMcpServer = vi.fn();
  }),
}));

vi.mock('../../services/mrtr-relay-service.js', () => ({
  MrtrRelayService: vi.fn(function (this: unknown, opts: { key: unknown; ttlSeconds: unknown }) {
    relayCtorCalls.push({ key: opts.key, ttlSeconds: opts.ttlSeconds });
    // verify getter——注入 McpServer 构造的函数（生产里由 codec.verify 提供）
    Object.defineProperty(this, 'verify', {
      value: vi.fn(),
      configurable: true,
    });
  }),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  // createMcpHandler 不在 ensureGroupMcpService 路径触发（仅 createGroupMcpHandler 用）；
  // 桩成抛错以防意外调用。
  createMcpHandler: vi.fn(() => {
    throw new Error('createMcpHandler 不应在本测试中被调用');
  }),
}));

vi.mock('../../services/service-registry.js', () => ({
  getCoreServiceManager: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  ensureGroupMcpService,
  getGroupServicesCache,
  invalidateAllGroupMcpServices,
} from './mcp-handler-factory.js';

describe('mcp-handler-factory MRTR 接线（P5 Task 8）', () => {
  beforeEach(() => {
    // 只清 group 构造记录与缓存；relay 单例构造记录不清空（见上注释）。
    getGroupServicesCache().clear();
    groupCtorCalls.length = 0;
  });

  it('ensureGroupMcpService 构造 GroupMcpService 时传入 MrtrRelayService 实例', async () => {
    await ensureGroupMcpService('g1');

    expect(groupCtorCalls).toHaveLength(1);
    expect(groupCtorCalls[0]!.groupId).toBe('g1');
    // 第三参：MrtrRelayService 实例（有 verify 函数）
    const relay = groupCtorCalls[0]!.mrtrRelay;
    expect(relay).toBeDefined();
    expect(typeof (relay as { verify: unknown }).verify).toBe('function');
  });

  it('MrtrRelayService 是模块级单例：跨 group 共享同一实例，构造只发生一次', async () => {
    // 创建两个不同 group 的 service
    await ensureGroupMcpService('g1');
    await ensureGroupMcpService('g2');

    // 两个 group 的 service 应共享同一个 relay 实例引用
    expect(groupCtorCalls).toHaveLength(2);
    const relay1 = groupCtorCalls[0]!.mrtrRelay;
    const relay2 = groupCtorCalls[1]!.mrtrRelay;
    expect(relay1).toBe(relay2);

    // MrtrRelayService 构造在整个测试文件生命周期内只发生 1 次（模块级单例，
    // 在 factory 首次 import 时构造，非 per-group）。
    expect(relayCtorCalls).toHaveLength(1);
    expect(relayCtorCalls[0]!.ttlSeconds).toBe(600);
    const key = relayCtorCalls[0]!.key as Uint8Array;
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.byteLength).toBe(32);
  });

  it('invalidateAll 后重建仍复用同一个 MrtrRelayService 单例', async () => {
    await ensureGroupMcpService('g1');
    const firstRelay = groupCtorCalls[0]!.mrtrRelay;

    await invalidateAllGroupMcpServices();
    getGroupServicesCache().clear();

    await ensureGroupMcpService('g1');
    // 单例不随 group 缓存失效而重建：relay 构造次数仍为 1，
    // 重建的 service（groupCtorCalls[1]）拿到同一 relay 引用
    expect(relayCtorCalls).toHaveLength(1);
    expect(groupCtorCalls[1]!.mrtrRelay).toBe(firstRelay);
  });
});
