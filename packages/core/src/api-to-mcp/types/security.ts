/**
 * 安全相关的类型定义
 */

/**
 * 安全事件类型
 */
export enum SecurityEventType {
  /** 认证失败 */
  AUTH_FAILURE = 'AUTH_FAILURE',
  /** 访问被拒绝 */
  ACCESS_DENIED = 'ACCESS_DENIED',
  /** 频率限制触发 */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** 可疑活动 */
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  /** 域名不在白名单 */
  DOMAIN_NOT_ALLOWED = 'DOMAIN_NOT_ALLOWED',
}

/**
 * 安全事件
 */
export interface SecurityEvent {
  /** 事件类型 */
  type: SecurityEventType;
  /** 工具ID */
  toolId: string;
  /** 客户端ID */
  clientId?: string;
  /** 事件时间 */
  timestamp: Date;
  /** 事件详情 */
  details: Record<string, unknown>;
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 认证头信息
 */
export interface AuthHeaders {
  /** 认证头键值对 */
  [key: string]: string;
}

/**
 * 域名验证结果
 */
export interface DomainValidationResult {
  /** 是否允许 */
  allowed: boolean;
  /** 域名 */
  domain: string;
  /** 拒绝原因 */
  reason?: string;
}
