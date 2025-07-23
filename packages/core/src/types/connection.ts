/**
 * 连接相关类型定义
 */

/**
 * 连接状态
 */
export interface ConnectionStatus {
  /** 是否已连接 */
  connected: boolean;
  /** 最后连接时间 */
  lastConnected: Date | null;
  /** 错误信息 */
  error: string | null;
  /** 连接延迟（毫秒） */
  latency?: number;
  /** 连接尝试次数 */
  attempts?: number;
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
  /** 连接超时（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  retryInterval: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
}

/**
 * 连接事件
 */
export interface ConnectionEvent {
  /** 事件类型 */
  type: 'connected' | 'disconnected' | 'error' | 'retry';
  /** 服务器ID */
  serverId: string;
  /** 时间戳 */
  timestamp: Date;
  /** 事件数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
}
