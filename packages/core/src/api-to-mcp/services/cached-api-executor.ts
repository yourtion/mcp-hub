/**
 * 带缓存功能的API执行器
 * 在原有API执行器基础上添加缓存支持，提供缓存命中率统计和动态配置
 */

import { createLogger } from '../../utils/logger.js';
import type { ApiToolConfig, AuthConfig } from '../types/api-config.js';
import type { CacheStats } from '../types/cache.js';
import type { ApiResponse, HttpRequestConfig } from '../types/http-client.js';
import type { ApiExecutor } from './api-executor.js';
import type { CacheKeyManager } from './cache-key-manager.js';
import type { CacheManager } from './cache-manager.js';

const logger = createLogger({ component: 'CachedApiExecutor' });

/**
 * 缓存配置接口
 */
export interface CacheExecutorConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 默认TTL（秒） */
  defaultTtl: number;
  /** 是否缓存错误响应 */
  cacheErrors: boolean;
  /** 错误响应的TTL（秒） */
  errorTtl: number;
  /** 是否启用缓存日志 */
  enableCacheLogging: boolean;
  /** 缓存键前缀 */
  keyPrefix?: string;
}

/**
 * 缓存统计信息扩展
 */
export interface CacheExecutorStats extends CacheStats {
  /** API调用总数 */
  totalApiCalls: number;
  /** 缓存的API调用数 */
  cachedApiCalls: number;
  /** 缓存节省的时间（毫秒） */
  timeSaved: number;
  /** 平均API调用时间（毫秒） */
  averageApiTime: number;
  /** 平均缓存命中时间（毫秒） */
  averageCacheTime: number;
}

/**
 * 缓存决策结果
 */
interface CacheDecision {
  /** 是否应该缓存 */
  shouldCache: boolean;
  /** 缓存TTL */
  ttl: number;
  /** 决策原因 */
  reason: string;
}

/**
 * 带缓存功能的API执行器
 */
export class CachedApiExecutor implements ApiExecutor {
  private readonly baseExecutor: ApiExecutor;
  private readonly cacheManager: CacheManager;
  private readonly keyManager: CacheKeyManager;
  private readonly config: CacheExecutorConfig;

  // 统计信息
  private stats: CacheExecutorStats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    currentSize: 0,
    maxSize: 0,
    totalApiCalls: 0,
    cachedApiCalls: 0,
    timeSaved: 0,
    averageApiTime: 0,
    averageCacheTime: 0,
  };

  // 性能监控
  private apiTimes: number[] = [];
  private cacheTimes: number[] = [];

  constructor(
    baseExecutor: ApiExecutor,
    cacheManager: CacheManager,
    keyManager: CacheKeyManager,
    config: Partial<CacheExecutorConfig> = {},
  ) {
    this.baseExecutor = baseExecutor;
    this.cacheManager = cacheManager;
    this.keyManager = keyManager;
    this.config = {
      enabled: true,
      defaultTtl: 300, // 5分钟
      cacheErrors: false,
      errorTtl: 60, // 1分钟
      enableCacheLogging: true,
      ...config,
    };

    logger.info('带缓存的API执行器初始化完成');
  }

  /**
   * 执行API调用（带缓存支持）
   */
  async executeApiCall(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const startTime = Date.now();
    this.stats.totalApiCalls++;

    // 如果缓存未启用，直接调用基础执行器
    if (!this.config.enabled) {
      return this.executeWithoutCache(config, parameters, startTime);
    }

    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(config, parameters);

      // 尝试从缓存获取
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        const cacheTime = Date.now() - startTime;
        this.recordCacheHit(cacheTime);

        if (this.config.enableCacheLogging) {
          logger.debug(`缓存命中: ${config.id}`);
        }

        return cachedResponse;
      }

      // 缓存未命中，执行API调用
      const response = await this.executeWithoutCache(
        config,
        parameters,
        startTime,
      );

      // 决定是否缓存响应
      const cacheDecision = this.shouldCacheResponse(config, response);
      if (cacheDecision.shouldCache) {
        await this.cacheResponse(cacheKey, response, cacheDecision.ttl);

        if (this.config.enableCacheLogging) {
          logger.debug(`响应已缓存: ${config.id}`);
        }
      }

      return response;
    } catch (error) {
      logger.error(
        `缓存API执行失败: ${config.id}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      // 发生错误时，尝试直接调用基础执行器
      return this.executeWithoutCache(config, parameters, startTime);
    }
  }

  /**
   * 构建HTTP请求（委托给基础执行器）
   */
  buildHttpRequest(config: ApiToolConfig, parameters: Record<string, unknown>) {
    return this.baseExecutor.buildHttpRequest(config, parameters);
  }

  /**
   * 应用认证（委托给基础执行器）
   */
  applyAuthentication(request: HttpRequestConfig, authConfig: AuthConfig) {
    return this.baseExecutor.applyAuthentication(request, authConfig);
  }

  /**
   * 处理超时和重试（委托给基础执行器）
   */
  async handleTimeoutAndRetry(request: HttpRequestConfig) {
    return this.baseExecutor.handleTimeoutAndRetry(request);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheExecutorStats {
    const cacheStats = this.cacheManager.getStats();

    return {
      ...cacheStats,
      totalApiCalls: this.stats.totalApiCalls,
      cachedApiCalls: this.stats.cachedApiCalls,
      timeSaved: this.stats.timeSaved,
      averageApiTime: this.calculateAverage(this.apiTimes),
      averageCacheTime: this.calculateAverage(this.cacheTimes),
    };
  }

  /**
   * 清除特定工具的缓存
   */
  async clearToolCache(toolId: string): Promise<number> {
    try {
      const pattern = this.keyManager.generateToolKeyPattern(toolId);
      const clearedCount = 0;

      // 注意：这是一个简化实现，实际应用中可能需要更高效的方式
      // 例如使用Redis的SCAN命令或维护键的索引
      logger.warn(
        `清除工具缓存: ${toolId} (模式: ${pattern}) - 需要实现具体的清理逻辑`,
      );

      return clearedCount;
    } catch (error) {
      logger.error(
        `清除工具缓存失败: ${toolId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    await this.cacheManager.clear();
    this.resetStats();
    logger.info('所有缓存已清除');
  }

  /**
   * 预热缓存
   */
  async warmupCache(
    config: ApiToolConfig,
    parametersList: Record<string, unknown>[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    logger.info(
      `开始预热缓存: ${config.id}, ${parametersList.length} 个参数组合`,
    );

    for (const parameters of parametersList) {
      try {
        const response = await this.executeApiCall(config, parameters);
        if (response.success) {
          success++;
        } else {
          failed++;
          logger.warn(`预热缓存失败: API返回错误`);
        }
      } catch (error) {
        failed++;
        logger.warn(
          `预热缓存失败`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    logger.info(
      `缓存预热完成: ${config.id}, 成功: ${success}, 失败: ${failed}`,
    );
    return { success, failed };
  }

  /**
   * 动态调整缓存配置
   */
  updateConfig(newConfig: Partial<CacheExecutorConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info('缓存配置已更新');
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
  ): string {
    const baseKey = this.keyManager.generateKey(config.id, parameters);
    return this.config.keyPrefix
      ? `${this.config.keyPrefix}:${baseKey}`
      : baseKey;
  }

  /**
   * 从缓存获取响应
   */
  private async getCachedResponse(
    cacheKey: string,
  ): Promise<ApiResponse | null> {
    const startTime = Date.now();

    try {
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        const cacheTime = Date.now() - startTime;
        this.cacheTimes.push(cacheTime);
        return cached as ApiResponse;
      }

      return null;
    } catch (error) {
      logger.error(
        '从缓存获取响应失败',
        error instanceof Error ? error : new Error(String(error)),
      );
      return null;
    }
  }

  /**
   * 缓存响应
   */
  private async cacheResponse(
    cacheKey: string,
    response: ApiResponse,
    ttl: number,
  ): Promise<void> {
    try {
      await this.cacheManager.set(cacheKey, response, ttl);
    } catch (error) {
      logger.error(
        '缓存响应失败',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * 决定是否缓存响应
   */
  private shouldCacheResponse(
    config: ApiToolConfig,
    response: ApiResponse,
  ): CacheDecision {
    // 检查工具级别的缓存配置
    if (config.cache && !config.cache.enabled) {
      return {
        shouldCache: false,
        ttl: 0,
        reason: '工具配置禁用缓存',
      };
    }

    // 检查是否是错误响应
    if (!response.success) {
      if (!this.config.cacheErrors) {
        return {
          shouldCache: false,
          ttl: 0,
          reason: '错误响应且未启用错误缓存',
        };
      }

      return {
        shouldCache: true,
        ttl: this.config.errorTtl,
        reason: '错误响应缓存',
      };
    }

    // 使用工具配置的TTL或默认TTL
    const ttl = config.cache?.ttl || this.config.defaultTtl;

    return {
      shouldCache: true,
      ttl,
      reason: '成功响应缓存',
    };
  }

  /**
   * 执行API调用（不使用缓存）
   */
  private async executeWithoutCache(
    config: ApiToolConfig,
    parameters: Record<string, unknown>,
    startTime: number,
  ): Promise<ApiResponse> {
    const response = await this.baseExecutor.executeApiCall(config, parameters);

    const apiTime = Date.now() - startTime;
    this.apiTimes.push(apiTime);
    this.recordCacheMiss();

    return response;
  }

  /**
   * 记录缓存命中
   */
  private recordCacheHit(cacheTime: number): void {
    this.stats.cachedApiCalls++;

    // 估算节省的时间（使用平均API时间）
    const avgApiTime = this.calculateAverage(this.apiTimes);
    if (avgApiTime > 0) {
      this.stats.timeSaved += Math.max(0, avgApiTime - cacheTime);
    }
  }

  /**
   * 记录缓存未命中
   */
  private recordCacheMiss(): void {
    // 缓存未命中时不需要特殊处理，统计信息会在cacheManager中更新
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;

    // 只保留最近的1000个值以避免内存泄漏
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      currentSize: 0,
      maxSize: 0,
      totalApiCalls: 0,
      cachedApiCalls: 0,
      timeSaved: 0,
      averageApiTime: 0,
      averageCacheTime: 0,
    };

    this.apiTimes = [];
    this.cacheTimes = [];
  }
}

/**
 * 创建带缓存的API执行器
 */
export function createCachedApiExecutor(
  baseExecutor: ApiExecutor,
  cacheManager: CacheManager,
  keyManager: CacheKeyManager,
  config?: Partial<CacheExecutorConfig>,
): CachedApiExecutor {
  return new CachedApiExecutor(baseExecutor, cacheManager, keyManager, config);
}
