import { logger } from '../utils/logger.js';
import type { DashboardService } from './dashboard_service.js';
import type { SSEEventManager } from './sse_event_manager.js';

/**
 * 事件集成服务 - 连接各个服务组件的事件
 */
export class EventIntegrationService {
  constructor(
    private dashboardService: DashboardService,
    private sseEventManager: SSEEventManager,
  ) {}

  /**
   * 记录服务器状态变更
   */
  recordServerStatusChange(
    serverId: string,
    newStatus: string,
    previousStatus?: string,
    error?: string,
  ): void {
    logger.debug('记录服务器状态变更', {
      serverId,
      newStatus,
      previousStatus,
      hasError: !!error,
    });

    // 添加活动记录
    this.dashboardService.addActivity({
      type: 'server_connected', // 根据状态选择合适的类型
      message: `服务器 ${serverId} 状态变更: ${previousStatus || '未知'} -> ${newStatus}`,
      severity:
        newStatus === 'connected'
          ? 'info'
          : newStatus === 'error'
            ? 'error'
            : 'warning',
      metadata: {
        serverId,
        newStatus,
        previousStatus,
        error,
      },
    });

    // 广播SSE事件
    this.sseEventManager.broadcastServerStatus(
      serverId,
      newStatus,
      previousStatus,
      error,
    );

    // 如果是错误状态，发送系统告警
    if (newStatus === 'error' && error) {
      this.sseEventManager.broadcastSystemAlert(
        'error',
        `服务器 ${serverId} 连接失败: ${error}`,
        'server_connection',
        { serverId, error },
      );
    }
  }

  /**
   * 记录工具执行
   */
  recordToolExecution(
    toolName: string,
    serverId: string,
    groupId: string,
    executionTime: number,
    success: boolean,
    error?: string,
  ): void {
    logger.debug('记录工具执行', {
      toolName,
      serverId,
      groupId,
      executionTime,
      success,
      hasError: !!error,
    });

    // 记录性能统计
    this.dashboardService.recordToolExecution(toolName, executionTime, success);

    // 添加活动记录
    this.dashboardService.addActivity({
      type: 'tool_executed',
      message: success
        ? `工具 ${toolName} 执行成功 (${executionTime}ms)`
        : `工具 ${toolName} 执行失败: ${error || '未知错误'}`,
      severity: success ? 'info' : 'error',
      metadata: {
        toolName,
        serverId,
        groupId,
        executionTime,
        success,
        error,
      },
    });

    // 广播SSE事件
    this.sseEventManager.broadcastToolExecution(
      toolName,
      serverId,
      groupId,
      success,
      executionTime,
      error,
    );

    // 如果执行失败，发送系统告警
    if (!success && error) {
      this.sseEventManager.broadcastSystemAlert(
        'warning',
        `工具执行失败: ${toolName} - ${error}`,
        'tool_execution',
        { toolName, serverId, groupId, error },
      );
    }
  }

  /**
   * 记录系统错误
   */
  recordSystemError(
    message: string,
    category: string,
    metadata?: Record<string, unknown>,
  ): void {
    logger.debug('记录系统错误', {
      message,
      category,
      metadata,
    });

    // 添加活动记录
    this.dashboardService.addActivity({
      type: 'error',
      message: `系统错误: ${message}`,
      severity: 'error',
      metadata: {
        category,
        ...metadata,
      },
    });

    // 广播系统告警
    this.sseEventManager.broadcastSystemAlert(
      'error',
      message,
      category,
      metadata,
    );
  }

  /**
   * 记录配置变更
   */
  recordConfigChange(configType: string, description: string): void {
    logger.debug('记录配置变更', {
      configType,
      description,
    });

    // 添加活动记录
    this.dashboardService.addActivity({
      type: 'system_start', // 使用现有类型，实际应该是 config_changed
      message: `配置变更: ${description}`,
      severity: 'info',
      metadata: {
        configType,
        description,
      },
    });

    // 广播系统告警
    this.sseEventManager.broadcastSystemAlert(
      'info',
      `配置已更新: ${description}`,
      'configuration',
      { configType },
    );
  }

  /**
   * 记录系统启动
   */
  recordSystemStart(): void {
    logger.info('记录系统启动');

    // 添加活动记录
    this.dashboardService.addActivity({
      type: 'system_start',
      message: 'MCP Hub 系统启动完成',
      severity: 'info',
    });

    // 广播系统告警
    this.sseEventManager.broadcastSystemAlert(
      'info',
      'MCP Hub 系统已启动',
      'system_lifecycle',
    );
  }

  /**
   * 记录健康检查结果
   */
  recordHealthCheck(
    status: 'healthy' | 'warning' | 'error',
    changes: Array<{
      component: string;
      previousStatus: string;
      currentStatus: string;
    }>,
  ): void {
    logger.debug('记录健康检查结果', {
      status,
      changeCount: changes.length,
    });

    // 如果有状态变更，记录活动
    if (changes.length > 0) {
      const changeMessages = changes.map(
        (change) =>
          `${change.component}: ${change.previousStatus} -> ${change.currentStatus}`,
      );

      this.dashboardService.addActivity({
        type: 'system_start', // 使用现有类型
        message: `健康检查状态变更: ${changeMessages.join(', ')}`,
        severity:
          status === 'healthy'
            ? 'info'
            : status === 'warning'
              ? 'warning'
              : 'error',
        metadata: {
          status,
          changes,
        },
      });

      // 广播健康检查事件
      this.sseEventManager.broadcastHealthCheck(status, changes);

      // 如果状态不健康，发送告警
      if (status !== 'healthy') {
        this.sseEventManager.broadcastSystemAlert(
          status === 'warning' ? 'warning' : 'error',
          `系统健康检查发现问题: ${changeMessages.join(', ')}`,
          'health_check',
          { status, changes },
        );
      }
    }
  }

  /**
   * 添加自定义日志
   */
  addLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    category: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.dashboardService.addLog({
      level,
      message,
      category,
      metadata,
    });
  }
}
