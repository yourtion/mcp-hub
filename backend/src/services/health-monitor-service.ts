import { ServerStatus } from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';

import type { GroupManager, ServerManager } from '../types/mcp-hub.js';

/**
 * 健康监控服务
 *
 * 管理定期健康检查、健康报告生成、服务器断连处理和生命周期状态追踪。
 */
export class HealthMonitorService {
  private healthCheckInterval?: NodeJS.Timeout;
  private healthCheckTimers: Array<NodeJS.Timeout | NodeJS.Immediate> = [];
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000;
  private enabled = true;
  private initializationTime?: Date;
  private lastHealthCheck?: Date;

  constructor(
    private readonly serverManager: ServerManager,
    private readonly groupManager: GroupManager,
    private readonly onHealthCheck?: () => Promise<void>,
  ) {}

  /**
   * 启动后调用，记录初始化时间
   */
  markInitialized(): void {
    this.initializationTime = new Date();
  }

  /**
   * 启动健康监控
   */
  start(): void {
    if (!this.enabled) {
      logger.debug('Health monitoring disabled, skipping start');
      return;
    }

    if (this.healthCheckInterval) {
      logger.debug('Health monitoring already running');
      return;
    }

    this.stop();

    logger.info('Starting service health monitoring', {
      intervalMs: this.HEALTH_CHECK_INTERVAL_MS,
    });

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performCheck();
      } catch (error) {
        logger.error('Health check failed', error as Error);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);
    this.healthCheckInterval.unref?.();
    this.healthCheckTimers.push(this.healthCheckInterval);

    const initialCheck = setImmediate(async () => {
      try {
        await this.performCheck();
      } catch (error) {
        logger.error('Initial health check failed', error as Error);
      }
    });
    initialCheck.unref?.();
    this.healthCheckTimers.push(initialCheck);

    logger.debug('Health monitoring timers registered', {
      timerCount: this.healthCheckTimers.length,
    });
  }

  /**
   * 停止健康监控
   */
  stop(): void {
    let clearedCount = 0;

    for (const timer of this.healthCheckTimers) {
      try {
        if ('_onTimeout' in timer) {
          clearInterval(timer as NodeJS.Timeout);
        } else if ('_onImmediate' in timer) {
          clearImmediate(timer as NodeJS.Immediate);
        }
        clearedCount++;
      } catch (error) {
        logger.error('清理定时器失败', error as Error);
      }
    }

    this.healthCheckTimers = [];
    this.healthCheckInterval = undefined;

    if (clearedCount > 0) {
      logger.info('Health monitoring stopped', { clearedTimers: clearedCount });
    }
  }

  /**
   * 设置是否启用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled && this.initializationTime && !this.healthCheckInterval) {
      this.start();
    } else if (!enabled && this.healthCheckInterval) {
      this.stop();
    }

    logger.info('Health monitoring setting changed', { enabled });
  }

  /**
   * 获取生命周期状态
   */
  getLifecycleStatus(): {
    isInitialized: boolean;
    healthMonitoringEnabled: boolean;
    uptime: number;
    lastHealthCheck?: string;
    initializationTime?: string;
  } {
    return {
      isInitialized: !!this.initializationTime,
      healthMonitoringEnabled: this.enabled,
      uptime: this.getUptime(),
      lastHealthCheck: this.lastHealthCheck?.toISOString(),
      initializationTime: this.initializationTime?.toISOString(),
    };
  }

  /**
   * 手动触发健康检查
   */
  async triggerCheck(): Promise<void> {
    await this.performCheck();
  }

  /**
   * 执行健康检查
   */
  private async performCheck(): Promise<void> {
    this.lastHealthCheck = new Date();

    logger.debug('Performing service health check', {
      timestamp: this.lastHealthCheck.toISOString(),
    });

    try {
      const report = await this.generateReport();

      if (report.critical.length > 0) {
        logger.error('Critical health issues detected', new Error('Service health critical'), {
          criticalIssues: report.critical,
          warnings: report.warnings,
          healthScore: report.healthScore,
        });
      } else if (report.warnings.length > 0) {
        logger.warn('Service health warnings detected', {
          warnings: report.warnings,
          healthScore: report.healthScore,
        });
      } else {
        logger.debug('Service health check passed', {
          healthScore: report.healthScore,
          connectedServers: report.servers.connected,
          totalServers: report.servers.total,
        });
      }

      await this.handleDisconnections(report);
    } catch (error) {
      logger.error('Health check execution failed', error as Error);
    }
  }

  /**
   * 生成健康报告
   */
  private async generateReport(): Promise<{
    healthScore: number;
    critical: string[];
    warnings: string[];
    servers: {
      total: number;
      connected: number;
      disconnected: number;
      failed: number;
    };
    groups: {
      total: number;
      healthy: number;
      unhealthy: number;
    };
    uptime: number;
  }> {
    const critical: string[] = [];
    const warnings: string[] = [];

    const allServers = this.serverManager.getAllServers();
    const serverStats = {
      total: allServers.size,
      connected: 0,
      disconnected: 0,
      failed: 0,
    };

    for (const server of allServers.values()) {
      switch (server.status) {
        case ServerStatus.CONNECTED:
          serverStats.connected++;
          break;
        case ServerStatus.DISCONNECTED:
          serverStats.disconnected++;
          break;
        case ServerStatus.ERROR:
          serverStats.failed++;
          break;
      }
    }

    if (serverStats.connected === 0) {
      critical.push('No servers are connected');
    } else if (serverStats.connected < serverStats.total * 0.5) {
      warnings.push(`Only ${serverStats.connected} of ${serverStats.total} servers are connected`);
    }

    if (serverStats.failed > 0) {
      warnings.push(`${serverStats.failed} servers are in error state`);
    }

    const allGroups = this.groupManager.getAllGroups();
    const groupStats = {
      total: allGroups.size,
      healthy: 0,
      unhealthy: 0,
    };

    for (const [groupId] of allGroups) {
      try {
        const availableServers = this.groupManager.getGroupServers(groupId);
        const connectedServers = availableServers.filter((serverId) => {
          const server = allServers.get(serverId);
          return server?.status === ServerStatus.CONNECTED;
        });

        if (connectedServers.length > 0) {
          groupStats.healthy++;
        } else {
          groupStats.unhealthy++;
          warnings.push(`Group '${groupId}' has no connected servers`);
        }
      } catch (error) {
        groupStats.unhealthy++;
        warnings.push(`Group '${groupId}' health check failed: ${(error as Error).message}`);
      }
    }

    let healthScore = 100;
    healthScore -= critical.length * 30;
    healthScore -= warnings.length * 10;
    healthScore = Math.max(0, healthScore);

    return {
      healthScore,
      critical,
      warnings,
      servers: serverStats,
      groups: groupStats,
      uptime: this.getUptime(),
    };
  }

  /**
   * 处理服务器断连
   */
  private async handleDisconnections(report: {
    servers: { disconnected: number; failed: number };
  }): Promise<void> {
    if (report.servers.disconnected === 0 && report.servers.failed === 0) {
      return;
    }

    logger.info('Handling server disconnections', {
      disconnectedServers: report.servers.disconnected,
      failedServers: report.servers.failed,
    });

    if (this.onHealthCheck) {
      try {
        await this.onHealthCheck();
      } catch (error) {
        logger.error('Error in health check callback', error as Error);
      }
    }
  }

  /**
   * 获取运行时间（秒）
   */
  private getUptime(): number {
    if (!this.initializationTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.initializationTime.getTime()) / 1000);
  }
}
