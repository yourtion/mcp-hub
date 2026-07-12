import { describe, expect, it } from 'vitest';

import { ErrorCode, getHttpStatusForError } from './index.js';

describe('getHttpStatusForError', () => {
  // 表驱动测试：验证每个 ErrorCode 映射到正确的 HTTP 状态码
  const cases: Array<{ code: ErrorCode; expected: number; label: string }> = [
    // 配置错误 (1000-1999)
    { code: ErrorCode.INVALID_SERVER_CONFIG, expected: 500, label: 'INVALID_SERVER_CONFIG' },
    { code: ErrorCode.MISSING_GROUP_REFERENCE, expected: 400, label: 'MISSING_GROUP_REFERENCE' },
    { code: ErrorCode.SCHEMA_VALIDATION_FAILED, expected: 400, label: 'SCHEMA_VALIDATION_FAILED' },
    { code: ErrorCode.CONFIG_FILE_NOT_FOUND, expected: 500, label: 'CONFIG_FILE_NOT_FOUND' },
    { code: ErrorCode.INVALID_CONFIG_FORMAT, expected: 500, label: 'INVALID_CONFIG_FORMAT' },

    // 连接错误 (2000-2999)
    { code: ErrorCode.SERVER_STARTUP_FAILED, expected: 503, label: 'SERVER_STARTUP_FAILED' },
    {
      code: ErrorCode.NETWORK_CONNECTIVITY_FAILED,
      expected: 502,
      label: 'NETWORK_CONNECTIVITY_FAILED',
    },
    { code: ErrorCode.AUTHENTICATION_FAILED, expected: 401, label: 'AUTHENTICATION_FAILED' },
    { code: ErrorCode.SERVER_UNAVAILABLE, expected: 503, label: 'SERVER_UNAVAILABLE' },
    { code: ErrorCode.CONNECTION_TIMEOUT, expected: 504, label: 'CONNECTION_TIMEOUT' },
    { code: ErrorCode.CONNECTION_REFUSED, expected: 502, label: 'CONNECTION_REFUSED' },

    // 运行时错误 (3000-3999)
    { code: ErrorCode.TOOL_EXECUTION_FAILED, expected: 500, label: 'TOOL_EXECUTION_FAILED' },
    { code: ErrorCode.SERVER_DISCONNECTED, expected: 503, label: 'SERVER_DISCONNECTED' },
    { code: ErrorCode.INVALID_TOOL_ARGUMENTS, expected: 400, label: 'INVALID_TOOL_ARGUMENTS' },
    { code: ErrorCode.TOOL_NOT_FOUND, expected: 404, label: 'TOOL_NOT_FOUND' },
    { code: ErrorCode.GROUP_NOT_FOUND, expected: 404, label: 'GROUP_NOT_FOUND' },
    { code: ErrorCode.TOOL_ACCESS_DENIED, expected: 403, label: 'TOOL_ACCESS_DENIED' },
    { code: ErrorCode.SERVICE_UNAVAILABLE, expected: 503, label: 'SERVICE_UNAVAILABLE' },

    // 验证错误 (4000-4999)
    { code: ErrorCode.INVALID_REQUEST_FORMAT, expected: 400, label: 'INVALID_REQUEST_FORMAT' },
    {
      code: ErrorCode.MISSING_REQUIRED_PARAMETER,
      expected: 400,
      label: 'MISSING_REQUIRED_PARAMETER',
    },
    { code: ErrorCode.PARAMETER_TYPE_MISMATCH, expected: 400, label: 'PARAMETER_TYPE_MISMATCH' },
    { code: ErrorCode.INVALID_PARAMETER_VALUE, expected: 400, label: 'INVALID_PARAMETER_VALUE' },

    // 系统错误 (5000-5999)
    { code: ErrorCode.INTERNAL_SERVER_ERROR, expected: 500, label: 'INTERNAL_SERVER_ERROR' },
    { code: ErrorCode.MEMORY_LIMIT_EXCEEDED, expected: 500, label: 'MEMORY_LIMIT_EXCEEDED' },
    { code: ErrorCode.TIMEOUT_ERROR, expected: 504, label: 'TIMEOUT_ERROR' },
    { code: ErrorCode.UNKNOWN_ERROR, expected: 500, label: 'UNKNOWN_ERROR' },

    // 认证错误 (6000-6999)
    {
      code: ErrorCode.AUTH_INVALID_CREDENTIALS,
      expected: 401,
      label: 'AUTH_INVALID_CREDENTIALS',
    },
    { code: ErrorCode.AUTH_TOKEN_EXPIRED, expected: 401, label: 'AUTH_TOKEN_EXPIRED' },
    { code: ErrorCode.AUTH_TOKEN_INVALID, expected: 401, label: 'AUTH_TOKEN_INVALID' },
    { code: ErrorCode.AUTH_ACCESS_DENIED, expected: 403, label: 'AUTH_ACCESS_DENIED' },
    { code: ErrorCode.AUTH_ACCOUNT_LOCKED, expected: 423, label: 'AUTH_ACCOUNT_LOCKED' },
  ];

  for (const { code, expected, label } of cases) {
    it(`${label} (${code}) → ${expected}`, () => {
      expect(getHttpStatusForError(code)).toBe(expected);
    });
  }

  it('未知 code 应兜底返回 500', () => {
    // 用一个不在枚举中的值模拟
    expect(getHttpStatusForError(9999 as ErrorCode)).toBe(500);
  });
});
