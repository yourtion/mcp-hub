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

    // 验证 type 字段
    if (!config.type || typeof config.type !== 'string') {
      errors.push('服务器类型 (type) 是必需的且必须是字符串');
    } else if (
      config.type !== 'stdio' &&
      config.type !== 'sse' &&
      config.type !== 'streaming'
    ) {
      errors.push(
        '服务器类型 (type) 必须是 stdio、sse 或 streaming 之一',
      );
    }

    // 检查是否为 StdioServerConfig
    if (config.type === 'stdio') {
      if (!config.command || typeof config.command !== 'string') {
        errors.push('Stdio 服务器配置必须包含 command 字段');
      }
    } else if (config.type === 'sse' || config.type === 'streaming') {
      // 检查是否为 HTTPServerConfig
      if (!config.url || typeof config.url !== 'string') {
        errors.push('HTTP 服务器配置必须包含 url 字段');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
