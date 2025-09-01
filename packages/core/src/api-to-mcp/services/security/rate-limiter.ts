/**
 * 频率限制器
 * 控制API调用频率，支持异常检测和告警
 */

import { logger } from '../../../utils/logger.js';
import type { RateLimitConfig } from '../../types/api-config.js';
import type { RateLimitStatus, SecurityEvent } from '../../types/security.js';
import { SecurityEventType } from '../../types/security.js';

/**
 * 频率限制记录
 */
interface RateLimitRecord {
  /** 请求次数 */
  count: number;
  /** 窗口开始时间 */
  windowStart: Date;
  /** 最后请求时间 */
  lastRequest: Date;
  /** 连续违规次数 */
  violationCount: number;
  /** 最后违规时间 */
  lastViolation?: Date;
}

/**
 * 异常检测配置
 */
interface AnomalyDetectionConfig {
  /** 连续违规阈值 */
  violationThreshold: number;
  /** 异常检测时间窗口（秒） */
  detectionWindow: number;
  /** 是否启用异常检测 */
  enabled: boolean;
}

/**
 * 频率限制器接口
 */
export interface RateLimiter {
  /**
   * 检查是否超过频率限制
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  checkLimit(toolId: string, clientId?: string): Promise<boolean>;

  /**
   * 记录API调用
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  recordCall(toolId: string, clientId?: string): Promise<void>;

  /**
   * 重置计数器
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  resetCounter(toolId: string, clientId?: string): Promise<void>;

  /**
   * 获取剩余请求次数
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  getRemainingRequests(toolId: string, clientId?: string): Promise<number>;

  /**
   * 获取频率限制状态
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  getStatus(toolId: string, clientId?: string): Promise<RateLimitStatus>;

  /**
   * 检测异常活动
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  detectAnomalies(toolId: string, clientId?: string): Promise<SecurityEvent[]>;

  /**
   * 设置安全事件回调
   * @param callback 安全事件回调函数
   */
  setSecurityEventCallback(callback: (event: SecurityEvent) => void): void;
}

/**
 * 频率限制器实现类
 */
export class RateLimiterImpl implements RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private config: RateLimitConfig;
  private anomalyConfig: AnomalyDetectionConfig;
  private securityEventCallback?: (event: SecurityEvent) => void;

  constructor(
    config?: Partial<RateLimitConfig>,
    anomalyConfig?: Partial<AnomalyDetectionConfig>,
  ) {
    this.config = {
      windowSeconds: 60,
      maxRequests: 100,
      enabled: true,
      toolSpecific: {},
      ...config,
    };

    this.anomalyConfig = {
      violationThreshold: 5,
      detectionWindow: 300, // 5分钟
      enabled: true,
      ...anomalyConfig,
    };
  }

  async checkLimit(toolId: string, clientId?: string): Promise<boolean> {
    if (!this.config.enabled) {
      return true;
    }

    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);
    const limits = this.getLimitsForTool(toolId);

    if (!record) {
      return true; // 没有记录，允许请求
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - limits.windowSeconds * 1000);

    // 如果记录的窗口已过期，重置计数
    if (record.windowStart < windowStart) {
      record.count = 0;
      record.windowStart = now;
    }

    const allowed = record.count < limits.maxRequests;

    // 如果被限制，记录违规并检测异常
    if (!allowed) {
      await this.recordViolation(toolId, clientId, record);
    }

    return allowed;
  }

  async recordCall(toolId: string, clientId?: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(toolId, clientId);
    const now = new Date();
    const limits = this.getLimitsForTool(toolId);
    const windowStart = new Date(now.getTime() - limits.windowSeconds * 1000);

    let record = this.records.get(key);
    if (!record) {
      record = {
        count: 0,
        windowStart: now,
        lastRequest: now,
        violationCount: 0,
      };
      this.records.set(key, record);
    }

    // 如果窗口已过期，重置计数
    if (record.windowStart < windowStart) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count++;
    record.lastRequest = now;

    logger.debug('记录API调用');
  }

  async resetCounter(toolId: string, clientId?: string): Promise<void> {
    const key = this.generateKey(toolId, clientId);
    this.records.delete(key);
  }

  async getRemainingRequests(
    toolId: string,
    clientId?: string,
  ): Promise<number> {
    if (!this.config.enabled) {
      return Number.MAX_SAFE_INTEGER;
    }

    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);
    const limits = this.getLimitsForTool(toolId);

    if (!record) {
      return limits.maxRequests;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - limits.windowSeconds * 1000);

    // 如果窗口已过期，返回最大请求数
    if (record.windowStart < windowStart) {
      return limits.maxRequests;
    }

    return Math.max(0, limits.maxRequests - record.count);
  }

  async getStatus(toolId: string, clientId?: string): Promise<RateLimitStatus> {
    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);
    const limits = this.getLimitsForTool(toolId);
    const now = new Date();

    if (!record) {
      return {
        limited: false,
        remaining: limits.maxRequests,
        resetTime: new Date(now.getTime() + limits.windowSeconds * 1000),
        windowStart: now,
      };
    }

    const windowStart = new Date(now.getTime() - limits.windowSeconds * 1000);
    const isExpired = record.windowStart < windowStart;

    return {
      limited: !isExpired && record.count >= limits.maxRequests,
      remaining: isExpired
        ? limits.maxRequests
        : Math.max(0, limits.maxRequests - record.count),
      resetTime: new Date(
        record.windowStart.getTime() + limits.windowSeconds * 1000,
      ),
      windowStart: isExpired ? now : record.windowStart,
    };
  }

  async detectAnomalies(
    toolId: string,
    clientId?: string,
  ): Promise<SecurityEvent[]> {
    if (!this.anomalyConfig.enabled) {
      return [];
    }

    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);

    if (!record) {
      return [];
    }

    const events: SecurityEvent[] = [];
    const now = new Date();
    const detectionWindow = new Date(
      now.getTime() - this.anomalyConfig.detectionWindow * 1000,
    );

    // 检查连续违规
    if (record.violationCount >= this.anomalyConfig.violationThreshold) {
      if (record.lastViolation && record.lastViolation > detectionWindow) {
        events.push({
          type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          toolId,
          clientId,
          timestamp: now,
          details: {
            violationCount: record.violationCount,
            lastViolation: record.lastViolation,
            reason: '连续违反频率限制',
          },
          severity: 'high',
        });
      }
    }

    return events;
  }

  setSecurityEventCallback(callback: (event: SecurityEvent) => void): void {
    this.securityEventCallback = callback;
  }

  private async recordViolation(
    toolId: string,
    clientId: string | undefined,
    record: RateLimitRecord,
  ): Promise<void> {
    const now = new Date();
    record.violationCount++;
    record.lastViolation = now;

    logger.warn('频率限制违规');

    // 触发安全事件
    const event: SecurityEvent = {
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      toolId,
      clientId,
      timestamp: now,
      details: {
        currentCount: record.count,
        maxRequests: this.getLimitsForTool(toolId).maxRequests,
        violationCount: record.violationCount,
      },
      severity:
        record.violationCount > this.anomalyConfig.violationThreshold
          ? 'high'
          : 'medium',
    };

    if (this.securityEventCallback) {
      this.securityEventCallback(event);
    }

    // 检测异常活动
    const anomalies = await this.detectAnomalies(toolId, clientId);
    for (const anomaly of anomalies) {
      if (this.securityEventCallback) {
        this.securityEventCallback(anomaly);
      }
    }
  }

  private getLimitsForTool(toolId: string): {
    windowSeconds: number;
    maxRequests: number;
  } {
    const toolSpecific = this.config.toolSpecific?.[toolId];
    return {
      windowSeconds: toolSpecific?.windowSeconds ?? this.config.windowSeconds,
      maxRequests: toolSpecific?.maxRequests ?? this.config.maxRequests,
    };
  }

  private generateKey(toolId: string, clientId?: string): string {
    return clientId ? `${toolId}:${clientId}` : toolId;
  }
}
