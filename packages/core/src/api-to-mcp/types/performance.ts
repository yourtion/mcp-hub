/**
 * 性能监控相关的类型定义
 */

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** API调用延迟（毫秒） */
  latency: number;
  /** 成功率 */
  successRate: number;
  /** 错误率 */
  errorRate: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 并发连接数 */
  concurrentConnections: number;
  /** 请求队列长度 */
  queueLength: number;
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最小响应时间 */
  minResponseTime: number;
  /** 最大响应时间 */
  maxResponseTime: number;
  /** 95百分位响应时间 */
  p95ResponseTime: number;
  /** 99百分位响应时间 */
  p99ResponseTime: number;
}

/**
 * 系统资源使用情况
 */
export interface SystemResourceUsage {
  /** CPU使用率（百分比） */
  cpuUsage: number;
  /** 内存使用量（字节） */
  memoryUsage: number;
  /** 内存使用率（百分比） */
  memoryUsagePercent: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 空闲连接数 */
  idleConnections: number;
}
