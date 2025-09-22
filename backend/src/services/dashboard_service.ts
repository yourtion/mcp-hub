import type {
  Activity,
  DashboardStats,
  LogEntry,
  LogQuery,
  SystemHealth,
} from '../types/dashboard.js';
import { logger } from '../utils/logger.js';
import type { McpHubService } from './mcp_hub_service.js';

/**
 * 仪表板服务 - 管理系统统计信息、活动记录和健康检查
 */
export class DashboardService {
  private activities: Activity[] = [];
  private readonly MAX_ACTIVITIES = 1000; // 最大活动记录数
  private performanceStats = {
    totalRequests: 0,
    totalResponseTime: 0,
    errorCount: 0,
    toolExecutions: new Map<string, { calls: number; totalTime: number }>(),
  };
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 5000; // 最大日志记录数
  private startTime = Date.now();

  constructor(private hubService: McpHubService) {
    // 记录系统启动活动
    this.addActivity({
      type: 'system_start',
      message: '系统启动完成',
      severity: 'info',
    });
  }

  /**
   * 获取仪表板统计信息
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      logger.debug('获取仪表板统计信息');

      // 获取系统状态
      const serviceStatus = await this.hubService.getDetailedServiceStatus();
      const systemHealth = await this.getSystemHealth();

      // 计算性能指标
      const averageResponseTime =
        this.performanceStats.totalRequests > 0
          ? this.performanceStats.totalResponseTime /
            this.performanceStats.totalRequests
          : 0;

      const errorRate =
        this.performanceStats.totalRequests > 0
          ? (this.performanceStats.errorCount /
              this.performanceStats.totalRequests) *
            100
          : 0;

      // 获取热门工具统计
      const topTools = Array.from(
        this.performanceStats.toolExecutions.entries(),
      )
        .map(([name, stats]) => ({
          name,
          calls: stats.calls,
          avgTime: stats.calls > 0 ? stats.totalTime / stats.calls : 0,
        }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10);

      // 获取最近活动（最新50条）
      const recentActivity = this.activities.slice(-50).reverse(); // 最新的在前

      const stats: DashboardStats = {
        overview: {
          totalServers: serviceStatus.serverCount,
          connectedServers: serviceStatus.connectedServers,
          totalTools: serviceStatus.totalTools,
          totalGroups: serviceStatus.groupCount,
          apiTools: serviceStatus.apiTools,
        },
        recentActivity,
        systemHealth: {
          status: systemHealth.status,
          issues: systemHealth.issues,
          uptime: Math.floor((Date.now() - this.startTime) / 1000),
        },
        performance: {
          totalRequests: this.performanceStats.totalRequests,
          averageResponseTime: Math.round(averageResponseTime * 100) / 100,
          errorRate: Math.round(errorRate * 100) / 100,
          topTools,
        },
      };

      logger.debug('仪表板统计信息获取成功', {
        totalServers: stats.overview.totalServers,
        connectedServers: stats.overview.connectedServers,
        totalTools: stats.overview.totalTools,
        recentActivityCount: stats.recentActivity.length,
      });

      return stats;
    } catch (error) {
      logger.error('获取仪表板统计信息失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      logger.debug('执行系统健康检查');

      const issues: string[] = [];
      const checks = {
        servers: {
          status: 'healthy' as 'healthy' | 'warning' | 'error',
          message: '',
          details: { total: 0, connected: 0, failed: 0 },
        },
        groups: {
          status: 'healthy' as 'healthy' | 'warning' | 'error',
          message: '',
          details: { total: 0, healthy: 0, unhealthy: 0 },
        },
        apiTools: {
          status: 'healthy' as 'healthy' | 'warning' | 'error',
          message: '',
          details: {
            initialized: false,
            totalTools: 0,
            errors: [] as string[],
          },
        },
        memory: {
          status: 'healthy' as 'healthy' | 'warning' | 'error',
          message: '',
          details: { used: 0, total: 0, percentage: 0 },
        },
      };

      // 检查服务器状态
      const serviceStatus = await this.hubService.getDetailedServiceStatus();
      const serverHealth = this.hubService.getServerHealth();

      const failedServers = Array.from(serverHealth.values()).filter(
        (status) => status === 'error',
      ).length;

      checks.servers.details = {
        total: serviceStatus.serverCount,
        connected: serviceStatus.connectedServers,
        failed: failedServers,
      };

      if (serviceStatus.connectedServers === 0) {
        checks.servers.status = 'error';
        checks.servers.message = '没有服务器连接';
        issues.push('没有可用的MCP服务器连接');
      } else if (failedServers > 0) {
        checks.servers.status = 'warning';
        checks.servers.message = `${failedServers} 个服务器连接失败`;
        issues.push(`${failedServers} 个MCP服务器连接失败`);
      } else {
        checks.servers.message = `${serviceStatus.connectedServers} 个服务器正常连接`;
      }

      // 检查组状态
      const allGroups = this.hubService.getAllGroups();
      let healthyGroups = 0;

      for (const [groupId] of allGroups) {
        try {
          const tools = await this.hubService.listTools(groupId);
          if (tools.length > 0) {
            healthyGroups++;
          }
        } catch (error) {
          // 组不健康
        }
      }

      const unhealthyGroups = allGroups.size - healthyGroups;
      checks.groups.details = {
        total: allGroups.size,
        healthy: healthyGroups,
        unhealthy: unhealthyGroups,
      };

      if (healthyGroups === 0) {
        checks.groups.status = 'error';
        checks.groups.message = '没有健康的组';
        issues.push('没有可用的工具组');
      } else if (unhealthyGroups > 0) {
        checks.groups.status = 'warning';
        checks.groups.message = `${unhealthyGroups} 个组不健康`;
        issues.push(`${unhealthyGroups} 个工具组不健康`);
      } else {
        checks.groups.message = `${healthyGroups} 个组正常运行`;
      }

      // 检查API工具状态
      const apiToolHealth = this.hubService.getApiToolServiceHealth();
      checks.apiTools.details = {
        initialized: apiToolHealth.initialized,
        totalTools: serviceStatus.apiTools,
        errors: apiToolHealth.errors || [],
      };

      if (!apiToolHealth.initialized) {
        checks.apiTools.status = 'warning';
        checks.apiTools.message = 'API工具服务未初始化';
      } else if (!apiToolHealth.healthy) {
        checks.apiTools.status = 'error';
        checks.apiTools.message = 'API工具服务不健康';
        issues.push('API工具服务存在问题');
      } else {
        checks.apiTools.message = `${serviceStatus.apiTools} 个API工具正常运行`;
      }

      // 检查内存使用情况
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const memPercentage = (usedMem / totalMem) * 100;

      checks.memory.details = {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round(memPercentage * 100) / 100,
      };

      if (memPercentage > 90) {
        checks.memory.status = 'error';
        checks.memory.message = '内存使用率过高';
        issues.push('系统内存使用率超过90%');
      } else if (memPercentage > 75) {
        checks.memory.status = 'warning';
        checks.memory.message = '内存使用率较高';
        issues.push('系统内存使用率超过75%');
      } else {
        checks.memory.message = `内存使用率 ${memPercentage.toFixed(1)}%`;
      }

      // 确定整体健康状态
      let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

      if (Object.values(checks).some((check) => check.status === 'error')) {
        overallStatus = 'error';
      } else if (
        Object.values(checks).some((check) => check.status === 'warning')
      ) {
        overallStatus = 'warning';
      }

      const health: SystemHealth = {
        status: overallStatus,
        issues,
        checks,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
      };

      logger.debug('系统健康检查完成', {
        status: overallStatus,
        issueCount: issues.length,
        connectedServers: serviceStatus.connectedServers,
        healthyGroups,
      });

      return health;
    } catch (error) {
      logger.error('系统健康检查失败', error as Error);

      // 返回错误状态
      return {
        status: 'error',
        issues: [`健康检查失败: ${(error as Error).message}`],
        checks: {
          servers: {
            status: 'error',
            message: '检查失败',
            details: { total: 0, connected: 0, failed: 0 },
          },
          groups: {
            status: 'error',
            message: '检查失败',
            details: { total: 0, healthy: 0, unhealthy: 0 },
          },
          apiTools: {
            status: 'error',
            message: '检查失败',
            details: { initialized: false, totalTools: 0, errors: [] },
          },
          memory: {
            status: 'error',
            message: '检查失败',
            details: { used: 0, total: 0, percentage: 0 },
          },
        },
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 添加活动记录
   */
  addActivity(activity: Omit<Activity, 'id' | 'timestamp'>): void {
    const newActivity: Activity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...activity,
    };

    this.activities.push(newActivity);

    // 限制活动记录数量
    if (this.activities.length > this.MAX_ACTIVITIES) {
      this.activities = this.activities.slice(-this.MAX_ACTIVITIES);
    }

    logger.debug('添加活动记录', {
      activityId: newActivity.id,
      type: newActivity.type,
      severity: newActivity.severity,
    });
  }

  /**
   * 记录工具执行统计
   */
  recordToolExecution(
    toolName: string,
    executionTime: number,
    success: boolean,
  ): void {
    this.performanceStats.totalRequests++;
    this.performanceStats.totalResponseTime += executionTime;

    if (!success) {
      this.performanceStats.errorCount++;
    }

    // 更新工具执行统计
    const toolStats = this.performanceStats.toolExecutions.get(toolName) || {
      calls: 0,
      totalTime: 0,
    };
    toolStats.calls++;
    toolStats.totalTime += executionTime;
    this.performanceStats.toolExecutions.set(toolName, toolStats);

    logger.debug('记录工具执行统计', {
      toolName,
      executionTime,
      success,
      totalRequests: this.performanceStats.totalRequests,
    });
  }

  /**
   * 添加日志条目
   */
  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    this.logs.push(newLog);

    // 限制日志记录数量
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * 查询日志
   */
  queryLogs(query: LogQuery = {}): { logs: LogEntry[]; total: number } {
    let filteredLogs = [...this.logs];

    // 按级别过滤
    if (query.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === query.level);
    }

    // 按分类过滤
    if (query.category) {
      filteredLogs = filteredLogs.filter(
        (log) => log.category === query.category,
      );
    }

    // 按时间范围过滤
    if (query.startTime) {
      const startTime = new Date(query.startTime);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) >= startTime,
      );
    }

    if (query.endTime) {
      const endTime = new Date(query.endTime);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) <= endTime,
      );
    }

    // 按关键词搜索
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.category.toLowerCase().includes(searchLower),
      );
    }

    // 排序（最新的在前）
    filteredLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const total = filteredLogs.length;

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    logger.debug('日志查询完成', {
      totalLogs: this.logs.length,
      filteredCount: total,
      returnedCount: paginatedLogs.length,
      query,
    });

    return {
      logs: paginatedLogs,
      total,
    };
  }

  /**
   * 获取最近的活动记录
   */
  getRecentActivities(limit = 50): Activity[] {
    return this.activities.slice(-limit).reverse(); // 最新的在前
  }

  /**
   * 清理旧数据
   */
  cleanup(): void {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000; // 一周前

    // 清理一周前的活动记录
    this.activities = this.activities.filter(
      (activity) => new Date(activity.timestamp).getTime() > oneWeekAgo,
    );

    // 清理一周前的日志
    this.logs = this.logs.filter(
      (log) => new Date(log.timestamp).getTime() > oneWeekAgo,
    );

    logger.info('数据清理完成', {
      remainingActivities: this.activities.length,
      remainingLogs: this.logs.length,
    });
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats() {
    const averageResponseTime =
      this.performanceStats.totalRequests > 0
        ? this.performanceStats.totalResponseTime /
          this.performanceStats.totalRequests
        : 0;

    const errorRate =
      this.performanceStats.totalRequests > 0
        ? (this.performanceStats.errorCount /
            this.performanceStats.totalRequests) *
          100
        : 0;

    return {
      totalRequests: this.performanceStats.totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      errorCount: this.performanceStats.errorCount,
      toolExecutions: Object.fromEntries(this.performanceStats.toolExecutions),
    };
  }
}
