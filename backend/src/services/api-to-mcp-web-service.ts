/**
 * API到MCP Web服务
 * 整合API到MCP核心功能，提供Web API所需的完整服务
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type {
  ApiConfigManager,
  ApiConfigManagerImpl,
  ApiToolsConfig,
} from '@mcp-core/mcp-hub-core/api-to-mcp';
import { ConfigLoadError } from '@mcp-core/mcp-hub-core/api-to-mcp';
import type {
  ApiConfigInfo,
  ApiConfigListResponse,
  ApiResponse,
  ApiToolConfig,
  TestApiConfigRequest,
  TestApiConfigResponse,
} from '../types/web-api.js';
import { logger } from '../utils/logger.js';
import { ApiToolIntegrationService } from './api_tool_integration_service.js';

/**
 * API配置管理结果
 */
interface ApiConfigManagementResult {
  success: boolean;
  message: string;
  config?: ApiToolConfig;
  error?: string;
}

/**
 * API到MCP Web服务类
 * 提供Web界面所需的完整API到MCP管理功能
 */
export class ApiToMcpWebService {
  private apiToolIntegrationService: ApiToolIntegrationService;
  private configManager?: ApiConfigManager;
  private configPath?: string;

  constructor() {
    this.apiToolIntegrationService = new ApiToolIntegrationService();
  }

  /**
   * 初始化Web服务
   * @param configPath API配置文件路径
   */
  async initialize(configPath?: string): Promise<void> {
    try {
      logger.info('初始化API到MCP Web服务', { configPath });

      // 初始化API工具集成服务
      await this.apiToolIntegrationService.initialize(configPath);

      // 设置配置文件路径
      if (configPath) {
        this.configPath = configPath;

        // 导入ApiConfigManager (延迟导入以避免循环依赖)
        const { ApiConfigManagerImpl } = await import(
          '@mcp-core/mcp-hub-core/api-to-mcp'
        );

        this.configManager = new ApiConfigManagerImpl();

        logger.info('API到MCP Web服务初始化完成', { configPath });
      } else {
        logger.warn('未提供API配置文件路径，部分功能将不可用');
      }
    } catch (error) {
      logger.error('API到MCP Web服务初始化失败', error as Error);
      throw new Error(`初始化失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取API配置列表
   */
  async getConfigs(): Promise<ApiConfigListResponse> {
    try {
      const apiTools = await this.apiToolIntegrationService.getApiTools();

      const configs: ApiConfigInfo[] = apiTools.map((tool) => ({
        id: tool.name,
        name: tool.name,
        description: tool.description,
        status: 'active' as const,
        api: {
          url: this.extractApiUrl(tool.inputSchema),
          method: this.extractHttpMethod(tool.inputSchema),
        },
        toolsGenerated: 1,
        lastUpdated: new Date().toISOString(),
      }));

      return { configs };
    } catch (error) {
      logger.error('获取API配置列表失败', error as Error);
      throw new Error(`获取配置列表失败: ${(error as Error).message}`);
    }
  }

  /**
   * 创建新的API配置
   */
  async createConfig(
    config: ApiToolConfig,
  ): Promise<ApiConfigManagementResult> {
    try {
      logger.info('创建新的API配置', { configId: config.id });

      if (!this.configPath) {
        throw new Error('配置文件路径未设置，无法创建配置');
      }

      // 验证配置数据
      this.validateApiConfig(config);

      // 加载现有配置
      const existingConfigs = await this.loadAllConfigs();

      // 检查ID是否已存在
      if (existingConfigs.find((c) => c.id === config.id)) {
        return {
          success: false,
          message: `配置ID '${config.id}' 已存在`,
        };
      }

      // 添加新配置
      existingConfigs.push(config);

      // 保存配置
      await this.saveAllConfigs(existingConfigs);

      // 重新加载API工具集成服务
      await this.apiToolIntegrationService.reloadConfig();

      logger.info('API配置创建成功', { configId: config.id });

      return {
        success: true,
        message: 'API配置创建成功',
        config,
      };
    } catch (error) {
      logger.error('创建API配置失败', error as Error);
      return {
        success: false,
        message: `创建配置失败: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 更新API配置
   */
  async updateConfig(
    configId: string,
    config: ApiToolConfig,
  ): Promise<ApiConfigManagementResult> {
    try {
      logger.info('更新API配置', { configId });

      if (!this.configPath) {
        throw new Error('配置文件路径未设置，无法更新配置');
      }

      // 验证配置数据
      this.validateApiConfig(config);

      // 验证ID匹配
      if (config.id !== configId) {
        return {
          success: false,
          message: '配置ID不匹配',
        };
      }

      // 加载现有配置
      const existingConfigs = await this.loadAllConfigs();

      // 查找并更新配置
      const configIndex = existingConfigs.findIndex((c) => c.id === configId);
      if (configIndex === -1) {
        return {
          success: false,
          message: `配置 '${configId}' 不存在`,
        };
      }

      existingConfigs[configIndex] = config;

      // 保存配置
      await this.saveAllConfigs(existingConfigs);

      // 重新加载API工具集成服务
      await this.apiToolIntegrationService.reloadConfig();

      logger.info('API配置更新成功', { configId });

      return {
        success: true,
        message: 'API配置更新成功',
        config,
      };
    } catch (error) {
      logger.error('更新API配置失败', error as Error);
      return {
        success: false,
        message: `更新配置失败: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 删除API配置
   */
  async deleteConfig(configId: string): Promise<ApiConfigManagementResult> {
    try {
      logger.info('删除API配置', { configId });

      if (!this.configPath) {
        throw new Error('配置文件路径未设置，无法删除配置');
      }

      // 加载现有配置
      const existingConfigs = await this.loadAllConfigs();

      // 查找并删除配置
      const configIndex = existingConfigs.findIndex((c) => c.id === configId);
      if (configIndex === -1) {
        return {
          success: false,
          message: `配置 '${configId}' 不存在`,
        };
      }

      existingConfigs.splice(configIndex, 1);

      // 保存配置
      await this.saveAllConfigs(existingConfigs);

      // 重新加载API工具集成服务
      await this.apiToolIntegrationService.reloadConfig();

      logger.info('API配置删除成功', { configId });

      return {
        success: true,
        message: 'API配置删除成功',
      };
    } catch (error) {
      logger.error('删除API配置失败', error as Error);
      return {
        success: false,
        message: `删除配置失败: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 测试API配置
   */
  async testConfig(
    configId: string,
    parameters: Record<string, unknown>,
  ): Promise<TestApiConfigResponse> {
    try {
      logger.info('测试API配置', { configId, parameters });

      const startTime = Date.now();

      // 执行API工具测试
      const result = await this.apiToolIntegrationService.executeApiTool(
        configId,
        parameters,
      );

      const executionTime = Date.now() - startTime;

      const testResponse: TestApiConfigResponse = {
        success: !result.isError,
        response: result.isError ? undefined : result.content[0]?.text,
        error: result.isError ? result.content[0]?.text : undefined,
        executionTime,
      };

      logger.info('API配置测试完成', {
        configId,
        success: testResponse.success,
        executionTime,
      });

      return testResponse;
    } catch (error) {
      logger.error('测试API配置失败', error as Error);

      return {
        success: false,
        error: `测试失败: ${(error as Error).message}`,
        executionTime: 0,
      };
    }
  }

  /**
   * 获取API配置详情
   */
  async getConfigDetails(configId: string): Promise<ApiToolConfig | null> {
    try {
      logger.info('获取API配置详情', { configId });

      // 从API工具集成服务获取工具定义
      const toolDefinition =
        this.apiToolIntegrationService.getApiToolDefinition(configId);

      if (!toolDefinition) {
        return null;
      }

      // 加载完整配置信息
      if (!this.configPath) {
        return null;
      }

      const allConfigs = await this.loadAllConfigs();
      const fullConfig = allConfigs.find((c) => c.id === configId);

      if (!fullConfig) {
        return null;
      }

      return fullConfig;
    } catch (error) {
      logger.error('获取API配置详情失败', error as Error);
      throw new Error(`获取配置详情失败: ${(error as Error).message}`);
    }
  }

  /**
   * 验证API配置格式
   */
  private validateApiConfig(config: ApiToolConfig): void {
    if (!config.id || !config.id.trim()) {
      throw new Error('配置ID不能为空');
    }

    if (!config.name || !config.name.trim()) {
      throw new Error('配置名称不能为空');
    }

    if (!config.description || !config.description.trim()) {
      throw new Error('配置描述不能为空');
    }

    if (!config.api || !config.api.url || !config.api.method) {
      throw new Error('API配置不完整');
    }

    if (!config.parameters || !config.parameters.properties) {
      throw new Error('参数配置不完整');
    }
  }

  /**
   * 加载所有API配置
   */
  private async loadAllConfigs(): Promise<ApiToolConfig[]> {
    if (!this.configPath || !this.configManager) {
      return [];
    }

    try {
      return await this.configManager.loadConfig(this.configPath);
    } catch (error) {
      if (error instanceof ConfigLoadError && error.cause?.code === 'ENOENT') {
        // 文件不存在，返回空配置
        return [];
      }
      throw error;
    }
  }

  /**
   * 保存所有API配置
   */
  private async saveAllConfigs(configs: ApiToolConfig[]): Promise<void> {
    if (!this.configPath) {
      throw new Error('配置文件路径未设置');
    }

    // 确保目录存在
    const configDir = dirname(this.configPath);
    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      // 目录已存在，忽略错误
      if ((error as any).code !== 'EEXIST') {
        throw error;
      }
    }

    // 构建完整的配置对象
    const fullConfig: ApiToolsConfig = {
      version: '1.0.0',
      tools: configs,
    };

    // 保存到文件
    const configContent = JSON.stringify(fullConfig, null, 2);
    await fs.writeFile(this.configPath, configContent, 'utf-8');

    logger.info('API配置保存成功', {
      path: this.configPath,
      configCount: configs.length,
    });
  }

  /**
   * 从工具schema中提取API URL
   */
  private extractApiUrl(schema: any): string {
    // 尝试从schema的description或其他字段中提取URL信息
    // 这是一个简化的实现，实际可能需要更复杂的逻辑
    return schema.description?.match(/https?:\/\/[^\s]+/)?.[0] || '';
  }

  /**
   * 从工具schema中提取HTTP方法
   */
  private extractHttpMethod(schema: any): string {
    // 尝试从schema中提取HTTP方法信息
    // 这是一个简化的实现，实际可能需要更复杂的逻辑
    return 'GET';
  }

  /**
   * 获取默认配置文件路径
   */
  static getDefaultConfigPath(): string {
    return join(homedir(), '.mcp-hub', 'api-tools.json');
  }

  /**
   * 获取服务健康状态
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    healthy: boolean;
    configPath?: string;
    toolCount: number;
    errors?: string[];
  }> {
    try {
      const health = this.apiToolIntegrationService.getHealthStatus();

      const stats = await this.apiToolIntegrationService.getStats();

      return {
        initialized: health.initialized,
        healthy: health.healthy,
        configPath: this.configPath,
        toolCount: stats.totalApiTools,
        errors: health.errors,
      };
    } catch (error) {
      logger.error('获取健康状态失败', error as Error);
      return {
        initialized: false,
        healthy: false,
        toolCount: 0,
        errors: [`获取健康状态失败: ${(error as Error).message}`],
      };
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<void> {
    try {
      await this.apiToolIntegrationService.reloadConfig();
      logger.info('API配置重新加载完成');
    } catch (error) {
      logger.error('重新加载API配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('关闭API到MCP Web服务');

      // 关闭API工具集成服务
      await this.apiToolIntegrationService.shutdown();

      logger.info('API到MCP Web服务已关闭');
    } catch (error) {
      logger.error('关闭API到MCP Web服务时发生错误', error as Error);
      throw error;
    }
  }
}
