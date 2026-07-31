/**
 * 工具执行结果的类型转换
 *
 * 从 tool_manager.ts 提取的纯函数，负责将 MCP server 返回的各种结果格式
 * 统一转换为 ToolResult。
 *
 * v2 兼容性说明：本模块仅处理"工具已成功调用并返回"的结果对象（含 v2 仍保留的
 * isError 字段）。v2 中未知工具的 -32602 rejection 不会走到这里——它在
 * server_manager.executeToolOnServer 的 catch 中被吸收并 throw，最终由
 * tool_manager.createErrorResult 转成带 isError:true 的 ToolResult。
 *
 * 本模块构造的 ToolResult 是 Hub 内部类型，不需要也不应该设置 resultType
 * （v2 的 wire-only 字段，由 codec 层在出站时统一打）。
 */

import { logger } from '../utils/logger.js';

import type { ToolContent, ToolResult } from '../types/mcp-knot.js';

/**
 * 格式化错误对象为可读字符串
 */
export function formatError(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorObj = error as {
      message?: string;
      code?: string | number;
      data?: unknown;
    };

    if (errorObj.message) {
      let formatted = errorObj.message;
      if (errorObj.code) {
        formatted = `[${errorObj.code}] ${formatted}`;
      }
      if (errorObj.data) {
        formatted += ` (${JSON.stringify(errorObj.data)})`;
      }
      return formatted;
    }

    return JSON.stringify(error);
  }

  return String(error);
}

/**
 * 将 MCP server 返回的各种结果格式统一转换为 ToolResult
 *
 * 处理以下格式：
 * - 标准 MCP 结果（含 content 数组）
 * - 错误结果（含 error 字段）
 * - 一般对象（JSON 序列化）
 * - 原始类型（string/number/boolean）
 * - null/undefined
 */
export function transformToolResult(result: unknown): ToolResult {
  logger.debug('Transforming tool result', { result });

  try {
    // Handle different result formats from MCP servers
    if (result && typeof result === 'object') {
      const mcpResult = result as {
        content?: unknown[];
        isError?: boolean;
        error?: unknown;
        _meta?: {
          progressToken?: string;
        };
      };

      // If it's already in the expected format
      if (mcpResult.content && Array.isArray(mcpResult.content)) {
        logger.debug('Result already in expected format', {
          contentLength: mcpResult.content.length,
          isError: mcpResult.isError,
        });
        return {
          content: mcpResult.content as ToolContent[],
          isError: mcpResult.isError || false,
        };
      }

      // If it's an error result
      if (mcpResult.error) {
        logger.debug('Transforming error result', { error: mcpResult.error });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${formatError(mcpResult.error)}`,
            },
          ],
          isError: true,
        };
      }

      // Handle other object formats
      if (Object.keys(mcpResult).length > 0) {
        logger.debug('Transforming object result to text');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mcpResult, null, 2),
            },
          ],
          isError: false,
        };
      }
    }

    // Handle primitive types
    if (typeof result === 'string') {
      logger.debug('Transforming string result');
      return {
        content: [{ type: 'text', text: result }],
        isError: false,
      };
    }

    if (typeof result === 'number' || typeof result === 'boolean') {
      logger.debug('Transforming primitive result', { type: typeof result });
      return {
        content: [{ type: 'text', text: String(result) }],
        isError: false,
      };
    }

    // Handle null/undefined
    if (result === null || result === undefined) {
      logger.debug('Transforming null/undefined result');
      return {
        content: [{ type: 'text', text: String(result) }],
        isError: false,
      };
    }

    // Default transformation - stringify everything else
    logger.debug('Using default transformation');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    logger.error('Error transforming tool result', error as Error, {
      originalResult: result,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Error transforming result: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}
