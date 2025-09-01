/**
 * 缓存键生成和管理器
 * 提供灵活的缓存键生成策略和批量管理功能
 */

import crypto from 'node:crypto';
import { logger } from '../../utils/logger.js';
import type { CacheKeyGenerator } from '../types/api-config.js';

/**
 * 缓存键策略接口
 */
export interface CacheKeyStrategy {
  /** 策略名称 */
  name: string;
  /** 生成缓存键 */
  generateKey: CacheKeyGenerator;
  /** 验证键格式 */
  validateKey?: (key: string) => boolean;
  /** 提取键信息 */
  extractInfo?: (key: string) => { toolId: string; hash: string } | null;
}

/**
 * 缓存键管理器接口
 */
export interface CacheKeyManager {
  /** 生成缓存键 */
  generateKey(toolId: string, parameters: Record<string, unknown>): string;

  /** 设置键生成策略 */
  setStrategy(strategy: CacheKeyStrategy): void;

  /** 获取当前策略 */
  getStrategy(): CacheKeyStrategy;

  /** 验证键格式 */
  validateKey(key: string): boolean;

  /** 提取键信息 */
  extractKeyInfo(key: string): { toolId: string; hash: string } | null;

  /** 生成工具相关的键模式 */
  generateToolKeyPattern(toolId: string): string;

  /** 检查键是否匹配工具 */
  isKeyForTool(key: string, toolId: string): boolean;

  /** 生成批量清理的键列表 */
  generateKeysForTool(
    toolId: string,
    parametersList: Record<string, unknown>[],
  ): string[];
}

/**
 * 默认缓存键策略
 */
export const defaultCacheKeyStrategy: CacheKeyStrategy = {
  name: 'default',
  generateKey: (
    toolId: string,
    parameters: Record<string, unknown>,
  ): string => {
    try {
      // 对参数进行排序以确保一致性
      const sortedParams = Object.keys(parameters)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = parameters[key];
            return result;
          },
          {} as Record<string, unknown>,
        );

      // 创建参数的哈希值
      const paramsStr = JSON.stringify(sortedParams);
      const paramsHash = crypto
        .createHash('sha256')
        .update(paramsStr)
        .digest('hex')
        .substring(0, 16);

      return `${toolId}:${paramsHash}`;
    } catch (error) {
      logger.error(
        '生成缓存键时出错:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error(
        `无法生成缓存键: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  },
  validateKey: (key: string): boolean => {
    // 验证格式: toolId:hash
    const pattern = /^[a-zA-Z0-9_-]+:[a-f0-9]{16}$/;
    return pattern.test(key);
  },
  extractInfo: (key: string): { toolId: string; hash: string } | null => {
    const parts = key.split(':');
    if (parts.length === 2) {
      return {
        toolId: parts[0],
        hash: parts[1],
      };
    }
    return null;
  },
};

/**
 * 简单缓存键策略（仅使用工具ID和参数哈希）
 */
export const simpleCacheKeyStrategy: CacheKeyStrategy = {
  name: 'simple',
  generateKey: (
    toolId: string,
    parameters: Record<string, unknown>,
  ): string => {
    const paramsStr = JSON.stringify(parameters);
    const hash = crypto
      .createHash('md5')
      .update(paramsStr)
      .digest('hex')
      .substring(0, 8);
    return `${toolId}_${hash}`;
  },
  validateKey: (key: string): boolean => {
    const pattern = /^[a-zA-Z0-9_-]+_[a-f0-9]{8}$/;
    return pattern.test(key);
  },
  extractInfo: (key: string): { toolId: string; hash: string } | null => {
    const lastUnderscoreIndex = key.lastIndexOf('_');
    if (lastUnderscoreIndex > 0) {
      return {
        toolId: key.substring(0, lastUnderscoreIndex),
        hash: key.substring(lastUnderscoreIndex + 1),
      };
    }
    return null;
  },
};

/**
 * 层次化缓存键策略（支持命名空间）
 */
export const hierarchicalCacheKeyStrategy: CacheKeyStrategy = {
  name: 'hierarchical',
  generateKey: (
    toolId: string,
    parameters: Record<string, unknown>,
  ): string => {
    try {
      // 提取可能的命名空间
      const namespace = (parameters.namespace as string) || 'default';

      // 创建不包含命名空间的参数副本
      const { namespace: _, ...cleanParams } = parameters;

      // 对参数进行排序
      const sortedParams = Object.keys(cleanParams)
        .sort()
        .reduce(
          (result, key) => {
            result[key] = cleanParams[key];
            return result;
          },
          {} as Record<string, unknown>,
        );

      const paramsStr = JSON.stringify(sortedParams);
      const paramsHash = crypto
        .createHash('sha256')
        .update(paramsStr)
        .digest('hex')
        .substring(0, 12);

      return `${namespace}:${toolId}:${paramsHash}`;
    } catch (error) {
      logger.error(
        '生成层次化缓存键时出错:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error(
        `无法生成层次化缓存键: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  },
  validateKey: (key: string): boolean => {
    const pattern = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-f0-9]{12}$/;
    return pattern.test(key);
  },
  extractInfo: (key: string): { toolId: string; hash: string } | null => {
    const parts = key.split(':');
    if (parts.length === 3) {
      return {
        toolId: parts[1],
        hash: parts[2],
      };
    }
    return null;
  },
};

/**
 * 缓存键管理器实现
 */
export class CacheKeyManagerImpl implements CacheKeyManager {
  private strategy: CacheKeyStrategy = defaultCacheKeyStrategy;

  constructor(strategy?: CacheKeyStrategy) {
    if (strategy) {
      this.strategy = strategy;
    }
  }

  /**
   * 生成缓存键
   */
  generateKey(toolId: string, parameters: Record<string, unknown>): string {
    if (!toolId) {
      throw new Error('工具ID不能为空');
    }

    if (!parameters || typeof parameters !== 'object') {
      throw new Error('参数必须是一个对象');
    }

    try {
      const key = this.strategy.generateKey(toolId, parameters);
      logger.debug(`生成缓存键: ${key} (策略: ${this.strategy.name})`);
      return key;
    } catch (error) {
      logger.error(
        `使用策略 ${this.strategy.name} 生成缓存键失败:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * 设置键生成策略
   */
  setStrategy(strategy: CacheKeyStrategy): void {
    if (!strategy || !strategy.name || !strategy.generateKey) {
      throw new Error('无效的缓存键策略');
    }

    this.strategy = strategy;
    logger.debug(`缓存键策略已设置为: ${strategy.name}`);
  }

  /**
   * 获取当前策略
   */
  getStrategy(): CacheKeyStrategy {
    return this.strategy;
  }

  /**
   * 验证键格式
   */
  validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (this.strategy.validateKey) {
      return this.strategy.validateKey(key);
    }

    // 默认验证：非空字符串
    return key.length > 0;
  }

  /**
   * 提取键信息
   */
  extractKeyInfo(key: string): { toolId: string; hash: string } | null {
    if (!this.validateKey(key)) {
      return null;
    }

    if (this.strategy.extractInfo) {
      return this.strategy.extractInfo(key);
    }

    return null;
  }

  /**
   * 生成工具相关的键模式
   */
  generateToolKeyPattern(toolId: string): string {
    if (!toolId) {
      throw new Error('工具ID不能为空');
    }

    switch (this.strategy.name) {
      case 'default':
        return `${toolId}:*`;
      case 'simple':
        return `${toolId}_*`;
      case 'hierarchical':
        return `*:${toolId}:*`;
      default:
        return `${toolId}*`;
    }
  }

  /**
   * 检查键是否匹配工具
   */
  isKeyForTool(key: string, toolId: string): boolean {
    if (!this.validateKey(key) || !toolId) {
      return false;
    }

    const keyInfo = this.extractKeyInfo(key);
    return keyInfo?.toolId === toolId;
  }

  /**
   * 生成批量清理的键列表
   */
  generateKeysForTool(
    toolId: string,
    parametersList: Record<string, unknown>[],
  ): string[] {
    if (!toolId) {
      throw new Error('工具ID不能为空');
    }

    if (!Array.isArray(parametersList)) {
      throw new Error('参数列表必须是数组');
    }

    const keys: string[] = [];
    const errors: Error[] = [];

    for (let i = 0; i < parametersList.length; i++) {
      try {
        const parameters = parametersList[i];
        if (parameters && typeof parameters === 'object') {
          const key = this.generateKey(toolId, parameters);
          keys.push(key);
        } else {
          logger.warn(`跳过无效的参数对象 (索引 ${i}):`, parameters);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('未知错误');
        errors.push(err);
        logger.error(`生成键失败 (索引 ${i}):`, err);
      }
    }

    if (errors.length > 0 && keys.length === 0) {
      throw new Error(`所有键生成都失败了。第一个错误: ${errors[0].message}`);
    }

    logger.debug(`为工具 ${toolId} 生成了 ${keys.length} 个缓存键`);
    return keys;
  }
}

/**
 * 缓存键工具函数
 */
export class CacheKeyUtils {
  /**
   * 从键列表中过滤出特定工具的键
   */
  static filterKeysForTool(
    keys: string[],
    toolId: string,
    keyManager: CacheKeyManager,
  ): string[] {
    return keys.filter((key) => keyManager.isKeyForTool(key, toolId));
  }

  /**
   * 按工具ID分组键
   */
  static groupKeysByTool(
    keys: string[],
    keyManager: CacheKeyManager,
  ): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    for (const key of keys) {
      const keyInfo = keyManager.extractKeyInfo(key);
      if (keyInfo) {
        const { toolId } = keyInfo;
        if (!groups[toolId]) {
          groups[toolId] = [];
        }
        groups[toolId].push(key);
      }
    }

    return groups;
  }

  /**
   * 验证键列表
   */
  static validateKeys(
    keys: string[],
    keyManager: CacheKeyManager,
  ): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const key of keys) {
      if (keyManager.validateKey(key)) {
        valid.push(key);
      } else {
        invalid.push(key);
      }
    }

    return { valid, invalid };
  }

  /**
   * 生成键的统计信息
   */
  static generateKeyStats(
    keys: string[],
    keyManager: CacheKeyManager,
  ): {
    total: number;
    valid: number;
    invalid: number;
    toolGroups: Record<string, number>;
  } {
    const { valid, invalid } = CacheKeyUtils.validateKeys(keys, keyManager);
    const toolGroups = CacheKeyUtils.groupKeysByTool(valid, keyManager);

    const toolGroupCounts: Record<string, number> = {};
    for (const [toolId, toolKeys] of Object.entries(toolGroups)) {
      toolGroupCounts[toolId] = toolKeys.length;
    }

    return {
      total: keys.length,
      valid: valid.length,
      invalid: invalid.length,
      toolGroups: toolGroupCounts,
    };
  }
}

/**
 * 创建缓存键管理器的工厂函数
 */
export function createCacheKeyManager(strategyName?: string): CacheKeyManager {
  let strategy: CacheKeyStrategy;

  switch (strategyName) {
    case 'simple':
      strategy = simpleCacheKeyStrategy;
      break;
    case 'hierarchical':
      strategy = hierarchicalCacheKeyStrategy;
      break;
    case 'default':
    default:
      strategy = defaultCacheKeyStrategy;
      break;
  }

  return new CacheKeyManagerImpl(strategy);
}
