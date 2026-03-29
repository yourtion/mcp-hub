/**
 * 交叉引用校验（MCP 配置 → Group 配置）
 */
import type { z } from 'zod/v4';
import { GroupConfigSchema } from '../schemas/group.schema.js';
import { McpConfigSchema } from '../schemas/mcp.schema.js';
import { SystemConfigSchema } from '../schemas/system.schema.js';
import type { Group } from '../types/index.js';
import { validateWithSchema } from './config-validator.js';

/**
 * 校验结果
 */
export interface CrossReferenceResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 校验 MCP 配置与 Group 配置之间的交叉引用关系
 */
export function validateCrossReferences(
  servers: Record<string, unknown>,
  groups: Record<string, Group>,
): CrossReferenceResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const availableServers = new Set(Object.keys(servers));

  // 检查组中引用的服务器是否存在
  for (const [groupName, group] of Object.entries(groups)) {
    for (const serverName of group.servers) {
      if (!availableServers.has(serverName)) {
        errors.push(
          `组 "${groupName}" 引用了未在MCP配置中定义的服务器 "${serverName}"`,
        );
      }
    }
  }

  // 检查未使用的服务器
  const usedServers = new Set<string>();
  for (const group of Object.values(groups)) {
    for (const server of group.servers) {
      usedServers.add(server);
    }
  }

  const unusedServers = Object.keys(servers).filter(
    (server) => !usedServers.has(server),
  );

  if (unusedServers.length > 0) {
    warnings.push(`以下服务器未被任何组使用: ${unusedServers.join('、 ')}`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors, warnings };
}

/**
 * 校验所有配置（Schema校验 + 交叉引用校验）
 */
export function validateAllConfigs(
  mcpConfig: unknown,
  groupConfig: unknown,
  systemConfig?: unknown,
):
  | {
      success: true;
      data: {
        mcpConfig: z.infer<typeof McpConfigSchema>;
        groupConfig: z.infer<typeof GroupConfigSchema>;
        systemConfig?: z.infer<typeof SystemConfigSchema>;
      };
    }
  | { success: false; errors: string[] } {
  const allErrors: string[] = [];

  // Schema 校验 MCP 配置
  const mcpResult = validateWithSchema(McpConfigSchema, mcpConfig);
  if (!mcpResult.success) {
    allErrors.push(...(mcpResult.errors ?? []).map((e) => `MCP配置错误: ${e}`));
    return { success: false, errors: allErrors };
  }

  // Schema 校验 Group 配置
  const groupResult = validateWithSchema(GroupConfigSchema, groupConfig);
  if (!groupResult.success) {
    allErrors.push(
      ...(groupResult.errors ?? []).map((e) => `组配置错误: ${e}`),
    );
    return { success: false, errors: allErrors };
  }

  // 交叉引用校验
  const crossRefResult = validateCrossReferences(
    mcpResult.data?.servers as Record<string, unknown>,
    groupResult.data as z.infer<typeof GroupConfigSchema>,
  );
  if (!crossRefResult.valid) {
    allErrors.push(...crossRefResult.errors.map((e) => `交叉引用错误: ${e}`));
    return { success: false, errors: allErrors };
  }

  // Schema 校验 System 配置（可选）
  let parsedSystemConfig: z.infer<typeof SystemConfigSchema> | undefined;
  if (systemConfig) {
    const sysResult = validateWithSchema(SystemConfigSchema, systemConfig);
    if (!sysResult.success) {
      allErrors.push(
        ...(sysResult.errors ?? []).map((e) => `系统配置错误: ${e}`),
      );
      return { success: false, errors: allErrors };
    }
    parsedSystemConfig = sysResult.data;
  }

  return {
    success: true,
    data: {
      mcpConfig: mcpResult.data as z.infer<typeof McpConfigSchema>,
      groupConfig: groupResult.data as z.infer<typeof GroupConfigSchema>,
      systemConfig: parsedSystemConfig,
    },
  };
}
