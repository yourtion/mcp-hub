/**
 * 服务器连接管理器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '../../types';
import {
  ConnectionFailedError,
  ConnectionManagerError,
  ConnectionNotFoundError,
  ConnectionState,
  type ServerConnectionInfo,
  ServerConnectionManager,
} from './connection-manager';

// 模拟控制台方法
const mockConsole = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// 替换全局console
vi.stubGlobal('console', mockConsole);

describe('ServerConnectionManager', () => {
  let connectionManager: ServerConnectionManager;
  let mockServerConfig: ServerConfig;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建模拟服务器配置
    mockServerConfig = {
      command: 'node',
      args: ['test-server.js'],
      disabled: false,
    };

    connectionManager = new ServerConnectionManager();
  });

  afterEach(() => {
    // 清理
    if (connectionManager) {
      connectionManager.shutdown().catch(() => {
        // 忽略关闭错误
      });
    }
  });

  describe('初始化', () => {
    it('应该成功初始化连接管理器', async () => {
      await connectionManager.initialize();

      expect(mockConsole.info).toHaveBeenCalledWith('初始化服务器连接管理器');
      expect(mockConsole.info).toHaveBeenCalledWith(
        '服务器连接管理器初始化完成',
      );
    });

    it('应该跳过重复初始化', async () => {
      await connectionManager.initialize();

      // 清除之前的日志调用
      mockConsole.warn.mockClear();

      // 尝试再次初始化
      await connectionManager.initialize();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '服务器连接管理器已初始化，跳过重复初始化',
      );
    });

    it('应该在未初始化时抛出错误', async () => {
      await expect(
        connectionManager.createConnection('test-server', mockServerConfig),
      ).rejects.toThrow(ConnectionManagerError);
    });
  });

  describe('连接管理', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该成功创建服务器连接', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const status = connectionManager.getConnectionStatus('test-server');
      expect(status.connected).toBe(true);
      expect(status.lastConnected).toBeInstanceOf(Date);
      expect(status.error).toBeNull();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '创建服务器连接',
        expect.objectContaining({
          serverId: 'test-server',
          command: 'node',
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith('服务器连接创建成功', {
        serverId: 'test-server',
      });
    });

    it('应该重新创建已存在的连接', async () => {
      // 创建第一个连接
      await connectionManager.createConnection('test-server', mockServerConfig);

      // 清除日志
      mockConsole.warn.mockClear();

      // 重新创建连接
      await connectionManager.createConnection('test-server', mockServerConfig);

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '服务器连接已存在，将重新创建',
        { serverId: 'test-server' },
      );
    });

    it('应该处理连接创建失败', async () => {
      // 模拟连接失败
      const originalPerformConnection = (
        connectionManager as unknown as { performConnection: unknown }
      ).performConnection;
      (
        connectionManager as unknown as { performConnection: unknown }
      ).performConnection = vi.fn().mockRejectedValue(new Error('连接失败'));

      await expect(
        connectionManager.createConnection('test-server', mockServerConfig),
      ).rejects.toThrow(ConnectionFailedError);

      const status = connectionManager.getConnectionStatus('test-server');
      expect(status.connected).toBe(false);
      expect(status.error).toBe('连接失败');

      // 恢复原方法
      (
        connectionManager as unknown as { performConnection: unknown }
      ).performConnection = originalPerformConnection;
    });

    it('应该成功关闭连接', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      // 清除日志
      mockConsole.info.mockClear();

      await connectionManager.closeConnection('test-server');

      const status = connectionManager.getConnectionStatus('test-server');
      expect(status.connected).toBe(false);
      expect(status.error).toBe('连接不存在');

      expect(mockConsole.info).toHaveBeenCalledWith('关闭服务器连接', {
        serverId: 'test-server',
      });
    });

    it('应该处理关闭不存在的连接', async () => {
      await connectionManager.closeConnection('nonexistent-server');

      expect(mockConsole.warn).toHaveBeenCalledWith('尝试关闭不存在的连接', {
        serverId: 'nonexistent-server',
      });
    });
  });

  describe('连接状态管理', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该返回正确的连接状态', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const status = connectionManager.getConnectionStatus('test-server');
      expect(status).toMatchObject({
        connected: true,
        error: null,
      });
      expect(status.lastConnected).toBeInstanceOf(Date);
    });

    it('应该返回不存在连接的状态', () => {
      const status =
        connectionManager.getConnectionStatus('nonexistent-server');
      expect(status).toEqual({
        connected: false,
        lastConnected: null,
        error: '连接不存在',
      });
    });

    it('应该返回连接信息', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const info = connectionManager.getConnectionInfo('test-server');
      expect(info).toMatchObject({
        id: 'test-server',
        state: ConnectionState.CONNECTED,
        reconnectAttempts: 0,
        healthCheckCount: 0,
      });
      expect(info?.config).toEqual(mockServerConfig);
      expect(info?.tools).toHaveLength(2); // 模拟工具
      expect(info?.lastConnected).toBeInstanceOf(Date);
    });

    it('应该返回所有连接信息', async () => {
      await connectionManager.createConnection('server1', mockServerConfig);
      await connectionManager.createConnection('server2', mockServerConfig);

      const allConnections = connectionManager.getAllConnections();
      expect(allConnections.size).toBe(2);
      expect(allConnections.has('server1')).toBe(true);
      expect(allConnections.has('server2')).toBe(true);
    });

    it('应该返回活跃连接列表', async () => {
      await connectionManager.createConnection('server1', mockServerConfig);
      await connectionManager.createConnection('server2', mockServerConfig);

      const activeConnections = connectionManager.getActiveConnections();
      expect(activeConnections).toHaveLength(2);
      expect(activeConnections).toContain('server1');
      expect(activeConnections).toContain('server2');
    });
  });

  describe('健康检查', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该对连接的服务器返回健康状态', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const isHealthy = await connectionManager.healthCheck('test-server');
      expect(isHealthy).toBe(true);

      const info = connectionManager.getConnectionInfo('test-server');
      expect(info?.healthCheckCount).toBe(1);
      expect(info?.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('应该对不存在的服务器返回不健康状态', async () => {
      const isHealthy =
        await connectionManager.healthCheck('nonexistent-server');
      expect(isHealthy).toBe(false);
    });

    it('应该对未连接的服务器返回不健康状态', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);
      await connectionManager.closeConnection('test-server');

      const isHealthy = await connectionManager.healthCheck('test-server');
      expect(isHealthy).toBe(false);
    });
  });

  describe('工具管理', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该返回服务器工具列表', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const tools = await connectionManager.getServerTools('test-server');
      expect(tools).toHaveLength(2);
      expect(tools[0]).toMatchObject({
        name: 'test-server_tool_1',
        description: '来自服务器 test-server 的工具 1',
        serverId: 'test-server',
      });
    });

    it('应该在服务器不存在时抛出错误', async () => {
      await expect(
        connectionManager.getServerTools('nonexistent-server'),
      ).rejects.toThrow(ConnectionNotFoundError);
    });

    it('应该在服务器未连接时返回空工具列表', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);
      await connectionManager.closeConnection('test-server');

      // 手动添加连接信息以模拟未连接状态
      const mockConnection: ServerConnectionInfo = {
        id: 'test-server',
        config: mockServerConfig,
        state: ConnectionState.DISCONNECTED,
        tools: [],
        reconnectAttempts: 0,
        healthCheckCount: 0,
      };
      (
        connectionManager as unknown as {
          connections: Map<string, ServerConnectionInfo>;
        }
      ).connections.set('test-server', mockConnection);

      const tools = await connectionManager.getServerTools('test-server');
      expect(tools).toHaveLength(0);
    });

    it('应该成功执行工具调用', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      const result = await connectionManager.executeToolOnServer(
        'test-server',
        'test-tool',
        { param: 'value' },
      );

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: '工具 test-tool 在服务器 test-server 上执行成功',
          },
        ],
        isError: false,
      });
    });

    it('应该在服务器不存在时抛出错误', async () => {
      await expect(
        connectionManager.executeToolOnServer(
          'nonexistent-server',
          'test-tool',
          {},
        ),
      ).rejects.toThrow(ConnectionNotFoundError);
    });

    it('应该在服务器未连接时抛出错误', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);
      await connectionManager.closeConnection('test-server');

      // 手动添加连接信息以模拟未连接状态
      const mockConnection: ServerConnectionInfo = {
        id: 'test-server',
        config: mockServerConfig,
        state: ConnectionState.DISCONNECTED,
        tools: [],
        reconnectAttempts: 0,
        healthCheckCount: 0,
      };
      (
        connectionManager as unknown as {
          connections: Map<string, ServerConnectionInfo>;
        }
      ).connections.set('test-server', mockConnection);

      await expect(
        connectionManager.executeToolOnServer('test-server', 'test-tool', {}),
      ).rejects.toThrow(ConnectionManagerError);
    });
  });

  describe('连接池统计', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该返回正确的连接池统计信息', async () => {
      await connectionManager.createConnection('server1', mockServerConfig);
      await connectionManager.createConnection('server2', mockServerConfig);

      // 执行一些健康检查
      await connectionManager.healthCheck('server1');
      await connectionManager.healthCheck('server2');

      const stats = connectionManager.getPoolStats();
      expect(stats).toMatchObject({
        totalConnections: 2,
        activeConnections: 2,
        failedConnections: 0,
        reconnectingConnections: 0,
        averageReconnectAttempts: 0,
        totalHealthChecks: 2,
      });
    });

    it('应该返回空连接池的统计信息', () => {
      const stats = connectionManager.getPoolStats();
      expect(stats).toEqual({
        totalConnections: 0,
        activeConnections: 0,
        failedConnections: 0,
        reconnectingConnections: 0,
        averageReconnectAttempts: 0,
        totalHealthChecks: 0,
      });
    });
  });

  describe('重新连接', () => {
    beforeEach(async () => {
      await connectionManager.initialize();
    });

    it('应该成功重新连接服务器', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      // 模拟连接断开
      const connection = connectionManager.getConnectionInfo('test-server');
      if (connection) {
        connection.state = ConnectionState.ERROR;
        connection.lastError = new Error('连接断开');
      }

      await connectionManager.reconnectServer('test-server');

      const status = connectionManager.getConnectionStatus('test-server');
      expect(status.connected).toBe(true);
      expect(status.error).toBeNull();

      const info = connectionManager.getConnectionInfo('test-server');
      expect(info?.reconnectAttempts).toBe(1);
    });

    it('应该在服务器不存在时抛出错误', async () => {
      await expect(
        connectionManager.reconnectServer('nonexistent-server'),
      ).rejects.toThrow(ConnectionNotFoundError);
    });

    it('应该在达到最大重连次数时抛出错误', async () => {
      await connectionManager.createConnection('test-server', mockServerConfig);

      // 设置重连次数达到上限
      const connection = connectionManager.getConnectionInfo('test-server');
      if (connection) {
        connection.reconnectAttempts = 3; // MAX_RECONNECT_ATTEMPTS
      }

      await expect(
        connectionManager.reconnectServer('test-server'),
      ).rejects.toThrow(ConnectionManagerError);
    });
  });

  describe('关闭', () => {
    it('应该在未初始化时跳过关闭', async () => {
      await connectionManager.shutdown();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '连接管理器未初始化，跳过关闭',
      );
    });

    it('应该成功关闭连接管理器', async () => {
      await connectionManager.initialize();
      await connectionManager.createConnection('server1', mockServerConfig);
      await connectionManager.createConnection('server2', mockServerConfig);

      // 清除初始化日志
      mockConsole.info.mockClear();

      await connectionManager.shutdown();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '开始关闭服务器连接管理器',
        expect.objectContaining({
          totalConnections: 2,
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '服务器连接管理器关闭完成',
        expect.objectContaining({
          shutdownTimeMs: expect.any(Number),
        }),
      );

      const stats = connectionManager.getPoolStats();
      expect(stats.totalConnections).toBe(0);
    });

    it('应该防止重复关闭', async () => {
      await connectionManager.initialize();

      // 开始第一次关闭（不等待完成）
      const shutdownPromise1 = connectionManager.shutdown();

      // 立即开始第二次关闭
      const shutdownPromise2 = connectionManager.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      expect(mockConsole.warn).toHaveBeenCalledWith('关闭已在进行中，等待完成');
    });
  });

  describe('错误处理', () => {
    it('应该正确创建ConnectionManagerError', () => {
      const error = new ConnectionManagerError(
        '测试错误',
        'TEST_ERROR',
        'test-server',
        { key: 'value' },
      );

      expect(error.name).toBe('ConnectionManagerError');
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.serverId).toBe('test-server');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('应该正确创建ConnectionNotFoundError', () => {
      const error = new ConnectionNotFoundError('test-server');

      expect(error).toBeInstanceOf(ConnectionManagerError);
      expect(error.code).toBe('CONNECTION_NOT_FOUND');
      expect(error.message).toBe("连接 'test-server' 未找到");
      expect(error.serverId).toBe('test-server');
    });

    it('应该正确创建ConnectionFailedError', () => {
      const error = new ConnectionFailedError('test-server', '网络错误');

      expect(error).toBeInstanceOf(ConnectionManagerError);
      expect(error.code).toBe('CONNECTION_FAILED');
      expect(error.message).toBe("连接 'test-server' 失败: 网络错误");
      expect(error.serverId).toBe('test-server');
      expect(error.context).toEqual({ reason: '网络错误' });
    });
  });
});
