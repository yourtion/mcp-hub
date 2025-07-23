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
