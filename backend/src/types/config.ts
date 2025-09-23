import type {
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';

// 配置类型枚举
export type ConfigType = 'system' | 'mcp' | 'groups';

// 配置响应接口
export interface ConfigResponse {
  success: true;
  data: {
    system: SystemConfig;
    mcp: McpConfig;
    groups: GroupConfig;
    lastUpdated: string;
    version: string;
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
  success: true;
  data: {
    valid: boolean;
    errors: ConfigValidationError[];
    warnings: ConfigValidationWarning[];
    impact: ConfigImpactAnalysis;
  };
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
  success: true;
  data: {
    history: ConfigHistoryEntry[];
    total: number;
    limit: number;
    offset: number;
  };
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

// 配置服务接口
export interface IConfigService {
  // 获取当前配置
  getCurrentConfig(): Promise<{
    system: SystemConfig;
    mcps: McpConfig;
    groups: GroupConfig;
  }>;

  // 更新配置
  updateConfig(
    configType: ConfigType,
    config: Record<string, unknown>,
    description?: string,
  ): Promise<void>;

  // 验证配置
  validateConfig(
    configType: ConfigType,
    config: Record<string, unknown>,
  ): Promise<ConfigValidationResult>;

  // 分析配置影响
  analyzeConfigImpact(
    configType: ConfigType,
    config: Record<string, unknown>,
  ): Promise<ConfigImpactAnalysis>;

  // 获取配置历史
  getConfigHistory(
    limit: number,
    offset: number,
    configType?: ConfigType,
  ): Promise<ConfigHistoryEntry[]>;

  // 获取配置历史总数
  getConfigHistoryCount(configType?: ConfigType): Promise<number>;

  // 创建备份
  createBackup(
    description?: string,
    includeTypes?: ConfigType[],
  ): Promise<string>;

  // 从备份恢复
  restoreFromBackup(
    backupId: string,
    configTypes?: ConfigType[],
  ): Promise<void>;

  // 获取备份列表
  getBackupList(limit: number, offset: number): Promise<ConfigBackup[]>;

  // 获取备份总数
  getBackupCount(): Promise<number>;

  // 获取最后更新时间
  getLastUpdatedTime(): Promise<string>;

  // 获取配置版本
  getConfigVersion(): Promise<string>;

  // 测试配置
  testConfig(
    configType: ConfigType,
    config: Record<string, unknown>,
  ): Promise<ConfigTestResult>;

  // 预览配置更改
  previewConfigChanges(
    configType: ConfigType,
    config: Record<string, unknown>,
  ): Promise<ConfigPreview>;
}
