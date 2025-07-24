/**
 * 服务器连接管理器
 * 负责MCP服务器连接池管理和状态监控
 */

import type { ConnectionStatus, ServerConfig, ToolInfo } from '../../types';

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
}

/**
 * 服务器连接信息
 */
export interface ServerConnectionInfo {
  id: string;
  config: ServerConfig;
  state: ConnectionState;
  client?: unknown; // MCP客户端实例
  tools: ToolInfo[];
  lastConnected?: Date;
  lastError?: Error;
  reconnectAttempts: number;
  healthCheckCount: number;
  lastHealthCheck?: Date;
}

/**
 * 连接池统计信息
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  reconnectingConnections: number;
  averageReconnectAttempts: number;
  totalHealthChecks: number;
}

/**
 * 服务器连接管理器错误类
 */
export class ConnectionManagerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly serverId?: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ConnectionManagerError';
  }
}

export class ConnectionNotFoundError extends ConnectionManagerError {
  constructor(serverId: string) {
    super(`连接 '${serverId}' 未找到`, 'CONNECTION_NOT_FOUND', serverId);
  }
}

export class ConnectionFailedError extends ConnectionManagerError {
  constructor(serverId: string, reason: string) {
    super(`连接 '${serverId}' 失败: ${reason}`, 'CONNECTION_FAILED', serverId, {
      reason,
    });
  }
}

/**
 * 服务器连接管理器接口
 */
export interface ServerConnectionManagerInterface {
  /**
   * 初始化连接管理器
   */
  initialize(): Promise<void>;

  /**
   * 创建服务器连接
   */
  createConnection(serverId: string, config: ServerConfig): Promise<void>;

  /**
   * 获取连接状态
   */
  getConnectionStatus(serverId: string): ConnectionStatus;

  /**
   * 获取连接信息
   */
  getConnectionInfo(serverId: string): ServerConnectionInfo | undefined;

  /**
   * 获取所有连接信息
   */
  getAllConnections(): Map<string, ServerConnectionInfo>;

  /**
   * 关闭连接
   */
  closeConnection(serverId: string): Promise<void>;

  /**
   * 获取所有活跃连接ID
   */
  getActiveConnections(): string[];

  /**
   * 健康检查
   */
  healthCheck(serverId: string): Promise<boolean>;

  /**
   * 执行工具调用
   */
  executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown>;

  /**
   * 获取服务器工具列表
   */
  getServerTools(serverId: string): Promise<ToolInfo[]>;

  /**
   * 获取连接池统计信息
   */
  getPoolStats(): ConnectionPoolStats;

  /**
   * 重新连接服务器
   */
  reconnectServer(serverId: string): Promise<void>;

  /**
   * 关闭所有连接
   */
  shutdown(): Promise<void>;
}

/**
 * 服务器连接管理器实现
 */
export class ServerConnectionManager
  implements ServerConnectionManagerInterface
{
  private connections = new Map<string, ServerConnectionInfo>();
  private initialized = false;
  private shutdownInProgress = false;

  // 配置常量
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY_BASE = 1000; // 1秒

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('服务器连接管理器已初始化，跳过重复初始化');
      return;
    }

    console.info('初始化服务器连接管理器');

    try {
      // 初始化连接池
      this.connections.clear();
      this.initialized = true;

      console.info('服务器连接管理器初始化完成');
    } catch (error) {
      console.error('服务器连接管理器初始化失败', error);
      throw new ConnectionManagerError(
        `连接管理器初始化失败: ${(error as Error).message}`,
        'INITIALIZATION_FAILED',
        undefined,
        { originalError: (error as Error).message },
      );
    }
  }

  async createConnection(
    serverId: string,
    config: ServerConfig,
  ): Promise<void> {
    this.ensureInitialized();

    console.info('创建服务器连接', { serverId, command: config.command });

    // 检查是否已存在连接
    if (this.connections.has(serverId)) {
      console.warn('服务器连接已存在，将重新创建', { serverId });
      await this.closeConnection(serverId);
    }

    // 创建连接信息
    const connectionInfo: ServerConnectionInfo = {
      id: serverId,
      config,
      state: ConnectionState.CONNECTING,
      tools: [],
      reconnectAttempts: 0,
      healthCheckCount: 0,
    };

    this.connections.set(serverId, connectionInfo);

    try {
      // 执行实际连接
      await this.performConnection(connectionInfo);

      connectionInfo.state = ConnectionState.CONNECTED;
      connectionInfo.lastConnected = new Date();
      connectionInfo.reconnectAttempts = 0;

      console.info('服务器连接创建成功', { serverId });

      // 发现工具
      await this.discoverTools(connectionInfo);
    } catch (error) {
      connectionInfo.state = ConnectionState.ERROR;
      connectionInfo.lastError = error as Error;

      console.error('服务器连接创建失败', error, { serverId });
      throw new ConnectionFailedError(serverId, (error as Error).message);
    }
  }

  getConnectionStatus(serverId: string): ConnectionStatus {
    const connection = this.connections.get(serverId);

    if (!connection) {
      return {
        connected: false,
        lastConnected: null,
        error: '连接不存在',
      };
    }

    return {
      connected: connection.state === ConnectionState.CONNECTED,
      lastConnected: connection.lastConnected || null,
      error: connection.lastError?.message || null,
    };
  }

  getConnectionInfo(serverId: string): ServerConnectionInfo | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): Map<string, ServerConnectionInfo> {
    return new Map(this.connections);
  }

  async closeConnection(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      console.warn('尝试关闭不存在的连接', { serverId });
      return;
    }

    console.info('关闭服务器连接', { serverId });

    try {
      // 如果有客户端实例，关闭它
      if (
        connection.client &&
        typeof (connection.client as { close?: () => Promise<void> }).close ===
          'function'
      ) {
        await (connection.client as { close: () => Promise<void> }).close();
      }

      // 更新状态
      connection.state = ConnectionState.DISCONNECTED;
      connection.client = undefined;

      console.info('服务器连接已关闭', { serverId });
    } catch (error) {
      console.error('关闭服务器连接时出错', error, { serverId });
      connection.lastError = error as Error;
    } finally {
      // 从连接池中移除
      this.connections.delete(serverId);
    }
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.entries())
      .filter(
        ([, connection]) => connection.state === ConnectionState.CONNECTED,
      )
      .map(([serverId]) => serverId);
  }

  async healthCheck(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return false;
    }

    console.debug('执行健康检查', { serverId });

    try {
      // 更新健康检查统计
      connection.healthCheckCount++;
      connection.lastHealthCheck = new Date();

      // 检查连接状态
      if (connection.state !== ConnectionState.CONNECTED) {
        return false;
      }

      // 如果有客户端，可以执行更详细的健康检查
      if (connection.client) {
        // 这里可以调用客户端的ping方法或列出工具来验证连接
        // 暂时只检查客户端是否存在
        return true;
      }

      return false;
    } catch (error) {
      console.error('健康检查失败', error, { serverId });
      connection.lastError = error as Error;
      return false;
    }
  }

  async executeToolOnServer(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new ConnectionNotFoundError(serverId);
    }

    if (connection.state !== ConnectionState.CONNECTED) {
      throw new ConnectionManagerError(
        `服务器 '${serverId}' 未连接 (状态: ${connection.state})`,
        'SERVER_NOT_CONNECTED',
        serverId,
        { state: connection.state },
      );
    }

    if (!connection.client) {
      throw new ConnectionManagerError(
        `服务器 '${serverId}' 客户端不可用`,
        'CLIENT_NOT_AVAILABLE',
        serverId,
      );
    }

    console.debug('在服务器上执行工具', { serverId, toolName, args });

    try {
      // 这里应该调用实际的MCP客户端callTool方法
      // 暂时返回模拟结果
      const mockResult = {
        content: [
          {
            type: 'text',
            text: `工具 ${toolName} 在服务器 ${serverId} 上执行成功`,
          },
        ],
        isError: false,
      };

      console.debug('工具执行完成', { serverId, toolName });
      return mockResult;
    } catch (error) {
      console.error('工具执行失败', error, { serverId, toolName });
      throw new ConnectionManagerError(
        `工具执行失败: ${(error as Error).message}`,
        'TOOL_EXECUTION_FAILED',
        serverId,
        { toolName, args, originalError: (error as Error).message },
      );
    }
  }

  async getServerTools(serverId: string): Promise<ToolInfo[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new ConnectionNotFoundError(serverId);
    }

    if (connection.state !== ConnectionState.CONNECTED) {
      console.warn('服务器未连接，返回空工具列表', {
        serverId,
        state: connection.state,
      });
      return [];
    }

    return [...connection.tools];
  }

  getPoolStats(): ConnectionPoolStats {
    const connections = Array.from(this.connections.values());

    const stats: ConnectionPoolStats = {
      totalConnections: connections.length,
      activeConnections: connections.filter(
        (c) => c.state === ConnectionState.CONNECTED,
      ).length,
      failedConnections: connections.filter(
        (c) => c.state === ConnectionState.ERROR,
      ).length,
      reconnectingConnections: connections.filter(
        (c) => c.state === ConnectionState.RECONNECTING,
      ).length,
      averageReconnectAttempts:
        connections.length > 0
          ? connections.reduce((sum, c) => sum + c.reconnectAttempts, 0) /
            connections.length
          : 0,
      totalHealthChecks: connections.reduce(
        (sum, c) => sum + c.healthCheckCount,
        0,
      ),
    };

    return stats;
  }

  async reconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new ConnectionNotFoundError(serverId);
    }

    console.info('重新连接服务器', {
      serverId,
      attempts: connection.reconnectAttempts,
    });

    // 检查重连次数限制
    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      throw new ConnectionManagerError(
        `服务器 '${serverId}' 重连次数已达上限`,
        'MAX_RECONNECT_ATTEMPTS_EXCEEDED',
        serverId,
        { maxAttempts: this.MAX_RECONNECT_ATTEMPTS },
      );
    }

    connection.state = ConnectionState.RECONNECTING;
    connection.reconnectAttempts++;

    try {
      // 关闭现有连接
      if (
        connection.client &&
        typeof (connection.client as { close?: () => Promise<void> }).close ===
          'function'
      ) {
        await (connection.client as { close: () => Promise<void> }).close();
      }
      connection.client = undefined;

      // 等待重连延迟
      const delay =
        this.RECONNECT_DELAY_BASE * 2 ** (connection.reconnectAttempts - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      // 重新连接
      await this.performConnection(connection);

      connection.state = ConnectionState.CONNECTED;
      connection.lastConnected = new Date();
      connection.lastError = undefined;

      console.info('服务器重连成功', {
        serverId,
        attempts: connection.reconnectAttempts,
      });

      // 重新发现工具
      await this.discoverTools(connection);
    } catch (error) {
      connection.state = ConnectionState.ERROR;
      connection.lastError = error as Error;

      console.error('服务器重连失败', error, {
        serverId,
        attempts: connection.reconnectAttempts,
      });

      throw new ConnectionFailedError(serverId, (error as Error).message);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      console.warn('连接管理器未初始化，跳过关闭');
      return;
    }

    if (this.shutdownInProgress) {
      console.warn('关闭已在进行中，等待完成');
      return;
    }

    this.shutdownInProgress = true;
    const shutdownStartTime = Date.now();

    console.info('开始关闭服务器连接管理器', {
      totalConnections: this.connections.size,
      timestamp: new Date().toISOString(),
    });

    try {
      // 关闭所有连接
      const closePromises = Array.from(this.connections.keys()).map(
        (serverId) => this.closeConnection(serverId),
      );

      await Promise.allSettled(closePromises);

      // 清理状态
      this.connections.clear();
      this.initialized = false;
      this.shutdownInProgress = false;

      const shutdownDuration = Date.now() - shutdownStartTime;
      console.info('服务器连接管理器关闭完成', {
        shutdownTimeMs: shutdownDuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const shutdownDuration = Date.now() - shutdownStartTime;
      console.error('服务器连接管理器关闭时出错', error, {
        shutdownTimeMs: shutdownDuration,
      });

      this.shutdownInProgress = false;
      throw new ConnectionManagerError(
        `连接管理器关闭失败: ${(error as Error).message}`,
        'SHUTDOWN_FAILED',
        undefined,
        { originalError: (error as Error).message },
      );
    }
  }

  // 私有辅助方法

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ConnectionManagerError(
        '连接管理器必须在使用前初始化',
        'NOT_INITIALIZED',
      );
    }
  }

  private async performConnection(
    connection: ServerConnectionInfo,
  ): Promise<void> {
    const { id: serverId, config } = connection;

    console.debug('执行服务器连接', { serverId, command: config.command });

    try {
      // 这里应该实现实际的MCP客户端连接逻辑
      // 暂时模拟连接过程
      await this.simulateConnection(connection);

      console.debug('服务器连接成功', { serverId });
    } catch (error) {
      console.error('服务器连接失败', error, { serverId });
      throw error;
    }
  }

  private async simulateConnection(
    connection: ServerConnectionInfo,
  ): Promise<void> {
    // 模拟连接延迟
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 模拟创建客户端
    connection.client = {
      id: connection.id,
      connected: true,
      close: async () => {
        console.debug('模拟客户端关闭', { serverId: connection.id });
      },
    };

    console.debug('模拟连接完成', { serverId: connection.id });
  }

  private async discoverTools(connection: ServerConnectionInfo): Promise<void> {
    const { id: serverId } = connection;

    console.debug('发现服务器工具', { serverId });

    try {
      // 这里应该调用实际的MCP客户端listTools方法
      // 暂时返回模拟工具
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

      connection.tools = mockTools;

      console.info('工具发现完成', {
        serverId,
        toolCount: mockTools.length,
        toolNames: mockTools.map((t) => t.name),
      });
    } catch (error) {
      console.error('工具发现失败', error, { serverId });
      connection.tools = [];
      connection.lastError = error as Error;
    }
  }
}
