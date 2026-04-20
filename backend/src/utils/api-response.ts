/**
 * 统一 API 响应工具
 * 提供标准化的成功和错误响应格式，包含 requestId
 */

import {
  defaultErrorHandler,
  type ErrorResponse,
  type SuccessResponse,
} from '@mcp-core/mcp-hub-core';
import type { Context } from 'hono';
import { logger } from './logger.js';

/**
 * 返回统一成功响应
 */
export function successResponse<T>(
  c: Context,
  data: T,
  status = 200,
): Response {
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
 */
export function errorResponse(
  c: Context,
  error: Error,
  status = 500,
): Response {
  const requestId = c.get('requestId');
  const formatted = defaultErrorHandler.formatErrorResponse(
    error,
    undefined,
    requestId,
  );

  logger.error('API error', error, {
    requestId,
    path: c.req.path,
    method: c.req.method,
  });

  const body: ErrorResponse = formatted;

  return c.json(body, status as 500);
}
