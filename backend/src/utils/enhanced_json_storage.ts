import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * 配置版本元数据
 */
export interface ConfigVersionMetadata {
  version: string;
  checksum: string;
  timestamp: string;
  size: number;
  backupPath?: string;
}

/**
 * 配置验证函数类型
 */
export type ConfigValidator<T> = (data: unknown) => data is T;

/**
 * 配置健康检查结果
 */
export interface HealthCheckResult {
  healthy: boolean;
  version?: ConfigVersionMetadata;
  error?: Error;
  canRecover: boolean;
  backupAvailable: boolean;
}

/**
 * 写入选项
 */
export interface WriteOptions {
  skipValidation?: boolean;
  createBackup?: boolean;
  expectedVersion?: string;
}

/**
 * 增强的JsonStorage类，支持原子写入、版本管理和自动恢复
 */
export class EnhancedJsonStorage<T> {
  private filePath: string;
  private defaultValue?: T;
  private validator?: ConfigValidator<T>;
  private backupDir: string;
  private metadataPath: string;

  constructor(
    filePath: string,
    defaultValue?: T,
    validator?: ConfigValidator<T>,
  ) {
    this.filePath = path.resolve(filePath);
    this.defaultValue = defaultValue;
    this.validator = validator;

    // 备份目录：在原文件同目录下的 .backups 子目录
    const fileDir = path.dirname(this.filePath);
    const fileBasename = path.basename(this.filePath, '.json');
    this.backupDir = path.resolve(fileDir, '.backups', fileBasename);
    this.metadataPath = `${this.filePath}.metadata.json`;

    // 确保备份目录存在
    this.ensureBackupDirExists();
  }

  private async ensureBackupDirExists(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error(`创建备份目录失败: ${this.backupDir}`, error);
    }
  }

  /**
   * 读取配置文件，支持自动恢复
   */
  async read(options?: { allowRecovery?: boolean }): Promise<T> {
    try {
      // 尝试读取主文件
      const data = await this.readFile(this.filePath) as T;

      // 验证数据
      if (this.validator && !this.validator(data)) {
        throw new Error('配置数据验证失败');
      }

      // 验证校验和
      await this.verifyChecksum(data);

      return data;
    } catch (error) {
      console.error(`读取文件 ${this.filePath} 时出错:`, error);

      // 尝试恢复
      if (options?.allowRecovery !== false) {
        const recovered = await this.attemptRecovery(error as Error);
        if (recovered) {
          return recovered;
        }
      }

      // 文件不存在且有默认值
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT' &&
        this.defaultValue !== undefined
      ) {
        await this.write(this.defaultValue, { createBackup: false });
        return this.defaultValue;
      }

      throw error;
    }
  }

  /**
   * 原子写入配置文件
   */
  async write(data: T, options: WriteOptions = {}): Promise<void> {
    const {
      skipValidation = false,
      createBackup = true,
      expectedVersion,
    } = options;

    // 1. 验证数据
    if (!skipValidation && this.validator && !this.validator(data)) {
      throw new Error('配置数据验证失败，无法写入');
    }

    // 2. 乐观锁检查
    if (expectedVersion) {
      const currentMetadata = await this.readMetadata();
      if (currentMetadata && currentMetadata.version !== expectedVersion) {
        throw new Error(
          `版本冲突: 期望版本 ${expectedVersion}, 实际版本 ${currentMetadata.version}`,
        );
      }
    }

    // 3. 创建备份
    let backupPath: string | undefined;
    if (createBackup) {
      backupPath = await this.createBackup();
    }

    // 4. 生成新版本信息
    const newVersion = this.generateVersion();
    const checksum = this.calculateChecksum(data);

    // 5. 写入临时文件
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    try {
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(tempPath, jsonData, 'utf-8');

      // 6. 原子重命名
      await fs.rename(tempPath, this.filePath);

      // 7. 更新元数据
      await this.writeMetadata({
        version: newVersion,
        checksum,
        timestamp: new Date().toISOString(),
        size: Buffer.byteLength(jsonData, 'utf-8'),
        backupPath: backupPath ?? undefined,
      });

      console.log(`配置文件写入成功: ${this.filePath}, 版本: ${newVersion}`);
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      // 检查主文件是否存在
      await fs.access(this.filePath);

      // 尝试读取元数据
      const metadata = await this.readMetadata();

      // 尝试读取并验证主文件
      const data = await this.readFile(this.filePath);

      if (this.validator && !this.validator(data)) {
        throw new Error('配置数据验证失败');
      }

      await this.verifyChecksum(data);

      return {
        healthy: true,
        version: metadata ?? undefined,
        canRecover: true,
        backupAvailable: await this.hasBackup(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error as Error,
        canRecover: await this.hasBackup(),
        backupAvailable: await this.hasBackup(),
      };
    }
  }

  /**
   * 尝试从损坏中恢复
   */
  private async attemptRecovery(error: Error): Promise<T | null> {
    console.info(`尝试恢复配置文件: ${this.filePath}`);

    // 1. 尝试从最近的备份恢复
    const backup = await this.getLatestBackup();
    if (backup) {
      try {
        const data = await this.readFile(backup.path) as T;

        if (this.validator && !this.validator(data)) {
          throw new Error('备份数据验证失败');
        }

        // 恢复成功，直接写入主文件（不通过write方法避免循环）
        const jsonData = JSON.stringify(data, null, 2);
        await fs.writeFile(this.filePath, jsonData, 'utf-8');

        // 生成新的版本信息
        const newVersion = this.generateVersion();
        const checksum = this.calculateChecksum(data);
        await this.writeMetadata({
          version: newVersion,
          checksum,
          timestamp: new Date().toISOString(),
          size: Buffer.byteLength(jsonData, 'utf-8'),
        });

        console.info(`从备份成功恢复配置文件: ${this.filePath}`);
        return data;
      } catch (backupError) {
        console.error('从备份恢复失败:', backupError);
      }
    }

    // 2. 尝试使用默认值
    if (this.defaultValue !== undefined) {
      console.info(`使用默认值恢复配置文件: ${this.filePath}`);

      // 直接写入默认值
      const jsonData = JSON.stringify(this.defaultValue, null, 2);
      await fs.writeFile(this.filePath, jsonData, 'utf-8');

      // 生成新的版本信息
      const newVersion = this.generateVersion();
      const checksum = this.calculateChecksum(this.defaultValue);
      await this.writeMetadata({
        version: newVersion,
        checksum,
        timestamp: new Date().toISOString(),
        size: Buffer.byteLength(jsonData, 'utf-8'),
      });

      return this.defaultValue;
    }

    return null;
  }

  /**
   * 读取文件内容
   */
  private async readFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(data: unknown): string {
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 验证校验和
   */
  private async verifyChecksum(data: unknown): Promise<void> {
    const metadata = await this.readMetadata();
    if (!metadata) {
      return; // 没有元数据，跳过验证
    }

    const actualChecksum = this.calculateChecksum(data);
    if (actualChecksum !== metadata.checksum) {
      throw new Error(
        `校验和不匹配: 期望 ${metadata.checksum}, 实际 ${actualChecksum}`,
      );
    }
  }

  /**
   * 生成新版本号
   */
  private generateVersion(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * 读取元数据
   */
  private async readMetadata(): Promise<ConfigVersionMetadata | null> {
    try {
      const content = await fs.readFile(this.metadataPath, 'utf-8');
      return JSON.parse(content) as ConfigVersionMetadata;
    } catch {
      return null;
    }
  }

  /**
   * 写入元数据
   */
  private async writeMetadata(metadata: ConfigVersionMetadata): Promise<void> {
    const content = JSON.stringify(metadata, null, 2);
    await fs.writeFile(this.metadataPath, content, 'utf-8');
  }

  /**
   * 创建备份
   */
  private async createBackup(): Promise<string | undefined> {
    try {
      // 检查文件是否存在
      try {
        await fs.access(this.filePath);
      } catch {
        // 文件不存在，不需要备份
        return undefined;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.resolve(
        this.backupDir,
        `backup-${timestamp}.json`,
      );

      await fs.copyFile(this.filePath, backupPath);

      // 清理旧备份（保留最近10个）
      await this.cleanupOldBackups(10);

      return backupPath;
    } catch (error) {
      console.error('创建备份失败:', error);
      return undefined;
    }
  }

  /**
   * 获取最新的备份
   */
  private async getLatestBackup(): Promise<{
    path: string;
    timestamp: number;
  } | null> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
        .map(async (f) => {
          const filePath = path.resolve(this.backupDir, f);
          try {
            const stats = await fs.stat(filePath);
            return {
              path: filePath,
              timestamp: stats.mtimeMs, // 使用文件修改时间
            };
          } catch {
            return null;
          }
        });

      // 等待所有文件统计信息
      const resolvedFiles = await Promise.all(backupFiles);

      // 过滤掉 null 值并按时间戳降序排序
      const validFiles = resolvedFiles
        .filter((f): f is { path: string; timestamp: number } => f !== null)
        .sort((a, b) => b.timestamp - a.timestamp);

      return validFiles[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * 检查是否有可用的备份
   */
  private async hasBackup(): Promise<boolean> {
    const backup = await this.getLatestBackup();
    return backup !== null;
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(keepCount: number): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
        .map((f) => {
          const match = f.match(/backup-(.+)\.json/);
          if (!match) return null;
          const timestamp = Date.parse(match[1]);
          return {
            path: path.resolve(this.backupDir, f),
            timestamp,
          };
        })
        .filter((f): f is { path: string; timestamp: number } => f !== null)
        .sort((a, b) => b.timestamp - a.timestamp);

      // 删除超过保留数量的旧备份
      for (const oldBackup of backupFiles.slice(keepCount)) {
        try {
          await fs.unlink(oldBackup.path);
        } catch {
          // 忽略删除错误
        }
      }
    } catch (error) {
      console.error('清理旧备份失败:', error);
    }
  }
}
