/**
 * CLI MCP服务器单元测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliConfig } from '../types';
import { CliMcpServer } from './cli-mcp-server';

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock 核心包
vi.mock('@mcp-core/mcp-hub-core', () => ({
  McpServiceManager: vi.fn().mockImplementation(() => ({
    initializeFromConfig: vi.fn(),
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
    shutdown: vi.fn(),
  })),
}));

describe('CliMcpServer', () => {
  let server: CliMcpServer;
  let mockConfig: CliConfig;

  beforeEach(() => {
    server = new CliMcpServer();
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

    // 清除所有mock调用记录
    vi.clearAllMocks();
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
      const mockServiceManager = {
        initializeFromConfig: vi
          .fn()
          .mockRejectedValue(new Error('初始化失败')),
        getAvailableTools: vi.fn(),
        getAllTools: vi.fn(),
        callTool: vi.fn(),
        shutdown: vi.fn(),
        getServiceStatus: vi.fn().mockReturnValue({ status: 'error' }),
      };

      // 创建一个新的服务器实例来测试失败情况
      const failingServer = new CliMcpServer();

      // 使用反射或其他方式模拟失败
      vi.spyOn(failingServer as any, 'createServiceManager').mockReturnValue(
        mockServiceManager,
      );

      await expect(failingServer.initialize(mockConfig)).rejects.toThrow(
        '初始化失败',
      );

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

      await expect(uninitializedServer.start()).rejects.toThrow(
        'CLI MCP服务器必须先初始化',
      );
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

      // 验证协议处理器已创建
      expect((server as any).protocolHandler).toBeDefined();

      // 验证服务管理器已创建
      expect((server as any).coreService).toBeDefined();
    });
  });
});
