import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * JsonStorage 类用于以 JSON 格式读取和写入数据到文件。
 * 它使用泛型来支持不同类型的数据结构。
 */
export class JsonStorage<T> {
  private filePath: string;
  private defaultValue?: T;

  /**
   * 构造函数
   * @param filePath - JSON 文件的完整路径 (例如: '/path/to/your/data.json' 或 'data/data.json')。
   * @param defaultValue - 可选的默认值。如果在读取时文件不存在，将使用此值。
   */
  constructor(filePath: string, defaultValue?: T) {
    this.filePath = path.resolve(filePath); // 解析为绝对路径以确保一致性
    this.defaultValue = defaultValue;
    // 确保文件所在的目录存在
    this.ensureDataDirExists(path.dirname(this.filePath));
  }

  private async ensureDataDirExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (_error) {
      // 目录不存在，创建它
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 从 JSON 文件中读取数据。
   * @returns 返回一个 Promise，解析为存储的数据 (类型为 T)。
   *          如果文件不存在且未提供默认值，则返回 null。
   *          如果文件不存在但提供了默认值，则写入默认值到新文件并返回该默认值。
   * @throws 如果读取或解析现有文件时发生错误（非 ENOENT）。
   */
  async read(): Promise<T> {
    try {
      const fileContent = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(fileContent) as T;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        // 文件不存在
        if (this.defaultValue !== undefined) {
          await this.write(this.defaultValue); // 写入默认值到新文件
          return this.defaultValue;
        }
      }
      // 其他错误，例如现有文件内容无效导致的 JSON 解析错误
      console.error(`读取文件 ${this.filePath} 时出错:`, error);
      throw error; // 重新抛出错误，不使用默认值覆盖损坏的文件
    }
  }

  /**
   * 将数据写入 JSON 文件。
   * @param data - 要写入文件的数据 (类型为 T)。
   * @returns 返回一个 Promise，在写入完成后解析。
   * @throws 如果写入文件时发生错误。
   */
  async write(data: T): Promise<void> {
    try {
      const jsonData = JSON.stringify(data, null, 2); // 使用 null, 2 进行格式化输出，方便阅读
      await fs.writeFile(this.filePath, jsonData, 'utf-8');
    } catch (error) {
      console.error(`写入文件 ${this.filePath} 时出错:`, error);
      throw error;
    }
  }
}
