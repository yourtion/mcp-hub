/**
 * 缓存管理器
 * 提供多级缓存支持
 */

import type { CacheEntry, CacheStats, CacheStrategy } from '../types/cache.js';

/**
 * 缓存管理器接口
 */
export interface CacheManager {
  /**
   * 获取缓存
   * @param key 缓存键
   */
  get(key: string): Promise<any | null>;

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（秒）
   */
  set(key: string, value: any, ttl?: number): Promise<void>;

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): Promise<void>;

  /**
   * 清空缓存
   */
  clear(): Promise<void>;

  /**
   * 生成缓存键
   * @param toolId 工具ID
   * @param parameters 参数
   */
  generateCacheKey(toolId: string, parameters: any): string;

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats;
}

/**
 * 缓存管理器实现类
 */
export class CacheManagerImpl implements CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    currentSize: 0,
    maxSize: 1000,
  };

  async get(key: string): Promise<any | null> {
    this.stats.totalRequests++;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // 检查是否过期
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessedAt = new Date();

    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }

  async set(key: string, value: any, ttl = 300): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const entry: CacheEntry = {
      key,
      value,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      lastAccessedAt: now,
    };

    this.cache.set(key, entry);
    this.stats.currentSize = this.cache.size;

    // 如果超过最大大小，清理最旧的条目
    if (this.cache.size > this.stats.maxSize) {
      this.evictOldest();
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.stats.currentSize = this.cache.size;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.currentSize = 0;
  }

  generateCacheKey(toolId: string, parameters: any): string {
    // TODO: 实现更复杂的缓存键生成逻辑
    const paramStr = JSON.stringify(parameters);
    return `${toolId}:${Buffer.from(paramStr).toString('base64')}`;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    this.stats.hitRate =
      this.stats.totalRequests > 0
        ? this.stats.hits / this.stats.totalRequests
        : 0;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.currentSize = this.cache.size;
    }
  }
}
