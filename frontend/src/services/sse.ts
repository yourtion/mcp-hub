// SSE (Server-Sent Events) 服务

import type {
  HealthCheckEvent,
  ServerStatusEvent,
  SSEEvent,
  SystemAlertEvent,
  ToolExecutionEvent,
} from '@/types/dashboard';

export type SSEEventType =
  | 'server_status'
  | 'tool_execution'
  | 'system_alert'
  | 'health_check';

export type SSEEventHandler<T = unknown> = (event: T) => void;

export class SSEService {
  private eventSource: EventSource | null = null;
  private handlers: Map<SSEEventType, Set<SSEEventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1秒
  private isConnecting = false;
  private subscriptions: string[] = [];

  constructor() {
    // 初始化事件处理器映射
    this.handlers.set('server_status', new Set());
    this.handlers.set('tool_execution', new Set());
    this.handlers.set('system_alert', new Set());
    this.handlers.set('health_check', new Set());
  }

  /**
   * 连接到SSE端点
   */
  connect(subscriptions: SSEEventType[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        this.eventSource &&
        this.eventSource.readyState === EventSource.OPEN
      ) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('已在连接中'));
        return;
      }

      this.isConnecting = true;
      this.subscriptions = subscriptions;

      try {
        // 构建URL参数
        const params = new URLSearchParams();
        if (subscriptions.length > 0) {
          params.append('subscriptions', subscriptions.join(','));
        }

        const url = `/api/dashboard/events${params.toString() ? `?${params.toString()}` : ''}`;

        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          console.log('SSE连接已建立');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data: SSEEvent = JSON.parse(event.data);
            this.handleEvent(data);
          } catch (error) {
            console.error('解析SSE事件数据失败:', error);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('SSE连接错误:', error);
          this.isConnecting = false;

          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.attemptReconnect();
          }

          reject(error);
        };

        // 监听特定事件类型
        subscriptions.forEach((eventType) => {
          this.eventSource?.addEventListener(eventType, (event) => {
            try {
              const data = JSON.parse((event as MessageEvent).data);
              this.handleTypedEvent(eventType, data);
            } catch (error) {
              console.error(`解析${eventType}事件数据失败:`, error);
            }
          });
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开SSE连接
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    console.log('SSE连接已断开');
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): 'connecting' | 'open' | 'closed' {
    if (this.isConnecting) return 'connecting';
    if (!this.eventSource) return 'closed';

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting';
      case EventSource.OPEN:
        return 'open';
      case EventSource.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener<T = unknown>(
    eventType: SSEEventType,
    handler: SSEEventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.add(handler as SSEEventHandler);
    }
  }

  /**
   * 移除事件监听器
   */
  removeEventListener<T = unknown>(
    eventType: SSEEventType,
    handler: SSEEventHandler<T>,
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as SSEEventHandler);
    }
  }

  /**
   * 移除所有事件监听器
   */
  removeAllEventListeners(eventType?: SSEEventType): void {
    if (eventType) {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.clear();
      }
    } else {
      this.handlers.forEach((handlers) => handlers.clear());
    }
  }

  /**
   * 处理通用SSE事件
   */
  private handleEvent(event: SSEEvent): void {
    console.log('收到SSE事件:', event);

    // 根据事件类型分发到对应的处理器
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`处理${event.type}事件时发生错误:`, error);
        }
      });
    }
  }

  /**
   * 处理特定类型的事件
   */
  private handleTypedEvent(eventType: SSEEventType, data: unknown): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`处理${eventType}事件时发生错误:`, error);
        }
      });
    }
  }

  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('SSE重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1); // 指数退避

    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次SSE重连`);

    setTimeout(() => {
      this.connect(this.subscriptions as SSEEventType[])
        .then(() => {
          console.log('SSE重连成功');
        })
        .catch((error) => {
          console.error('SSE重连失败:', error);
        });
    }, delay);
  }

  /**
   * 添加服务器状态事件监听器
   */
  onServerStatus(handler: SSEEventHandler<ServerStatusEvent['data']>): void {
    this.addEventListener('server_status', handler);
  }

  /**
   * 添加工具执行事件监听器
   */
  onToolExecution(handler: SSEEventHandler<ToolExecutionEvent['data']>): void {
    this.addEventListener('tool_execution', handler);
  }

  /**
   * 添加系统告警事件监听器
   */
  onSystemAlert(handler: SSEEventHandler<SystemAlertEvent['data']>): void {
    this.addEventListener('system_alert', handler);
  }

  /**
   * 添加健康检查事件监听器
   */
  onHealthCheck(handler: SSEEventHandler<HealthCheckEvent['data']>): void {
    this.addEventListener('health_check', handler);
  }
}

// 创建全局SSE服务实例
export const sseService = new SSEService();
