/**
 * 配置加载器
 * 负责从文件系统加载配置文件
 */

import { readFile } from 'node:fs/promises';
import type { McpServerConfig } from '../types/index.js';

/**
 * 配置加载器接口
 */
export interface ConfigLoaderInterface {
  /**
   * 从文件加载配置
   */
  loadFromFile(filePath: string): Promise<McpServerConfig>;

  /**
   * 从JSON字符串加载配置
   */
  loadFromJson(jsonString: string): McpServerConfig;
}

/**
 * 配置加载器实现
 */
export class ConfigLoader implements ConfigLoaderInterface {
  async loadFromFile(filePath: string): Promise<McpServerConfig> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.loadFromJson(content);
    } catch (error) {
      throw new Error(`无法加载配置文件 ${filePath}: ${error}`);
    }
  }

  loadFromJson(jsonString: string): McpServerConfig {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`无法解析配置JSON: ${error}`);
    }
  }
}
