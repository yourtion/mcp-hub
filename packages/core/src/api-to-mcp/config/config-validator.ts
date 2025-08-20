/**
 * 配置验证器
 * 使用Zod验证API配置的正确性
 */

import { z } from 'zod';
import type { ApiToolConfig, ApiToolsConfig } from '../types/api-config.js';
import type { ValidationResult } from '../types/api-tool.js';
import {
  ApiToolConfigSchema,
  ApiToolsConfigSchema,
} from './api-config-schemas.js';

/**
 * 配置验证器接口
 */
export interface ConfigValidator {
  /**
   * 验证完整的API工具配置文件
   * @param config 配置对象
   */
  validateApiToolsConfig(
    config: unknown,
  ): ValidationResult & { data?: ApiToolsConfig };

  /**
   * 验证单个API工具配置
   * @param config 单个工具配置
   */
  validateApiToolConfig(
    config: unknown,
  ): ValidationResult & { data?: ApiToolConfig };

  /**
   * 验证JSONata表达式语法
   * @param expression JSONata表达式
   */
  validateJsonataExpression(expression: string): ValidationResult;

  /**
   * 验证URL格式
   * @param url URL字符串
   */
  validateUrl(url: string): ValidationResult;
}

/**
 * 配置验证器实现类
 */
export class ConfigValidatorImpl implements ConfigValidator {
  validateApiToolsConfig(
    config: unknown,
  ): ValidationResult & { data?: ApiToolsConfig } {
    try {
      const validatedConfig = ApiToolsConfigSchema.parse(config);
      return {
        valid: true,
        errors: [],
        data: validatedConfig,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            path: 'config',
            message: error instanceof Error ? error.message : '未知验证错误',
            code: 'UNKNOWN_ERROR',
          },
        ],
      };
    }
  }

  validateApiToolConfig(
    config: unknown,
  ): ValidationResult & { data?: ApiToolConfig } {
    try {
      const validatedConfig = ApiToolConfigSchema.parse(config);
      return {
        valid: true,
        errors: [],
        data: validatedConfig,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            path: 'config',
            message: error instanceof Error ? error.message : '未知验证错误',
            code: 'UNKNOWN_ERROR',
          },
        ],
      };
    }
  }

  validateJsonataExpression(expression: string): ValidationResult {
    try {
      // TODO: 实际的JSONata语法验证
      // 这里应该使用jsonata库来验证表达式语法
      if (!expression || typeof expression !== 'string') {
        return {
          valid: false,
          errors: [
            {
              path: 'jsonata',
              message: 'JSONata表达式必须是非空字符串',
              code: 'INVALID_TYPE',
            },
          ],
        };
      }

      // 基本语法检查
      if (expression.includes('{{') || expression.includes('}}')) {
        return {
          valid: false,
          errors: [
            {
              path: 'jsonata',
              message: 'JSONata表达式不应包含模板语法',
              code: 'INVALID_SYNTAX',
            },
          ],
        };
      }

      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'jsonata',
            message:
              error instanceof Error ? error.message : 'JSONata表达式验证失败',
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  validateUrl(url: string): ValidationResult {
    try {
      new URL(url);
      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'url',
            message: `无效的URL格式: ${error instanceof Error ? error.message : '未知错误'}`,
            code: 'INVALID_URL',
          },
        ],
      };
    }
  }

  /**
   * 验证Zod schema本身
   * @param schema Zod schema
   * @param data 要验证的数据
   */
  validateWithSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
  ): ValidationResult & { data?: T } {
    try {
      const validatedData = schema.parse(data);
      return {
        valid: true,
        errors: [],
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            path: 'data',
            message: error instanceof Error ? error.message : '未知验证错误',
            code: 'UNKNOWN_ERROR',
          },
        ],
      };
    }
  }
}
