/**
 * API工具相关的类型定义
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { JsonSchemaProperty } from './api-config.js';

/**
 * MCP工具输入参数schema
 */
export interface McpToolInputSchema {
  [x: string]: unknown;
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * MCP工具定义
 */
export interface McpTool extends Tool {
  /** 工具唯一标识 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数schema */
  inputSchema: McpToolInputSchema;
}

/**
 * 工具执行结果内容项
 */
export interface ToolResultContent {
  type: 'text';
  text: string;
}

/**
 * 工具执行结果
 */
export interface ApiToolResult {
  /** 执行是否成功 */
  isError: boolean;
  /** 结果内容 */
  content: ToolResultContent[];
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

/**
 * 配置验证结果（带数据）
 */
export interface ValidationResultWithData<T> extends ValidationResult {
  /** 验证通过时的数据 */
  data?: T;
}
