/**
 * 安全日志记录器
 * 记录所有API调用和安全事件，支持敏感数据脱敏
 */

import { logger } from '../../../utils/logger.js';
import type { SecurityEvent } from '../../types/security.js';
import { SecurityEventType } from '../../types/security.js';

/**
 * 敏感数据脱敏配置
 */
interface SensitiveDataConfig {
  /** 需要脱敏的字段名称 */
  sensitiveFields: string[];
  /** 脱敏字符 */
  maskChar: string;
  /** 保留字符数量 */
  keepChars: number;
}

/**
 * API调用日志记录
 */
interface ApiCallLog {
  /** 工具ID */
  toolId: string;
  /** 客户端ID */
  clientId?: string;
  /** 请求时间 */
  timestamp: Date;
  /** 请求参数 */
  parameters: Record<string, unknown>;
  /** 响应数据 */
  response?: unknown;
  /** 响应时间（毫秒） */
  duration?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 请求IP */
  clientIp?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 安全事件监控配置
 */
interface SecurityMonitoringConfig {
  /** 是否启用实时监控 */
  realTimeMonitoring: boolean;
  /** 告警阈值配置 */
  alertThresholds: {
    /** 错误率阈值（百分比） */
    errorRate: number;
    /** 时间窗口（秒） */
    timeWindow: number;
    /** 最小请求数 */
    minRequests: number;
  };
  /** 是否启用告警 */
  alertingEnabled: boolean;
}

/**
 * 安全日志记录器接口
 */
export interface SecurityLogger {
  /**
   * 记录API调用
   * @param log API调用日志
   */
  logApiCall(log: ApiCallLog): void;

  /**
   * 记录认证失败
   * @param toolId 工具ID
   * @param clientId 客户端ID
   * @param error 错误信息
   * @param clientIp 客户端IP
   */
  logAuthFailure(
    toolId: string,
    clientId: string | undefined,
    error: Error,
    clientIp?: string,
  ): void;

  /**
   * 记录访问被拒绝
   * @param toolId 工具ID
   * @param clientId 客户端ID
   * @param reason 拒绝原因
   * @param clientIp 客户端IP
   */
  logAccessDenied(
    toolId: string,
    clientId: string | undefined,
    reason: string,
    clientIp?: string,
  ): void;

  /**
   * 记录安全事件
   * @param event 安全事件
   */
  logSecurityEvent(event: SecurityEvent): void;

  /**
   * 获取安全统计信息
   * @param timeWindow 时间窗口（秒）
   */
  getSecurityStats(timeWindow: number): Promise<SecurityStats>;

  /**
   * 设置告警回调
   * @param callback 告警回调函数
   */
  setAlertCallback(callback: (alert: SecurityAlert) => void): void;
}

/**
 * 安全统计信息
 */
interface SecurityStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 错误率 */
  errorRate: number;
  /** 认证失败次数 */
  authFailures: number;
  /** 访问被拒绝次数 */
  accessDenied: number;
  /** 频率限制触发次数 */
  rateLimitExceeded: number;
  /** 异常活动检测次数 */
  suspiciousActivities: number;
  /** 统计时间范围 */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * 安全告警
 */
interface SecurityAlert {
  /** 告警类型 */
  type:
    | 'HIGH_ERROR_RATE'
    | 'MULTIPLE_AUTH_FAILURES'
    | 'SUSPICIOUS_ACTIVITY'
    | 'RATE_LIMIT_ABUSE';
  /** 告警级别 */
  level: 'warning' | 'critical';
  /** 告警消息 */
  message: string;
  /** 相关数据 */
  data: Record<string, unknown>;
  /** 告警时间 */
  timestamp: Date;
}

/**
 * 安全日志记录器实现类
 */
export class SecurityLoggerImpl implements SecurityLogger {
  private apiCallLogs: ApiCallLog[] = [];
  private securityEvents: SecurityEvent[] = [];
  private sensitiveConfig: SensitiveDataConfig;
  private monitoringConfig: SecurityMonitoringConfig;
  private alertCallback?: (alert: SecurityAlert) => void;

  constructor(
    sensitiveConfig?: Partial<SensitiveDataConfig>,
    monitoringConfig?: Partial<SecurityMonitoringConfig>,
  ) {
    this.sensitiveConfig = {
      sensitiveFields: [
        'password',
        'token',
        'apiKey',
        'secret',
        'authorization',
      ],
      maskChar: '*',
      keepChars: 4,
      ...sensitiveConfig,
    };

    this.monitoringConfig = {
      realTimeMonitoring: true,
      alertThresholds: {
        errorRate: 50, // 50%错误率
        timeWindow: 300, // 5分钟
        minRequests: 10,
      },
      alertingEnabled: true,
      ...monitoringConfig,
    };

    // 定期清理旧日志（保留24小时）
    setInterval(
      () => {
        this.cleanupOldLogs();
      },
      60 * 60 * 1000,
    ); // 每小时清理一次
  }

  logApiCall(log: ApiCallLog): void {
    // 脱敏处理
    const sanitizedLog: ApiCallLog = {
      ...log,
      parameters: this.sanitizeData(log.parameters) as Record<string, unknown>,
      response: this.sanitizeData(log.response),
    };

    this.apiCallLogs.push(sanitizedLog);

    // 记录到系统日志
    if (sanitizedLog.success) {
      logger.info('API调用成功');
    } else {
      logger.warn('API调用失败');
    }

    // 实时监控检查
    if (this.monitoringConfig.realTimeMonitoring) {
      this.checkForAlerts();
    }
  }

  logAuthFailure(
    toolId: string,
    clientId: string | undefined,
    error: Error,
    clientIp?: string,
  ): void {
    const event: SecurityEvent = {
      type: SecurityEventType.AUTH_FAILURE,
      toolId,
      clientId,
      timestamp: new Date(),
      details: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        clientIp,
        stack: error.stack,
      },
      severity: 'medium',
    };

    this.logSecurityEvent(event);

    logger.warn('认证失败');
  }

  logAccessDenied(
    toolId: string,
    clientId: string | undefined,
    reason: string,
    clientIp?: string,
  ): void {
    const event: SecurityEvent = {
      type: SecurityEventType.ACCESS_DENIED,
      toolId,
      clientId,
      timestamp: new Date(),
      details: {
        reason,
        clientIp,
      },
      severity: 'medium',
    };

    this.logSecurityEvent(event);

    logger.warn('访问被拒绝');
  }

  logSecurityEvent(event: SecurityEvent): void {
    // 脱敏处理
    const sanitizedEvent: SecurityEvent = {
      ...event,
      details: this.sanitizeData(event.details) as Record<string, unknown>,
    };

    this.securityEvents.push(sanitizedEvent);

    // 根据严重程度选择日志级别
    const logLevel =
      event.severity === 'critical' || event.severity === 'high'
        ? 'error'
        : 'warn';
    if (logLevel === 'error') {
      logger.error('安全事件');
    } else {
      logger.warn('安全事件');
    }

    // 检查是否需要触发告警
    if (this.monitoringConfig.alertingEnabled && this.alertCallback) {
      this.checkSecurityEventAlerts(sanitizedEvent);
    }
  }

  async getSecurityStats(timeWindow: number): Promise<SecurityStats> {
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindow * 1000);

    // 过滤时间范围内的日志
    const recentLogs = this.apiCallLogs.filter(
      (log) => log.timestamp >= startTime,
    );
    const recentEvents = this.securityEvents.filter(
      (event) => event.timestamp >= startTime,
    );

    const totalRequests = recentLogs.length;
    const successfulRequests = recentLogs.filter((log) => log.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate =
      totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    const authFailures = recentEvents.filter(
      (event) => event.type === SecurityEventType.AUTH_FAILURE,
    ).length;
    const accessDenied = recentEvents.filter(
      (event) => event.type === SecurityEventType.ACCESS_DENIED,
    ).length;
    const rateLimitExceeded = recentEvents.filter(
      (event) => event.type === SecurityEventType.RATE_LIMIT_EXCEEDED,
    ).length;
    const suspiciousActivities = recentEvents.filter(
      (event) => event.type === SecurityEventType.SUSPICIOUS_ACTIVITY,
    ).length;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate,
      authFailures,
      accessDenied,
      rateLimitExceeded,
      suspiciousActivities,
      timeRange: {
        start: startTime,
        end: now,
      },
    };
  }

  setAlertCallback(callback: (alert: SecurityAlert) => void): void {
    this.alertCallback = callback;
  }

  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.maskSensitiveString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        data as Record<string, unknown>,
      )) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.sensitiveConfig.sensitiveFields.some((sensitive) =>
      lowerFieldName.includes(sensitive.toLowerCase()),
    );
  }

  private maskValue(value: unknown): string {
    if (typeof value !== 'string') {
      return this.sensitiveConfig.maskChar.repeat(8);
    }

    if (value.length <= this.sensitiveConfig.keepChars * 2) {
      return this.sensitiveConfig.maskChar.repeat(value.length);
    }

    const keepStart = value.substring(0, this.sensitiveConfig.keepChars);
    const keepEnd = value.substring(
      value.length - this.sensitiveConfig.keepChars,
    );
    const maskLength = value.length - this.sensitiveConfig.keepChars * 2;

    return (
      keepStart + this.sensitiveConfig.maskChar.repeat(maskLength) + keepEnd
    );
  }

  private maskSensitiveString(str: string): string {
    // 检查字符串是否包含敏感信息模式
    const patterns = [
      /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi, // Bearer token
      /api[_-]?key[:\s=]+([A-Za-z0-9\-._~+/]+=*)/gi, // API key
      /token[:\s=]+([A-Za-z0-9\-._~+/]+=*)/gi, // Token
    ];

    let result = str;
    for (const pattern of patterns) {
      result = result.replace(pattern, (match, token) => {
        return match.replace(token, this.maskValue(token));
      });
    }

    return result;
  }

  private checkForAlerts(): void {
    if (!this.monitoringConfig.alertingEnabled || !this.alertCallback) {
      return;
    }

    const {
      timeWindow,
      errorRate: threshold,
      minRequests,
    } = this.monitoringConfig.alertThresholds;
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindow * 1000);

    const recentLogs = this.apiCallLogs.filter(
      (log) => log.timestamp >= startTime,
    );

    if (recentLogs.length >= minRequests) {
      const failedRequests = recentLogs.filter((log) => !log.success).length;
      const currentErrorRate = (failedRequests / recentLogs.length) * 100;

      if (currentErrorRate >= threshold) {
        const alert: SecurityAlert = {
          type: 'HIGH_ERROR_RATE',
          level: currentErrorRate >= 80 ? 'critical' : 'warning',
          message: `检测到高错误率: ${currentErrorRate.toFixed(2)}%`,
          data: {
            errorRate: currentErrorRate,
            totalRequests: recentLogs.length,
            failedRequests,
            timeWindow,
          },
          timestamp: now,
        };

        this.alertCallback(alert);
      }
    }
  }

  private checkSecurityEventAlerts(event: SecurityEvent): void {
    if (!this.alertCallback) {
      return;
    }

    // 检查连续认证失败
    if (event.type === SecurityEventType.AUTH_FAILURE) {
      const recentAuthFailures = this.securityEvents.filter(
        (e) =>
          e.type === SecurityEventType.AUTH_FAILURE &&
          e.clientId === event.clientId &&
          e.timestamp >= new Date(Date.now() - 5 * 60 * 1000), // 5分钟内
      ).length;

      if (recentAuthFailures >= 5) {
        const alert: SecurityAlert = {
          type: 'MULTIPLE_AUTH_FAILURES',
          level: 'critical',
          message: `检测到多次认证失败: 客户端 ${event.clientId} 在5分钟内失败${recentAuthFailures}次`,
          data: {
            clientId: event.clientId,
            failureCount: recentAuthFailures,
            toolId: event.toolId,
          },
          timestamp: new Date(),
        };

        this.alertCallback(alert);
      }
    }

    // 检查可疑活动
    if (event.type === SecurityEventType.SUSPICIOUS_ACTIVITY) {
      const alert: SecurityAlert = {
        type: 'SUSPICIOUS_ACTIVITY',
        level: event.severity === 'critical' ? 'critical' : 'warning',
        message: `检测到可疑活动: ${event.details.reason || '未知原因'}`,
        data: {
          toolId: event.toolId,
          clientId: event.clientId,
          details: event.details,
        },
        timestamp: new Date(),
      };

      this.alertCallback(alert);
    }

    // 检查频率限制滥用
    if (event.type === SecurityEventType.RATE_LIMIT_EXCEEDED) {
      const recentViolations = this.securityEvents.filter(
        (e) =>
          e.type === SecurityEventType.RATE_LIMIT_EXCEEDED &&
          e.clientId === event.clientId &&
          e.timestamp >= new Date(Date.now() - 10 * 60 * 1000), // 10分钟内
      ).length;

      if (recentViolations >= 10) {
        const alert: SecurityAlert = {
          type: 'RATE_LIMIT_ABUSE',
          level: 'warning',
          message: `检测到频率限制滥用: 客户端 ${event.clientId} 在10分钟内违规${recentViolations}次`,
          data: {
            clientId: event.clientId,
            violationCount: recentViolations,
            toolId: event.toolId,
          },
          timestamp: new Date(),
        };

        this.alertCallback(alert);
      }
    }
  }

  private cleanupOldLogs(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

    // 清理旧的API调用日志
    this.apiCallLogs = this.apiCallLogs.filter(
      (log) => log.timestamp >= cutoffTime,
    );

    // 清理旧的安全事件
    this.securityEvents = this.securityEvents.filter(
      (event) => event.timestamp >= cutoffTime,
    );

    logger.debug('清理旧日志完成');
  }
}
