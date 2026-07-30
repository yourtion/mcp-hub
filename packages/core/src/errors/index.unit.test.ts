import { describe, expect, it } from 'vitest';

import {
  ErrorCode,
  ERROR_MESSAGES,
  ERROR_SEVERITY,
  ErrorSeverity,
  ErrorCategory,
  ServiceError,
  getHttpStatusForError,
} from './index.js';

describe('P3 出站 OAuth 错误码', () => {
  it('6200-6203 错误码已定义', () => {
    expect(ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID).toBe(6200);
    expect(ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED).toBe(6201);
    expect(ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED).toBe(6202);
    expect(ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING).toBe(6203);
  });

  it('每个错误码都有中文消息', () => {
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]).toBeTruthy();
    expect(ERROR_MESSAGES[ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]).toBeTruthy();
  });

  it('每个错误码都有严重程度', () => {
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_CONFIG_INVALID]).toBe(ErrorSeverity.LOW);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_TOKEN_FETCH_FAILED]).toBe(ErrorSeverity.HIGH);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_TOKEN_EXPIRED]).toBe(ErrorSeverity.HIGH);
    expect(ERROR_SEVERITY[ErrorCode.OAUTH_OUTBOUND_ENV_VAR_MISSING]).toBe(ErrorSeverity.LOW);
  });
});

describe('API-to-MCP 错误码段 (7000-7499)', () => {
  it('7001 CONFIG_ERROR 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_CONFIG_ERROR).toBe(7001);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_CONFIG_ERROR]).toBe('API-to-MCP 配置错误');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_CONFIG_ERROR]).toBe(ErrorSeverity.HIGH);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_CONFIG_ERROR)).toBe(500);
  });
  it('7002 BUILD_FAILED 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_BUILD_FAILED).toBe(7002);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_BUILD_FAILED]).toBe('API-to-MCP 请求构建失败');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_BUILD_FAILED]).toBe(ErrorSeverity.MEDIUM);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_BUILD_FAILED)).toBe(400);
  });
  it('7003 EXECUTION_FAILED 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_EXECUTION_FAILED).toBe(7003);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_EXECUTION_FAILED]).toBe('API-to-MCP 执行失败');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_EXECUTION_FAILED]).toBe(ErrorSeverity.MEDIUM);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_EXECUTION_FAILED)).toBe(502);
  });
  it('7004 INTERNAL 三表映射正确', () => {
    expect(ErrorCode.API_TO_MCP_INTERNAL).toBe(7004);
    expect(ERROR_MESSAGES[ErrorCode.API_TO_MCP_INTERNAL]).toBe('API-to-MCP 内部错误');
    expect(ERROR_SEVERITY[ErrorCode.API_TO_MCP_INTERNAL]).toBe(ErrorSeverity.HIGH);
    expect(getHttpStatusForError(ErrorCode.API_TO_MCP_INTERNAL)).toBe(500);
  });
  it('7000 段归类为 RUNTIME', () => {
    const err = new ServiceError(ErrorCode.API_TO_MCP_INTERNAL);
    expect(err.category).toBe(ErrorCategory.RUNTIME);
  });
});
