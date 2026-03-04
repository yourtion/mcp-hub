import path from 'node:path';
import type {
  DeepReadonly,
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import { EnhancedJsonStorage } from '../utils/enhanced_json_storage.js';

/**
 * 配置版本信息
 */
export interface ConfigVersionInfo {
  configType: 'mcp' | 'groups' | 'system';
  version: string;
  timestamp: string;
  checksum: string;
}

/**
 * 全局配置版本信息
 */
export interface GlobalVersionInfo {
  mcp?: ConfigVersionInfo;
  groups?: ConfigVersionInfo;
  system?: ConfigVersionInfo;
  lastUpdated: string;
}

/**
 * 配置版本管理服务
 */
export class ConfigVersionService {
  private readonly configDir: string;
  private mcpStorage: EnhancedJsonStorage<McpConfig>;
  private groupStorage: EnhancedJsonStorage<GroupConfig>;
  private systemStorage: EnhancedJsonStorage<SystemConfig>;

  constructor() {
    this.configDir =
      process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config');

    // 创建增强的存储实例
    this.mcpStorage = new EnhancedJsonStorage<McpConfig>(
      path.resolve(this.configDir, 'mcp_server.json'),
      { servers: {} },
      this.isMcpConfig.bind(this),
    );

    this.groupStorage = new EnhancedJsonStorage<GroupConfig>(
      path.resolve(this.configDir, 'group.json'),
      {} as GroupConfig,
      this.isGroupConfig.bind(this),
    );

    this.systemStorage = new EnhancedJsonStorage<SystemConfig>(
      path.resolve(this.configDir, 'system.json'),
      undefined, // system.json 是可选的
      this.isSystemConfig.bind(this),
    );
  }

  /**
   * 获取全局版本信息
   */
  async getGlobalVersion(): Promise<GlobalVersionInfo> {
    const versionInfo: GlobalVersionInfo = {
      lastUpdated: new Date().toISOString(),
    };

    try {
      const mcpMetadata = await this.getMetadata(this.mcpStorage);
      if (mcpMetadata) {
        versionInfo.mcp = {
          configType: 'mcp',
          version: mcpMetadata.version,
          timestamp: mcpMetadata.timestamp,
          checksum: mcpMetadata.checksum,
        };
      }
    } catch {
      // 忽略错误
    }

    try {
      const groupMetadata = await this.getMetadata(this.groupStorage);
      if (groupMetadata) {
        versionInfo.groups = {
          configType: 'groups',
          version: groupMetadata.version,
          timestamp: groupMetadata.timestamp,
          checksum: groupMetadata.checksum,
        };
      }
    } catch {
      // 忽略错误
    }

    try {
      const systemMetadata = await this.getMetadata(this.systemStorage);
      if (systemMetadata) {
        versionInfo.system = {
          configType: 'system',
          version: systemMetadata.version,
          timestamp: systemMetadata.timestamp,
          checksum: systemMetadata.checksum,
        };
      }
    } catch {
      // 忽略错误
    }

    return versionInfo;
  }

  /**
   * 获取MCP配置存储
   */
  getMcpStorage(): EnhancedJsonStorage<McpConfig> {
    return this.mcpStorage;
  }

  /**
   * 获取组配置存储
   */
  getGroupStorage(): EnhancedJsonStorage<GroupConfig> {
    return this.groupStorage;
  }

  /**
   * 获取系统配置存储
   */
  getSystemStorage(): EnhancedJsonStorage<SystemConfig> {
    return this.systemStorage;
  }

  /**
   * 执行全局健康检查
   */
  async globalHealthCheck(): Promise<{
    healthy: boolean;
    configs: {
      mcp: Awaited<ReturnType<EnhancedJsonStorage<McpConfig>['healthCheck']>>;
      groups: Awaited<
        ReturnType<EnhancedJsonStorage<GroupConfig>['healthCheck']>
      >;
      system: Awaited<
        ReturnType<EnhancedJsonStorage<SystemConfig>['healthCheck']>
      >;
    };
  }> {
    const [mcp, groups, system] = await Promise.all([
      this.mcpStorage.healthCheck().catch((error) => ({
        healthy: false,
        error,
        canRecover: false,
        backupAvailable: false,
      })),
      this.groupStorage.healthCheck().catch((error) => ({
        healthy: false,
        error,
        canRecover: false,
        backupAvailable: false,
      })),
      this.systemStorage.healthCheck().catch((error) => ({
        healthy: false,
        error,
        canRecover: false,
        backupAvailable: false,
      })),
    ]);

    return {
      healthy: mcp.healthy && groups.healthy && system.healthy,
      configs: { mcp, groups, system },
    };
  }

  /**
   * 获取存储元数据
   */
  private async getMetadata<T>(storage: EnhancedJsonStorage<T>): Promise<{
    version: string;
    timestamp: string;
    checksum: string;
  } | null> {
    try {
      const filePath = this.getStorageFilePath(storage);
      const metadataPath = `${filePath}.metadata.json`;

      const fs = await import('node:fs/promises');
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 获取存储文件路径
   */
  private getStorageFilePath<T>(storage: EnhancedJsonStorage<T>): string {
    // 通过比较存储实例获取文件路径
    if (storage === this.mcpStorage) {
      return path.resolve(this.configDir, 'mcp_server.json');
    } else if (storage === this.groupStorage) {
      return path.resolve(this.configDir, 'group.json');
    } else if (storage === this.systemStorage) {
      return path.resolve(this.configDir, 'system.json');
    }
    throw new Error('Unknown storage instance');
  }

  /**
   * MCP配置类型守卫
   */
  private isMcpConfig(data: unknown): data is McpConfig {
    return (
      typeof data === 'object' &&
      data !== null &&
      'servers' in data &&
      typeof data.servers === 'object'
    );
  }

  /**
   * 组配置类型守卫
   */
  private isGroupConfig(data: unknown): data is GroupConfig {
    return typeof data === 'object' && data !== null;
  }

  /**
   * 系统配置类型守卫
   */
  private isSystemConfig(data: unknown): data is SystemConfig {
    return (
      typeof data === 'object' &&
      data !== null &&
      'server' in data &&
      typeof data.server === 'object'
    );
  }
}

// 单例实例
let versionServiceInstance: ConfigVersionService | null = null;

/**
 * 获取配置版本服务实例
 */
export function getConfigVersionService(): ConfigVersionService {
  if (!versionServiceInstance) {
    versionServiceInstance = new ConfigVersionService();
  }
  return versionServiceInstance;
}
