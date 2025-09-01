/**
 * API转MCP服务管理器
 * 负责整合所有组件，提供统一的服务接口
 */

import { logger } from '../../utils/logger.js';
import type {
  ApiToolResult,
  McpTool,
  ValidationResult,
} from '../types/api-tool.js';
import { ParameterValidatorImpl } from '../utils/parameter-validator.js';
import { ApiConfigManagerImpl } from './api-config-manager.js';
import { ApiExecutorImpl } from './api-executor.js';
import { ApiToolGenerator } from './api-tool-generator.js';
import { ApiToolRegistry } from './api-tool-registry.js';
import { AuthenticationManager } from './authentication.js';
import { HttpClient } from './http-client.js';

/**
 * API转MCP服务管理器接口
 */
export interface ApiToMcpServiceManager {
  /**
   * 初始化服务管理器
   * @param configPath 配置文件路径
   */
  initialize(configPath: string): Promise<void>;

  /**
   * 重新加载配置
   */
  reloadConfig(): Promise<void>;

  /**
   * 获取所有API生成的工具
   */
  getApiTools(): Promise<McpTool[]>;

  /**
   * 执行API工具调用
   * @param toolId 工具ID
   * @param parameters 调用参数
   */
  executeApiTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<ApiToolResult>;

  /**
   * 获取工具定义
   * @param toolId 工具ID
   */
  getToolDefinition(toolId: string): McpTool | undefined;

  /**
   * 验证工具参数
   * @param toolId 工具ID
   * @param parameters 参数
   */
  validateToolParameters(
    toolId: string,
    parameters: Record<string, unknown>,
  ): ValidationResult;

  /**
   * 关闭服务管理器
   */
  shutdown(): Promise<void>;
}

/**
 * 服务管理器实现类
 */
export class ApiToMcpServiceManagerImpl implements ApiToMcpServiceManager {
  private configPath?: string;
  private initialized = false;

  // 核心组件
  private configManager: ApiConfigManagerImpl;
  private toolGenerator: ApiToolGenerator;
  private toolRegistry: ApiToolRegistry;
  private apiExecutor: ApiExecutorImpl;
  private parameterValidator: ParameterValidatorImpl;

  constructor() {
    this.configManager = new ApiConfigManagerImpl();
    this.toolGenerator = new ApiToolGenerator();
    this.toolRegistry = new ApiToolRegistry();

    // 创建HTTP客户端和认证管理器
    const httpClient = new HttpClient();
    const authManager = new AuthenticationManager();
    this.apiExecutor = new ApiExecutorImpl(httpClient, authManager);

    this.parameterValidator = new ParameterValidatorImpl();
  }

  async initialize(configPath: string): Promise<void> {
    logger.info('初始化API转MCP服务管理器', { context: { configPath } });

    try {
      this.configPath = configPath;

      // 加载配置
      await this.loadAndRegisterTools();

      // 设置配置文件监听
      this.configManager.watchConfigFile(async () => {
        logger.info('检测到配置文件变化，重新加载工具');
        await this.reloadConfig();
      });

      this.initialized = true;
      logger.info('API转MCP服务管理器初始化完成', {
        context: {
          toolCount: this.toolRegistry.getToolCount(),
        },
      });
    } catch (error) {
      logger.error('API转MCP服务管理器初始化失败', error as Error);
      throw new Error(`初始化失败: ${(error as Error).message}`);
    }
  }

  async reloadConfig(): Promise<void> {
    if (!this.configPath) {
      throw new Error('服务管理器未初始化');
    }

    logger.info('重新加载API工具配置');

    try {
      // 清空现有工具
      this.toolRegistry.clear();

      // 重新加载和注册工具
      await this.loadAndRegisterTools();

      logger.info('API工具配置重新加载完成', {
        context: {
          toolCount: this.toolRegistry.getToolCount(),
        },
      });
    } catch (error) {
      logger.error('重新加载配置失败', error as Error);
      throw new Error(`重新加载失败: ${(error as Error).message}`);
    }
  }

  async getApiTools(): Promise<McpTool[]> {
    if (!this.initialized) {
      throw new Error('服务管理器未初始化');
    }

    return this.toolRegistry.getAllTools();
  }

  async executeApiTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<ApiToolResult> {
    if (!this.initialized) {
      throw new Error('服务管理器未初始化');
    }

    logger.debug('执行API工具', { context: { toolId, parameters } });

    try {
      // 获取工具配置
      const config = this.toolRegistry.getToolConfig(toolId);
      if (!config) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `工具 '${toolId}' 不存在`,
            },
          ],
        };
      }

      // 验证参数
      const validation = this.validateToolParameters(toolId, parameters);
      if (!validation.valid) {
        const errorMessages = validation.errors
          .map((e) => e.message)
          .join(', ');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `参数验证失败: ${errorMessages}`,
            },
          ],
        };
      }

      // 执行API调用
      const response = await this.apiExecutor.executeApiCall(
        config,
        parameters,
      );

      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('API工具执行失败', error as Error, { context: { toolId } });
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `执行失败: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  getToolDefinition(toolId: string): McpTool | undefined {
    return this.toolRegistry.getTool(toolId);
  }

  validateToolParameters(
    toolId: string,
    parameters: Record<string, unknown>,
  ): ValidationResult {
    const config = this.toolRegistry.getToolConfig(toolId);
    if (!config) {
      return {
        valid: false,
        errors: [
          {
            path: 'toolId',
            message: `工具 '${toolId}' 不存在`,
            code: 'TOOL_NOT_FOUND',
          },
        ],
      };
    }

    return this.parameterValidator.validate(parameters, config.parameters);
  }

  async shutdown(): Promise<void> {
    logger.info('关闭API转MCP服务管理器');

    try {
      // 清理资源
      this.toolRegistry.clear();
      this.toolRegistry.removeAllEventListeners();

      this.initialized = false;
      logger.info('API转MCP服务管理器已关闭');
    } catch (error) {
      logger.error('关闭服务管理器时发生错误', error as Error);
      throw error;
    }
  }

  /**
   * 加载配置并注册工具
   */
  private async loadAndRegisterTools(): Promise<void> {
    if (!this.configPath) {
      throw new Error('配置文件路径未设置');
    }

    // 加载配置
    const configs = await this.configManager.loadConfig(this.configPath);

    // 生成工具
    const tools = this.toolGenerator.generateAllTools(configs);

    // 注册工具
    const toolsWithConfigs = tools.map((tool) => {
      const config = configs.find((c) => c.id === tool.name);
      if (!config) {
        throw new Error(`找不到工具 '${tool.name}' 的配置`);
      }
      return { tool, config };
    });

    const result = this.toolRegistry.registerTools(toolsWithConfigs);

    if (result.failed > 0) {
      logger.warn('部分工具注册失败', {
        context: {
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
        },
      });
    }

    logger.info('工具注册完成', {
      context: {
        successful: result.successful,
        failed: result.failed,
        total: configs.length,
      },
    });
  }
}
