/**
 * CLI MCP服务器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CliConfig } from '../types';

/**
 * 用于访问 CliMcpServer 私有属性的接口
 */
interface CliMcpServerInternals {
  createServiceManager: () => unknown;
  registerTools: () => Promise<void>;
  protocolHandler: unknown;
  coreService: unknown;
  server: unknown;
}

// 创建 mock 实例
const mockServiceManager = {
  initializeFromConfig: vi.fn().mockResolvedValue(undefined),
  getAllTools: vi.fn().mockResolvedValue([
    {
      name: 'test_tool',
      description: '测试工具',
      serverId: 'test_server',
    },
  ]),
  executeToolCall: vi.fn().mockResolvedValue({
    success: true,
    data: { result: 'test result' },
    executionTime: 100,
  }),
  getServiceStatus: vi.fn().mockReturnValue({
    initialized: true,
    serverCount: 1,
    activeConnections: 1,
  }),
  shutdown: vi.fn().mockResolvedValue(undefined),
};

// Mock 核心包
vi.mock('@mcp-core/mcp-knot-core', () => ({
  McpServiceManager: vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockServiceManager);
  }),
}));

// 创建 mock stdio handle 实例（serveStdio 的返回值）。
// 用 vi.hoisted 提前初始化，因为 vi.mock 工厂会被提升到文件顶部执行。
const mockStdioHandle = vi.hoisted(() => ({
  close: vi.fn().mockResolvedValue(undefined),
}));

// 创建 mock MCP server 实例
const mockMcpServer = {
  setRequestHandler: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  registerTool: vi.fn(),
};

// Mock MCP SDK
vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockMcpServer);
  }),
}));

vi.mock('@modelcontextprotocol/server/stdio', () => ({
  // serveStdio: 工厂在连接建立时被调用，测试中不需要真实启动 stdio。
  serveStdio: vi.fn().mockReturnValue(mockStdioHandle),
}));

// 导入要测试的类
import { CliMcpServer } from './cli-mcp-server';

describe('CliMcpServer', () => {
  let server: CliMcpServer;
  let mockConfig: CliConfig;

  beforeEach(() => {
    // 清除所有mock调用记录，但保留实现
    vi.clearAllMocks();

    // 重置 mock 函数的返回值
    mockServiceManager.getAllTools.mockResolvedValue([
      {
        name: 'test_tool',
        description: '测试工具',
        serverId: 'test_server',
      },
    ]);

    server = new CliMcpServer();

    const serverInternals = server as unknown as CliMcpServerInternals;

    // 直接 spy createServiceManager 方法
    vi.spyOn(serverInternals, 'createServiceManager').mockReturnValue(mockServiceManager);

    // Mock registerTools 方法以避免 registerTool 错误
    vi.spyOn(serverInternals, 'registerTools').mockResolvedValue(undefined);

    // 直接设置 server 属性以确保 mock 正确工作
    serverInternals.server = mockMcpServer;

    mockConfig = {
      servers: {
        test_server: {
          type: 'stdio',
          command: 'node',
          args: ['test.js'],
        },
      },
      logging: {
        level: 'info',
      },
      transport: {
        type: 'stdio',
      },
    };

    // 重置 mock 函数的返回值（在清除之后）
    mockServiceManager.getAllTools.mockResolvedValue([
      {
        name: 'test_tool',
        description: '测试工具',
        serverId: 'test_server',
      },
    ]);
  });

  afterEach(async () => {
    try {
      await server.shutdown();
    } catch {
      // 忽略关闭错误
    }
  });

  describe('initialize', () => {
    it('应该成功初始化CLI MCP服务器', async () => {
      await server.initialize(mockConfig);

      const status = server.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.config?.serverCount).toBe(1);
      expect(status.config?.loggingLevel).toBe('info');
    });

    it('应该跳过重复初始化', async () => {
      await server.initialize(mockConfig);

      // 第二次初始化应该被跳过
      await server.initialize(mockConfig);

      const status = server.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('应该在初始化失败时清理资源', async () => {
      // Mock核心服务初始化失败
      const failingMockServiceManager = {
        initializeFromConfig: vi.fn().mockRejectedValue(new Error('初始化失败')),
        getAvailableTools: vi.fn(),
        getAllTools: vi.fn(),
        callTool: vi.fn(),
        shutdown: vi.fn(),
        getServiceStatus: vi.fn().mockReturnValue({ status: 'error' }),
      };

      // 创建一个新的服务器实例来测试失败情况
      const failingServer = new CliMcpServer();

      // 使用反射模拟失败
      vi.spyOn(
        failingServer as unknown as CliMcpServerInternals,
        'createServiceManager',
      ).mockReturnValue(failingMockServiceManager);

      await expect(failingServer.initialize(mockConfig)).rejects.toThrow('初始化失败');

      const status = failingServer.getStatus();
      expect(status.initialized).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      await server.initialize(mockConfig);
    });

    it('应该成功启动CLI MCP服务器', async () => {
      await server.start();

      const status = server.getStatus();
      expect(status.started).toBe(true);
    });

    it('应该在未初始化时抛出错误', async () => {
      const uninitializedServer = new CliMcpServer();

      await expect(uninitializedServer.start()).rejects.toThrow('CLI MCP服务器必须先初始化');
    });

    it('应该跳过重复启动', async () => {
      await server.start();

      // 第二次启动应该被跳过
      await server.start();

      const status = server.getStatus();
      expect(status.started).toBe(true);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await server.initialize(mockConfig);
      await server.start();
    });

    it('应该成功关闭CLI MCP服务器', async () => {
      await server.shutdown();

      const status = server.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);
    });

    it('应该在未初始化时也能安全关闭', async () => {
      const uninitializedServer = new CliMcpServer();

      // 应该不抛出错误
      await expect(uninitializedServer.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的初始状态', () => {
      const status = server.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);
      expect(status.config).toBeNull();
      expect(status.coreServiceStatus).toBeUndefined();
    });

    it('应该在初始化后返回正确状态', async () => {
      await server.initialize(mockConfig);

      const status = server.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.config?.serverCount).toBe(1);
      expect(status.config?.loggingLevel).toBe('info');
      expect(status.coreServiceStatus).toBeDefined();
    });
  });

  describe('工具处理', () => {
    beforeEach(async () => {
      await server.initialize(mockConfig);
    });

    it('应该正确设置工具处理器', () => {
      // 验证服务器状态和工具处理器设置
      const status = server.getStatus();
      expect(status.initialized).toBe(true);

      const serverInternals = server as unknown as CliMcpServerInternals;

      // 验证协议处理器已创建
      expect(serverInternals.protocolHandler).toBeDefined();

      // 验证服务管理器已创建
      expect(serverInternals.coreService).toBeDefined();
    });
  });
});
