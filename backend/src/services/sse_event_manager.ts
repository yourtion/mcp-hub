import type {
  ActivityEvent,
  HealthCheckEvent,
  ServerStatusEvent,
  SSEEvent,
  SystemAlertEvent,
  ToolExecutionEvent,
} from '../types/dashboard.js';
import { logger } from '../utils/logger.js';

/**
 * SSE客户端连接信息
 */
interface SSEClient {
  id: string;
  response: Response;
  controller: ReadableStreamDefaultController;
  connectedAt: Date;
  lastPing: Date;
  subscriptions: Set<string>; // 订阅的事件类型
}

/**
 * SSE事件管理器 - 管理实时事件推送
 */
export class SSEEventManager {
  private clients = new Map<string, SSEClient>();
  private eventHistory: SSEEvent[] = [];
  private readonly MAX_HISTORY = 100; // 最大历史事件数
  private pingInterval?: NodeJS.Timeout;
  private readonly PING_INTERVAL_MS = 30000; // 30秒ping间隔
  private readonly CLIENT_TIMEOUT_MS = 60000; // 60秒客户端超时

  constructor() {
    // 启动ping定时器
    this.startPingTimer();
  }

  /**
   * 创建SSE连接
   */
  createConnection(subscriptions: string[] = []): {
    response: Response;
    clientId: string;
  } {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('创建SSE连接', {
      clientId,
      subscriptions,
      timestamp: new Date().toISOString(),
    });

    const stream = new ReadableStream({
      start: (controller) => {
        const client: SSEClient = {
          id: clientId,
          response: new Response(), // 临时响应，将被替换
          controller,
          connectedAt: new Date(),
          lastPing: new Date(),
          subscriptions: new Set(subscriptions),
        };

        this.clients.set(clientId, client);

        // 发送连接确认
        this.sendToClient(clientId, {
          type: 'system_alert',
          data: {
            severity: 'info' as const,
            message: 'SSE连接已建立',
            category: 'connection',
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });

        // 发送最近的历史事件
        this.sendHistoryToClient(clientId);

        logger.debug('SSE客户端已连接', {
          clientId,
          totalClients: this.clients.size,
        });
      },
      cancel: () => {
        this.removeClient(clientId);
      },
    });

    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

    // 更新客户端的响应对象
    const client = this.clients.get(clientId);
    if (client) {
      client.response = response;
    }

    return { response, clientId };
  }

  /**
   * 广播事件到所有订阅的客户端
   */
  broadcast(event: SSEEvent): void {
    logger.debug('广播SSE事件', {
      eventType: event.type,
      clientCount: this.clients.size,
      timestamp: event.timestamp,
    });

    // 添加到历史记录
    this.addToHistory(event);

    // 发送给所有订阅的客户端
    for (const [clientId, client] of this.clients) {
      if (
        client.subscriptions.size === 0 ||
        client.subscriptions.has(event.type)
      ) {
        this.sendToClient(clientId, event);
      }
    }
  }

  /**
   * 发送服务器状态变更事件
   */
  broadcastServerStatus(
    serverId: string,
    status: string,
    previousStatus?: string,
    error?: string,
  ): void {
    const event: ServerStatusEvent = {
      type: 'server_status',
      data: {
        serverId,
        status,
        previousStatus,
        error,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcast(event);
  }

  /**
   * 发送工具执行事件
   */
  broadcastToolExecution(
    toolName: string,
    serverId: string,
    groupId: string,
    success: boolean,
    executionTime: number,
    error?: string,
  ): void {
    const event: ToolExecutionEvent = {
      type: 'tool_execution',
      data: {
        toolName,
        serverId,
        groupId,
        success,
        executionTime,
        timestamp: new Date().toISOString(),
        error,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcast(event);
  }

  /**
   * 发送系统告警事件
   */
  broadcastSystemAlert(
    severity: 'info' | 'warning' | 'error',
    message: string,
    category: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: SystemAlertEvent = {
      type: 'system_alert',
      data: {
        severity,
        message,
        category,
        timestamp: new Date().toISOString(),
        metadata,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcast(event);
  }

  /**
   * 发送活动事件
   */
  broadcastActivity(activity: ActivityEvent['data']): void {
    const event: ActivityEvent = {
      type: 'activity',
      data: activity,
      timestamp: new Date().toISOString(),
    };

    this.broadcast(event);
  }

  /**
   * 发送健康检查事件
   */
  broadcastHealthCheck(
    status: 'healthy' | 'warning' | 'error',
    changes: Array<{
      component: string;
      previousStatus: string;
      currentStatus: string;
    }>,
  ): void {
    const event: HealthCheckEvent = {
      type: 'health_check',
      data: {
        status,
        timestamp: new Date().toISOString(),
        changes,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcast(event);
  }

  /**
   * 更新客户端订阅
   */
  updateClientSubscriptions(
    clientId: string,
    subscriptions: string[],
  ): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.subscriptions = new Set(subscriptions);

    logger.debug('更新客户端订阅', {
      clientId,
      subscriptions,
    });

    return true;
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats(): {
    totalClients: number;
    clients: Array<{
      id: string;
      connectedAt: string;
      lastPing: string;
      subscriptions: string[];
    }>;
    eventHistoryCount: number;
  } {
    return {
      totalClients: this.clients.size,
      clients: Array.from(this.clients.values()).map((client) => ({
        id: client.id,
        connectedAt: client.connectedAt.toISOString(),
        lastPing: client.lastPing.toISOString(),
        subscriptions: Array.from(client.subscriptions),
      })),
      eventHistoryCount: this.eventHistory.length,
    };
  }

  /**
   * 关闭所有连接
   */
  shutdown(): void {
    logger.info('关闭SSE事件管理器', {
      clientCount: this.clients.size,
    });

    // 停止ping定时器
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    // 关闭所有客户端连接
    for (const [clientId, client] of this.clients) {
      try {
        client.controller.close();
      } catch (error) {
        logger.warn('关闭SSE客户端连接失败', {
          clientId,
          error: (error as Error).message,
        });
      }
    }

    this.clients.clear();
    this.eventHistory = [];
  }

  /**
   * 发送事件到特定客户端
   */
  private sendToClient(clientId: string, event: SSEEvent): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(eventData));

      logger.debug('发送SSE事件到客户端', {
        clientId,
        eventType: event.type,
      });
    } catch (error) {
      logger.warn('发送SSE事件失败', {
        clientId,
        eventType: event.type,
        error: (error as Error).message,
      });

      // 移除失效的客户端
      this.removeClient(clientId);
    }
  }

  /**
   * 发送历史事件到新连接的客户端
   */
  private sendHistoryToClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // 发送最近的历史事件
    const recentEvents = this.eventHistory.slice(-10); // 最近10个事件

    for (const event of recentEvents) {
      if (
        client.subscriptions.size === 0 ||
        client.subscriptions.has(event.type)
      ) {
        this.sendToClient(clientId, event);
      }
    }

    logger.debug('发送历史事件到客户端', {
      clientId,
      eventCount: recentEvents.length,
    });
  }

  /**
   * 移除客户端
   */
  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.close();
      } catch (error) {
        // 忽略关闭错误
      }

      this.clients.delete(clientId);

      logger.debug('移除SSE客户端', {
        clientId,
        remainingClients: this.clients.size,
      });
    }
  }

  /**
   * 添加事件到历史记录
   */
  private addToHistory(event: SSEEvent): void {
    this.eventHistory.push(event);

    // 限制历史记录数量
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * 启动ping定时器
   */
  private startPingTimer(): void {
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, this.PING_INTERVAL_MS);
  }

  /**
   * 向所有客户端发送ping并清理超时连接
   */
  private pingClients(): void {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - this.CLIENT_TIMEOUT_MS);

    for (const [clientId, client] of this.clients) {
      // 检查客户端是否超时
      if (client.lastPing < timeoutThreshold) {
        logger.warn('SSE客户端超时，移除连接', {
          clientId,
          lastPing: client.lastPing.toISOString(),
        });
        this.removeClient(clientId);
        continue;
      }

      // 发送ping
      try {
        const pingData = `data: ${JSON.stringify({
          type: 'ping',
          timestamp: now.toISOString(),
        })}\n\n`;

        client.controller.enqueue(new TextEncoder().encode(pingData));
        client.lastPing = now;
      } catch (error) {
        logger.warn('发送ping失败，移除客户端', {
          clientId,
          error: (error as Error).message,
        });
        this.removeClient(clientId);
      }
    }

    logger.debug('SSE客户端ping完成', {
      activeClients: this.clients.size,
    });
  }
}
