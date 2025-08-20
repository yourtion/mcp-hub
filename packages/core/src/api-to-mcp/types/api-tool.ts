/**
 * API工具相关的类型定义
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP工具定义
 */
export interface McpTool extends Tool {
  /** 工具唯一标识 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * 工具执行结果
 */
export interface ApiToolResult {
  /** 执行是否成功 */
  isError: boolean;
  /** 结果内容 */
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * 参数验证结果
 */
export interface ValidationResult {
  /** 验证是否通过 */
  valid: boolean;
  /** 错误信息列表 */
  errors: ValidationError[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误路径 */
  path: string;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code?: string;
}
