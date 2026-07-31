/**
 * 配置验证模块
 * 使用 share 包的统一 Zod Schema 进行配置校验
 */

import {
  GroupConfigSchema,
  McpConfigSchema,
  SystemConfigSchema,
  validateCrossReferences,
  validateWithSchema,
} from '@mcp-core/mcp-knot-share/config';

import { logger } from '../utils/logger.js';

import type { GroupConfig, McpConfig, SystemConfig } from '@mcp-core/mcp-knot-share/config';

/**
 * 验证MCP服务器配置
 */
export function validateMcpConfig(config: unknown):
  | {
      success: true;
      data: McpConfig;
    }
  | {
      success: false;
      errors: string[];
    } {
  const result = validateWithSchema(McpConfigSchema, config);
  if (result.success && result.data) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.errors ?? [] };
}

/**
 * 验证组配置
 */
export function validateGroupConfig(
  config: unknown,
  availableServers: string[] = [],
):
  | {
      success: true;
      data: GroupConfig;
    }
  | {
      success: false;
      errors: string[];
    } {
  const result = validateWithSchema(GroupConfigSchema, config);
  if (!result.success || !result.data) {
    return { success: false, errors: result.errors ?? [] };
  }

  // 验证组中引用的服务器是否存在
  const validationErrors: string[] = [];

  for (const [groupName, group] of Object.entries(result.data)) {
    for (const serverName of group.servers) {
      if (availableServers.length > 0 && !availableServers.includes(serverName)) {
        validationErrors.push(`组 "${groupName}" 引用了不存在的服务器 "${serverName}"`);
      }
    }

    // 检查组ID是否与组名匹配
    if (group.id && !group.id.includes(groupName)) {
      logger.warn('组 ID 可能与组名不匹配', { groupName, groupId: group.id });
    }
  }

  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  return { success: true, data: result.data };
}

/**
 * 验证系统配置
 */
export function validateSystemConfig(config: unknown):
  | {
      success: true;
      data: SystemConfig;
    }
  | {
      success: false;
      errors: string[];
    } {
  const result = validateWithSchema(SystemConfigSchema, config);
  if (result.success && result.data) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.errors ?? [] };
}

/**
 * 验证配置文件的交叉引用
 */
export function validateConfigCrossReferences(
  mcpConfig: McpConfig,
  groupConfig: GroupConfig,
): { success: true } | { success: false; errors: string[] } {
  const result = validateCrossReferences(mcpConfig.servers, groupConfig);
  if (result.valid) {
    return { success: true };
  }
  return { success: false, errors: result.errors };
}

/**
 * 验证所有配置文件
 */
export function validateAllConfigs(
  mcpConfig: unknown,
  groupConfig: unknown,
  systemConfig?: unknown,
):
  | {
      success: true;
      data: {
        mcpConfig: McpConfig;
        groupConfig: GroupConfig;
        systemConfig?: SystemConfig;
      };
    }
  | {
      success: false;
      errors: string[];
    } {
  const allErrors: string[] = [];

  // 验证MCP配置
  const mcpResult = validateMcpConfig(mcpConfig);
  if (!mcpResult.success) {
    allErrors.push(...mcpResult.errors.map((err) => `MCP配置错误: ${err}`));
    return { success: false, errors: allErrors };
  }

  // 验证组配置
  const availableServers = Object.keys(mcpResult.data.servers);
  const groupResult = validateGroupConfig(groupConfig, availableServers);
  if (!groupResult.success) {
    allErrors.push(...groupResult.errors.map((err) => `组配置错误: ${err}`));
    return { success: false, errors: allErrors };
  }

  // 验证交叉引用
  const crossRefResult = validateConfigCrossReferences(mcpResult.data, groupResult.data);
  if (!crossRefResult.success) {
    allErrors.push(...crossRefResult.errors.map((err) => `交叉引用错误: ${err}`));
    return { success: false, errors: allErrors };
  }

  // 验证系统配置（如果提供）
  let systemResult: { success: true; data: SystemConfig } | undefined;
  if (systemConfig) {
    const sysResult = validateSystemConfig(systemConfig);
    if (!sysResult.success) {
      allErrors.push(...sysResult.errors.map((err) => `系统配置错误: ${err}`));
      return { success: false, errors: allErrors };
    }
    systemResult = sysResult;
  }

  return {
    success: true,
    data: {
      mcpConfig: mcpResult.data,
      groupConfig: groupResult.data,
      systemConfig: systemResult?.data,
    },
  };
}
