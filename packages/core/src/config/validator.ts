/**
 * 配置验证器
 * 负责验证配置文件的格式和内容
 */

import type { McpServerConfig, ServerConfig } from '../types/index.js';

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * 配置验证器
 */
export class ConfigValidator {
  /**
   * 验证MCP服务器配置
   */
  validateMcpServerConfig(config: McpServerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // TODO: 实现完整的配置验证逻辑
    if (!config.servers || Object.keys(config.servers).length === 0) {
      errors.push('配置中必须包含至少一个服务器');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证单个服务器配置
   */
  validateServerConfig(config: ServerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // TODO: 实现服务器配置验证逻辑
    if (!config.command) {
      errors.push('服务器配置必须包含command字段');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
