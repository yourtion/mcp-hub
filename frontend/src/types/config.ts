// 配置管理相关类型定义

// 配置类型枚举
export type ConfigType = 'system' | 'mcp' | 'groups';

// 配置数据接口
export interface ConfigData {
  system: SystemConfig;
  mcp: McpConfig;
  groups: GroupConfig;
  lastUpdated: string;
  version: string;
}

// 系统配置接口
export interface SystemConfig {
  server: {
    port: number;
    host: string;
  };
  auth: {
    jwt: {
      secret: string;
      expiresIn: string;
      refreshExpiresIn: string;
      issuer: string;
    };
    security: {
      maxLoginAttempts: number;
      lockoutDuration: number;
      passwordMinLength: number;
      requireStrongPassword: boolean;
    };
  };
  users: Record<string, UserConfig>;
  ui: {
    title: string;
    theme: string;
    features: {
      apiToMcp: boolean;
      debugging: boolean;
      monitoring: boolean;
    };
  };
  monitoring: {
    metricsEnabled: boolean;
    logLevel: string;
    retentionDays: number;
  };
}

// 用户配置接口
export interface UserConfig {
  id: string;
  username: string;
  password: string;
  passwordHash: string;
  role: string;
  groups: string[];
  createdAt: string;
}

// MCP配置接口
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

// MCP服务器配置接口
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  transport?: {
    type: 'stdio' | 'sse' | 'websocket';
    url?: string;
    headers?: Record<string, string>;
  };
}

// 组配置接口
export interface GroupConfig {
  [groupId: string]: GroupInfo;
}

// 组信息接口
export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  servers: string[];
  tools: string[];
  validation?: {
    enabled: boolean;
    validationKey?: string;
    createdAt?: string;
    lastUpdated?: string;
  };
}

// 配置更新请求接口
export interface ConfigUpdateRequest {
  configType: ConfigType;
  config: Record<string, unknown>;
  description?: string;
}

// 配置验证请求接口
export interface ConfigValidationRequest {
  configType: ConfigType;
  config: Record<string, unknown>;
}

// 配置验证结果接口
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

// 配置验证错误接口
export interface ConfigValidationError {
  path: string;
  message: string;
  code: string;
  severity: 'error';
}

// 配置验证警告接口
export interface ConfigValidationWarning {
  path: string;
  message: string;
  code: string;
  severity: 'warning';
}

// 配置影响分析接口
export interface ConfigImpactAnalysis {
  affectedServices: string[];
  requiresRestart: boolean;
  potentialIssues: string[];
  recommendations: string[];
}

// 配置验证响应接口
export interface ConfigValidationResponse {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
  impact: ConfigImpactAnalysis;
}

// 配置历史记录接口
export interface ConfigHistoryEntry {
  id: string;
  configType: ConfigType;
  timestamp: string;
  description?: string;
  changes: ConfigChange[];
  user: string;
  version: string;
}

// 配置变更接口
export interface ConfigChange {
  path: string;
  operation: 'add' | 'update' | 'delete';
  oldValue?: unknown;
  newValue?: unknown;
}

// 配置历史响应接口
export interface ConfigHistoryResponse {
  history: ConfigHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

// 配置备份请求接口
export interface ConfigBackupRequest {
  description?: string;
  includeTypes?: ConfigType[];
}

// 配置备份信息接口
export interface ConfigBackup {
  id: string;
  timestamp: string;
  description?: string;
  configTypes: ConfigType[];
  size: number;
  user: string;
}

// 配置恢复请求接口
export interface ConfigRestoreRequest {
  backupId: string;
  configTypes?: ConfigType[];
}

// 配置测试结果接口
export interface ConfigTestResult {
  success: boolean;
  tests: ConfigTest[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// 配置测试接口
export interface ConfigTest {
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: unknown;
}

// 配置预览接口
export interface ConfigPreview {
  changes: ConfigChange[];
  affectedServices: string[];
  potentialIssues: string[];
  recommendations: string[];
  rollbackPlan: string[];
}

// 配置分类接口
export interface ConfigCategory {
  key: string;
  label: string;
  description: string;
  icon?: string;
  configType: ConfigType;
  path: string;
}

// 配置项接口
export interface ConfigItem {
  key: string;
  label: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ label: string; value: unknown }>;
  };
  sensitive?: boolean; // 敏感信息，如密码
}

// 配置表单数据接口
export interface ConfigFormData {
  configType: ConfigType;
  config: Record<string, unknown>;
  originalConfig: Record<string, unknown>;
  isDirty: boolean;
}

// 配置搜索过滤器接口
export interface ConfigSearchFilter {
  keyword: string;
  configType?: ConfigType;
  category?: string;
  showAdvanced: boolean;
}
