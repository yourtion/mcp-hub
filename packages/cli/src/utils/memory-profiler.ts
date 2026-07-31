/**
 * CLI 内存分析工具
 * 专门用于追踪 CLI 重启场景的内存泄漏
 */

import { createCliLogger } from '@mcp-core/mcp-knot-share';

const logger = createCliLogger({ component: 'MemoryProfiler' });

export interface RestartMemorySnapshot {
  iteration: number;
  timestamp: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryDelta: number;
  fileDescriptorsBefore?: number;
  fileDescriptorsAfter?: number;
}

export interface MemoryLeakReport {
  totalIterations: number;
  totalMemoryGrowth: number;
  averageGrowthPerIteration: number;
  leakDetected: boolean;
  snapshots: RestartMemorySnapshot[];
}

export class CliMemoryProfiler {
  private baselineMemory?: number;
  private snapshots: RestartMemorySnapshot[] = [];
  private iterationCount = 0;

  /**
   * 记录重启前的内存状态
   */
  recordBeforeRestart(): void {
    const memUsage = process.memoryUsage();
    this.baselineMemory = memUsage.heapUsed;

    logger.debug(
      `记录重启前内存 - 堆: ${this.formatBytes(this.baselineMemory)}, RSS: ${this.formatBytes(memUsage.rss)}`,
    );
  }

  /**
   * 记录重启后的内存状态
   */
  recordAfterRestart(): RestartMemorySnapshot {
    if (this.baselineMemory === undefined) {
      throw new Error('必须先调用 recordBeforeRestart()');
    }

    const memUsage = process.memoryUsage();
    const memoryAfter = memUsage.heapUsed;
    const memoryDelta = memoryAfter - this.baselineMemory;

    this.iterationCount++;

    const snapshot: RestartMemorySnapshot = {
      iteration: this.iterationCount,
      timestamp: Date.now(),
      memoryBefore: this.baselineMemory,
      memoryAfter,
      memoryDelta,
    };

    // 尝试获取文件描述符数量
    try {
      const fs = require('node:fs');
      if (fs.existsSync('/proc/self/fd')) {
        snapshot.fileDescriptorsBefore = this.getFileDescriptorCount();
      }
    } catch {
      // 忽略
    }

    this.snapshots.push(snapshot);

    const deltaSign = memoryDelta >= 0 ? '+' : '';
    logger.info(
      `重启内存分析 #${snapshot.iteration} - 前: ${this.formatBytes(snapshot.memoryBefore)}, 后: ${this.formatBytes(snapshot.memoryAfter)}, 增量: ${deltaSign}${this.formatBytes(memoryDelta)}`,
    );

    return snapshot;
  }

  /**
   * 生成内存泄漏报告
   */
  generateReport(): MemoryLeakReport {
    if (this.snapshots.length === 0) {
      return {
        totalIterations: 0,
        totalMemoryGrowth: 0,
        averageGrowthPerIteration: 0,
        leakDetected: false,
        snapshots: [],
      };
    }

    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const totalMemoryGrowth = lastSnapshot.memoryAfter - firstSnapshot.memoryBefore;
    const averageGrowthPerIteration =
      this.snapshots.length > 0 ? totalMemoryGrowth / this.snapshots.length : 0;

    // 判断是否存在内存泄漏
    // 如果平均每次重启增长超过 5MB，认为存在泄漏
    const leakDetected = averageGrowthPerIteration > 5 * 1024 * 1024;

    return {
      totalIterations: this.snapshots.length,
      totalMemoryGrowth,
      averageGrowthPerIteration,
      leakDetected,
      snapshots: [...this.snapshots],
    };
  }

  /**
   * 打印报告摘要
   */
  printReportSummary(): void {
    const report = this.generateReport();

    logger.info('=== 内存泄漏分析报告 ===');
    logger.info(`总迭代次数: ${report.totalIterations}`);
    logger.info(`总内存增长: ${this.formatBytes(report.totalMemoryGrowth)}`);
    logger.info(`平均每次增长: ${this.formatBytes(report.averageGrowthPerIteration)}`);
    logger.info(`检测到泄漏: ${report.leakDetected ? '是 ⚠️' : '否 ✅'}`);

    if (report.leakDetected) {
      logger.warn(
        `检测到可能的内存泄漏！平均每次重启增长 ${this.formatBytes(report.averageGrowthPerIteration)}`,
      );
    } else if (report.totalIterations > 0) {
      logger.info('未检测到明显的内存泄漏 ✅');
    }

    // 显示最近几次的快照
    const recentSnapshots = report.snapshots.slice(-5);
    if (recentSnapshots.length > 0) {
      logger.info('最近 5 次重启的内存变化:');
      recentSnapshots.forEach((snapshot) => {
        logger.info(
          `  迭代 ${snapshot.iteration}: ${this.formatBytes(snapshot.memoryDelta)} (前: ${this.formatBytes(snapshot.memoryBefore)}, 后: ${this.formatBytes(snapshot.memoryAfter)})`,
        );
      });
    }
  }

  /**
   * 重置分析器
   */
  reset(): void {
    this.baselineMemory = undefined;
    this.snapshots = [];
    this.iterationCount = 0;
    logger.debug('内存分析器已重置');
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemoryUsage(): {
    heapUsed: number;
    rss: number;
    external: number;
  } {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      rss: memUsage.rss,
      external: memUsage.external,
    };
  }

  /**
   * 获取文件描述符数量（仅 Unix-like 系统）
   */
  private getFileDescriptorCount(): number {
    try {
      const fs = require('node:fs');
      if (fs.existsSync('/proc/self/fd')) {
        const files = fs.readdirSync('/proc/self/fd');
        return files.length;
      }
    } catch {
      // 忽略
    }
    return 0;
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
}

// 创建全局单例
export const cliMemoryProfiler = new CliMemoryProfiler();
