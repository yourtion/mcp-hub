/**
 * MCP服务管理器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerConfig, ServerConfig } from '../../types';
import {
  McpServiceError,
  McpServiceManager,
  ServerNotFoundError,
  ServerStatus,
  ServiceNotInitializedError,
  ToolNotFoundError,
} from './service-manager';

// 模拟控制台方法
const mockConsole = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// 替换全局console
vi.stubGlobal('console', mockConsole);

describe('McpServiceManager', () => {
  let serviceManager: McpServiceManager;
  let mockConfig: McpServerConfig;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建模拟配置
    mockConfig = {
      servers: {
        server1: {
          command: 'node',
          args: ['server1.js'],
          disabled: false,
        } as ServerConfig,
        server2: {
          command: 'python',
          args: ['server2.py'],
          disabled: false,
        } as ServerConfig,
        disabledServer: {
          command: 'node',
          args: ['disabled.js'],
          disabled: true,
        } as ServerConfig,
      },
    };

    serviceManager = new McpServiceManager();
  });

  afterEach(() => {
    // 清理
    if (serviceManager) {
      serviceManager.shutdown().catch(() => {
        // 忽略关闭错误
      });
    }
  });

  describe('构造函数', () => {
    it('应该创建未初始化的服务管理器', () => {
      const manager = new McpServiceManager();
      const status = manager.getServiceStatus();

      expect(status.initialized).toBe(false);
      expect(status.serverCount).toBe(0);
      expect(status.activeConnections).toBe(0);
    });

    it('应该接受配置并异步初始化', () => {
      const manager = new McpServiceManager(mockConfig);
      const status = manager.getServiceStatus();

      // 构造函数不会同步初始化
      expect(status.initialized).toBe(false);
    });
  });

  describe('initializeFromConfig', () => {
    it('应该成功初始化服务管理器', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      const status = serviceManager.getServiceStatus();
      expect(status.initialized).toBe(true);
      expect(status.serverCount).toBe(3); // 包括禁用的服务器
      expect(status.activeConnections).toBe(2); // 只有启用的服务器

      // 验证日志调用
      expect(mockConsole.info).toHaveBeenCalledWith(
        '开始初始化MCP服务管理器',
        expect.objectContaining({
          serverCount: 3,
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        'MCP服务管理器初始化完成',
        expect.objectContaining({
          totalServers: 3,
          connectedServers: 2,
          failedServers: 1,
        }),
      );
    });

    it('应该跳过重复初始化', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      // 清除之前的日志调用
      mockConsole.warn.mockClear();

      // 尝试再次初始化
      await serviceManager.initializeFromConfig(mockConfig);

      expect(mockConsole.warn).toHaveBeenCalledWith(
        'MCP服务管理器已初始化，跳过重复初始化',
      );
    });

    it('应该跳过禁用的服务器', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      expect(mockConsole.info).toHaveBeenCalledWith('跳过禁用的服务器', {
        serverId: 'disabledServer',
      });
    });

    it('应该处理初始化错误', async () => {
      // 创建会导致错误的配置
      const errorConfig: McpServerConfig = {
        servers: {
          errorServer: {
            command: 'invalid-command',
            args: [],
          } as ServerConfig,
        },
      };

      // 模拟服务器初始化失败
      const originalInitializeServer = (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer;
      (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer = vi.fn().mockRejectedValue(new Error('连接失败'));

      await expect(
        serviceManager.initializeFromConfig(errorConfig),
      ).rejects.toThrow(McpServiceError);

      // 恢复原方法
      (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer = originalInitializeServer;
    });
  });

  describe('registerServer', () => {
    beforeEach(async () => {
      await serviceManager.initializeFromConfig(mockConfig);
    });

    it('应该成功注册新服务器', async () => {
      const newServerConfig: ServerConfig = {
        command: 'node',
        args: ['new-server.js'],
        disabled: false,
      };

      await serviceManager.registerServer('newServer', newServerConfig);

      const status = serviceManager.getServiceStatus();
      expect(status.serverCount).toBe(4);

      expect(mockConsole.info).toHaveBeenCalledWith('注册MCP服务器', {
        serverId: 'newServer',
      });

      expect(mockConsole.info).toHaveBeenCalledWith('MCP服务器注册成功', {
        serverId: 'newServer',
      });
    });

    it('应该处理注册错误', async () => {
      // 模拟初始化服务器失败
      const originalInitializeServer = (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer;
      (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer = vi.fn().mockRejectedValue(new Error('初始化失败'));

      const newServerConfig: ServerConfig = {
        command: 'invalid',
        args: [],
      };

      await expect(
        serviceManager.registerServer('errorServer', newServerConfig),
      ).rejects.toThrow(McpServiceError);

      // 恢复原方法
      (
        serviceManager as unknown as { initializeServer: unknown }
      ).initializeServer = originalInitializeServer;
    });
  });

  describe('getAllTools', () => {
    it('应该在未初始化时抛出错误', async () => {
      await expect(serviceManager.getAllTools()).rejects.toThrow(
        ServiceNotInitializedError,
      );
    });

    it('应该返回所有连接服务器的工具', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      const tools = await serviceManager.getAllTools();

      expect(tools).toHaveLength(4); // 2个服务器，每个2个工具
      expect(tools[0]).toMatchObject({
        name: 'server1_tool_1',
        description: '来自服务器 server1 的工具 1',
        serverId: 'server1',
      });

      expect(mockConsole.debug).toHaveBeenCalledWith('获取所有可用工具');
      expect(mockConsole.debug).toHaveBeenCalledWith(
        '获取所有工具完成',
        expect.objectContaining({
          totalTools: 4,
          connectedServers: 2,
        }),
      );
    });
  });

  describe('getServerTools', () => {
    beforeEach(async () => {
      await serviceManager.initializeFromConfig(mockConfig);
    });

    it('应该返回指定服务器的工具', async () => {
      const tools = await serviceManager.getServerTools('server1');

      expect(tools).toHaveLength(2);
      expect(tools[0].serverId).toBe('server1');
      expect(tools[1].serverId).toBe('server1');
    });

    it('应该在服务器不存在时抛出错误', async () => {
      await expect(
        serviceManager.getServerTools('nonexistent'),
      ).rejects.toThrow(ServerNotFoundError);
    });

    it('应该在服务器未连接时返回空数组', async () => {
      // 模拟服务器断开连接
      const connections = serviceManager.getServerConnections();
      const server1 = connections.get('server1');
      if (server1) {
        server1.status = ServerStatus.DISCONNECTED;
      }

      const tools = await serviceManager.getServerTools('server1');
      expect(tools).toHaveLength(0);
    });
  });

  describe('executeToolCall', () => {
    beforeEach(async () => {
      await serviceManager.initializeFromConfig(mockConfig);
    });

    it('应该成功执行工具调用（指定服务器）', async () => {
      const result = await serviceManager.executeToolCall(
        'server1_tool_1',
        { param: 'value' },
        'server1',
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        message: '工具 server1_tool_1 在服务器 server1 上执行成功',
        args: { param: 'value' },
      });
      expect(result.executionTime).toBe(100);
    });

    it('应该成功执行工具调用（自动查找服务器）', async () => {
      const result = await serviceManager.executeToolCall('server2_tool_1', {
        param: 'value',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({
        serverId: 'server2',
        toolName: 'server2_tool_1',
      });
    });

    it('应该在工具不存在时抛出错误', async () => {
      await expect(
        serviceManager.executeToolCall('nonexistent_tool', {}),
      ).rejects.toThrow(ToolNotFoundError);
    });

    it('应该在指定服务器不存在时抛出错误', async () => {
      await expect(
        serviceManager.executeToolCall('any_tool', {}, 'nonexistent_server'),
      ).rejects.toThrow(ServerNotFoundError);
    });

    it('应该在服务器未连接时抛出错误', async () => {
      // 模拟服务器断开连接
      const connections = serviceManager.getServerConnections();
      const server1 = connections.get('server1');
      if (server1) {
        server1.status = ServerStatus.DISCONNECTED;
      }

      await expect(
        serviceManager.executeToolCall('server1_tool_1', {}, 'server1'),
      ).rejects.toThrow(McpServiceError);
    });
  });

  describe('getServiceStatus', () => {
    it('应该返回未初始化状态', () => {
      const status = serviceManager.getServiceStatus();

      expect(status).toMatchObject({
        initialized: false,
        serverCount: 0,
        activeConnections: 0,
        error: '服务未初始化',
      });
      expect(status.lastUpdated).toBeInstanceOf(Date);
    });

    it('应该返回已初始化状态', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      const status = serviceManager.getServiceStatus();

      expect(status).toMatchObject({
        initialized: true,
        serverCount: 3,
        activeConnections: 2,
        error: undefined,
      });
      expect(status.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('getServerConnections', () => {
    it('应该返回服务器连接信息', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      const connections = serviceManager.getServerConnections();

      expect(connections.size).toBe(2); // 只有启用的服务器
      expect(connections.has('server1')).toBe(true);
      expect(connections.has('server2')).toBe(true);
      expect(connections.has('disabledServer')).toBe(false);

      const server1 = connections.get('server1');
      expect(server1).toMatchObject({
        id: 'server1',
        status: ServerStatus.CONNECTED,
        reconnectAttempts: 0,
      });
      expect(server1?.tools).toHaveLength(2);
      expect(server1?.lastConnected).toBeInstanceOf(Date);
    });
  });

  describe('isToolAvailable', () => {
    beforeEach(async () => {
      await serviceManager.initializeFromConfig(mockConfig);
    });

    it('应该检查工具在指定服务器上的可用性', async () => {
      const available = await serviceManager.isToolAvailable(
        'server1_tool_1',
        'server1',
      );
      expect(available).toBe(true);

      const notAvailable = await serviceManager.isToolAvailable(
        'nonexistent_tool',
        'server1',
      );
      expect(notAvailable).toBe(false);
    });

    it('应该检查工具在所有服务器上的可用性', async () => {
      const available = await serviceManager.isToolAvailable('server2_tool_1');
      expect(available).toBe(true);

      const notAvailable =
        await serviceManager.isToolAvailable('nonexistent_tool');
      expect(notAvailable).toBe(false);
    });

    it('应该在服务器不存在时返回false', async () => {
      const available = await serviceManager.isToolAvailable(
        'any_tool',
        'nonexistent_server',
      );
      expect(available).toBe(false);
    });

    it('应该在服务器未连接时返回false', async () => {
      // 模拟服务器断开连接
      const connections = serviceManager.getServerConnections();
      const server1 = connections.get('server1');
      if (server1) {
        server1.status = ServerStatus.DISCONNECTED;
      }

      const available = await serviceManager.isToolAvailable(
        'server1_tool_1',
        'server1',
      );
      expect(available).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('应该在未初始化时跳过关闭', async () => {
      await serviceManager.shutdown();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        'MCP服务管理器未初始化，跳过关闭',
      );
    });

    it('应该成功关闭服务管理器', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      // 清除初始化日志
      mockConsole.info.mockClear();

      await serviceManager.shutdown();

      const status = serviceManager.getServiceStatus();
      expect(status.initialized).toBe(false);
      expect(status.serverCount).toBe(0);
      expect(status.activeConnections).toBe(0);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '开始关闭MCP服务管理器',
        expect.objectContaining({
          connectedServers: 2,
        }),
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        'MCP服务管理器关闭完成',
        expect.objectContaining({
          shutdownTimeMs: expect.any(Number),
        }),
      );
    });

    it('应该防止重复关闭', async () => {
      await serviceManager.initializeFromConfig(mockConfig);

      // 开始第一次关闭（不等待完成）
      const shutdownPromise1 = serviceManager.shutdown();

      // 立即开始第二次关闭
      const shutdownPromise2 = serviceManager.shutdown();

      await Promise.all([shutdownPromise1, shutdownPromise2]);

      expect(mockConsole.warn).toHaveBeenCalledWith('关闭已在进行中，等待完成');
    });
  });

  describe('错误处理', () => {
    it('应该正确创建和抛出McpServiceError', () => {
      const error = new McpServiceError('测试错误', 'TEST_ERROR', {
        key: 'value',
      });

      expect(error.name).toBe('McpServiceError');
      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('应该正确创建ServiceNotInitializedError', () => {
      const error = new ServiceNotInitializedError();

      expect(error).toBeInstanceOf(McpServiceError);
      expect(error.code).toBe('SERVICE_NOT_INITIALIZED');
      expect(error.message).toBe('MCP服务管理器必须在使用前初始化');
    });

    it('应该正确创建ServerNotFoundError', () => {
      const error = new ServerNotFoundError('test-server');

      expect(error).toBeInstanceOf(McpServiceError);
      expect(error.code).toBe('SERVER_NOT_FOUND');
      expect(error.message).toBe("服务器 'test-server' 未找到");
      expect(error.context).toEqual({ serverId: 'test-server' });
    });

    it('应该正确创建ToolNotFoundError', () => {
      const error1 = new ToolNotFoundError('test-tool');
      expect(error1.message).toBe("工具 'test-tool' 未找到");

      const error2 = new ToolNotFoundError('test-tool', 'test-server');
      expect(error2.message).toBe(
        "工具 'test-tool' 未找到 在服务器 'test-server'",
      );
      expect(error2.context).toEqual({
        toolName: 'test-tool',
        serverId: 'test-server',
      });
    });
  });
});
