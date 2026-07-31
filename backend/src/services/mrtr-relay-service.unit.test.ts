import { describe, expect, it } from 'vitest';
import { MrtrRelayService } from './mrtr-relay-service.js';

function makeKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}
const MOCK_CTX = {} as any; // verify 第二参数 ctx（生产由 SDK 传入）

describe('MrtrRelayService', () => {
  describe('relay + resume round-trip', () => {
    it('relay mint 的 state 可被 resume 还原', async () => {
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds: 600 });
      const result = await relay.relay('s1', 'tool_a', {
        inputRequests: { confirm: { type: 'elicitation', message: 'sure?' } },
        requestState: 'upstream-opaque-state',
      }, 1);
      expect(result.resultType).toBe('input_required');
      expect(result.requestState).toBeTypeOf('string');
      expect(result.inputRequests).toBeDefined();

      // verify 还原（async，需 await + ctx）
      const hubState = await relay.verify(result.requestState!, MOCK_CTX);
      expect(hubState.serverId).toBe('s1');
      expect(hubState.toolName).toBe('tool_a');
      expect(hubState.upstreamRequestState).toBe('upstream-opaque-state');
      expect(hubState.step).toBe(1);

      // resume 语义
      const r = relay.resume(hubState);
      expect(r.isResume).toBe(true);
      expect(r.serverId).toBe('s1');
      expect(r.upstreamRequestState).toBe('upstream-opaque-state');
    });

    it('resume(undefined) 表示初次调用（非重试）', () => {
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds: 600 });
      const r = relay.resume(undefined);
      expect(r.isResume).toBe(false);
    });
  });

  describe('安全性', () => {
    it('篡改的 state 被 verify 拒绝（抛错）', async () => {
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds: 600 });
      const result = await relay.relay('s1', 't', {}, 1);
      const tampered = result.requestState!.slice(0, -4) + 'AAAA';
      await expect(relay.verify(tampered, MOCK_CTX)).rejects.toThrow();
    });

    it('过期 state 被 verify 拒绝', async () => {
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds: 1 });
      const result = await relay.relay('s1', 't', {}, 1);
      // codec exp = floor(now_mint) + ttlSeconds；需 floor(now_verify) > exp，
      // 即至少跨越 2 个整数秒边界。等 2500ms 保证确定性（避免 mint/verify 落在同一秒）。
      await new Promise((r) => setTimeout(r, 2500));
      await expect(relay.verify(result.requestState!, MOCK_CTX)).rejects.toThrow();
    });

    it('不同 key mint 的 state 在本实例 verify 失败', async () => {
      const k1 = makeKey();
      const k2 = makeKey();
      const r1 = new MrtrRelayService({ key: k1, ttlSeconds: 600 });
      const r2 = new MrtrRelayService({ key: k2, ttlSeconds: 600 });
      const result = await r1.relay('s1', 't', {}, 1);
      await expect(r2.verify(result.requestState!, MOCK_CTX)).rejects.toThrow();
    });
  });

  describe('step 防乱序', () => {
    it('relay 多轮 step 递增', async () => {
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds: 600 });
      const r1 = await relay.relay('s1', 't', { requestState: 'up1' }, 1);
      const s1 = await relay.verify(r1.requestState!, MOCK_CTX);
      expect(s1.step).toBe(1);
      const r2 = await relay.relay('s1', 't', { requestState: 'up2' }, 2);
      const s2 = await relay.verify(r2.requestState!, MOCK_CTX);
      expect(s2.step).toBe(2);
    });
  });

  describe('exp 用配置 ttlSeconds（P5 修复 I1）', () => {
    it('relay mint 的 state.exp = now + ttlSeconds（非硬编码 600）', async () => {
      // 用非默认 ttl（300）验证 exp 与 codec ttl 一致、非硬编码 600
      const ttlSeconds = 300;
      const before = Math.floor(Date.now() / 1000);
      const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds });
      const r = await relay.relay('s1', 't', {}, 1);
      const after = Math.floor(Date.now() / 1000);
      const hubState = await relay.verify(r.requestState!, MOCK_CTX);

      // exp 应落在 [before+ttl, after+ttl] 区间（mint 在 before..after 之间执行）
      expect(hubState.exp).toBeGreaterThanOrEqual(before + ttlSeconds);
      expect(hubState.exp).toBeLessThanOrEqual(after + ttlSeconds);
      // 显式断言非硬编码 600：用 ttl=300 时 exp 不应在 now+600 附近
      expect(hubState.exp).toBeLessThan(before + 600);
    });

    it('不同 ttlSeconds 产生不同 exp（确认读了配置值）', async () => {
      const make = async (ttlSeconds: number) => {
        const before = Math.floor(Date.now() / 1000);
        const relay = new MrtrRelayService({ key: makeKey(), ttlSeconds });
        const r = await relay.relay('s1', 't', {}, 1);
        const hubState = await relay.verify(r.requestState!, MOCK_CTX);
        return hubState.exp - before;
      };
      const deltaShort = await make(60);
      const deltaLong = await make(1200);
      // 两者 exp-now 差值应明显反映 ttl 差异（short≈60，long≈1200）
      expect(deltaLong - deltaShort).toBeGreaterThan(1000);
    });
  });
});
