/**
 * API配置管理器
 * 负责加载、验证和监听配置文件变化
 */

import { type FSWatcher, promises as fs, watch } from 'node:fs';
import { resolve } from 'node:path';
import { ApiToolsConfigSchema } from '../config/api-config-schemas.js';
import type { ApiToolConfig, ApiToolsConfig } from '../types/api-config.js';
import type { ValidationResult } from '../types/api-tool.js';
import { EnvironmentResolverImpl } from '../utils/environment-resolver.js';

/**
 * 配置加载错误
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * API配置管理器接口
 */
export interface ApiConfigManager {
  /**
   * 加载API配置文件
   * @param configPath 配置文件路径
   */
  loadConfig(configPath: string): Promise<ApiToolConfig[]>;

  /**
   * 验证配置格式
   * @param config 配置对象
   */
  validateConfig(config: ApiToolsConfig): ValidationResult;

  /**
   * 监听配置文件变化
   * @param callback 变化回调函数
   */
  watchConfigFile(callback: (config: ApiToolConfig[]) => void): void;

  /**
   * 解析环境变量引用
   * @param config API工具配置
   */
  resolveEnvironmentVariables(config: ApiToolConfig): ApiToolConfig;

  /**
   * 停止监听配置文件
   */
  stopWatching(): void;

  /**
   * 获取当前配置文件路径
   */
  getCurrentConfigPath(): string | undefined;

  /**
   * 重新加载当前配置
   */
  reloadConfig(): Promise<ApiToolConfig[]>;
}

/**
 * API配置管理器实现类
 */
export class ApiConfigManagerImpl implements ApiConfigManager {
  private watchCallback?: (config: ApiToolConfig[]) => void;
  private configPath?: string;
  private watcher?: FSWatcher;
  private readonly environmentResolver = new EnvironmentResolverImpl();

  async loadConfig(configPath: string): Promise<ApiToolConfig[]> {
    try {
      this.configPath = resolve(configPath);

      // 检查文件是否存在
      await fs.access(this.configPath);

      // 读取配置文件
      const configContent = await fs.readFile(this.configPath, 'utf-8');

      // 解析JSON
      let configData: unknown;
      try {
        configData = JSON.parse(configContent);
      } catch (parseError) {
        throw new ConfigLoadError(
          `配置文件JSON格式错误: ${parseError instanceof Error ? parseError.message : '未知错误'}`,
          this.configPath,
          parseError instanceof Error ? parseError : undefined,
        );
      }

      const config = configData as ApiToolsConfig;

      // 先解析环境变量，再进行验证
      const resolvedConfig: ApiToolsConfig = {
        ...config,
        tools: config.tools.map((tool) =>
          this.resolveEnvironmentVariables(tool),
        ),
      };

      // 验证解析后的配置格式
      const validationResult = this.validateConfig(resolvedConfig);
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => `${e.path}: ${e.message}`)
          .join(', ');
        throw new ConfigLoadError(
          `配置文件格式验证失败: ${errorMessages}`,
          this.configPath,
        );
      }

      const resolvedTools = resolvedConfig.tools;

      console.log(`成功加载 ${resolvedTools.length} 个API工具配置`);
      return resolvedTools;
    } catch (error) {
      if (error instanceof ConfigLoadError) {
        throw error;
      }

      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          throw new ConfigLoadError(
            `配置文件不存在: ${configPath}`,
            configPath,
            error,
          );
        }
        if (error.code === 'EACCES') {
          throw new ConfigLoadError(
            `无权限访问配置文件: ${configPath}`,
            configPath,
            error,
          );
        }
      }

      throw new ConfigLoadError(
        `加载配置文件失败: ${error instanceof Error ? error.message : '未知错误'}`,
        configPath,
        error instanceof Error ? error : undefined,
      );
    }
  }

  validateConfig(config: ApiToolsConfig): ValidationResult {
    try {
      const result = ApiToolsConfigSchema.safeParse(config);

      if (result.success) {
        // 额外验证：检查工具ID的唯一性
        const toolIds = new Set<string>();
        const duplicateIds: string[] = [];

        for (const tool of result.data.tools) {
          if (toolIds.has(tool.id)) {
            duplicateIds.push(tool.id);
          } else {
            toolIds.add(tool.id);
          }
        }

        if (duplicateIds.length > 0) {
          return {
            valid: false,
            errors: duplicateIds.map((id) => ({
              path: `tools[id="${id}"]`,
              message: `工具ID重复: ${id}`,
              code: 'DUPLICATE_TOOL_ID',
            })),
          };
        }

        return {
          valid: true,
          errors: [],
        };
      }

      // 转换Zod错误为ValidationError格式
      const errors = result.error.errors.map((error) => ({
        path: error.path.join('.'),
        message: error.message,
        code: error.code,
      }));

      return {
        valid: false,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'root',
            message: `配置验证异常: ${error instanceof Error ? error.message : '未知错误'}`,
            code: 'VALIDATION_EXCEPTION',
          },
        ],
      };
    }
  }

  watchConfigFile(callback: (config: ApiToolConfig[]) => void): void {
    if (!this.configPath) {
      throw new Error('必须先调用 loadConfig() 才能监听配置文件变化');
    }

    // 停止之前的监听
    this.stopWatching();

    this.watchCallback = callback;

    try {
      this.watcher = watch(
        this.configPath,
        { persistent: false },
        (eventType) => {
          if (eventType === 'change') {
            console.log('检测到配置文件变化，重新加载配置...');
            this.handleConfigChange();
          }
        },
      );

      console.log(`开始监听配置文件变化: ${this.configPath}`);
    } catch (error) {
      console.error('启动配置文件监听失败:', error);
      throw new Error(
        `启动配置文件监听失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  private async handleConfigChange(): Promise<void> {
    if (!this.configPath || !this.watchCallback) {
      return;
    }

    try {
      // 添加短暂延迟，避免文件写入过程中读取
      await new Promise((resolve) => setTimeout(resolve, 100));

      const newConfig = await this.loadConfig(this.configPath);
      this.watchCallback(newConfig);
      console.log('配置文件重新加载成功');
    } catch (error) {
      console.error('重新加载配置文件失败:', error);
      // 不抛出错误，避免中断监听
    }
  }

  resolveEnvironmentVariables(config: ApiToolConfig): ApiToolConfig {
    try {
      // 深度克隆配置对象，避免修改原始配置
      const clonedConfig = JSON.parse(JSON.stringify(config));

      // 使用环境变量解析器处理整个配置对象
      const resolvedConfig =
        this.environmentResolver.resolveObject(clonedConfig);

      // 验证必需的环境变量
      const requiredVars =
        this.environmentResolver.extractAllEnvironmentVariables(config);
      const missingVars =
        this.environmentResolver.validateRequiredVariables(requiredVars);

      if (missingVars.length > 0) {
        console.warn(
          `工具 ${config.id} 缺少环境变量: ${missingVars.join(', ')}`,
        );
      }

      return resolvedConfig;
    } catch (error) {
      console.error(`解析工具 ${config.id} 的环境变量失败:`, error);
      return config; // 返回原始配置
    }
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      console.log('已停止监听配置文件变化');
    }
    this.watchCallback = undefined;
  }

  getCurrentConfigPath(): string | undefined {
    return this.configPath;
  }

  async reloadConfig(): Promise<ApiToolConfig[]> {
    if (!this.configPath) {
      throw new Error('没有当前配置文件路径，请先调用 loadConfig()');
    }

    return this.loadConfig(this.configPath);
  }
}
