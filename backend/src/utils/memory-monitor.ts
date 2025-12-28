/**
 * 内存监控工具
 * 提供实时内存跟踪、趋势分析和泄漏检测
 */

import { logger } from './logger.js';

export interface MemorySnapshot {
  timestamp: number;
  rss: number; // Resident Set Size - 总内存占用
  heapTotal: number; // V8 分配的总堆内存
  heapUsed: number; // V8 实际使用的堆内存
  external: number; // C++ 对象占用的内存
  arrayBuffers: number; // ArrayBuffer 和 SharedArrayBuffer 占用的内存
}

export interface MemoryTrend {
  duration: number; // 分析时长（毫秒）
  growthRate: number; // 内存增长率（字节/分钟）
  totalGrowth: number; // 总增长量（字节）
  snapshots: MemorySnapshot[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface MemoryAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  growthRate?: number;
  currentUsage?: number;
  threshold?: number;
}

const ALERT_THRESHOLDS = {
  // 增长率告警（字节/分钟）
  growthRateWarning: 5 * 1024 * 1024, // 5 MB/min
  growthRateCritical: 10 * 1024 * 1024, // 10 MB/min

  // 堆内存使用率告警
  heapUsageWarning: 0.75, // 75%
  heapUsageCritical: 0.9, // 90%

  // 持续增长时间（分钟）
  sustainedGrowthDuration: 5,
};

export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 60; // 最多保留 60 个快照（约 1 分钟，假设每秒一个）
  private snapshotInterval?: NodeJS.Timeout;
  private alertCallback?: (alert: MemoryAlert) => void;

  /**
   * 启动内存监控
   * @param intervalMs 快照间隔（毫秒）
   */
  start(intervalMs: number = 1000): void {
    if (this.snapshotInterval) {
      logger.warn('内存监控已在运行');
      return;
    }

    logger.info('启动内存监控', { intervalMs });

    // 立即记录第一个快照
    this.takeSnapshot();

    // 定期记录快照
    this.snapshotInterval = setInterval(() => {
      this.takeSnapshot();
      this.checkForAlerts();
    }, intervalMs);

    logger.info('内存监控已启动');
  }

  /**
   * 停止内存监控
   */
  stop(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = undefined;
      logger.info('内存监控已停止');
    }
  }

  /**
   * 记录当前内存快照
   */
  takeSnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    };

    this.addSnapshot(snapshot);
    return snapshot;
  }

  /**
   * 添加快照到历史记录
   */
  private addSnapshot(snapshot: MemorySnapshot): void {
    this.snapshots.push(snapshot);

    // 限制快照数量
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemory(): MemorySnapshot {
    return this.takeSnapshot();
  }

  /**
   * 分析内存趋势
   * @param durationMs 分析时长（毫秒）
   */
  analyzeTrend(durationMs: number): MemoryTrend | null {
    if (this.snapshots.length < 2) {
      return null;
    }

    const now = Date.now();
    const startTime = now - durationMs;

    // 筛选指定时间范围内的快照
    const relevantSnapshots = this.snapshots.filter(
      (s) => s.timestamp >= startTime && s.timestamp <= now,
    );

    if (relevantSnapshots.length < 2) {
      return null;
    }

    // 计算增长趋势（基于 heapUsed）
    const firstSnapshot = relevantSnapshots[0];
    const lastSnapshot = relevantSnapshots[relevantSnapshots.length - 1];
    const timeDiff = lastSnapshot.timestamp - firstSnapshot.timestamp;
    const memoryDiff = lastSnapshot.heapUsed - firstSnapshot.heapUsed;

    // 计算增长率（字节/分钟）
    const growthRate = timeDiff > 0 ? (memoryDiff / timeDiff) * 60000 : 0;

    // 判断趋势
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (memoryDiff > 10 * 1024 * 1024) {
      // 增长超过 10MB
      trend = 'increasing';
    } else if (memoryDiff < -10 * 1024 * 1024) {
      // 减少超过 10MB
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      duration: timeDiff,
      growthRate,
      totalGrowth: memoryDiff,
      snapshots: relevantSnapshots,
      trend,
    };
  }

  /**
   * 检查内存告警
   */
  private checkForAlerts(): void {
    const trend = this.analyzeTrend(60000); // 分析最近 1 分钟
    if (!trend) {
      return;
    }

    const current = this.getCurrentMemory();

    // 检查增长率告警
    if (trend.growthRate > ALERT_THRESHOLDS.growthRateCritical) {
      this.triggerAlert({
        level: 'critical',
        message: `内存增长过快: ${this.formatBytes(trend.growthRate)}/min`,
        growthRate: trend.growthRate,
        currentUsage: current.heapUsed,
        threshold: ALERT_THRESHOLDS.growthRateCritical,
      });
    } else if (trend.growthRate > ALERT_THRESHOLDS.growthRateWarning) {
      this.triggerAlert({
        level: 'warning',
        message: `内存持续增长: ${this.formatBytes(trend.growthRate)}/min`,
        growthRate: trend.growthRate,
        currentUsage: current.heapUsed,
        threshold: ALERT_THRESHOLDS.growthRateWarning,
      });
    }

    // 检查堆内存使用率告警
    const heapUsageRatio = current.heapUsed / current.heapTotal;
    if (heapUsageRatio > ALERT_THRESHOLDS.heapUsageCritical) {
      this.triggerAlert({
        level: 'critical',
        message: `堆内存使用率过高: ${(heapUsageRatio * 100).toFixed(1)}%`,
        currentUsage: current.heapUsed,
        threshold: current.heapTotal * ALERT_THRESHOLDS.heapUsageCritical,
      });
    } else if (heapUsageRatio > ALERT_THRESHOLDS.heapUsageWarning) {
      this.triggerAlert({
        level: 'warning',
        message: `堆内存使用率较高: ${(heapUsageRatio * 100).toFixed(1)}%`,
        currentUsage: current.heapUsed,
        threshold: current.heapTotal * ALERT_THRESHOLDS.heapUsageWarning,
      });
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(alert: MemoryAlert): void {
    logger.warn('内存告警', {
      level: alert.level,
      message: alert.message,
      growthRate: alert.growthRate
        ? this.formatBytes(alert.growthRate)
        : undefined,
      currentUsage: alert.currentUsage
        ? this.formatBytes(alert.currentUsage)
        : undefined,
      threshold: alert.threshold
        ? this.formatBytes(alert.threshold)
        : undefined,
    });

    if (this.alertCallback) {
      try {
        this.alertCallback(alert);
      } catch (error) {
        logger.error('告警回调执行失败', error as Error);
      }
    }
  }

  /**
   * 设置告警回调
   */
  onAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * 获取内存统计信息
   */
  getStats(): {
    current: MemorySnapshot;
    trend: MemoryTrend | null;
    snapshotCount: number;
    heapUsageRatio: number;
  } {
    const current = this.getCurrentMemory();
    const trend = this.analyzeTrend(60000); // 最近 1 分钟

    return {
      current,
      trend,
      snapshotCount: this.snapshots.length,
      heapUsageRatio:
        current.heapTotal > 0 ? current.heapUsed / current.heapTotal : 0,
    };
  }

  /**
   * 清空历史快照
   */
  clear(): void {
    this.snapshots = [];
    logger.debug('内存快照已清空');
  }

  /**
   * 格式化字节数为可读字符串
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 手动触发垃圾回收（需要 --expose-gc 启动）
   */
  forceGC(): boolean {
    if (global.gc) {
      try {
        global.gc();
        logger.info('已触发垃圾回收');
        return true;
      } catch (error) {
        logger.error('垃圾回收失败', error as Error);
        return false;
      }
    } else {
      logger.warn('垃圾回收不可用（未使用 --expose-gc 启动）');
      return false;
    }
  }
}

// 创建全局单例
export const memoryMonitor = new MemoryMonitor();
