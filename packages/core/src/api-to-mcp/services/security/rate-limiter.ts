/**
 * 频率限制器
 * 控制API调用频率
 */

/**
 * 频率限制记录
 */
interface RateLimitRecord {
  /** 请求次数 */
  count: number;
  /** 窗口开始时间 */
  windowStart: Date;
  /** 最后请求时间 */
  lastRequest: Date;
}

/**
 * 频率限制器接口
 */
export interface RateLimiter {
  /**
   * 检查是否超过频率限制
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  checkLimit(toolId: string, clientId?: string): Promise<boolean>;

  /**
   * 记录API调用
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  recordCall(toolId: string, clientId?: string): Promise<void>;

  /**
   * 重置计数器
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  resetCounter(toolId: string, clientId?: string): Promise<void>;

  /**
   * 获取剩余请求次数
   * @param toolId 工具ID
   * @param clientId 客户端ID（可选）
   */
  getRemainingRequests(toolId: string, clientId?: string): Promise<number>;
}

/**
 * 频率限制器实现类
 */
export class RateLimiterImpl implements RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private windowSeconds: number;
  private maxRequests: number;

  constructor(windowSeconds = 60, maxRequests = 100) {
    this.windowSeconds = windowSeconds;
    this.maxRequests = maxRequests;
  }

  async checkLimit(toolId: string, clientId?: string): Promise<boolean> {
    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);

    if (!record) {
      return true; // 没有记录，允许请求
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - this.windowSeconds * 1000);

    // 如果记录的窗口已过期，重置计数
    if (record.windowStart < windowStart) {
      record.count = 0;
      record.windowStart = now;
    }

    return record.count < this.maxRequests;
  }

  async recordCall(toolId: string, clientId?: string): Promise<void> {
    const key = this.generateKey(toolId, clientId);
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.windowSeconds * 1000);

    let record = this.records.get(key);
    if (!record) {
      record = {
        count: 0,
        windowStart: now,
        lastRequest: now,
      };
      this.records.set(key, record);
    }

    // 如果窗口已过期，重置计数
    if (record.windowStart < windowStart) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count++;
    record.lastRequest = now;
  }

  async resetCounter(toolId: string, clientId?: string): Promise<void> {
    const key = this.generateKey(toolId, clientId);
    this.records.delete(key);
  }

  async getRemainingRequests(
    toolId: string,
    clientId?: string,
  ): Promise<number> {
    const key = this.generateKey(toolId, clientId);
    const record = this.records.get(key);

    if (!record) {
      return this.maxRequests;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - this.windowSeconds * 1000);

    // 如果窗口已过期，返回最大请求数
    if (record.windowStart < windowStart) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - record.count);
  }

  private generateKey(toolId: string, clientId?: string): string {
    return clientId ? `${toolId}:${clientId}` : toolId;
  }
}
