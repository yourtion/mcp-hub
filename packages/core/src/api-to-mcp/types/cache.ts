/**
 * 缓存系统相关的类型定义
 */

/**
 * 缓存策略
 */
export interface CacheStrategy {
  /** 策略名称 */
  name: string;
  /** 是否应该缓存 */
  shouldCache: (key: string, value: any) => boolean;
  /** 获取TTL */
  getTtl: (key: string, value: any) => number;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value: any;
  /** 创建时间 */
  createdAt: Date;
  /** 过期时间 */
  expiresAt: Date;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: Date;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 总请求次数 */
  totalRequests: number;
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 当前缓存条目数 */
  currentSize: number;
  /** 最大缓存大小 */
  maxSize: number;
}
