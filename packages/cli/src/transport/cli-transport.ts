/**
 * CLI传输层实现
 * 封装MCP SDK的StdioServerTransport，提供额外的CLI特定功能
 */

import { createCliLogger } from '@mcp-core/mcp-hub-share';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * CLI传输层类
 * 提供stdio传输的封装和CLI特定的功能
 */
export class CliTransport {
  private transport: StdioServerTransport | null = null;
  private isInitialized = false;
  private logger = createCliLogger({ component: 'Transport' });
  private isStarted = false;
  private messageCount = 0;

  // 事件处理器
  public onMessage?: (message: JSONRPCMessage) => void;
  public onError?: (error: Error) => void;
  public onClose?: () => void;

  /**
   * 初始化传输层
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('CLI传输层已初始化');
      return;
    }

    this.logger.debug('初始化CLI传输层');

    try {
      // 创建stdio传输层
      this.transport = new StdioServerTransport();

      // 设置事件处理器
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.debug('CLI传输层初始化完成');
    } catch (error) {
      this.logger.error('CLI传输层初始化失败', error as Error);
      throw error;
    }
  }

  /**
   * 启动传输层监听
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('传输层必须先初始化');
    }

    if (this.isStarted) {
      this.logger.warn('CLI传输层已启动');
      return;
    }

    this.logger.debug('启动CLI传输层');

    try {
      if (!this.transport) {
        throw new Error('传输层未初始化');
      }

      await this.transport.start();

      this.isStarted = true;
      this.logger.debug('CLI传输层启动成功');
    } catch (error) {
      this.logger.error('CLI传输层启动失败', error as Error);
      throw error;
    }
  }

  /**
   * 关闭传输层
   */
  async shutdown(): Promise<void> {
    this.logger.debug('关闭CLI传输层');

    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      this.isInitialized = false;
      this.isStarted = false;

      this.logger.debug('CLI传输层关闭完成');
    } catch (error) {
      this.logger.error('CLI传输层关闭时出错', error as Error);
      throw error;
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(message: JSONRPCMessage): Promise<void> {
    if (!this.transport) {
      throw new Error('传输层未初始化');
    }

    if (!this.isStarted) {
      throw new Error('传输层未启动');
    }

    try {
      await this.transport.send(message);
      this.logger.debug('消息发送成功', {
        context: {
          messageId: 'id' in message ? message.id : 'unknown',
        },
      });
    } catch (error) {
      this.logger.error('消息发送失败', error as Error, {
        context: {
          messageId: 'id' in message ? message.id : 'unknown',
        },
      });
      throw error;
    }
  }

  /**
   * 获取底层传输层实例
   */
  getTransport(): StdioServerTransport | null {
    return this.transport;
  }

  /**
   * 获取传输层状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      started: this.isStarted,
      messageCount: this.messageCount,
      hasTransport: this.transport !== null,
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.transport) {
      return;
    }

    // 消息处理
    this.transport.onmessage = (message: JSONRPCMessage) => {
      this.messageCount++;
      this.logger.debug('收到消息', {
        messageId: 'id' in message ? message.id : 'unknown',
        method: 'method' in message ? message.method : 'response',
        totalMessages: this.messageCount,
      });

      if (this.onMessage) {
        this.onMessage(message);
      }
    };

    // 错误处理
    this.transport.onerror = (error: Error) => {
      this.logger.error('传输层错误', error);

      if (this.onError) {
        this.onError(error);
      }
    };

    // 关闭处理
    this.transport.onclose = () => {
      this.logger.debug('传输层连接关闭');
      this.isStarted = false;

      if (this.onClose) {
        this.onClose();
      }
    };
  }
}
