import { describe, expect, it } from 'vitest';

import { ErrorCode, ERROR_MESSAGES, ERROR_SEVERITY, ErrorSeverity } from './index.js';

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
