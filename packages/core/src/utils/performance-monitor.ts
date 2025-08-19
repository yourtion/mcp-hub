/**
 * 性能监控系统
 * 提供请求响应时间监控、内存和CPU使用监控、性能指标收集和报告
 */

import { EventEmitter } from 'node:events';
import * as os from 'node:os';
import * as process from 'node:process';

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  // 请求相关指标
  requestCount: number;
  totalRequestTime: number;
  averageRequestTime: number;
  minRequestTime: number;
  maxRequestTime: number;

  // 错误相关指标
  errorCount: number;
  errorRate: number;

  // 系统资源指标
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;

  // 时间戳
  timestamp: number;
  uptime: number;
}

/**
 * 请求性能数据
 */
export interface RequestPerformance {
  requestId: string;
  operation: string;
  component: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 系统资源使用情况
 */
export interface SystemResourceUsage {
  memory: {
    rss: number; // 常驻内存大小
    heapTotal: number; // 堆总大小
    heapUsed: number; // 已使用堆大小
    external: number; // 外部内存使用
    arrayBuffers: number; // ArrayBuffer使用
    usagePercentage: number; // 内存使用百分比
  };
  cpu: {
    user: number; // 用户CPU时间
    system: number; // 系统CPU时间
    usagePercentage: number; // CPU使用百分比
  };
  system: {
    totalMemory: number; // 系统总内存
    freeMemory: number; // 系统可用内存
    loadAverage: number[]; // 系统负载平均值
    uptime: number; // 系统运行时间
  };
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  maxRequestTime: number; // 最大请求时间（毫秒）
  maxMemoryUsage: number; // 最大内存使用（字节）
  maxCpuUsage: number; // 最大CPU使用百分比
  maxErrorRate: number; // 最大错误率
}

/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  enabled: boolean;
  collectInterval: number; // 收集间隔（毫秒）
  retentionPeriod: number; // 数据保留期（毫秒）
  thresholds: PerformanceThresholds;
  enableAlerts: boolean;
  maxHistorySize: number; // 最大历史记录数量
}

/**
 * 默认性能监控配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  collectInterval: 30000, // 30秒
  retentionPeriod: 24 * 60 * 60 * 1000, // 24小时
  thresholds: {
    maxRequestTime: 5000, // 5秒
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxCpuUsage: 80, // 80%
    maxErrorRate: 0.05, // 5%
  },
  enableAlerts: true,
  maxHistorySize: 1000,
};

/**
 * 性能监控器
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private requestHistory: RequestPerformance[] = [];
  private metricsHistory: PerformanceMetrics[] = [];
  private collectTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private startTime: number;
  private lastCpuUsage?: NodeJS.CpuUsage;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.startTime = Date.now();

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.collectTimer) {
      return;
    }

    // 启动指标收集定时器
    this.collectTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    // 启动清理定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.retentionPeriod / 10); // 每10%保留期清理一次

    this.emit('started');
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.emit('stopped');
  }

  /**
   * 记录请求开始
   */
  startRequest(
    requestId: string,
    operation: string,
    component: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.enabled) return;

    const startTime = Date.now();

    // 临时存储请求开始信息
    (this as any)[`_req_${requestId}`] = {
      requestId,
      operation,
      component,
      startTime,
      metadata,
    };
  }

  /**
   * 记录请求结束
   */
  endRequest(requestId: string, success: boolean = true, error?: string): void {
    if (!this.config.enabled) return;

    const endTime = Date.now();
    const startData = (this as any)[`_req_${requestId}`];

    if (!startData) {
      return;
    }

    const requestPerformance: RequestPerformance = {
      ...startData,
      endTime,
      duration: endTime - startData.startTime,
      success,
      error,
    };

    this.requestHistory.push(requestPerformance);

    // 限制历史记录大小
    if (this.requestHistory.length > this.config.maxHistorySize) {
      this.requestHistory.shift();
    }

    // 清理临时数据
    delete (this as any)[`_req_${requestId}`];

    // 检查性能阈值
    this.checkThresholds(requestPerformance);

    this.emit('requestCompleted', requestPerformance);
  }

  /**
   * 收集系统指标
   */
  private collectMetrics(): void {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    // 计算请求统计
    const recentRequests = this.getRecentRequests(this.config.collectInterval);
    const requestCount = recentRequests.length;
    const successfulRequests = recentRequests.filter((r) => r.success);
    const failedRequests = recentRequests.filter((r) => !r.success);

    const requestTimes = successfulRequests.map((r) => r.duration);
    const totalRequestTime = requestTimes.reduce((sum, time) => sum + time, 0);
    const averageRequestTime =
      requestTimes.length > 0 ? totalRequestTime / requestTimes.length : 0;
    const minRequestTime =
      requestTimes.length > 0 ? Math.min(...requestTimes) : 0;
    const maxRequestTime =
      requestTimes.length > 0 ? Math.max(...requestTimes) : 0;

    const errorCount = failedRequests.length;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    const metrics: PerformanceMetrics = {
      requestCount,
      totalRequestTime,
      averageRequestTime,
      minRequestTime,
      maxRequestTime,
      errorCount,
      errorRate,
      memoryUsage,
      cpuUsage: currentCpuUsage,
      timestamp: now,
      uptime: now - this.startTime,
    };

    this.metricsHistory.push(metrics);

    // 限制历史记录大小
    if (this.metricsHistory.length > this.config.maxHistorySize) {
      this.metricsHistory.shift();
    }

    this.emit('metricsCollected', metrics);
  }

  /**
   * 获取最近的请求记录
   */
  private getRecentRequests(timeWindow: number): RequestPerformance[] {
    const cutoff = Date.now() - timeWindow;
    return this.requestHistory.filter((req) => req.endTime >= cutoff);
  }

  /**
   * 检查性能阈值
   */
  private checkThresholds(request: RequestPerformance): void {
    if (!this.config.enableAlerts) return;

    const { thresholds } = this.config;

    // 检查请求时间阈值
    if (request.duration > thresholds.maxRequestTime) {
      this.emit('thresholdExceeded', {
        type: 'requestTime',
        value: request.duration,
        threshold: thresholds.maxRequestTime,
        request,
      });
    }

    // 检查错误率阈值
    const recentRequests = this.getRecentRequests(this.config.collectInterval);
    const errorRate =
      recentRequests.length > 0
        ? recentRequests.filter((r) => !r.success).length /
          recentRequests.length
        : 0;

    if (errorRate > thresholds.maxErrorRate) {
      this.emit('thresholdExceeded', {
        type: 'errorRate',
        value: errorRate,
        threshold: thresholds.maxErrorRate,
        request,
      });
    }
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // 清理请求历史
    this.requestHistory = this.requestHistory.filter(
      (req) => req.endTime >= cutoff,
    );

    // 清理指标历史
    this.metricsHistory = this.metricsHistory.filter(
      (metrics) => metrics.timestamp >= cutoff,
    );

    this.emit('dataCleanup', {
      requestHistorySize: this.requestHistory.length,
      metricsHistorySize: this.metricsHistory.length,
    });
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0
      ? this.metricsHistory[this.metricsHistory.length - 1]
      : null;
  }

  /**
   * 获取系统资源使用情况
   */
  getSystemResourceUsage(): SystemResourceUsage {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const cpuUsage = process.cpuUsage();
    const cpuCount = os.cpus().length;

    return {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        usagePercentage: (usedMemory / totalMemory) * 100,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usagePercentage:
          ((cpuUsage.user + cpuUsage.system) / (1000000 * cpuCount)) * 100,
      },
      system: {
        totalMemory,
        freeMemory,
        loadAverage: os.loadavg(),
        uptime: os.uptime(),
      },
    };
  }

  /**
   * 获取性能统计报告
   */
  getPerformanceReport(timeWindow?: number): {
    summary: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      errorRate: number;
      uptime: number;
    };
    resourceUsage: SystemResourceUsage;
    recentMetrics: PerformanceMetrics[];
    topSlowRequests: RequestPerformance[];
  } {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;
    const relevantRequests = this.requestHistory.filter(
      (req) => req.endTime >= cutoff,
    );
    const relevantMetrics = this.metricsHistory.filter(
      (metrics) => metrics.timestamp >= cutoff,
    );

    const totalRequests = relevantRequests.length;
    const successfulRequests = relevantRequests.filter((r) => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime =
      totalRequests > 0
        ? relevantRequests.reduce((sum, req) => sum + req.duration, 0) /
          totalRequests
        : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // 获取最慢的10个请求
    const topSlowRequests = [...relevantRequests]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime,
        errorRate,
        uptime: Date.now() - this.startTime,
      },
      resourceUsage: this.getSystemResourceUsage(),
      recentMetrics: relevantMetrics.slice(-10), // 最近10个指标
      topSlowRequests,
    };
  }

  /**
   * 获取请求历史
   */
  getRequestHistory(limit?: number): RequestPerformance[] {
    return limit ? this.requestHistory.slice(-limit) : [...this.requestHistory];
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    if (!wasEnabled && this.config.enabled) {
      this.start();
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * 重置所有数据
   */
  reset(): void {
    this.requestHistory = [];
    this.metricsHistory = [];
    this.startTime = Date.now();
    this.lastCpuUsage = undefined;

    this.emit('reset');
  }
}

/**
 * 创建性能监控器
 */
export function createPerformanceMonitor(
  config?: Partial<PerformanceMonitorConfig>,
): PerformanceMonitor {
  return new PerformanceMonitor(config);
}

/**
 * 默认性能监控器实例（延迟初始化）
 */
let _performanceMonitor: PerformanceMonitor | null = null;

export const performanceMonitor = new Proxy({} as PerformanceMonitor, {
  get(target, prop) {
    if (!_performanceMonitor) {
      _performanceMonitor = createPerformanceMonitor({
        enabled: process.env.PERFORMANCE_MONITORING !== 'false',
        collectInterval: process.env.PERFORMANCE_COLLECT_INTERVAL
          ? parseInt(process.env.PERFORMANCE_COLLECT_INTERVAL, 10)
          : undefined,
      });
    }
    return _performanceMonitor[prop as keyof PerformanceMonitor];
  },
});
