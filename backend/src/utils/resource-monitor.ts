/**
 * 资源监控工具
 * 跟踪定时器、文件描述符、连接等系统资源
 */

import { logger } from './logger.js';

export interface ResourceSnapshot {
  timestamp: number;
  activeTimers: number;
  activeHandles: number;
  fileDescriptors?: number; // 仅在支持的平台上可用
  heapUsed: number;
}

export interface ResourceAlert {
  level: 'info' | 'warning' | 'critical';
  resource: 'timers' | 'handles' | 'file-descriptors' | 'memory';
  message: string;
  currentValue: number;
  threshold?: number;
}

const RESOURCE_THRESHOLDS = {
  // 活动定时器数量告警
  activeTimersWarning: 30,
  activeTimersCritical: 50,

  // 活动句柄数量告警
  activeHandlesWarning: 100,
  activeHandlesCritical: 200,

  // 文件描述符使用率告警（相对于系统限制）
  fileDescriptorsWarning: 0.7, // 70%
  fileDescriptorsCritical: 0.85, // 85%
};

export class ResourceMonitor {
  private snapshots: ResourceSnapshot[] = [];
  private maxSnapshots = 60; // 保留最近 60 个快照
  private monitorInterval?: NodeJS.Timeout;
  private alertCallback?: (alert: ResourceAlert) => void;
  private systemFdLimit?: number;

  constructor() {
    this.detectSystemFdLimit();
  }

  /**
   * 检测系统文件描述符限制
   */
  private detectSystemFdLimit(): void {
    try {
      // 在 Unix-like 系统上获取文件描述符限制
      if (process.stdin && 'fd' in process.stdin) {
        // 尝试读取 /proc/self/limits (Linux)
        try {
          const fs = require('node:fs');
          if (fs.existsSync('/proc/self/limits')) {
            const limits = fs.readFileSync('/proc/self/limits', 'utf-8');
            const match = limits.match(/max open files\s+(\d+)/);
            if (match) {
              this.systemFdLimit = Number.parseInt(match[1], 10);
              logger.info('检测到文件描述符限制', {
                limit: this.systemFdLimit,
              });
            }
          }
        } catch {
          // 忽略错误
        }

        // 尝试使用 os-module (跨平台)
        if (!this.systemFdLimit) {
          const os = require('node:os');
          // 在某些系统上可用
          try {
            this.systemFdLimit = os.getppid ? undefined : 1024; // 默认值
          } catch {
            // 使用保守的默认值
            this.systemFdLimit = 1024;
          }
        }
      }
    } catch (error) {
      logger.warn('无法检测文件描述符限制', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * 启动资源监控
   * @param intervalMs 检查间隔（毫秒）
   */
  start(intervalMs: number = 5000): void {
    if (this.monitorInterval) {
      logger.warn('资源监控已在运行');
      return;
    }

    logger.info('启动资源监控', { intervalMs });

    // 立即记录第一个快照
    this.takeSnapshot();

    // 定期记录快照并检查告警
    this.monitorInterval = setInterval(() => {
      this.takeSnapshot();
      this.checkForAlerts();
    }, intervalMs);
    this.monitorInterval.unref?.();

    logger.info('资源监控已启动');
  }

  /**
   * 停止资源监控
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
      logger.info('资源监控已停止');
    }
  }

  /**
   * 记录当前资源快照
   */
  takeSnapshot(): ResourceSnapshot {
    const memUsage = process.memoryUsage();

    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      activeTimers: this.countActiveTimers(),
      activeHandles: this.countActiveHandles(),
      heapUsed: memUsage.heapUsed,
    };

    // 尝试获取文件描述符数量
    try {
      snapshot.fileDescriptors = this.getFileDescriptorCount();
    } catch {
      // 忽略错误，某些平台不支持
    }

    this.addSnapshot(snapshot);
    return snapshot;
  }

  /**
   * 添加快照到历史记录
   */
  private addSnapshot(snapshot: ResourceSnapshot): void {
    this.snapshots.push(snapshot);

    // 限制快照数量
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * 获取当前资源使用情况
   */
  getCurrentResources(): ResourceSnapshot {
    return this.takeSnapshot();
  }

  /**
   * 计算活动定时器数量
   * 注意：这是一个近似值，无法直接访问 Node.js 内部的定时器列表
   */
  private countActiveTimers(): number {
    let count = 0;

    // 尝试通过检查 process._getActiveHandles 来估算
    try {
      // 这是一个内部 API，可能在某些版本中不可用
      // biome-ignore lint/suspicious/noExplicitAny: 内部 API 访问
      const handles = (process as any)._getActiveHandles?.();
      if (Array.isArray(handles)) {
        count = handles.filter(
          // biome-ignore lint/suspicious/noExplicitAny: 内部 API 类型
          (h: any) =>
            h && (h._onTimeout || h._onImmediate || h instanceof Date), // Timeout 或 Immediate
        ).length;
      }
    } catch {
      // 如果内部 API 不可用，返回估算值
      // 这是一个非常粗略的估算
      count = 0;
    }

    return count;
  }

  /**
   * 获取活动句柄数量
   */
  private countActiveHandles(): number {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: 内部 API 访问
      const handles = (process as any)._getActiveHandles?.();
      return Array.isArray(handles) ? handles.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 获取打开的文件描述符数量
   * 仅在 Unix-like 系统上可用
   */
  private getFileDescriptorCount(): number | undefined {
    try {
      const fs = require('node:fs');
      // 读取 /proc/self/fd 目录（Linux）
      if (fs.existsSync('/proc/self/fd')) {
        const files = fs.readdirSync('/proc/self/fd');
        return files.length;
      }

      // 在其他系统上，可以使用 lsof 命令（较慢）
      // 这里暂时返回 undefined
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 检查资源告警
   */
  private checkForAlerts(): void {
    const current = this.getCurrentResources();

    // 检查活动定时器
    if (current.activeTimers > RESOURCE_THRESHOLDS.activeTimersCritical) {
      this.triggerAlert({
        level: 'critical',
        resource: 'timers',
        message: `活动定时器数量过多: ${current.activeTimers}`,
        currentValue: current.activeTimers,
        threshold: RESOURCE_THRESHOLDS.activeTimersCritical,
      });
    } else if (current.activeTimers > RESOURCE_THRESHOLDS.activeTimersWarning) {
      this.triggerAlert({
        level: 'warning',
        resource: 'timers',
        message: `活动定时器数量较多: ${current.activeTimers}`,
        currentValue: current.activeTimers,
        threshold: RESOURCE_THRESHOLDS.activeTimersWarning,
      });
    }

    // 检查活动句柄
    if (current.activeHandles > RESOURCE_THRESHOLDS.activeHandlesCritical) {
      this.triggerAlert({
        level: 'critical',
        resource: 'handles',
        message: `活动句柄数量过多: ${current.activeHandles}`,
        currentValue: current.activeHandles,
        threshold: RESOURCE_THRESHOLDS.activeHandlesCritical,
      });
    } else if (
      current.activeHandles > RESOURCE_THRESHOLDS.activeHandlesWarning
    ) {
      this.triggerAlert({
        level: 'warning',
        resource: 'handles',
        message: `活动句柄数量较多: ${current.activeHandles}`,
        currentValue: current.activeHandles,
        threshold: RESOURCE_THRESHOLDS.activeHandlesWarning,
      });
    }

    // 检查文件描述符使用率
    if (current.fileDescriptors && this.systemFdLimit) {
      const fdUsageRatio = current.fileDescriptors / this.systemFdLimit;

      if (fdUsageRatio > RESOURCE_THRESHOLDS.fileDescriptorsCritical) {
        this.triggerAlert({
          level: 'critical',
          resource: 'file-descriptors',
          message: `文件描述符使用率过高: ${(fdUsageRatio * 100).toFixed(1)}% (${current.fileDescriptors}/${this.systemFdLimit})`,
          currentValue: current.fileDescriptors,
          threshold:
            this.systemFdLimit * RESOURCE_THRESHOLDS.fileDescriptorsCritical,
        });
      } else if (fdUsageRatio > RESOURCE_THRESHOLDS.fileDescriptorsWarning) {
        this.triggerAlert({
          level: 'warning',
          resource: 'file-descriptors',
          message: `文件描述符使用率较高: ${(fdUsageRatio * 100).toFixed(1)}% (${current.fileDescriptors}/${this.systemFdLimit})`,
          currentValue: current.fileDescriptors,
          threshold:
            this.systemFdLimit * RESOURCE_THRESHOLDS.fileDescriptorsWarning,
        });
      }
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(alert: ResourceAlert): void {
    logger.warn('资源告警', {
      level: alert.level,
      resource: alert.resource,
      message: alert.message,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
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
  onAlert(callback: (alert: ResourceAlert) => void): void {
    this.alertCallback = callback;
  }

  /**
   * 获取资源统计信息
   */
  getStats(): {
    current: ResourceSnapshot;
    snapshotCount: number;
    trend?: {
      timers: 'increasing' | 'decreasing' | 'stable';
      handles: 'increasing' | 'decreasing' | 'stable';
    };
  } {
    const current = this.getCurrentResources();

    // 分析趋势（如果有足够的历史数据）
    let trend:
      | {
          timers: 'increasing' | 'decreasing' | 'stable';
          handles: 'increasing' | 'decreasing' | 'stable';
        }
      | undefined;

    if (this.snapshots.length >= 2) {
      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];

      trend = {
        timers: this.getTrend(first.activeTimers, last.activeTimers),
        handles: this.getTrend(first.activeHandles, last.activeHandles),
      };
    }

    return {
      current,
      snapshotCount: this.snapshots.length,
      trend,
    };
  }

  /**
   * 判断趋势
   */
  private getTrend(
    first: number,
    last: number,
  ): 'increasing' | 'decreasing' | 'stable' {
    const diff = last - first;
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * 清空历史快照
   */
  clear(): void {
    this.snapshots = [];
    logger.debug('资源快照已清空');
  }
}

// 创建全局单例
export const resourceMonitor = new ResourceMonitor();
