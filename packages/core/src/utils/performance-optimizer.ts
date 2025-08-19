/**
 * 性能优化器
 * 提供启动时间优化、响应时间优化和资源使用优化
 */

import { EventEmitter } from 'node:events';
import { createLogger } from '@mcp-core/mcp-hub-share';

/**
 * 性能优化配置
 */
export interface PerformanceOptimizerConfig {
  // 启动优化
  enableLazyLoading: boolean;
  enableParallelInitialization: boolean;
  enableConnectionPooling: boolean;

  // 响应优化
  enableCaching: boolean;
  cacheMaxSize: number;
  cacheTtl: number;

  // 资源优化
  enableMemoryOptimization: boolean;
  enableGarbageCollection: boolean;
  gcInterval: number;

  // 连接优化
  maxConcurrentConnections: number;
  connectionTimeout: number;
  keepAliveTimeout: number;
}

/**
 * 默认性能优化配置
 */
export const DEFAULT_OPTIMIZER_CONFIG: PerformanceOptimizerConfig = {
  enableLazyLoading: true,
  enableParallelInitialization: true,
  enableConnectionPooling: true,
  enableCaching: true,
  cacheMaxSize: 1000,
  cacheTtl: 300000, // 5分钟
  enableMemoryOptimization: true,
  enableGarbageCollection: true,
  gcInterval: 60000, // 1分钟
  maxConcurrentConnections: 10,
  connectionTimeout: 5000,
  keepAliveTimeout: 30000,
};

/**
 * 缓存项
 */
interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * 连接池统计
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  averageWaitTime: number;
}

/**
 * 性能优化器
 */
export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceOptimizerConfig;
  private logger = createLogger({ component: 'PerformanceOptimizer' });

  // 缓存系统
  private cache = new Map<string, CacheItem<any>>();
  private cacheCleanupTimer?: NodeJS.Timeout;

  // 连接池
  private connectionPool = new Map<string, any[]>();
  private connectionStats = new Map<
    string,
    { created: number; used: number; errors: number }
  >();

  // 垃圾回收
  private gcTimer?: NodeJS.Timeout;

  // 性能指标
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    connectionReuses: 0,
    connectionCreations: 0,
    gcRuns: 0,
    memoryFreed: 0,
  };

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };
    this.initialize();
  }

  /**
   * 初始化性能优化器
   */
  private initialize(): void {
    this.logger.info('初始化性能优化器', {
      context: { config: this.config },
    });

    // 启动缓存清理定时器
    if (this.config.enableCaching) {
      this.startCacheCleanup();
    }

    // 启动垃圾回收定时器
    if (this.config.enableGarbageCollection) {
      this.startGarbageCollection();
    }

    this.emit('initialized');
  }

  /**
   * 优化启动时间 - 延迟加载模块
   */
  async optimizeStartupTime<T>(
    moduleLoader: () => Promise<T>,
    moduleName: string,
  ): Promise<T> {
    if (!this.config.enableLazyLoading) {
      return moduleLoader();
    }

    const startTime = Date.now();
    this.logger.debug('延迟加载模块', { context: { moduleName } });

    try {
      const module = await moduleLoader();
      const loadTime = Date.now() - startTime;

      this.logger.debug('模块加载完成', {
        context: {
          moduleName,
          loadTimeMs: loadTime,
        },
      });

      this.emit('moduleLoaded', { moduleName, loadTime });
      return module;
    } catch (error) {
      this.logger.error('模块加载失败', error as Error, {
        context: { moduleName },
      });
      throw error;
    }
  }

  /**
   * 优化并行初始化
   */
  async optimizeParallelInitialization<T>(
    tasks: Array<() => Promise<T>>,
    taskNames: string[],
  ): Promise<T[]> {
    if (!this.config.enableParallelInitialization) {
      // 串行执行
      const results: T[] = [];
      for (let i = 0; i < tasks.length; i++) {
        results.push(await tasks[i]());
      }
      return results;
    }

    const startTime = Date.now();
    this.logger.info('开始并行初始化', {
      context: {
        taskCount: tasks.length,
        taskNames,
      },
    });

    try {
      const results = await Promise.all(tasks.map((task) => task()));
      const totalTime = Date.now() - startTime;

      this.logger.info('并行初始化完成', {
        context: {
          taskCount: tasks.length,
          totalTimeMs: totalTime,
          averageTimeMs: totalTime / tasks.length,
        },
      });

      this.emit('parallelInitializationCompleted', {
        taskCount: tasks.length,
        totalTime,
      });

      return results;
    } catch (error) {
      this.logger.error('并行初始化失败', error as Error, {
        context: {
          taskCount: tasks.length,
          taskNames,
        },
      });
      throw error;
    }
  }

  /**
   * 缓存优化 - 获取缓存值
   */
  getCached<T>(key: string): T | undefined {
    if (!this.config.enableCaching) {
      return undefined;
    }

    const item = this.cache.get(key);
    if (!item) {
      this.metrics.cacheMisses++;
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return undefined;
    }

    // 更新访问统计
    item.accessCount++;
    item.lastAccessed = Date.now();
    this.metrics.cacheHits++;

    return item.value;
  }

  /**
   * 缓存优化 - 设置缓存值
   */
  setCached<T>(key: string, value: T, ttl?: number): void {
    if (!this.config.enableCaching) {
      return;
    }

    // 检查缓存大小限制
    if (this.cache.size >= this.config.cacheMaxSize) {
      this.evictLeastRecentlyUsed();
    }

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTtl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, item);
  }

  /**
   * 缓存优化 - 清除缓存
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.cache) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }

    this.emit('cacheCleared', { pattern });
  }

  /**
   * 连接池优化 - 获取连接
   */
  async getPooledConnection(
    poolName: string,
    connectionFactory: () => Promise<any>,
  ): Promise<any> {
    if (!this.config.enableConnectionPooling) {
      return connectionFactory();
    }

    const pool = this.connectionPool.get(poolName) || [];

    // 尝试从池中获取空闲连接
    const connection = pool.pop();
    if (connection) {
      this.metrics.connectionReuses++;
      this.updateConnectionStats(poolName, 'used');
      return connection;
    }

    // 创建新连接
    try {
      const newConnection = await connectionFactory();
      this.metrics.connectionCreations++;
      this.updateConnectionStats(poolName, 'created');
      return newConnection;
    } catch (error) {
      this.updateConnectionStats(poolName, 'errors');
      throw error;
    }
  }

  /**
   * 连接池优化 - 归还连接
   */
  returnPooledConnection(poolName: string, connection: any): void {
    if (!this.config.enableConnectionPooling) {
      return;
    }

    const pool = this.connectionPool.get(poolName) || [];

    // 检查池大小限制
    if (pool.length < this.config.maxConcurrentConnections) {
      pool.push(connection);
      this.connectionPool.set(poolName, pool);
    } else {
      // 池已满，关闭连接
      if (connection && typeof connection.close === 'function') {
        connection.close().catch((error: Error) => {
          this.logger.error('关闭多余连接失败', error);
        });
      }
    }
  }

  /**
   * 获取连接池统计
   */
  getConnectionPoolStats(poolName: string): ConnectionPoolStats {
    const pool = this.connectionPool.get(poolName) || [];
    const stats = this.connectionStats.get(poolName) || {
      created: 0,
      used: 0,
      errors: 0,
    };

    return {
      totalConnections: stats.created,
      activeConnections: stats.used,
      idleConnections: pool.length,
      pendingRequests: 0, // 简化实现
      averageWaitTime: 0, // 简化实现
    };
  }

  /**
   * 内存优化 - 手动垃圾回收
   */
  optimizeMemory(): void {
    if (!this.config.enableMemoryOptimization) {
      return;
    }

    const beforeMemory = process.memoryUsage();

    // 清理过期缓存
    this.cleanupExpiredCache();

    // 清理空闲连接
    this.cleanupIdleConnections();

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      this.metrics.gcRuns++;
    }

    const afterMemory = process.memoryUsage();
    const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
    this.metrics.memoryFreed += Math.max(0, memoryFreed);

    this.logger.debug('内存优化完成', {
      context: {
        beforeHeapUsed: beforeMemory.heapUsed,
        afterHeapUsed: afterMemory.heapUsed,
        memoryFreed,
      },
    });

    this.emit('memoryOptimized', {
      memoryFreed,
      beforeMemory,
      afterMemory,
    });
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate:
        this.metrics.cacheHits /
          (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      connectionPools: Array.from(this.connectionPool.keys()).map(
        (poolName) => ({
          name: poolName,
          stats: this.getConnectionPoolStats(poolName),
        }),
      ),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 重新初始化定时器
    this.stopTimers();
    this.initialize();

    this.emit('configUpdated', this.config);
  }

  /**
   * 关闭性能优化器
   */
  shutdown(): void {
    this.logger.info('关闭性能优化器');

    this.stopTimers();
    this.clearCache();
    this.clearConnectionPools();

    this.emit('shutdown');
  }

  // 私有方法

  /**
   * 启动缓存清理定时器
   */
  private startCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.config.cacheTtl / 10); // 每10%TTL清理一次
  }

  /**
   * 启动垃圾回收定时器
   */
  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      this.optimizeMemory();
    }, this.config.gcInterval);
  }

  /**
   * 停止所有定时器
   */
  private stopTimers(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = undefined;
    }

    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('清理过期缓存', { context: { cleanedCount } });
      this.emit('cacheCleanup', { cleanedCount });
    }
  }

  /**
   * 驱逐最少使用的缓存项
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | undefined;
    let lruTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.lastAccessed < lruTime) {
        lruTime = item.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.logger.debug('驱逐LRU缓存项', { context: { key: lruKey } });
    }
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    for (const [poolName, pool] of this.connectionPool) {
      // 保留一半连接，关闭其余的
      const keepCount = Math.ceil(pool.length / 2);
      const toClose = pool.splice(keepCount);

      for (const connection of toClose) {
        if (connection && typeof connection.close === 'function') {
          connection.close().catch((error: Error) => {
            this.logger.error('关闭空闲连接失败', error, {
              context: { poolName },
            });
          });
        }
      }

      if (toClose.length > 0) {
        this.logger.debug('清理空闲连接', {
          context: {
            poolName,
            closedCount: toClose.length,
            remainingCount: pool.length,
          },
        });
      }
    }
  }

  /**
   * 清理所有连接池
   */
  private clearConnectionPools(): void {
    for (const [poolName, pool] of this.connectionPool) {
      for (const connection of pool) {
        if (connection && typeof connection.close === 'function') {
          connection.close().catch((error: Error) => {
            this.logger.error('关闭连接失败', error, { context: { poolName } });
          });
        }
      }
    }

    this.connectionPool.clear();
    this.connectionStats.clear();
  }

  /**
   * 更新连接统计
   */
  private updateConnectionStats(
    poolName: string,
    type: 'created' | 'used' | 'errors',
  ): void {
    const stats = this.connectionStats.get(poolName) || {
      created: 0,
      used: 0,
      errors: 0,
    };
    stats[type]++;
    this.connectionStats.set(poolName, stats);
  }
}

/**
 * 创建性能优化器实例
 */
export function createPerformanceOptimizer(
  config?: Partial<PerformanceOptimizerConfig>,
): PerformanceOptimizer {
  return new PerformanceOptimizer(config);
}

/**
 * 默认性能优化器实例（延迟初始化）
 */
let _performanceOptimizer: PerformanceOptimizer | null = null;

export const performanceOptimizer = new Proxy({} as PerformanceOptimizer, {
  get(_target, prop) {
    if (!_performanceOptimizer) {
      _performanceOptimizer = createPerformanceOptimizer({
        enableLazyLoading: process.env.ENABLE_LAZY_LOADING !== 'false',
        enableParallelInitialization:
          process.env.ENABLE_PARALLEL_INIT !== 'false',
        enableConnectionPooling:
          process.env.ENABLE_CONNECTION_POOLING !== 'false',
        enableCaching: process.env.ENABLE_CACHING !== 'false',
      });
    }
    return _performanceOptimizer[prop as keyof PerformanceOptimizer];
  },
});
