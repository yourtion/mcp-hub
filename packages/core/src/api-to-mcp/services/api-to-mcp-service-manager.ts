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
 * 服务状态枚举
 */
export enum ServiceStatus {
  NOT_INITIALIZED = 'not_initialized',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  SHUTTING_DOWN = 'shutting_down',
  SHUTDOWN = 'shutdown',
  ERROR = 'error',
}

/**
 * 服务健康状态
 */
export interface ServiceHealth {
  /** 服务状态 */
  status: ServiceStatus;
  /** 是否健康 */
  healthy: boolean;
  /** 初始化时间 */
  initializationTime?: Date;
  /** 最后健康检查时间 */
  lastHealthCheck?: Date;
  /** 运行时间（毫秒） */
  uptime?: number;
  /** 工具统计 */
  toolStats: {
    total: number;
    registered: number;
    failed: number;
  };
  /** 错误信息 */
  errors?: string[];
}

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
   * 获取服务健康状态
   */
  getHealthStatus(): ServiceHealth;

  /**
   * 执行健康检查
   */
  performHealthCheck(): Promise<ServiceHealth>;

  /**
   * 重启服务
   */
  restart(): Promise<void>;

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
  private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
  private initializationTime?: Date;
  private lastHealthCheck?: Date;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30秒

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
    // 如果当前状态是ERROR，允许重新初始化
    if (
      this.status !== ServiceStatus.NOT_INITIALIZED &&
      this.status !== ServiceStatus.ERROR
    ) {
      logger.warn('服务管理器已初始化或正在初始化中', { status: this.status });
      return;
    }

    this.status = ServiceStatus.INITIALIZING;
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

      this.status = ServiceStatus.RUNNING;
      this.initializationTime = new Date();

      // 启动健康检查
      this.startHealthMonitoring();

      logger.info('API转MCP服务管理器初始化完成', {
        context: {
          toolCount: this.toolRegistry.getToolCount(),
          status: this.status,
        },
      });
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      logger.error('API转MCP服务管理器初始化失败', error as Error);
      throw new Error(`初始化失败: ${(error as Error).message}`);
    }
  }

  async reloadConfig(): Promise<void> {
    this.ensureInitialized();

    if (!this.configPath) {
      throw new Error('配置文件路径未设置');
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
      this.status = ServiceStatus.ERROR;
      logger.error('重新加载配置失败', error as Error);
      throw new Error(`重新加载失败: ${(error as Error).message}`);
    }
  }

  async getApiTools(): Promise<McpTool[]> {
    this.ensureInitialized();
    return this.toolRegistry.getAllTools();
  }

  async executeApiTool(
    toolId: string,
    parameters: Record<string, unknown>,
  ): Promise<ApiToolResult> {
    this.ensureInitialized();

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

      logger.debug('API调用响应', {
        context: {
          toolId,
          response,
        },
      });

      // 处理错误响应
      if (!response.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: response.error || 'API调用失败',
            },
          ],
        };
      }

      // 处理成功响应，应用JSONata表达式（如果有）
      let resultData = response.data;
      if (config.response?.jsonata) {
        try {
          // 使用ResponseProcessor处理JSONata表达式
          const { ResponseProcessorImpl } = await import(
            './response-processor.js'
          );
          const processor = new ResponseProcessorImpl();
          // 确保响应数据是有效的JSON对象
          let jsonData = response.data;
          if (typeof response.data === 'string') {
            try {
              jsonData = JSON.parse(response.data);
            } catch (parseError) {
              // 如果解析失败，保持原始数据
              jsonData = response.data;
            }
          }
          resultData = await processor.processWithJsonata(
            jsonData,
            config.response.jsonata,
          );
        } catch (jsonataError) {
          logger.error('JSONata处理失败', jsonataError as Error, {
            context: { toolId },
          });
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `响应处理失败: ${(jsonataError as Error).message}`,
              },
            ],
          };
        }
      }

      // 确保结果数据是字符串格式
      let resultText: string;
      if (typeof resultData === 'string') {
        // 对于字符串结果，我们不需要额外的JSON序列化
        resultText = resultData;
      } else {
        resultText = JSON.stringify(resultData, null, 2);
      }

      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: resultText,
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

  getHealthStatus(): ServiceHealth {
    const now = new Date();
    const uptime = this.initializationTime
      ? Math.max(0, now.getTime() - this.initializationTime.getTime())
      : 0;

    const toolStats = this.toolRegistry.getStats();

    return {
      status: this.status,
      healthy: this.status === ServiceStatus.RUNNING,
      initializationTime: this.initializationTime,
      lastHealthCheck: this.lastHealthCheck,
      uptime,
      toolStats: {
        total: toolStats.totalTools,
        registered: toolStats.totalTools,
        failed: 0, // TODO: 实现失败工具统计
      },
    };
  }

  async performHealthCheck(): Promise<ServiceHealth> {
    this.lastHealthCheck = new Date();

    logger.debug('执行服务健康检查');

    try {
      const health = this.getHealthStatus();

      // 检查核心组件状态
      const errors: string[] = [];

      // 检查工具注册表
      if (this.toolRegistry.getToolCount() === 0) {
        errors.push('没有注册的API工具');
      }

      // 检查配置管理器
      if (!this.configPath) {
        errors.push('配置文件路径未设置');
      }

      // 更新健康状态
      const updatedHealth: ServiceHealth = {
        ...health,
        healthy: this.status === ServiceStatus.RUNNING && errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };

      if (errors.length > 0) {
        logger.warn('健康检查发现问题', { context: { errors } });
      } else {
        logger.debug('健康检查通过');
      }

      return updatedHealth;
    } catch (error) {
      logger.error('健康检查执行失败', error as Error);
      return {
        status: ServiceStatus.ERROR,
        healthy: false,
        errors: [`健康检查失败: ${(error as Error).message}`],
        toolStats: {
          total: 0,
          registered: 0,
          failed: 0,
        },
      };
    }
  }

  async restart(): Promise<void> {
    logger.info('重启API转MCP服务管理器');

    try {
      // 先关闭服务
      await this.shutdown();

      // 等待一小段时间确保资源清理完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重新初始化
      if (this.configPath) {
        // 重置状态以便重新初始化
        this.status = ServiceStatus.NOT_INITIALIZED;
        // 重新创建核心组件以确保干净状态
        this.configManager = new ApiConfigManagerImpl();
        this.toolGenerator = new ApiToolGenerator();
        this.toolRegistry = new ApiToolRegistry();

        // 创建HTTP客户端和认证管理器
        const httpClient = new HttpClient();
        const authManager = new AuthenticationManager();
        this.apiExecutor = new ApiExecutorImpl(httpClient, authManager);

        this.parameterValidator = new ParameterValidatorImpl();

        await this.initialize(this.configPath);
        logger.info('服务管理器重启完成');
      } else {
        throw new Error('无法重启：配置文件路径未设置');
      }
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      logger.error('服务管理器重启失败', error as Error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.status === ServiceStatus.SHUTDOWN) {
      logger.warn('服务管理器已关闭');
      return;
    }

    this.status = ServiceStatus.SHUTTING_DOWN;
    logger.info('关闭API转MCP服务管理器');

    try {
      // 停止健康检查
      this.stopHealthMonitoring();

      // 清理资源
      this.toolRegistry.clear();
      this.toolRegistry.removeAllEventListeners();

      this.status = ServiceStatus.SHUTDOWN;
      logger.info('API转MCP服务管理器已关闭');
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      logger.error('关闭服务管理器时发生错误', error as Error);
      throw error;
    }
  }

  /**
   * 确保服务已初始化
   */
  private ensureInitialized(): void {
    if (this.status !== ServiceStatus.RUNNING) {
      throw new Error(`服务管理器未运行，当前状态: ${this.status}`);
    }
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return; // 已经启动
    }

    logger.debug('启动健康监控', {
      context: { intervalMs: this.HEALTH_CHECK_INTERVAL_MS },
    });

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('定期健康检查失败', error as Error);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);

    // 立即执行一次健康检查
    setImmediate(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('初始健康检查失败', error as Error);
      }
    });
  }

  /**
   * 停止健康监控
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.debug('健康监控已停止');
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
