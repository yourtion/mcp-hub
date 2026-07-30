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
});
