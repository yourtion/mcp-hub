/**
 * 共享配置处理器
 * 负责处理mcp_service.json配置文件
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GroupConfig, McpServerConfig, ServerConfig } from '../types';
import type { ValidationResult } from './validator';

/**
 * 配置处理器错误类
 */
export class ConfigProcessorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConfigProcessorError';
  }
}

export class ConfigFileNotFoundError extends ConfigProcessorError {
  constructor(filePath: string) {
    super(`配置文件未找到: ${filePath}`, 'CONFIG_FILE_NOT_FOUND', { filePath });
  }
}

export class ConfigParseError extends ConfigProcessorError {
  constructor(filePath: string, parseError: string) {
    super(
      `配置文件解析失败: ${filePath} - ${parseError}`,
      'CONFIG_PARSE_ERROR',
      { filePath, parseError },
    );
  }
}

export class ConfigValidationError extends ConfigProcessorError {
  constructor(errors: string[]) {
    super(`配置验证失败: ${errors.join(', ')}`, 'CONFIG_VALIDATION_ERROR', {
      errors,
    });
  }
}

/**
 * 配置处理选项
 */
export interface ConfigProcessorOptions {
  /** 是否启用严格模式验证 */
  strictMode?: boolean;
  /** 默认配置目录 */
  defaultConfigDir?: string;
  /** 是否允许缺失的配置文件 */
  allowMissingFiles?: boolean;
  /** 配置文件编码 */
  encoding?: BufferEncoding;
}

/**
 * 配置文件信息
 */
export interface ConfigFileInfo {
  path: string;
  exists: boolean;
  lastModified?: Date;
  size?: number;
}

/**
 * 共享配置处理器接口
 */
export interface SharedConfigProcessorInterface {
  /**
   * 初始化配置处理器
   */
  initialize(options?: ConfigProcessorOptions): Promise<void>;

  /**
   * 处理mcp_service.json配置
   */
  processMcpServerConfig(configPath: string): Promise<McpServerConfig>;

  /**
   * 从多个路径加载配置
   */
  loadConfigFromPaths(configPaths: string[]): Promise<McpServerConfig>;

  /**
   * 验证服务器配置
   */
  validateServerConfig(config: ServerConfig): ValidationResult;

  /**
   * 验证完整的MCP服务器配置
   */
  validateMcpServerConfig(config: McpServerConfig): ValidationResult;

  /**
   * 合并配置文件
   */
  mergeConfigs(
    baseConfig: McpServerConfig,
    overrideConfig: Partial<McpServerConfig>,
  ): McpServerConfig;

  /**
   * 保存配置到文件
   */
  saveConfig(config: McpServerConfig, configPath: string): Promise<void>;

  /**
   * 获取配置文件信息
   */
  getConfigFileInfo(configPath: string): Promise<ConfigFileInfo>;

  /**
   * 生成默认配置
   */
  generateDefaultConfig(): McpServerConfig;

  /**
   * 规范化配置路径
   */
  normalizeConfigPath(configPath: string): string;
}

/**
 * 共享配置处理器实现
 */
export class SharedConfigProcessor implements SharedConfigProcessorInterface {
  private options: Required<ConfigProcessorOptions>;
  private initialized = false;

  constructor(options?: ConfigProcessorOptions) {
    this.options = {
      strictMode: false,
      defaultConfigDir: process.cwd(),
      allowMissingFiles: true,
      encoding: 'utf8',
      ...options,
    };
  }

  async initialize(options?: ConfigProcessorOptions): Promise<void> {
    if (this.initialized) {
      console.warn('配置处理器已初始化，跳过重复初始化');
      return;
    }

    if (options) {
      this.options = { ...this.options, ...options };
    }

    console.info('初始化配置处理器', {
      strictMode: this.options.strictMode,
      defaultConfigDir: this.options.defaultConfigDir,
      allowMissingFiles: this.options.allowMissingFiles,
    });

    try {
      // 验证默认配置目录
      await this.ensureDirectoryExists(this.options.defaultConfigDir);

      this.initialized = true;
      console.info('配置处理器初始化完成');
    } catch (error) {
      console.error('配置处理器初始化失败', error);
      throw new ConfigProcessorError(
        `配置处理器初始化失败: ${(error as Error).message}`,
        'INITIALIZATION_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  async processMcpServerConfig(configPath: string): Promise<McpServerConfig> {
    this.ensureInitialized();

    const normalizedPath = this.normalizeConfigPath(configPath);
    console.info('处理MCP服务器配置', { configPath: normalizedPath });

    try {
      // 检查文件是否存在
      const fileInfo = await this.getConfigFileInfo(normalizedPath);
      if (!fileInfo.exists) {
        if (this.options.allowMissingFiles) {
          console.warn('配置文件不存在，使用默认配置', {
            configPath: normalizedPath,
          });
          return this.generateDefaultConfig();
        } else {
          throw new ConfigFileNotFoundError(normalizedPath);
        }
      }

      // 读取和解析配置文件
      const configContent = await fs.readFile(
        normalizedPath,
        this.options.encoding,
      );
      let config: McpServerConfig;

      try {
        const parsedConfig = JSON.parse(configContent);
        config = this.transformRawConfig(parsedConfig);
      } catch (parseError) {
        throw new ConfigParseError(
          normalizedPath,
          (parseError as Error).message,
        );
      }

      // 验证配置
      const validation = this.validateMcpServerConfig(config);
      if (!validation.valid) {
        if (this.options.strictMode) {
          throw new ConfigValidationError(validation.errors);
        } else {
          console.warn('配置验证警告', {
            configPath: normalizedPath,
            errors: validation.errors,
          });
        }
      }

      console.info('MCP服务器配置处理完成', {
        configPath: normalizedPath,
        serverCount: Object.keys(config.servers).length,
        groupCount: config.groups ? Object.keys(config.groups).length : 0,
      });

      return config;
    } catch (error) {
      console.error('MCP服务器配置处理失败', error, {
        configPath: normalizedPath,
      });

      if (error instanceof ConfigProcessorError) {
        throw error;
      }

      throw new ConfigProcessorError(
        `配置处理失败: ${(error as Error).message}`,
        'PROCESSING_FAILED',
        { configPath: normalizedPath, originalError: (error as Error).message },
      );
    }
  }

  async loadConfigFromPaths(configPaths: string[]): Promise<McpServerConfig> {
    this.ensureInitialized();

    console.info('从多个路径加载配置', { configPaths });

    if (configPaths.length === 0) {
      return this.generateDefaultConfig();
    }

    let mergedConfig = this.generateDefaultConfig();
    let loadedCount = 0;

    for (const configPath of configPaths) {
      try {
        const config = await this.processMcpServerConfig(configPath);
        mergedConfig = this.mergeConfigs(mergedConfig, config);
        loadedCount++;
      } catch (error) {
        console.warn('配置文件加载失败，跳过', {
          configPath,
          error: (error as Error).message,
        });
      }
    }

    console.info('多路径配置加载完成', {
      totalPaths: configPaths.length,
      loadedCount,
      serverCount: Object.keys(mergedConfig.servers).length,
    });

    return mergedConfig;
  }

  validateServerConfig(config: ServerConfig): ValidationResult {
    const errors: string[] = [];

    // 验证必需字段
    if (!config.command || typeof config.command !== 'string') {
      errors.push('服务器命令 (command) 是必需的且必须是字符串');
    }

    // 验证可选字段类型
    if (config.args && !Array.isArray(config.args)) {
      errors.push('服务器参数 (args) 必须是数组');
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push('环境变量 (env) 必须是对象');
    }

    if (config.cwd && typeof config.cwd !== 'string') {
      errors.push('工作目录 (cwd) 必须是字符串');
    }

    if (config.disabled !== undefined && typeof config.disabled !== 'boolean') {
      errors.push('禁用标志 (disabled) 必须是布尔值');
    }

    if (
      config.timeout !== undefined &&
      (typeof config.timeout !== 'number' || config.timeout <= 0)
    ) {
      errors.push('超时时间 (timeout) 必须是正数');
    }

    // 验证重试配置
    if (config.retry) {
      if (
        typeof config.retry.maxRetries !== 'number' ||
        config.retry.maxRetries < 0
      ) {
        errors.push('最大重试次数 (retry.maxRetries) 必须是非负数');
      }
      if (typeof config.retry.delay !== 'number' || config.retry.delay < 0) {
        errors.push('重试延迟 (retry.delay) 必须是非负数');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateMcpServerConfig(config: McpServerConfig): ValidationResult {
    const errors: string[] = [];

    // 验证服务器配置
    if (!config.servers || typeof config.servers !== 'object') {
      errors.push('服务器配置 (servers) 是必需的且必须是对象');
    } else {
      for (const [serverId, serverConfig] of Object.entries(config.servers)) {
        const serverValidation = this.validateServerConfig(serverConfig);
        if (!serverValidation.valid) {
          errors.push(
            `服务器 '${serverId}': ${serverValidation.errors.join(', ')}`,
          );
        }
      }
    }

    // 验证组配置（可选）
    if (config.groups) {
      if (typeof config.groups !== 'object') {
        errors.push('组配置 (groups) 必须是对象');
      } else {
        for (const [groupId, groupConfig] of Object.entries(config.groups)) {
          const groupValidation = this.validateGroupConfig(groupConfig);
          if (!groupValidation.valid) {
            errors.push(
              `组 '${groupId}': ${groupValidation.errors.join(', ')}`,
            );
          }
        }
      }
    }

    // 验证全局设置（可选）
    if (config.settings) {
      const settingsValidation = this.validateGlobalSettings(config.settings);
      if (!settingsValidation.valid) {
        errors.push(`全局设置: ${settingsValidation.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  mergeConfigs(
    baseConfig: McpServerConfig,
    overrideConfig: Partial<McpServerConfig>,
  ): McpServerConfig {
    console.debug('合并配置', {
      baseServers: Object.keys(baseConfig.servers).length,
      overrideServers: overrideConfig.servers
        ? Object.keys(overrideConfig.servers).length
        : 0,
    });

    const merged: McpServerConfig = {
      servers: {
        ...baseConfig.servers,
        ...overrideConfig.servers,
      },
      groups: {
        ...baseConfig.groups,
        ...overrideConfig.groups,
      },
      settings: {
        ...baseConfig.settings,
        ...overrideConfig.settings,
      },
    };

    console.debug('配置合并完成', {
      totalServers: Object.keys(merged.servers).length,
      totalGroups: merged.groups ? Object.keys(merged.groups).length : 0,
    });

    return merged;
  }

  async saveConfig(config: McpServerConfig, configPath: string): Promise<void> {
    this.ensureInitialized();

    const normalizedPath = this.normalizeConfigPath(configPath);
    console.info('保存配置到文件', { configPath: normalizedPath });

    try {
      // 验证配置
      const validation = this.validateMcpServerConfig(config);
      if (!validation.valid) {
        throw new ConfigValidationError(validation.errors);
      }

      // 确保目录存在
      const configDir = path.dirname(normalizedPath);
      await this.ensureDirectoryExists(configDir);

      // 格式化并保存配置
      const configContent = JSON.stringify(config, null, 2);
      await fs.writeFile(normalizedPath, configContent, this.options.encoding);

      console.info('配置保存成功', { configPath: normalizedPath });
    } catch (error) {
      console.error('配置保存失败', error, { configPath: normalizedPath });

      if (error instanceof ConfigProcessorError) {
        throw error;
      }

      throw new ConfigProcessorError(
        `配置保存失败: ${(error as Error).message}`,
        'SAVE_FAILED',
        { configPath: normalizedPath, originalError: (error as Error).message },
      );
    }
  }

  async getConfigFileInfo(configPath: string): Promise<ConfigFileInfo> {
    const normalizedPath = this.normalizeConfigPath(configPath);

    try {
      const stats = await fs.stat(normalizedPath);
      return {
        path: normalizedPath,
        exists: true,
        lastModified: stats.mtime,
        size: stats.size,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          path: normalizedPath,
          exists: false,
        };
      }
      throw error;
    }
  }

  generateDefaultConfig(): McpServerConfig {
    return {
      servers: {},
      groups: {},
      settings: {
        logLevel: 'info',
        connectionTimeout: 10000,
        maxConcurrentConnections: 10,
      },
    };
  }

  normalizeConfigPath(configPath: string): string {
    if (path.isAbsolute(configPath)) {
      return configPath;
    }

    return path.resolve(this.options.defaultConfigDir, configPath);
  }

  // 私有辅助方法

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ConfigProcessorError(
        '配置处理器必须在使用前初始化',
        'NOT_INITIALIZED',
      );
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        console.debug('创建配置目录', { dirPath });
      } else {
        throw error;
      }
    }
  }

  private transformRawConfig(rawConfig: unknown): McpServerConfig {
    // 处理不同的配置文件格式，确保兼容性
    const config: McpServerConfig = {
      servers: {},
      groups: {},
      settings: {},
    };

    // 处理服务器配置
    if (rawConfig && typeof rawConfig === 'object' && 'servers' in rawConfig) {
      config.servers = rawConfig.servers as Record<string, ServerConfig>;
    } else if (
      rawConfig &&
      typeof rawConfig === 'object' &&
      'mcpServers' in rawConfig
    ) {
      // 兼容旧格式
      config.servers = rawConfig.mcpServers as Record<string, ServerConfig>;
    }

    // 处理组配置
    if (rawConfig && typeof rawConfig === 'object' && 'groups' in rawConfig) {
      config.groups = rawConfig.groups as Record<string, GroupConfig>;
    }

    // 处理全局设置
    if (rawConfig && typeof rawConfig === 'object' && 'settings' in rawConfig) {
      config.settings = rawConfig.settings as Record<string, unknown>;
    }

    return config;
  }

  private validateGroupConfig(config: GroupConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.name || typeof config.name !== 'string') {
      errors.push('组名称 (name) 是必需的且必须是字符串');
    }

    if (!Array.isArray(config.servers)) {
      errors.push('服务器列表 (servers) 必须是数组');
    }

    if (config.toolFilter) {
      if (
        config.toolFilter.include &&
        !Array.isArray(config.toolFilter.include)
      ) {
        errors.push('工具包含列表 (toolFilter.include) 必须是数组');
      }
      if (
        config.toolFilter.exclude &&
        !Array.isArray(config.toolFilter.exclude)
      ) {
        errors.push('工具排除列表 (toolFilter.exclude) 必须是数组');
      }
    }

    if (config.validation) {
      if (typeof config.validation.enabled !== 'boolean') {
        errors.push('验证启用标志 (validation.enabled) 必须是布尔值');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateGlobalSettings(settings: unknown): ValidationResult {
    const errors: string[] = [];

    if (settings && typeof settings === 'object') {
      const settingsObj = settings as Record<string, unknown>;

      if (
        settingsObj.logLevel &&
        !['debug', 'info', 'warn', 'error'].includes(
          settingsObj.logLevel as string,
        )
      ) {
        errors.push('日志级别 (logLevel) 必须是 debug, info, warn, error 之一');
      }

      if (settingsObj.connectionTimeout !== undefined) {
        if (
          typeof settingsObj.connectionTimeout !== 'number' ||
          settingsObj.connectionTimeout <= 0
        ) {
          errors.push('连接超时 (connectionTimeout) 必须是正数');
        }
      }

      if (settingsObj.maxConcurrentConnections !== undefined) {
        if (
          typeof settingsObj.maxConcurrentConnections !== 'number' ||
          settingsObj.maxConcurrentConnections <= 0
        ) {
          errors.push('最大并发连接数 (maxConcurrentConnections) 必须是正数');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
