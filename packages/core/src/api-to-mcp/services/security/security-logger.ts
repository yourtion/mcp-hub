/**
 * 安全日志记录器
 * 记录所有API调用和安全事件
 */

import type { SecurityEvent, SecurityEventType } from '../../types/security.js';

/**
 * 安全日志记录器接口
 */
export interface SecurityLogger {
  /**
   * 记录API调用
   * @param toolId 工具ID
   * @param parameters 调用参数
   * @param response 响应数据
   */
  logApiCall(toolId: string, parameters: any, response: any): void;

  /**
   * 记录认证失败
   * @param toolId 工具ID
   * @param error 错误信息
   */
  logAuthFailure(toolId: string, error: Error): void;

  /**
   * 记录访问被拒绝
   * @param toolId 工具ID
   * @param reason 拒绝原因
   */
  logAccessDenied(toolId: string, reason: string): void;

  /**
   * 记录异常活动
   * @param event 安全事件
   */
  logSuspiciousActivity(event: SecurityEvent): void;

  /**
   * 记录安全事件
   * @param type 事件类型
   * @param toolId 工具ID
   * @param details 事件详情
   * @param severity 严重程度
   * @param clientId 客户端ID（可选）
   */
  logSecurityEvent(
    type: SecurityEventType,
    toolId: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical',
    clientId?: string,
  ): void;
}

/**
 * 安全日志记录器实现类
 */
export class SecurityLoggerImpl implements SecurityLogger {
  private sensitiveFields = new Set([
    'password',
    'token',
    'apikey',
    'secret',
    'authorization',
  ]);

  logApiCall(toolId: string, parameters: any, response: any): void {
    const sanitizedParams = this.sanitizeData(parameters);
    const sanitizedResponse = this.sanitizeData(response);

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'api-to-mcp',
        event: 'api_call',
        toolId,
        parameters: sanitizedParams,
        response: sanitizedResponse,
      }),
    );
  }

  logAuthFailure(toolId: string, error: Error): void {
    this.logSecurityEvent(
      'AUTH_FAILURE' as SecurityEventType,
      toolId,
      { error: error.message },
      'high',
    );
  }

  logAccessDenied(toolId: string, reason: string): void {
    this.logSecurityEvent(
      'ACCESS_DENIED' as SecurityEventType,
      toolId,
      { reason },
      'medium',
    );
  }

  logSuspiciousActivity(event: SecurityEvent): void {
    console.log(
      JSON.stringify({
        timestamp: event.timestamp.toISOString(),
        level: 'warn',
        component: 'api-to-mcp',
        event: 'suspicious_activity',
        type: event.type,
        toolId: event.toolId,
        clientId: event.clientId,
        details: this.sanitizeData(event.details),
        severity: event.severity,
      }),
    );
  }

  logSecurityEvent(
    type: SecurityEventType,
    toolId: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical',
    clientId?: string,
  ): void {
    const event: SecurityEvent = {
      type,
      toolId,
      clientId,
      timestamp: new Date(),
      details: this.sanitizeData(details),
      severity,
    };

    console.log(
      JSON.stringify({
        timestamp: event.timestamp.toISOString(),
        level:
          severity === 'critical' || severity === 'high' ? 'error' : 'warn',
        component: 'api-to-mcp',
        event: 'security_event',
        type: event.type,
        toolId: event.toolId,
        clientId: event.clientId,
        details: event.details,
        severity: event.severity,
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveFields.has(lowerKey)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }
}
