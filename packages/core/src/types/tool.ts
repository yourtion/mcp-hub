/**
 * 工具相关类型定义
 */

/**
 * 工具信息
 */
export interface ToolInfo {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具参数定义 */
  parameters?: ToolParameter[];
  /** 工具分类 */
  category?: string;
  /** 所属服务器ID */
  serverId?: string;
  /** 工具版本 */
  version?: string;
  /** 是否已弃用 */
  deprecated?: boolean;
}

/**
 * 工具参数
 */
export interface ToolParameter {
  /** 参数名称 */
  name: string;
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** 参数描述 */
  description?: string;
  /** 是否必需 */
  required?: boolean;
  /** 默认值 */
  default?: unknown;
  /** 枚举值 */
  enum?: unknown[];
}

/**
 * 工具调用结果
 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * P5 MRTR：上游工具调用返回 "input_required" 时的中转结果。
 *
 * 结构与 SDK 的 `InputRequiredResult`（protocol revision 2026-07-28）兼容：
 *   - resultType: 判别字面量
 *   - inputRequests: 上游请求的额外输入（透传给客户端）
 *   - requestState: Hub 印封的 opaque state（客户端下轮回传）
 *
 * 在 core 包定义本地 type，避免核心包对 `@modelcontextprotocol/*` 的硬依赖；
 * 后端 adapter/server_manager 把 SDK 原生对象断言为该结构。
 */
export interface InputRequiredResult {
  resultType: 'input_required';
  inputRequests?: unknown;
  requestState?: string;
}

/**
 * P5 MRTR：多轮重试时透传给上游 callTool 的上下文。
 *
 * 对应 SDK `tools/call` request params 的顶层 retry 字段（inputResponses /
 * requestState）。requestState 为上游原始 state（即 HubState.upstreamRequestState）。
 */
export interface RetryContext {
  /** 客户端对上一轮 inputRequests 的应答，键名与上游分配的标识一致。 */
  inputResponses?: Record<string, unknown>;
  /** 上游返回的 opaque request state（字节级原样回传）。 */
  requestState?: string;
}

/**
 * 工具过滤器
 */
export interface ToolFilter {
  /** 包含的服务器ID */
  serverIds?: string[];
  /** 包含的工具分类 */
  categories?: string[];
  /** 包含的工具名称 */
  toolNames?: string[];
  /** 排除的工具名称 */
  excludeToolNames?: string[];
  /** 是否包含已弃用的工具 */
  includeDeprecated?: boolean;
}
