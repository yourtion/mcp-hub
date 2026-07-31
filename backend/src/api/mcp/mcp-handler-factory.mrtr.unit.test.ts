/**
 * P5 Task 8/10：mcp-handler-factory MRTR 接线单测。
 *
 * 验证 factory 在创建 GroupMcpService 时传入了 MrtrRelayService 实例（3 参构造），
 * 且 relay 单例从 system.json mrtr 配置构造（Task 10 接通）。
 * 隔离到独立文件，避免与 mcp-handler-factory.unit.test.ts（失效路径，getCoreServiceManager
 * 被桩成抛错）的 vi.mock 冲突。
 *
 * SDK 事实核实（见 task-8-report）：requestState.verify 注入点是 McpServer 构造（ServerOptions），
 * 不是 createMcpHandler options——后者根本不读 requestState。McpServer 构造断言见
 * group-service.unit.test.ts 的「requestState.verify 注入」describe 块。本文件聚焦 factory 层：
 * 断言 MrtrRelayService 被实例化（惰性单例），且 GroupMcpService 构造收到它。
 *
 * 注意（Task 10）：MrtrRelayService 改为惰性单例——首次 ensureGroupMcpService 时经
 * getMrtrRelay() 异步构造（需读 system.json），非 factory import 时构造。relayCtorCalls
 * 不在 beforeEach 清空：单例在整个测试文件内只构造一次（首次 ensureGroupMcpService），
 * 清空会让后续测试看不到这次构造。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 捕获数组必须用 vi.hoisted 提升——vi.mock 工厂会被 hoist 到模块顶部。
const { groupCtorCalls, relayCtorCalls } = vi.hoisted(() => ({
  groupCtorCalls: [] as Array<{
    groupId: unknown;
    coreServiceManager: unknown;
    mrtrRelay?: unknown;
  }>,
  // relayCtorCalls 不在 beforeEach 清空：惰性单例只在首次 ensureGroupMcpService 构造一次，
  // 清空会让后续测试看不到这次构造。
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

// Task 10：getMrtrRelay 经 getAllConfig 读 system.json mrtr 配置。
// mock 成受控返回（stateTtlSeconds=600 来自 schema 默认），避免测试触碰真实文件系统。
vi.mock('../../utils/config.js', () => ({
  getAllConfig: vi.fn().mockResolvedValue({
    system: { mrtr: { stateTtlSeconds: 600 } },
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

import {
  ensureGroupMcpService,
  getGroupServicesCache,
  invalidateAllGroupMcpServices,
} from './mcp-handler-factory.js';

describe('mcp-handler-factory MRTR 接线（P5 Task 8/10）', () => {
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

  it('MrtrRelayService 是惰性单例：跨 group 共享同一实例，构造只发生一次', async () => {
    // 创建两个不同 group 的 service
    await ensureGroupMcpService('g1');
    await ensureGroupMcpService('g2');

    // 两个 group 的 service 应共享同一个 relay 实例引用
    expect(groupCtorCalls).toHaveLength(2);
    const relay1 = groupCtorCalls[0]!.mrtrRelay;
    const relay2 = groupCtorCalls[1]!.mrtrRelay;
    expect(relay1).toBe(relay2);

    // MrtrRelayService 构造在整个测试文件生命周期内只发生 1 次（惰性单例，
    // 在首次 ensureGroupMcpService 时经 getMrtrRelay() 构造，非 per-group，非 import 期）。
    expect(relayCtorCalls).toHaveLength(1);
    // Task 10：ttlSeconds 从 system.json mrtr.stateTtlSeconds 读（mock 返回 600）
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
