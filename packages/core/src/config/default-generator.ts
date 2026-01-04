/**
 * 默认配置生成器
 * 负责生成 MCP 服务器的默认配置文件
 */

import { existsSync } from 'node:fs';
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigError, ErrorCode } from '../errors/index.js';
import type {
  GroupConfig,
  McpServerConfig,
  ServerConfig,
} from '../types/index.js';

/**
 * 生成器选项
 */
export interface GeneratorOptions {
  /** 是否包含示例配置 */
  includeExamples?: boolean;
  /** 是否包含组配置 */
  includeGroups?: boolean;
  /** 配置目录路径 */
  configDir?: string;
  /** 是否覆盖已存在的文件 */
  overwrite?: boolean;
}

/**
 * 配置初始化结果
 */
export interface ConfigInitResult {
  /** 成功创建的文件列表 */
  createdFiles: string[];
  /** 跳过的文件列表（已存在且不覆盖） */
  skippedFiles: string[];
  /** 错误信息列表 */
  errors: string[];
}

/**
 * 服务器预设
 */
export interface ServerPreset {
  /** 预设ID */
  id: string;
  /** 预设名称 */
  name: string;
  /** 预设描述 */
  description: string;
  /** 服务器配置 */
  config: ServerConfig;
  /** 是否需要额外配置 */
  requiresAdditionalConfig?: boolean;
  /** 额外配置说明 */
  additionalConfigNote?: string;
}

/**
 * 默认配置生成器类
 */
export class DefaultConfigGenerator {
  private readonly options: Required<GeneratorOptions>;

  // 服务器预设定义
  private readonly serverPresets: Record<string, ServerPreset> = {
    fetch: {
      id: 'fetch',
      name: 'Fetch',
      description: 'Web fetching and HTTP requests',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        disabled: false,
      },
    },
    time: {
      id: 'time',
      name: 'Time',
      description: 'Time and date functionality',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-time'],
        disabled: false,
      },
    },
    'sequential-thinking': {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      description: 'Sequential thinking capabilities',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        disabled: false,
      },
    },
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem',
      description: 'File system operations',
      config: {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/path/to/allowed/directory',
        ],
        disabled: false,
      },
      requiresAdditionalConfig: true,
      additionalConfigNote:
        '请将 /path/to/allowed/directory 替换为实际的文件系统路径',
    },
    memory: {
      id: 'memory',
      name: 'Memory',
      description: 'Persistent memory storage',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        disabled: false,
      },
    },
    'brave-search': {
      id: 'brave-search',
      name: 'Brave Search',
      description: 'Brave search engine integration',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: 'your-api-key-here',
        },
        disabled: false,
      },
      requiresAdditionalConfig: true,
      additionalConfigNote: '请设置 BRAVE_API_KEY 环境变量',
    },
    github: {
      id: 'github',
      name: 'GitHub',
      description: 'GitHub repository management',
      config: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: 'your-token-here',
        },
        disabled: false,
      },
      requiresAdditionalConfig: true,
      additionalConfigNote: '请设置 GITHUB_PERSONAL_ACCESS_TOKEN 环境变量',
    },
  };

  // 默认使用的服务器预设（用于 --init）
  private readonly defaultPresets = ['fetch', 'time', 'sequential-thinking'];

  constructor(options: GeneratorOptions = {}) {
    this.options = {
      includeExamples: options.includeExamples ?? true,
      includeGroups: options.includeGroups ?? false,
      configDir: options.configDir ?? process.cwd(),
      overwrite: options.overwrite ?? false,
    };
  }

  /**
   * 初始化配置文件
   * 生成 mcp_service.json 和可选的 group.json
   */
  async initConfigFiles(): Promise<ConfigInitResult> {
    const result: ConfigInitResult = {
      createdFiles: [],
      skippedFiles: [],
      errors: [],
    };

    try {
      // 确保配置目录存在
      await this.ensureConfigDir(this.options.configDir);

      // 生成 mcp_service.json
      const serviceConfigPath = join(
        this.options.configDir,
        'mcp_service.json',
      );
      const serviceConfig = this.generateMcpServiceConfig();
      const serviceResult = await this.writeConfigFile(
        serviceConfigPath,
        JSON.stringify(serviceConfig, null, 2),
        this.options.overwrite,
      );

      if (serviceResult.created) {
        result.createdFiles.push(serviceConfigPath);
      } else if (serviceResult.skipped) {
        result.skippedFiles.push(serviceConfigPath);
      }

      // 生成 group.json（如果需要）
      if (this.options.includeGroups) {
        const groupConfigPath = join(this.options.configDir, 'group.json');
        const groupConfig = this.generateGroupConfig();
        const groupResult = await this.writeConfigFile(
          groupConfigPath,
          JSON.stringify(groupConfig, null, 2),
          this.options.overwrite,
        );

        if (groupResult.created) {
          result.createdFiles.push(groupConfigPath);
        } else if (groupResult.skipped) {
          result.skippedFiles.push(groupConfigPath);
        }
      }
    } catch (error) {
      // 捕获所有错误并添加到结果中
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * 获取所有可用的服务器预设
   */
  getAvailableServerPresets(): ServerPreset[] {
    return Object.values(this.serverPresets);
  }

  /**
   * 生成 MCP 服务配置
   */
  private generateMcpServiceConfig(): McpServerConfig {
    const servers: Record<string, ServerConfig> = {};

    // 添加默认服务器预设
    for (const presetId of this.defaultPresets) {
      const preset = this.serverPresets[presetId];
      if (preset) {
        servers[presetId] = { ...preset.config };
      }
    }

    // 添加其他示例（如果启用）
    if (this.options.includeExamples) {
      // 可以在这里添加更多示例配置
    }

    return {
      servers,
      settings: {
        logLevel: 'info',
        connectionTimeout: 30000,
        maxConcurrentConnections: 10,
      },
    };
  }

  /**
   * 生成组配置
   */
  private generateGroupConfig(): Record<string, GroupConfig> {
    const groups: Record<string, GroupConfig> = {
      default: {
        name: '默认组',
        description: '包含所有默认服务器',
        servers: this.defaultPresets,
        validation: {
          enabled: false,
        },
      },
      'web-tools': {
        name: 'Web工具组',
        description: '仅包含Web相关工具',
        servers: ['fetch'],
        toolFilter: {
          include: ['fetch'],
        },
        validation: {
          enabled: false,
        },
      },
    };

    return groups;
  }

  /**
   * 生成单个服务器配置
   */
  private generateServerConfig(presetId: string): ServerConfig {
    const preset = this.serverPresets[presetId];
    if (!preset) {
      throw new ConfigError(
        ErrorCode.INVALID_SERVER_CONFIG,
        `无效的服务器预设: ${presetId}`,
        { presetId },
      );
    }

    return { ...preset.config };
  }

  /**
   * 验证服务器预设是否有效
   */
  private isValidServerPreset(presetId: string): boolean {
    return presetId in this.serverPresets;
  }

  /**
   * 确保配置目录存在
   */
  private async ensureConfigDir(dir: string): Promise<void> {
    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ConfigError(
        ErrorCode.CONFIG_FILE_NOT_FOUND,
        `配置目录无法创建: ${dir}`,
        { dir, error: errorMessage },
      );
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全写入文件（使用临时文件+重命名确保原子性）
   */
  private async safeWriteFile(
    filePath: string,
    content: string,
  ): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      await writeFile(tempPath, content, 'utf-8');
      await rename(tempPath, filePath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ConfigError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        `无法写入配置文件: ${filePath}`,
        { filePath, error: errorMessage },
      );
    }
  }

  /**
   * 写入配置文件
   */
  private async writeConfigFile(
    filePath: string,
    content: string,
    overwrite: boolean,
  ): Promise<{ created: boolean; skipped: boolean }> {
    const exists = await this.fileExists(filePath);

    if (exists && !overwrite) {
      return { created: false, skipped: true };
    }

    await this.safeWriteFile(filePath, content);
    return { created: true, skipped: false };
  }
}
