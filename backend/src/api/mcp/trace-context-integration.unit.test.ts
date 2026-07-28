/**
 * P6 trace context 集成测试
 *
 * 验证入站提取 → ALS 透传 → 出站读取 这条链路在进程内连通：
 * 模拟 SDK 工具 handler（从 extra.mcpReq._meta 提取 + runWithTraceContext 包裹），
 * 在 handler 内用 getCurrentTraceContext 读取，断言与传入 _meta 一致。
 *
 * 这是 group-service.ts 工具 handler 改动（Task 3）+ server_manager 出站注入（Task 2）
 * 之间 ALS 链路的连通性验证。真正的端到端（真实上游断言 _meta）受 e2e fixture
 * 限制（default 组上游是 echo stdio，不暴露工具），由 Task 2 的 callTool._meta 注入
 * 单元测试 + 本集成测试共同覆盖。
 */
import { describe, expect, it } from 'vitest';

import {
  getCurrentTraceContext,
  runWithTraceContext,
  extractFromMeta,
  hasTraceContext,
  type TraceContext,
} from '../../middleware/trace-context.js';

/**
 * 模拟 SDK ServerContext：handler 的 extra 参数实际类型为 ServerContext，
 * 入站 _meta 位于 extra.mcpReq._meta（SDK v2 / 2026-07-28 protocol）。
 */
interface SimulatedServerContext {
  mcpReq?: { _meta?: Record<string, unknown> };
}

/**
 * 模拟 group-service.ts 动态工具 handler 的结构：
 * (args, extra) => runWithTraceContext(extractFromMeta(extra.mcpReq._meta), () => { ... })
 * handler 内模拟"出站读取"——即 server_manager.executeToolOnServer 会做的事。
 */
async function simulateToolHandler(
  args: Record<string, unknown>,
  extra: SimulatedServerContext,
): Promise<{ echoedTrace: TraceContext; receivedArgs: Record<string, unknown> }> {
  const traceCtx = extractFromMeta(extra?.mcpReq?._meta);
  return runWithTraceContext(traceCtx, async () => {
    // 模拟 handler 内调用 executeToolCall → executeToolOnServer，
    // 后者会 getCurrentTraceContext() 读 context。这里直接读并回显。
    const echoedTrace = getCurrentTraceContext();
    return { echoedTrace, receivedArgs: args };
  });
}

describe('P6 trace context 集成：入站 _meta → ALS → 出站读取', () => {
  it('客户端带完整 _meta 时，handler 内能读到完整 trace 三件套', async () => {
    const clientMeta = {
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01',
      tracestate: 'congo=t61rcWkgMzE',
      baggage: 'userId=am9',
    };

    const { echoedTrace, receivedArgs } = await simulateToolHandler({ q: 'hello' }, {
      mcpReq: { _meta: clientMeta },
    });

    expect(receivedArgs).toEqual({ q: 'hello' });
    expect(echoedTrace).toEqual(clientMeta);
    expect(hasTraceContext(echoedTrace)).toBe(true);
  });

  it('客户端只带 traceparent 时，handler 内读到部分 context', async () => {
    const { echoedTrace } = await simulateToolHandler({}, {
      mcpReq: { _meta: { traceparent: '00-trace-span-01' } },
    });
    expect(echoedTrace.traceparent).toBe('00-trace-span-01');
    expect(echoedTrace.tracestate).toBeUndefined();
    expect(echoedTrace.baggage).toBeUndefined();
  });

  it('客户端不带 _meta 时，handler 内 context 为空（不阻断，hasTraceContext=false）', async () => {
    const { echoedTrace } = await simulateToolHandler({}, { mcpReq: {} });
    expect(echoedTrace).toEqual({
      traceparent: undefined,
      tracestate: undefined,
      baggage: undefined,
    });
    expect(hasTraceContext(echoedTrace)).toBe(false);
  });

  it('客户端 extra 无 _meta 字段时（防御 SDK 版本差异），不抛错', async () => {
    const { echoedTrace } = await simulateToolHandler({}, {});
    expect(hasTraceContext(echoedTrace)).toBe(false);
  });

  it('并发工具调用 _meta 互不串扰', async () => {
    const run = (tp: string) =>
      simulateToolHandler({ id: tp }, { mcpReq: { _meta: { traceparent: tp } } });

    const [a, b, c] = await Promise.all([
      run('00-A-1-01'),
      run('00-B-1-01'),
      run('00-C-1-01'),
    ]);

    expect(a.echoedTrace.traceparent).toBe('00-A-1-01');
    expect(b.echoedTrace.traceparent).toBe('00-B-1-01');
    expect(c.echoedTrace.traceparent).toBe('00-C-1-01');
  });
});
