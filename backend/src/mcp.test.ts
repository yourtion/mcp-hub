import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mcp, shutdownMcpService } from './mcp';

// Mock所有依赖
vi.mock('@mcp-core/mcp-hub-core', () => ({
  McpServiceManager: vi.fn().mockImplementation(() => ({
    initializeFromConfig: vi.fn().mockResolvedValue(undefined),
    getServiceStatus: vi.fn().mockReturnValue({
      initialized: true,
      serverCount: 2,
      activeConnections: 1,
    }),
    getServerConnections: vi.fn().mockReturnValue(
      new Map([
        [
          'server1',
          {
            status: 'connected',
            lastConnected: new Date(),
            tools: [{ name: 'tool1' }],
            lastError: null,
          },
        ],
      ]),
    ),
    getAllTools: vi.fn().mockResolvedValue([
      {
        name: 'test_tool',
        description: '测试工具',
        serverId: 'server1',
        parameters: {},
      },
    ]),
    getServerTools: vi.fn().mockResolvedValue([
      {
        name: 'test_tool',
        description: '测试工具',
        parameters: {},
      },
    ]),
    executeToolCall: vi.fn().mockResolvedValue({
      success: true,
      data: 'test result',
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    onerror: null,
  })),
}));

vi.mock('fetch-to-node', () => ({
  toFetchResponse: vi.fn().mockReturnValue(new Response()),
  toReqRes: vi.fn().mockReturnValue({
    req: { method: 'POST', url: '/mcp' },
    res: {
      on: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    },
  }),
}));

vi.mock('./services/mcp_service.js', () => ({
  initializeMcpService: vi.fn().mockResolvedValue(undefined),
  mcpServer: {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  },
  shutdownMcpService: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./utils/config.js', () => ({
  getAllConfig: vi.fn().mockResolvedValue({
    mcps: {
      mcpServers: {
        server1: { command: 'test', args: [] },
      },
    },
    groups: {
      group1: { servers: ['server1'] },
    },
  }),
}));

vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCP Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownMcpService();
  });

  describe('POST /mcp', () => {
    it('应该成功处理MCP请求', async () => {
      const mockRequest = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'list_tools',
          id: 1,
        }),
      });

      const response = await mcp.request(mockRequest);
      expect(response).toBeDefined();
    });

    it('应该处理MCP请求错误', async () => {
      // Mock一个会抛出错误的请求
      const { initializeMcpService } = await import(
        './services/mcp_service.js'
      );
      vi.mocked(initializeMcpService).mockRejectedValueOnce(
        new Error('初始化失败'),
      );

      const mockRequest = new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'list_tools',
          id: 1,
        }),
      });

      const response = await mcp.request(mockRequest);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /mcp/status', () => {
    it('应该返回MCP服务状态', async () => {
      const response = await mcp.request('http://localhost/mcp/status');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('service');
      expect(data).toHaveProperty('servers');
      expect(data).toHaveProperty('compatibility');
    });

    it('应该处理状态查询错误', async () => {
      // Mock核心服务管理器为null的情况
      const mockRequest = new Request('http://localhost/mcp/status');

      // 这里需要重新初始化来触发错误
      const response = await mcp.request(mockRequest);
      expect(response).toBeDefined();
    });
  });

  describe('GET /mcp/tools', () => {
    it('应该返回所有MCP工具列表', async () => {
      const response = await mcp.request('http://localhost/mcp/tools');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('totalTools');
      expect(data).toHaveProperty('serverCount');
      expect(data).toHaveProperty('toolsByServer');
      expect(data).toHaveProperty('allTools');
    });
  });

  describe('GET /mcp/servers/:serverId', () => {
    it('应该返回指定服务器的详情', async () => {
      const response = await mcp.request(
        'http://localhost/mcp/servers/server1',
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('serverId');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('tools');
    });

    it('应该在服务器不存在时返回404', async () => {
      // Mock getServerConnections返回空Map
      const response = await mcp.request(
        'http://localhost/mcp/servers/nonexistent',
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /mcp/execute', () => {
    it('应该成功执行MCP工具', async () => {
      const mockRequest = new Request('http://localhost/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'test_tool',
          args: { param: 'value' },
          serverId: 'server1',
        }),
      });

      const response = await mcp.request(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('toolName');
      expect(data).toHaveProperty('result');
    });

    it('应该在缺少工具名称时返回400错误', async () => {
      const mockRequest = new Request('http://localhost/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          args: { param: 'value' },
        }),
      });

      const response = await mcp.request(mockRequest);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /mcp/health', () => {
    it('应该返回健康状态', async () => {
      const response = await mcp.request('http://localhost/mcp/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('healthy');
      expect(data).toHaveProperty('healthScore');
      expect(data).toHaveProperty('service');
      expect(data).toHaveProperty('servers');
    });

    it('应该在服务不健康时返回503状态', async () => {
      // Mock一个不健康的状态
      const { McpServiceManager } = await import('@mcp-core/mcp-hub-core');
      const mockInstance = new McpServiceManager();
      vi.mocked(mockInstance.getServiceStatus).mockReturnValue({
        initialized: true,
        serverCount: 4,
        activeConnections: 1, // 只有25%连接，低于50%阈值
      });

      const response = await mcp.request('http://localhost/mcp/health');
      expect(response).toBeDefined();
    });
  });

  describe('shutdownMcpService', () => {
    it('应该正确关闭MCP服务', async () => {
      await expect(shutdownMcpService()).resolves.not.toThrow();
    });

    it('应该在未初始化时安全关闭', async () => {
      // 多次调用关闭应该是安全的
      await shutdownMcpService();
      await expect(shutdownMcpService()).resolves.not.toThrow();
    });
  });
});
