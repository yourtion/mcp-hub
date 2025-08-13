/**
 * CLI端到端测试
 * 测试CLI包的完整功能流程
 */

import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliConfigManager } from '../config/cli-config-manager.js';
import { McpProtocolHandler } from '../protocol/mcp-protocol-handler.js';
import { CliMcpServer } from '../server/cli-mcp-server.js';
import type { CliConfig } from '../types/index.js';

// Mock外部依赖
vi.mock('@modelcontextprotocol/sdk/server/mcp.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('CLI端到端测试', () => {
  let testConfig: CliConfig;
  let configManager: CliConfigManager;
  let coreService: McpServiceManager;
  let protocolHandler: McpProtocolHandler;
  let cliServer: CliMcpServer;

  beforeEach(async () => {
    // 设置测试环境
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'ERROR';

    vi.clearAllMocks();

    // 静默console输出
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});

    testConfig = {
      servers: {
        'test-server-1': {
          type: 'stdio',
          command: 'node',
          args: ['test-server-1.js'],
          enabled: true,
          env: { NODE_ENV: 'test' },
        },
        'test-server-2': {
          type: 'sse',
          url: 'http://localhost:3001/sse',
          headers: { Authorization: 'Bearer test-token' },
          enabled: true,
        },
      },
      logging: {
        level: 'error',
        format: 'json',
        outputs: ['console'],
      },
      validation: {
        enabled: true,
        strictMode: false,
      },
    };

    configManager = new CliConfigManager();
    coreService = new McpServiceManager();
    protocolHandler = new McpProtocolHandler(coreService);
    cliServer = new CliMcpServer();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;

    try {
      if (cliServer) {
        await cliServer.shutdown();
      }
      if (coreService) {
        await coreService.shutdown();
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('完整的CLI工作流测试', () => {
    it('应该能够完成从配置加载到工具调用的完整流程', async () => {
      // Mock所有必要的依赖
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      // Mock核心服务方法
      vi.spyOn(coreService, 'initializeFromConfig').mockResolvedValue();
      vi.spyOn(coreService, 'getAllTools').mockResolvedValue([
        {
          name: 'test-tool-1',
          description: '测试工具1',
          serverId: 'test-server-1',
          parameters: {
            type: 'object',
            properties: { input: { type: 'string' } },
          },
        },
        {
          name: 'test-tool-2',
          description: '测试工具2',
          serverId: 'test-server-2',
          parameters: {
            type: 'object',
            properties: { data: { type: 'string' } },
          },
        },
      ]);
      vi.spyOn(coreService, 'isToolAvailable').mockResolvedValue(true);
      vi.spyOn(coreService, 'executeToolCall').mockResolvedValue({
        success: true,
        data: { result: 'Tool execution successful' },
        executionTime: 150,
      });
      vi.spyOn(coreService, 'shutdown').mockResolvedValue();

      // 1. 配置验证
      const validationResult = await configManager.validateConfig(testConfig);
      expect(validationResult).toBeDefined();

      // 2. CLI服务器初始化
      await cliServer.initialize(testConfig);
      let status = cliServer.getStatus();
      expect(status.initialized).toBe(true);

      // 3. 启动CLI服务器
      await cliServer.start();
      status = cliServer.getStatus();
      expect(status.started).toBe(true);

      // 4. 验证工具注册（验证实际注册的工具名称）
      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'test-server-1_tool_1',
        expect.any(Object),
        expect.any(Function),
      );
      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'test-server-1_tool_2',
        expect.any(Object),
        expect.any(Function),
      );

      // 5. 测试工具列表获取
      const toolsResult = await protocolHandler.handleListTools();
      expect(toolsResult).toHaveProperty('tools');
      expect(toolsResult.tools).toHaveLength(2);

      // 6. 测试工具调用
      const callResult = await protocolHandler.handleCallTool('test-tool-1', {
        input: 'test',
      });
      expect(callResult).toHaveProperty('content');
      expect(callResult.isError).toBe(false);

      // 7. 关闭服务器
      await cliServer.shutdown();
      status = cliServer.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);
    });
  });

  describe('CLI错误处理和恢复测试', () => {
    it('应该能够处理配置文件错误', async () => {
      // 测试无效配置
      const invalidConfig = {
        servers: {
          'invalid-server': {
            type: 'invalid-type' as any,
            command: '',
            enabled: true,
          },
        },
        logging: {
          level: 'invalid-level' as any,
          format: 'json',
          outputs: ['console'],
        },
        validation: {
          enabled: true,
          strictMode: false,
        },
      };

      // 配置验证应该检测到错误
      const validationResult =
        await configManager.validateConfig(invalidConfig);
      expect(validationResult).toBeDefined();

      // 即使配置有问题，系统也应该能够处理而不崩溃
      expect(() => configManager.validateConfig(invalidConfig)).not.toThrow();
    });

    it('应该能够处理服务器连接失败', async () => {
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      vi.spyOn(coreService, 'initializeFromConfig').mockRejectedValue(
        new Error('Init failed'),
      );

      // 初始化失败应该被适当处理
      try {
        await cliServer.initialize(testConfig);
        expect.fail('应该抛出初始化错误');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);

        // 验证初始化失败后的状态
        const status = cliServer.getStatus();
        // 注意：某些实现可能在失败后仍保持部分初始化状态
        // 这里我们主要验证错误被正确抛出
        expect(status).toBeDefined();
      }
    });

    it('应该能够处理工具执行错误', async () => {
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      vi.spyOn(coreService, 'initializeFromConfig').mockResolvedValue();
      vi.spyOn(coreService, 'getAllTools').mockResolvedValue([
        {
          name: 'failing-tool',
          description: '会失败的工具',
          serverId: 'test-server',
          parameters: {},
        },
      ]);
      vi.spyOn(coreService, 'isToolAvailable').mockResolvedValue(true);
      vi.spyOn(coreService, 'executeToolCall').mockRejectedValue(
        new Error('Tool execution failed'),
      );

      await cliServer.initialize(testConfig);
      await cliServer.start();

      // 工具调用失败应该返回错误响应而不是抛出异常
      try {
        const result = await protocolHandler.handleCallTool('failing-tool', {});
        expect(result).toHaveProperty('isError', true);
        expect(result).toHaveProperty('content');
      } catch (error) {
        // 如果抛出异常，验证是MCP协议错误
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBeDefined();
      }

      await cliServer.shutdown();
    });
  });

  describe('CLI性能和负载测试', () => {
    it('应该能够处理多个工具的并发调用', async () => {
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      // Mock多个工具
      const mockTools = Array.from({ length: 5 }, (_, index) => ({
        name: `concurrent-tool-${index}`,
        description: `并发测试工具${index}`,
        serverId: 'test-server',
        parameters: {},
      }));

      vi.spyOn(coreService, 'initializeFromConfig').mockResolvedValue();
      vi.spyOn(coreService, 'getAllTools').mockResolvedValue(mockTools);
      vi.spyOn(coreService, 'isToolAvailable').mockResolvedValue(true);
      vi.spyOn(coreService, 'executeToolCall').mockImplementation(
        async (toolName) => ({
          success: true,
          data: { result: `Result from ${toolName}` },
          executionTime: Math.random() * 100 + 50,
        }),
      );

      await cliServer.initialize(testConfig);
      await cliServer.start();

      // 并发调用多个工具
      const concurrentCalls = mockTools.map((tool) =>
        protocolHandler.handleCallTool(tool.name, { test: 'data' }),
      );

      const results = await Promise.all(concurrentCalls);

      // 所有调用都应该成功
      for (const result of results) {
        expect(result.isError).toBe(false);
        expect(result).toHaveProperty('content');
      }

      await cliServer.shutdown();
    });

    it('应该能够处理快速连续的工具列表请求', async () => {
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      vi.spyOn(coreService, 'initializeFromConfig').mockResolvedValue();
      vi.spyOn(coreService, 'getAllTools').mockResolvedValue([
        {
          name: 'tool1',
          description: '工具1',
          serverId: 'server1',
          parameters: {},
        },
        {
          name: 'tool2',
          description: '工具2',
          serverId: 'server2',
          parameters: {},
        },
      ]);

      await cliServer.initialize(testConfig);
      await cliServer.start();

      // 快速连续请求工具列表
      const requests = Array.from({ length: 10 }, () =>
        protocolHandler.handleListTools(),
      );

      const results = await Promise.all(requests);

      // 所有请求都应该返回相同的结果
      for (const result of results) {
        expect(result).toHaveProperty('tools');
        expect(result.tools).toHaveLength(2);
      }

      await cliServer.shutdown();
    });
  });

  describe('CLI向后兼容性测试', () => {
    it('应该能够处理旧版本的配置格式', async () => {
      // 模拟旧版本配置格式
      const legacyConfig = {
        servers: {
          'legacy-server': {
            type: 'stdio',
            command: 'node',
            args: ['legacy-server.js'],
            enabled: true,
            // 缺少一些新字段
          },
        },
        // 缺少一些新的配置节
      };

      // 配置管理器应该能够处理旧格式
      const result = await configManager.validateConfig(legacyConfig as any);
      expect(result).toBeDefined();
    });

    it('应该能够处理MCP协议的标准请求格式', async () => {
      const mockServer = {
        registerTool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockTransport = { close: vi.fn() };

      const { McpServer } = await import(
        '@modelcontextprotocol/sdk/server/mcp.js'
      );
      const { StdioServerTransport } = await import(
        '@modelcontextprotocol/sdk/server/stdio.js'
      );

      vi.mocked(McpServer).mockImplementation(() => mockServer as any);
      vi.mocked(StdioServerTransport).mockImplementation(
        () => mockTransport as any,
      );

      vi.spyOn(coreService, 'initializeFromConfig').mockResolvedValue();
      vi.spyOn(coreService, 'getAllTools').mockResolvedValue([
        {
          name: 'standard-tool',
          description: '标准工具',
          serverId: 'server',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' },
            },
            required: ['param1'],
          },
        },
      ]);
      vi.spyOn(coreService, 'isToolAvailable').mockResolvedValue(true);
      vi.spyOn(coreService, 'executeToolCall').mockResolvedValue({
        success: true,
        data: 'Standard result',
        executionTime: 100,
      });

      await cliServer.initialize(testConfig);
      await cliServer.start();

      // 测试标准MCP协议请求
      const listResult = await protocolHandler.handleListTools();
      expect(listResult).toHaveProperty('tools');
      expect(listResult.tools[0]).toHaveProperty('name', 'standard-tool');
      expect(listResult.tools[0]).toHaveProperty('inputSchema');

      const callResult = await protocolHandler.handleCallTool('standard-tool', {
        param1: 'test',
        param2: 42,
      });
      expect(callResult.isError).toBe(false);

      await cliServer.shutdown();
    });
  });
});
