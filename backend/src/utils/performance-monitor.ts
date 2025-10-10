/**
 * 性能监控工具
 * 提供API响应时间监控和性能分析功能
 */

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
  success: boolean;
}

export interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  errorRate: number;
  requestsPerSecond: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // 最多保留1000条记录
  private startTime = Date.now();

  /**
   * 记录性能指标
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // 如果超过最大记录数，删除最旧的记录
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 获取所有指标
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 获取性能统计
   */
  getStats(timeWindow?: number): PerformanceStats {
    let metricsToAnalyze = this.metrics;

    // 如果指定了时间窗口，只分析该时间窗口内的数据
    if (timeWindow) {
      const cutoffTime = Date.now() - timeWindow;
      metricsToAnalyze = this.metrics.filter((m) => m.timestamp >= cutoffTime);
    }

    if (metricsToAnalyze.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        successRate: 0,
        errorRate: 0,
        requestsPerSecond: 0,
      };
    }

    const durations = metricsToAnalyze.map((m) => m.duration);
    const successCount = metricsToAnalyze.filter((m) => m.success).length;
    const totalRequests = metricsToAnalyze.length;

    const timeSpan = timeWindow || Date.now() - this.startTime;
    const requestsPerSecond = (totalRequests / timeSpan) * 1000;

    return {
      totalRequests,
      averageResponseTime:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      successRate: (successCount / totalRequests) * 100,
      errorRate: ((totalRequests - successCount) / totalRequests) * 100,
      requestsPerSecond,
    };
  }

  /**
   * 获取按端点分组的统计
   */
  getStatsByEndpoint(): Record<string, PerformanceStats> {
    const groupedMetrics: Record<string, PerformanceMetric[]> = {};

    for (const metric of this.metrics) {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!groupedMetrics[key]) {
        groupedMetrics[key] = [];
      }
      groupedMetrics[key].push(metric);
    }

    const stats: Record<string, PerformanceStats> = {};
    for (const [key, metrics] of Object.entries(groupedMetrics)) {
      const durations = metrics.map((m) => m.duration);
      const successCount = metrics.filter((m) => m.success).length;
      const totalRequests = metrics.length;

      stats[key] = {
        totalRequests,
        averageResponseTime:
          durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minResponseTime: Math.min(...durations),
        maxResponseTime: Math.max(...durations),
        successRate: (successCount / totalRequests) * 100,
        errorRate: ((totalRequests - successCount) / totalRequests) * 100,
        requestsPerSecond: 0, // 端点级别不计算RPS
      };
    }

    return stats;
  }

  /**
   * 获取慢请求列表
   */
  getSlowRequests(threshold: number = 1000): PerformanceMetric[] {
    return this.metrics
      .filter((m) => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics = [];
    this.startTime = Date.now();
  }

  /**
   * 获取最近的错误请求
   */
  getRecentErrors(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter((m) => !m.success)
      .slice(-limit)
      .reverse();
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能监控中间件
 */
export function createPerformanceMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const startTime = Date.now();
    const method = c.req.method;
    const endpoint = c.req.path;

    try {
      await next();

      const duration = Date.now() - startTime;
      const statusCode = c.res.status;

      performanceMonitor.recordMetric({
        endpoint,
        method,
        duration,
        timestamp: Date.now(),
        statusCode,
        success: statusCode >= 200 && statusCode < 400,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      performanceMonitor.recordMetric({
        endpoint,
        method,
        duration,
        timestamp: Date.now(),
        statusCode: 500,
        success: false,
      });

      throw error;
    }
  };
}
