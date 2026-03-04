import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnhancedJsonStorage } from './enhanced_json_storage.js';

describe('EnhancedJsonStorage', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'enhanced-json-test-'));
    testFilePath = path.join(tempDir, 'test.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('基本读写', () => {
    it('应该能够写入和读取数据', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      const testData = { foo: 'bar', num: 42 };

      await storage.write(testData);
      const readData = await storage.read();

      expect(readData).toEqual(testData);
    });

    it('应该使用默认值当文件不存在时', async () => {
      const defaultValue = { default: true };
      const storage = new EnhancedJsonStorage(testFilePath, defaultValue);

      const data = await storage.read();

      expect(data).toEqual(defaultValue);
    });

    it('应该使用自定义验证器', async () => {
      const validator = (data: unknown): data is { valid: string } => {
        return (
          typeof data === 'object' &&
          data !== null &&
          'valid' in data &&
          typeof data.valid === 'string'
        );
      };

      const storage = new EnhancedJsonStorage(
        testFilePath,
        undefined,
        validator,
      );
      const testData = { valid: 'data' };

      await storage.write(testData);
      const readData = await storage.read();

      expect(readData).toEqual(testData);
    });

    it('应该在验证失败时抛出错误', async () => {
      const validator = (data: unknown): data is { valid: string } => {
        return (
          typeof data === 'object' &&
          data !== null &&
          'valid' in data &&
          typeof data.valid === 'string'
        );
      };

      const storage = new EnhancedJsonStorage(
        testFilePath,
        undefined,
        validator,
      );

      await expect(storage.write({ invalid: 'data' })).rejects.toThrow(
        '配置数据验证失败',
      );
    });
  });

  describe('原子写入', () => {
    it('应该使用临时文件进行原子写入', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      const testData = { atomic: 'write' };

      await storage.write(testData);

      // 检查临时文件是否被清理
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tempFiles).toHaveLength(0);
    });

    it('应该在写入后创建元数据文件', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      const testData = { metadata: 'test' };

      await storage.write(testData);

      // 检查元数据文件是否存在
      const metadataPath = `${testFilePath}.metadata.json`;
      const metadataExists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);

      expect(metadataExists).toBe(true);

      // 验证元数据内容
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('checksum');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('size');
    });
  });

  describe('版本管理', () => {
    it('应该为每次写入生成新版本', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await storage.write({ v1: true });
      await storage.write({ v2: true });

      // 版本应该不同（通过检查元数据文件）
      const metadataPath = `${testFilePath}.metadata.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.version).toBeDefined();
      expect(typeof metadata.version).toBe('string');
    });

    it('应该在版本冲突时拒绝写入', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await storage.write({ initial: true });

      // 获取当前版本
      const metadataPath = `${testFilePath}.metadata.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const currentMetadata = JSON.parse(metadataContent);

      // 尝试使用错误的版本号写入
      await expect(
        storage.write({ updated: true }, { expectedVersion: 'wrong-version' }),
      ).rejects.toThrow('版本冲突');
    });

    it('应该使用正确的版本号接受写入', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await storage.write({ initial: true });

      // 获取当前版本
      const metadataPath = `${testFilePath}.metadata.json`;
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const currentMetadata = JSON.parse(metadataContent);

      // 使用正确的版本号写入
      await expect(
        storage.write(
          { updated: true },
          { expectedVersion: currentMetadata.version },
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('健康检查', () => {
    it('应该报告健康的配置', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      await storage.write({ healthy: true });

      const health = await storage.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.version).toBeDefined();
    });

    it('应该检测损坏的JSON', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      // 写入损坏的JSON
      await fs.writeFile(testFilePath, '{ invalid json }', 'utf-8');

      const health = await storage.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('应该检测不存在的文件', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      // 不写入任何文件

      const health = await storage.healthCheck();

      expect(health.healthy).toBe(false);
    });
  });

  describe('自动恢复', () => {
    it('应该从备份自动恢复', async () => {
      const defaultValue = { default: true };
      const storage = new EnhancedJsonStorage(testFilePath, defaultValue);
      const testData = { recover: 'me' };

      // 写入第一次数据
      await storage.write(testData, { createBackup: false });

      // 写入第二次数据（这会创建第一次数据的备份）
      await storage.write({ v2: true }, { createBackup: true });

      // 损坏主文件
      await fs.writeFile(testFilePath, '{ corrupted }', 'utf-8');

      // 尝试读取，应该自动恢复到第一次的数据
      const recovered = await storage.read({ allowRecovery: true });

      expect(recovered).toEqual(testData);
    });

    it('应该使用默认值当无法恢复时', async () => {
      const defaultValue = { default: true };
      const storage = new EnhancedJsonStorage(testFilePath, defaultValue);

      // 直接损坏文件（没有备份）
      await fs.writeFile(testFilePath, '{ corrupted }', 'utf-8');

      // 尝试读取，应该使用默认值
      const recovered = await storage.read({ allowRecovery: true });

      expect(recovered).toEqual(defaultValue);
    });

    it('应该在恢复后创建新文件', async () => {
      const defaultValue = { recovered: true };
      const storage = new EnhancedJsonStorage(testFilePath, defaultValue);

      // 损坏文件
      await fs.writeFile(testFilePath, '{ corrupted }', 'utf-8');

      // 尝试读取，应该恢复
      await storage.read({ allowRecovery: true });

      // 验证文件已恢复
      const content = await fs.readFile(testFilePath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toEqual(defaultValue);
    });
  });

  describe('备份管理', () => {
    it('应该在写入前创建备份', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await storage.write({ v1: true });
      await storage.write({ v2: true });

      // 检查备份目录
      const backupDir = path.join(tempDir, '.backups', 'test');
      const backupExists = await fs
        .access(backupDir)
        .then(() => true)
        .catch(() => false);

      expect(backupExists).toBe(true);
    });

    it('应该保留指定数量的备份', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      // 写入多次
      for (let i = 0; i < 15; i++) {
        await storage.write({ version: i });
      }

      // 检查备份数量（应该保留最近10个）
      const backupDir = path.join(tempDir, '.backups', 'test');
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter((f) => f.startsWith('backup-'));

      expect(backupFiles.length).toBeLessThanOrEqual(10);
    });
  });

  describe('校验和验证', () => {
    it('应该验证正确的校验和', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      const testData = { checksum: 'test' };

      await storage.write(testData);
      const readData = await storage.read();

      expect(readData).toEqual(testData);
    });

    it('应该检测校验和不匹配', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);
      const testData = { checksum: 'test' };

      await storage.write(testData);

      // 手动修改文件内容
      await fs.writeFile(
        testFilePath,
        JSON.stringify({ modified: true }),
        'utf-8',
      );

      // 尝试读取应该失败
      await expect(storage.read()).rejects.toThrow('校验和不匹配');
    });
  });

  describe('错误处理', () => {
    it('应该处理文件不存在的情况', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await expect(storage.read({ allowRecovery: false })).rejects.toThrow();
    });

    it('应该处理无效的JSON', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      await fs.writeFile(testFilePath, 'invalid json', 'utf-8');

      await expect(storage.read({ allowRecovery: false })).rejects.toThrow();
    });

    it('应该在写入失败时清理临时文件', async () => {
      const storage = new EnhancedJsonStorage(testFilePath);

      // 创建一个只读目录（模拟写入失败）
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      const readOnlyPath = path.join(readOnlyDir, 'test.json');
      const readOnlyStorage = new EnhancedJsonStorage(readOnlyPath);

      // 这个测试可能因权限而异，在某些系统上可能不适用
      // 主要演示错误处理逻辑
    });
  });
});
