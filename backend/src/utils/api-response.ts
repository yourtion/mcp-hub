/**
 * 统一 API 响应工具
 * 提供标准化的成功和错误响应格式，包含 requestId
 */

import {
  defaultErrorHandler,
  getHttpStatusForError,
  McpHubCoreError,
  type ErrorResponse,
  type SuccessResponse,
} from '@mcp-core/mcp-hub-core';

import { logger } from './logger.js';

import type { Context } from 'hono';

/**
 * 返回统一成功响应
 */
export function successResponse<T>(c: Context, data: T, status = 200): Response {
  const requestId = c.get('requestId');
  const timestamp = new Date().toISOString();

  const body: SuccessResponse<T> = {
    success: true,
    data,
    timestamp,
    requestId,
  };

  return c.json(body, status as 200);
}

/**
 * 返回统一错误响应
 *
 * HTTP 状态码推导规则：
 * 1. 如果调用方显式指定了 status，使用调用方的值
 * 2. 否则，如果是结构化错误（McpHubCoreError），从 ErrorCode → httpStatus 映射推导
 * 3. 兜底 500
 */
export function errorResponse(c: Context, error: Error, status?: number): Response {
  const requestId = c.get('requestId');
  const formatted = defaultErrorHandler.formatErrorResponse(error, undefined, requestId);

  logger.error('API error', error, {
    requestId,
    path: c.req.path,
    method: c.req.method,
  });

  const body: ErrorResponse = formatted;

  // 推导 HTTP 状态码
  const httpStatus =
    status ?? (error instanceof McpHubCoreError ? getHttpStatusForError(error.code) : 500);

  return c.json(body, httpStatus as 500);
}
