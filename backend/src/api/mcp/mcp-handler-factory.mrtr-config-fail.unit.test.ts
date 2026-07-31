/**
 * P5 修复（I4）：getMrtrRelay 配置读取失败时不缓存错误默认值，下次调用重试。
 *
 * 背景：原实现里 getAllConfig() 抛错（瞬时 config 错误）的 catch 仍把「用随机 key +
 * 默认 ttl 构造的 relay」缓存进 mrtrRelayInstance/mrtrRelayPromise，导致后续永远用
 * 错误默认值（多实例下与其他实例 state 互相 verify 失败）。修复后：配置读取失败时
 * 本次调用回退默认值构造一份「用完即弃」的 relay，但清掉 promise，下次调用重新读
 * config 重试；仅成功读 config 且构造成功才缓存单例。
 *
 * 独立文件（与 mcp-handler-factory.mrtr.unit.test.ts 隔离）：本文件 mock getAllConfig
 * 第一次抛错、之后成功，验证 relay 构造发生两次（失败重试）且最终单例稳定复用。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { groupCtorCalls, relayCtorCalls } = vi.hoisted(() => ({
  groupCtorCalls: [] as Array<{
    groupId: unknown;
    coreServiceManager: unknown;
    mrtrRelay?: unknown;
  }>,
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
    Object.defineProperty(this, 'verify', {
      value: vi.fn(),
      configurable: true,
    });
  }),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  createMcpHandler: vi.fn(() => {
    throw new Error('createMcpHandler 不应在本测试中被调用');
  }),
}));

vi.mock('../../services/service-registry.js', () => ({
  getCoreServiceManager: vi.fn().mockResolvedValue({}),
}));

// 关键：getAllConfig 第一次抛错（瞬时 config 错误），之后返回成功配置。
// 用 mockImplementationOnce 让首次抛错、之后稳定返回 enabled=true + 自定义 ttl（1234）。
const { getAllConfigMock } = vi.hoisted(() => ({
  getAllConfigMock: vi.fn(),
}));
vi.mock('../../utils/config.js', () => ({
  getAllConfig: getAllConfigMock,
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

describe('mcp-handler-factory MRTR 配置读取失败重试（P5 修复 I4）', () => {
  beforeEach(() => {
    getGroupServicesCache().clear();
    groupCtorCalls.length = 0;
    relayCtorCalls.length = 0;
    // 首次抛错（瞬时），之后稳定成功返回 enabled=true + ttl=1234（非默认 600，
    // 便于区分「成功读到 config」与「失败回退默认值」两种构造）
    getAllConfigMock
      .mockReset()
      .mockImplementationOnce(async () => {
        throw new Error('simulated transient config read failure');
      })
      .mockResolvedValue({
        system: { mrtr: { enabled: true, stateTtlSeconds: 1234 } },
      });
  });

  it('首次 getAllConfig 抛错：本次仍返回 relay（回退默认 ttl=600），但不缓存——下次调用重试读到真实配置（ttl=1234）', async () => {
    // 第一次调用：getAllConfig 抛错 → 回退默认值构造「用完即弃」relay（ttlSeconds=600）
    await ensureGroupMcpService('g1');
    expect(relayCtorCalls).toHaveLength(1);
    expect(relayCtorCalls[0]!.ttlSeconds).toBe(600);
    const disposableRelay = groupCtorCalls[0]!.mrtrRelay;
    expect(disposableRelay).toBeDefined();

    // 第二次调用：getAllConfig 成功 → 读到真实配置（ttl=1234），构造并缓存单例
    await ensureGroupMcpService('g2');
    expect(relayCtorCalls).toHaveLength(2);
    expect(relayCtorCalls[1]!.ttlSeconds).toBe(1234);
    const stableRelay = groupCtorCalls[1]!.mrtrRelay;
    expect(stableRelay).toBeDefined();
    // 第二次的 relay 与第一次的「用完即弃」relay 是不同实例（每次失败/重试都新构造）
    expect(stableRelay).not.toBe(disposableRelay);

    // 第三次调用：复用已缓存的稳定单例（不再构造）
    await ensureGroupMcpService('g3');
    expect(relayCtorCalls).toHaveLength(2); // 仍为 2，第三次未触发新构造
    expect(groupCtorCalls[2]!.mrtrRelay).toBe(stableRelay);

    await invalidateAllGroupMcpServices();
  });

  it('首次失败本次返回的「用完即弃」relay 仍可用（注入 GroupMcpService，有 verify 函数）', async () => {
    // 第一次（抛错）→ 回退默认值构造的 relay 应仍是合法实例（有 verify）
    await ensureGroupMcpService('g1');
    const relay = groupCtorCalls[0]!.mrtrRelay;
    expect(relay).toBeDefined();
    expect(typeof (relay as { verify: unknown }).verify).toBe('function');

    await invalidateAllGroupMcpServices();
  });
});
