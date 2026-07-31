/**
 * P5 修复（代码审查 C1）：mrtr.enabled=false 时 relay 不构造、handler 走保底路径。
 *
 * 独立文件（不与 mcp-handler-factory.mrtr.unit.test.ts 合并）：后者 mock getAllConfig
 * 返回 enabled=true（默认），且 MrtrRelayService 单例在整个测试文件生命周期内只构造
 * 一次——单例缓存后无法在本文件内翻转 enabled。本文件 mock getAllConfig 返回
 * mrtr.enabled=false，验证 getMrtrRelay 返回 null、MrtrRelayService 不被构造、
 * GroupMcpService 第三参（mrtrRelay）为 undefined。
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

// P5 修复 C1：mrtr.enabled=false —— relay 应不被构造（getMrtrRelay 返回 null）
vi.mock('../../utils/config.js', () => ({
  getAllConfig: vi.fn().mockResolvedValue({
    system: { mrtr: { enabled: false, stateTtlSeconds: 600 } },
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

describe('mcp-handler-factory MRTR enabled=false（P5 修复 C1）', () => {
  beforeEach(() => {
    getGroupServicesCache().clear();
    groupCtorCalls.length = 0;
    relayCtorCalls.length = 0;
  });

  it('mrtr.enabled=false：MrtrRelayService 不构造，GroupMcpService 第三参为 undefined', async () => {
    await ensureGroupMcpService('g1');

    expect(groupCtorCalls).toHaveLength(1);
    expect(groupCtorCalls[0]!.groupId).toBe('g1');
    // 第三参 mrtrRelay 应为 undefined（getMrtrRelay 返回 null → ?? undefined）
    expect(groupCtorCalls[0]!.mrtrRelay).toBeUndefined();
    // MrtrRelayService 构造函数完全未被调用
    expect(relayCtorCalls).toHaveLength(0);

    // 清理（invalidateAll 会尝试 shutdown mock 的 service）
    await invalidateAllGroupMcpServices();
  });

  it('mrtr.enabled=false：跨多个 group 仍不构造 relay（决策与单例一致）', async () => {
    await ensureGroupMcpService('g1');
    await ensureGroupMcpService('g2');

    expect(relayCtorCalls).toHaveLength(0);
    expect(groupCtorCalls).toHaveLength(2);
    expect(groupCtorCalls[0]!.mrtrRelay).toBeUndefined();
    expect(groupCtorCalls[1]!.mrtrRelay).toBeUndefined();

    await invalidateAllGroupMcpServices();
  });
});
