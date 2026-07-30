import { createRequestStateCodec, type ServerContext } from '@modelcontextprotocol/server';

export interface HubState {
  serverId: string;
  toolName: string;
  upstreamRequestState?: string;
  step: number;
  exp: number;
}

export interface MrtrRelayServiceOptions {
  key: Uint8Array;
  ttlSeconds: number;
}

export interface RelayInput {
  inputRequests?: unknown;
  requestState?: string; // 上游的原始 state
}

export interface ResumeContext {
  isResume: boolean;
  serverId?: string;
  toolName?: string;
  upstreamRequestState?: string;
  step?: number;
}

export interface RelayResult {
  resultType: 'input_required';
  inputRequests?: unknown;
  requestState: string;
}

/**
 * MRTR 中转核心：用 SDK createRequestStateCodec（HMAC-SHA256）mint Hub 级
 * requestState，作为 MRTR 多轮中转的 opaque 句柄。内部把 serverId/toolName/
 * upstreamRequestState/step 印封进 state，客户端回传后由 SDK seam 调 verify 还原。
 */
export class MrtrRelayService {
  private readonly codec;

  constructor(opts: MrtrRelayServiceOptions) {
    this.codec = createRequestStateCodec<HubState>({
      key: opts.key,
      ttlSeconds: opts.ttlSeconds,
    });
  }

  /** 注入 ServerOptions.requestState.verify（async，SDK 传入 ctx）*/
  get verify(): (state: string, ctx: ServerContext) => Promise<HubState> {
    return this.codec.verify;
  }

  /** 上游返回 input_required → mint Hub state 返回给客户端 */
  async relay(
    serverId: string,
    toolName: string,
    upstream: RelayInput,
    step: number,
  ): Promise<RelayResult> {
    const payload: HubState = {
      serverId,
      toolName,
      upstreamRequestState: upstream.requestState,
      step,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const requestState = await this.codec.mint(payload);
    // 用对象字面量构造（不经 inputRequired(...) builder）——builder 会重新 mint
    // 一份它自己的 state，此处需保留上游映射后的 Hub state。
    return {
      resultType: 'input_required',
      inputRequests: upstream.inputRequests,
      requestState,
    };
  }

  /** 读回已 verify 的 Hub state，还原上游上下文 */
  resume(currentState: HubState | undefined): ResumeContext {
    if (!currentState) {
      return { isResume: false };
    }
    return {
      isResume: true,
      serverId: currentState.serverId,
      toolName: currentState.toolName,
      upstreamRequestState: currentState.upstreamRequestState,
      step: currentState.step,
    };
  }
}
