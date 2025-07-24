/**
 * MCP服务管理器
 * 负责MCP服务的注册、初始化和生命周期管理
 */

import type {
  McpServerConfig,
  ServerConfig,
  ServiceStatus,
  ToolInfo,
  ToolResult,
} from '../../types';

/**
 * MCP服务管理器错误类
 */
export class McpServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpServiceError';
  }
}

export class ServiceNotInitializedError extends McpServiceError {
  constructor() {
    super('MCP服务管理器必须在使用前初始化', 'SERVICE_NOT_INITIALIZED');
  }
}

export class ServerNotFoundError extends McpServiceError {
  constructor(serverId: string) {
    super(`服务器 '${serverId}' 未找到`, 'SERVER_NOT_FOUND', { serverId });
  }
}

export class ToolNotFoundError extends McpServiceError {
  constructor(toolName: string, serverId?: string) {
    super(
      `工具 '${toolName}' 未找到${serverId ? ` 在服务器 '${serverId}'` : ''}`,
      'TOOL_NOT_FOUND',
      { toolName, serverId },
    );
  }
}

/**
 * 服务器连接状态
 */
export enum ServerStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 服务器连接信息
 */
export interface ServerConnection {
  id: string;
  config: ServerConfig;
  status: ServerStatus;
  tools: ToolInfo[];
  lastConnected?: Date;
  lastError?: Error;
  reconnectAttempts: number;
}

/**
 * MCP服务管理器接口
 */
export interface McpServiceManagerInterface {
  /**
   * 从配置初始化MCP服务
   */
  initializeFromConfig(config: McpServerConfig): Promise<void>;

  /**
   * 注册MCP服务器
   */
  registerServer(serverId: string, config: ServerConfig): Promise<void>;

  /**
   * 获取所有可用工具
   */
  getAllTools(): Promise<ToolInfo[]>;

  /**
   * 获取指定服务器的工具
   */
  getServerTools(serverId: string): Promise<ToolInfo[]>;

  /**
   * 执行工具调用
   */
  executeToolCall(
    toolName: string,
    args: unknown,
    serverId?: string,
  ): Promise<ToolResult>;

  /**
   * 获取服务状态
   */
  getServiceStatus(): ServiceStatus;

  /**
   * 获取所有服务器连接状态
   */
  getServerConnections(): Map<string, ServerConnection>;

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName: string, serverId?: string): Promise<boolean>;

  /**
   * 关闭所有连接
   */
  shutdown(): Promise<void>;
}

/**
 * MCP服务管理器实现
 */
export class McpServiceManager implements McpServiceManagerInterface {
  private servers = new Map<string, ServerConnection>();
  private serverConfigs = new Map<string, ServerConfig>();
  private initialized = false;
  private shutdownInProgress = false;

  constructor(config?: McpServerConfig) {
    if (config) {
      // 异步初始化将在initializeFromConfig中处理
      this.initializeFromConfig(config).catch((error) => {
        console.error('MCP服务管理器初始化失败:', error);
      });
    }
  }

  async initializeFromConfig(config: McpServerConfig): Promise<void> {
    if (this.initialized) {
      console.warn('MCP服务管理器已初始化，跳过重复初始化');
      return;
    }

    const initStartTime = Date.now();
    console.info('开始初始化MCP服务管理器', {
      serverCount: Object.keys(config.servers).length,
      timestamp: new Date().toISOString(),
    });

    try {
      // 存储服务器配置
      for (const [serverId, serverConfig] of Object.entries(config.servers)) {
        this.serverConfigs.set(serverId, serverConfig);
      }

      // 初始化所有服务器连接
      const initPromises = Array.from(this.serverConfigs.entries()).map(
        ([serverId, serverConfig]) =>
          this.initializeServer(serverId, serverConfig),
      );

      // 并发初始化所有服务器，但不因部分失败而整体失败
      const results = await Promise.allSettled(initPromises);

      // 检查是否有严重错误（所有服务器都失败）
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length === results.length && results.length > 0) {
        // 如果所有服务器都失败了，抛出第一个错误
        const firstFailure = failures[0] as PromiseRejectedResult;
        throw firstFailure.reason;
      }

      const connectedCount = this.getConnectedServerCount();
      this.initialized = true;

      const initDuration = Date.now() - initStartTime;
      console.info('MCP服务管理器初始化完成', {
        totalServers: this.serverConfigs.size,
        connectedServers: connectedCount,
        failedServers: this.serverConfigs.size - connectedCount,
        initializationTimeMs: initDuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const initDuration = Date.now() - initStartTime;
      console.error('MCP服务管理器初始化失败', error, {
        initializationTimeMs: initDuration,
        serverCount: Object.keys(config.servers).length,
      });

      // 清理失败的初始化
      await this.cleanupFailedInitialization();
      throw new McpServiceError(
        `服务初始化失败: ${(error as Error).message}`,
        'INITIALIZATION_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  async registerServer(serverId: string, config: ServerConfig): Promise<void> {
    console.info('注册MCP服务器', { serverId });

    try {
      // 存储配置
      this.serverConfigs.set(serverId, config);

      // 如果已初始化，立即初始化新服务器
      if (this.initialized) {
        await this.initializeServer(serverId, config);
      }

      console.info('MCP服务器注册成功', { serverId });
    } catch (error) {
      console.error('MCP服务器注册失败', error, { serverId });
      throw new McpServiceError(
        `服务器注册失败: ${(error as Error).message}`,
        'SERVER_REGISTRATION_FAILED',
        { serverId, originalError: (error as Error).message },
      );
    }
  }

  async getAllTools(): Promise<ToolInfo[]> {
    this.ensureInitialized();

    console.debug('获取所有可用工具');

    try {
      const allTools: ToolInfo[] = [];
      const connectedServers = Array.from(this.servers.values()).filter(
        (server) => server.status === ServerStatus.CONNECTED,
      );

      for (const server of connectedServers) {
        allTools.push(...server.tools);
      }

      console.debug('获取所有工具完成', {
        totalTools: allTools.length,
        connectedServers: connectedServers.length,
      });

      return allTools;
    } catch (error) {
      console.error('获取所有工具失败', error);
      throw new McpServiceError(
        `获取工具失败: ${(error as Error).message}`,
        'GET_TOOLS_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  async getServerTools(serverId: string): Promise<ToolInfo[]> {
    this.ensureInitialized();

    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    if (server.status !== ServerStatus.CONNECTED) {
      console.warn('服务器未连接，返回空工具列表', {
        serverId,
        status: server.status,
      });
      return [];
    }

    return [...server.tools];
  }

  async executeToolCall(
    toolName: string,
    args: unknown,
    serverId?: string,
  ): Promise<ToolResult> {
    this.ensureInitialized();

    const executionId = `exec-${toolName}-${Date.now()}`;
    console.info('开始执行工具调用', {
      executionId,
      toolName,
      serverId,
      args,
    });

    try {
      // 如果指定了服务器ID，直接在该服务器上执行
      if (serverId) {
        return await this.executeToolOnServer(
          serverId,
          toolName,
          args,
          executionId,
        );
      }

      // 否则查找包含该工具的服务器
      const targetServerId = await this.findToolServer(toolName);
      if (!targetServerId) {
        throw new ToolNotFoundError(toolName);
      }

      return await this.executeToolOnServer(
        targetServerId,
        toolName,
        args,
        executionId,
      );
    } catch (error) {
      console.error('工具执行失败', error, {
        executionId,
        toolName,
        serverId,
      });

      if (error instanceof McpServiceError) {
        throw error;
      }

      throw new McpServiceError(
        `工具执行失败: ${(error as Error).message}`,
        'TOOL_EXECUTION_FAILED',
        {
          toolName,
          serverId,
          executionId,
          originalError: (error as Error).message,
        },
      );
    }
  }

  getServiceStatus(): ServiceStatus {
    const connectedServers = this.getConnectedServerCount();

    return {
      initialized: this.initialized,
      serverCount: this.serverConfigs.size,
      activeConnections: connectedServers,
      lastUpdated: new Date(),
      error: this.initialized ? undefined : '服务未初始化',
    };
  }

  getServerConnections(): Map<string, ServerConnection> {
    return new Map(this.servers);
  }

  async isToolAvailable(toolName: string, serverId?: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      if (serverId) {
        const server = this.servers.get(serverId);
        if (!server || server.status !== ServerStatus.CONNECTED) {
          return false;
        }
        return server.tools.some((tool) => tool.name === toolName);
      }

      // 在所有连接的服务器中查找
      const targetServerId = await this.findToolServer(toolName);
      return targetServerId !== undefined;
    } catch (error) {
      console.error('检查工具可用性失败', error, { toolName, serverId });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      console.warn('MCP服务管理器未初始化，跳过关闭');
      return;
    }

    if (this.shutdownInProgress) {
      console.warn('关闭已在进行中，等待完成');
      return;
    }

    this.shutdownInProgress = true;
    const shutdownStartTime = Date.now();

    console.info('开始关闭MCP服务管理器', {
      timestamp: new Date().toISOString(),
      connectedServers: this.getConnectedServerCount(),
    });

    try {
      // 关闭所有服务器连接
      const shutdownPromises = Array.from(this.servers.values()).map(
        async (server) => {
          try {
            if (server.status === ServerStatus.CONNECTED) {
              // 这里应该调用实际的客户端关闭方法
              // 由于我们在核心包中，暂时只更新状态
              server.status = ServerStatus.DISCONNECTED;
              console.debug('服务器连接已关闭', { serverId: server.id });
            }
          } catch (error) {
            console.error('关闭服务器连接时出错', error, {
              serverId: server.id,
            });
          }
        },
      );

      await Promise.allSettled(shutdownPromises);

      // 清理状态
      this.servers.clear();
      this.serverConfigs.clear();
      this.initialized = false;
      this.shutdownInProgress = false;

      const shutdownDuration = Date.now() - shutdownStartTime;
      console.info('MCP服务管理器关闭完成', {
        shutdownTimeMs: shutdownDuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const shutdownDuration = Date.now() - shutdownStartTime;
      console.error('MCP服务管理器关闭时出错', error, {
        shutdownTimeMs: shutdownDuration,
      });

      this.shutdownInProgress = false;
      throw new McpServiceError(
        `服务关闭失败: ${(error as Error).message}`,
        'SHUTDOWN_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  // 私有辅助方法

  private async initializeServer(
    serverId: string,
    config: ServerConfig,
  ): Promise<void> {
    // 跳过禁用的服务器
    if (config.disabled === true) {
      console.info('跳过禁用的服务器', { serverId });
      return;
    }

    console.info('初始化服务器', { serverId });

    const serverConnection: ServerConnection = {
      id: serverId,
      config,
      status: ServerStatus.CONNECTING,
      tools: [],
      reconnectAttempts: 0,
    };

    this.servers.set(serverId, serverConnection);

    try {
      // 这里应该实现实际的服务器连接逻辑
      // 由于我们在核心包中，暂时模拟连接成功
      await this.simulateServerConnection(serverConnection);

      serverConnection.status = ServerStatus.CONNECTED;
      serverConnection.lastConnected = new Date();
      serverConnection.reconnectAttempts = 0;

      console.info('服务器连接成功', { serverId });

      // 发现工具
      await this.discoverServerTools(serverConnection);
    } catch (error) {
      serverConnection.status = ServerStatus.ERROR;
      serverConnection.lastError = error as Error;
      console.error('服务器初始化失败', error, { serverId });
      throw error;
    }
  }

  private async simulateServerConnection(
    serverConnection: ServerConnection,
  ): Promise<void> {
    // 模拟连接延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 这里应该实现实际的MCP客户端连接逻辑
    // 暂时只是模拟成功
    console.debug('模拟服务器连接', { serverId: serverConnection.id });
  }

  private async discoverServerTools(
    serverConnection: ServerConnection,
  ): Promise<void> {
    const { id: serverId } = serverConnection;

    try {
      // 这里应该调用实际的MCP客户端listTools方法
      // 暂时返回模拟的工具列表
      const mockTools: ToolInfo[] = [
        {
          name: `${serverId}_tool_1`,
          description: `来自服务器 ${serverId} 的工具 1`,
          serverId,
        },
        {
          name: `${serverId}_tool_2`,
          description: `来自服务器 ${serverId} 的工具 2`,
          serverId,
        },
      ];

      serverConnection.tools = mockTools;
      console.info('工具发现完成', {
        serverId,
        toolCount: mockTools.length,
        toolNames: mockTools.map((t) => t.name),
      });
    } catch (error) {
      console.error('工具发现失败', error, { serverId });
      serverConnection.tools = [];
    }
  }

  private async executeToolOnServer(
    serverId: string,
    toolName: string,
    args: unknown,
    executionId: string,
  ): Promise<ToolResult> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    if (server.status !== ServerStatus.CONNECTED) {
      throw new McpServiceError(
        `服务器 ${serverId} 未连接 (状态: ${server.status})`,
        'SERVER_NOT_CONNECTED',
        { serverId, status: server.status },
      );
    }

    // 验证工具存在
    const tool = server.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName, serverId);
    }

    try {
      console.debug('在服务器上执行工具', {
        executionId,
        serverId,
        toolName,
        args,
      });

      // 这里应该调用实际的MCP客户端callTool方法
      // 暂时返回模拟结果
      const mockResult: ToolResult = {
        success: true,
        data: {
          message: `工具 ${toolName} 在服务器 ${serverId} 上执行成功`,
          args,
          timestamp: new Date().toISOString(),
        },
        executionTime: 100,
        metadata: {
          serverId,
          toolName,
          executionId,
        },
      };

      console.debug('工具执行完成', {
        executionId,
        serverId,
        toolName,
        success: mockResult.success,
      });

      return mockResult;
    } catch (error) {
      console.error('工具执行失败', error, {
        executionId,
        serverId,
        toolName,
      });
      throw error;
    }
  }

  private async findToolServer(toolName: string): Promise<string | undefined> {
    const connectedServers = Array.from(this.servers.values()).filter(
      (server) => server.status === ServerStatus.CONNECTED,
    );

    for (const server of connectedServers) {
      if (server.tools.some((tool) => tool.name === toolName)) {
        return server.id;
      }
    }

    return undefined;
  }

  private getConnectedServerCount(): number {
    return Array.from(this.servers.values()).filter(
      (server) => server.status === ServerStatus.CONNECTED,
    ).length;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ServiceNotInitializedError();
    }
  }

  private async cleanupFailedInitialization(): Promise<void> {
    console.debug('清理失败的初始化');

    try {
      // 清理部分初始化的服务器连接
      for (const server of this.servers.values()) {
        if (server.status === ServerStatus.CONNECTED) {
          server.status = ServerStatus.DISCONNECTED;
        }
      }

      this.servers.clear();
      console.debug('初始化清理完成');
    } catch (cleanupError) {
      console.error('初始化清理时出错', cleanupError);
      // 不抛出清理错误，只记录
    }
  }
}
