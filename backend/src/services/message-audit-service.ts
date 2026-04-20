import { logger } from '../utils/logger.js';

/**
 * MCP 消息审计服务
 *
 * 跟踪 MCP 协议消息，提供查询和性能统计能力。
 * 保留最近 500 条消息，防止内存泄漏。
 */
export class MessageAuditService {
  private messages: Array<{
    id: string;
    timestamp: string;
    serverId: string;
    type: 'request' | 'response' | 'notification';
    method: string;
    content: unknown;
  }> = [];

  private readonly MAX_MESSAGES = 500;

  /**
   * 记录一条 MCP 消息
   */
  addMessage(
    serverId: string,
    type: 'request' | 'response' | 'notification',
    method: string,
    content: unknown,
  ): void {
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      serverId,
      type,
      method,
      content,
    };

    this.messages.unshift(message);

    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(0, this.MAX_MESSAGES);
    }

    logger.debug('MCP message tracked', {
      serverId,
      type,
      method,
      messageId: message.id,
    });
  }

  /**
   * 查询消息，支持过滤
   */
  getMessages(
    limit = 50,
    serverId?: string,
    type?: 'request' | 'response' | 'notification',
  ): Array<{
    id: string;
    timestamp: string;
    serverId: string;
    type: 'request' | 'response' | 'notification';
    method: string;
    content: unknown;
  }> {
    let filtered = this.messages;

    if (serverId) {
      filtered = filtered.filter((msg) => msg.serverId === serverId);
    }

    if (type) {
      filtered = filtered.filter((msg) => msg.type === type);
    }

    return filtered.slice(0, Math.min(limit, filtered.length));
  }

  /**
   * 清除所有消息
   */
  clearMessages(): void {
    this.messages = [];
    logger.info('MCP message tracking cleared');
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topTools: Array<{ name: string; calls: number; avgTime: number }>;
  } {
    return {
      totalRequests: this.messages.filter((msg) => msg.type === 'request')
        .length,
      averageResponseTime: 0,
      errorRate: 0,
      topTools: [],
    };
  }
}
