import type {
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import { z } from 'zod';

// MCP服务器配置验证模式
const BaseServerConfigSchema = z.object({
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

const StdioServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.literal('stdio'),
  command: z.string().min(1, '命令不能为空'),
  args: z.array(z.string()).optional(),
});

const HTTPServerConfigSchema = BaseServerConfigSchema.extend({
  type: z.enum(['sse', 'streaming']),
  url: z.string().url('必须是有效的URL'),
  headers: z.record(z.string()).optional(),
});

const ServerConfigSchema = z.union([
  StdioServerConfigSchema,
  HTTPServerConfigSchema,
]);

// MCP配置验证模式
const McpConfigSchema = z.object({
  mcpServers: z
    .record(z.string(), ServerConfigSchema)
    .refine(
      (servers) => Object.keys(servers).length > 0,
      '至少需要配置一个MCP服务器',
    ),
});

// 组配置验证模式
const GroupSchema = z.object({
  id: z.string().min(1, '组ID不能为空'),
  name: z.string().min(1, '组名称不能为空'),
  description: z.string().optional(),
  servers: z
    .array(z.string().min(1, '服务器名称不能为空'))
    .min(1, '每个组至少需要包含一个服务器'),
  tools: z.array(z.string()),
});

const GroupConfigSchema = z.record(z.string(), GroupSchema);

// 系统配置验证模式
const SystemConfigSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65535),
    host: z.string().min(1),
  }),
  auth: z.object({
    jwt: z.object({
      secret: z.string().min(32),
      expiresIn: z.string(),
      refreshExpiresIn: z.string(),
      issuer: z.string(),
    }),
    security: z.object({
      maxLoginAttempts: z.number().min(1),
      lockoutDuration: z.number().min(0),
      passwordMinLength: z.number().min(4),
      requireStrongPassword: z.boolean(),
    }),
  }),
  users: z.record(
    z.string(),
    z.object({
      id: z.string(),
      username: z.string(),
      password: z.string().min(1, '密码不能为空'),
      passwordHash: z.string(),
      role: z.string(),
      groups: z.array(z.string()),
      createdAt: z.string(),
    }),
  ),
  ui: z.object({
    title: z.string(),
    theme: z.string(),
    features: z.object({
      apiToMcp: z.boolean(),
      debugging: z.boolean(),
      monitoring: z.boolean(),
    }),
  }),
  monitoring: z.object({
    metricsEnabled: z.boolean(),
    logLevel: z.string(),
    retentionDays: z.number().min(1),
  }),
});

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
  try {
    const result = McpConfigSchema.parse(config);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['配置验证失败：未知错误'] };
  }
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
  try {
    const result = GroupConfigSchema.parse(config);

    // 验证组中引用的服务器是否存在
    const validationErrors: string[] = [];

    for (const [groupName, group] of Object.entries(result)) {
      // 检查服务器引用
      for (const serverName of group.servers) {
        if (
          availableServers.length > 0 &&
          !availableServers.includes(serverName)
        ) {
          validationErrors.push(
            `组 "${groupName}" 引用了不存在的服务器 "${serverName}"`,
          );
        }
      }

      // 检查组ID是否与组名匹配（可选的一致性检查）
      if (group.id && !group.id.includes(groupName)) {
        console.warn(`警告：组 "${groupName}" 的ID "${group.id}" 可能不匹配`);
      }
    }

    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['组配置验证失败：未知错误'] };
  }
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
  try {
    const result = SystemConfigSchema.parse(config);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['系统配置验证失败：未知错误'] };
  }
}

/**
 * 验证配置文件的交叉引用
 */
export function validateConfigCrossReferences(
  mcpConfig: McpConfig,
  groupConfig: GroupConfig,
): { success: true } | { success: false; errors: string[] } {
  const errors: string[] = [];
  const availableServers = Object.keys(mcpConfig.mcpServers);

  // 检查组配置中引用的服务器是否在MCP配置中存在
  for (const [groupName, group] of Object.entries(groupConfig)) {
    for (const serverName of group.servers) {
      if (!availableServers.includes(serverName)) {
        errors.push(
          `组 "${groupName}" 引用了未在MCP配置中定义的服务器 "${serverName}"`,
        );
      }
    }
  }

  // 检查是否有未使用的服务器
  const usedServers = new Set<string>();
  for (const group of Object.values(groupConfig)) {
    group.servers.forEach((server) => usedServers.add(server));
  }

  const unusedServers = availableServers.filter(
    (server) => !usedServers.has(server),
  );
  if (unusedServers.length > 0) {
    console.warn(`警告：以下服务器未被任何组使用: ${unusedServers.join(', ')}`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
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
  const availableServers = Object.keys(mcpResult.data.mcpServers);
  const groupResult = validateGroupConfig(groupConfig, availableServers);
  if (!groupResult.success) {
    allErrors.push(...groupResult.errors.map((err) => `组配置错误: ${err}`));
    return { success: false, errors: allErrors };
  }

  // 验证交叉引用
  const crossRefResult = validateConfigCrossReferences(
    mcpResult.data,
    groupResult.data,
  );
  if (!crossRefResult.success) {
    allErrors.push(
      ...crossRefResult.errors.map((err) => `交叉引用错误: ${err}`),
    );
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
