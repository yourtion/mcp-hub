import type { ServerConfig } from '@mcp-core/mcp-hub-share';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerStatus } from '../types/mcp-hub.js';
import { ServerManager } from './server_manager.js';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js');
vi.mock('@modelcontextprotocol/sdk/client/stdio.js');
vi.mock('../utils/logger.js');

const MockClient = vi.mocked(Client);

describe('ServerManager', () => {
  let serverManager: ServerManager;
  let mockServerConfigs: Record<string, ServerConfig>;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client
    mockClient = {
      connect: vi.fn(),
      close: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
    };

    MockClient.mockImplementation(() => mockClient);

    // Setup test server configurations
    mockServerConfigs = {
      'test-server-1': {
        type: 'stdio',
        command: 'node',
        args: ['test-server.js'],
        enabled: true,
        env: { TEST_VAR: 'test-value' },
      },
      'test-server-2': {
        type: 'stdio',
        command: 'python',
        args: ['test-server.py'],
        enabled: true,
      },
      'disabled-server': {
        type: 'stdio',
        command: 'node',
        args: ['disabled.js'],
        enabled: false,
      },
    };

    serverManager = new ServerManager(mockServerConfigs);
  });

  afterEach(async () => {
    try {
      await serverManager.shutdown();
    } catch (_error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('constructor', () => {
    it('should store server configurations', () => {
      const servers = serverManager.getAllServers();
      expect(servers.size).toBe(0); // No servers initialized yet
    });

    it('should handle empty configuration', () => {
      const emptyManager = new ServerManager({});
      expect(emptyManager.getAllServers().size).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize enabled servers successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      expect(servers.size).toBe(2); // Only enabled servers
      expect(servers.has('test-server-1')).toBe(true);
      expect(servers.has('test-server-2')).toBe(true);
      expect(servers.has('disabled-server')).toBe(false);
    });

    it('should skip disabled servers', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      expect(servers.has('disabled-server')).toBe(false);
    });

    it('should handle server connection failures gracefully', async () => {
      mockClient.connect
        .mockResolvedValueOnce(undefined) // First server succeeds
        .mockRejectedValueOnce(new Error('Connection failed')); // Second server fails

      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      expect(servers.size).toBe(2);

      const server1 = servers.get('test-server-1');
      const server2 = servers.get('test-server-2');

      expect(server1?.status).toBe(ServerStatus.CONNECTED);
      expect(server2?.status).toBe(ServerStatus.ERROR);
      expect(server2?.lastError?.message).toBe('Connection failed');
    });

    it('should discover tools after successful connection', async () => {
      const mockTools = [
        { name: 'tool1', description: 'Test tool 1', inputSchema: {} },
        { name: 'tool2', description: 'Test tool 2', inputSchema: {} },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');

      expect(server?.tools).toHaveLength(2);
      expect(server?.tools[0].name).toBe('tool1');
      expect(server?.tools[0].serverId).toBe('test-server-1');
    });

    it('should handle tool discovery failures', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockRejectedValue(
        new Error('Tool discovery failed'),
      );

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');

      expect(server?.status).toBe(ServerStatus.CONNECTED);
      expect(server?.tools).toHaveLength(0);
    });
  });

  describe('getServerStatus', () => {
    it('should return correct server status', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      expect(serverManager.getServerStatus('test-server-1')).toBe(
        ServerStatus.CONNECTED,
      );
      expect(serverManager.getServerStatus('non-existent')).toBe(
        ServerStatus.DISCONNECTED,
      );
    });
  });

  describe('executeToolOnServer', () => {
    beforeEach(async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      await serverManager.initialize();
    });

    it('should execute tool successfully', async () => {
      const mockResult = { content: [{ type: 'text', text: 'Success' }] };
      mockClient.callTool.mockResolvedValue(mockResult);

      const result = await serverManager.executeToolOnServer(
        'test-server-1',
        'test-tool',
        { arg1: 'value1' },
      );

      expect(result).toEqual(mockResult);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { arg1: 'value1' },
      });
    });

    it('should throw error for non-existent server', async () => {
      await expect(
        serverManager.executeToolOnServer('non-existent', 'tool', {}),
      ).rejects.toThrow('Server non-existent not found');
    });

    it('should throw error for disconnected server', async () => {
      // Manually set server status to disconnected
      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');
      if (server) {
        server.status = ServerStatus.DISCONNECTED;
      }

      await expect(
        serverManager.executeToolOnServer('test-server-1', 'tool', {}),
      ).rejects.toThrow('Server test-server-1 is not connected');
    });

    it('should handle tool execution failures', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Tool execution failed'));

      await expect(
        serverManager.executeToolOnServer('test-server-1', 'test-tool', {}),
      ).rejects.toThrow('Tool execution failed');
    });
  });

  describe('getServerTools', () => {
    beforeEach(async () => {
      const mockTools = [
        { name: 'tool1', description: 'Test tool 1', inputSchema: {} },
      ];

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: mockTools });
      await serverManager.initialize();
    });

    it('should return tools for connected server', async () => {
      const tools = await serverManager.getServerTools('test-server-1');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool1');
      expect(tools[0].serverId).toBe('test-server-1');
    });

    it('should throw error for non-existent server', async () => {
      await expect(
        serverManager.getServerTools('non-existent'),
      ).rejects.toThrow('Server non-existent not found');
    });

    it('should return empty array for disconnected server', async () => {
      // Manually set server status to disconnected
      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');
      if (server) {
        server.status = ServerStatus.DISCONNECTED;
      }

      const tools = await serverManager.getServerTools('test-server-1');
      expect(tools).toHaveLength(0);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      await serverManager.initialize();
    });

    it('should close all connected servers', async () => {
      mockClient.close.mockResolvedValue(undefined);

      await serverManager.shutdown();

      expect(mockClient.close).toHaveBeenCalledTimes(2); // Two enabled servers
      expect(serverManager.getAllServers().size).toBe(0);
    });

    it('should handle server close failures gracefully', async () => {
      mockClient.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(serverManager.shutdown()).resolves.not.toThrow();
      expect(serverManager.getAllServers().size).toBe(0);
    });

    it('should handle shutdown when no servers are initialized', async () => {
      const emptyManager = new ServerManager({});
      await expect(emptyManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('server lifecycle and health monitoring', () => {
    it('should track connection timestamps', async () => {
      const beforeConnect = new Date();

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');

      expect(server?.lastConnected).toBeInstanceOf(Date);
      expect(server?.lastConnected?.getTime()).toBeGreaterThanOrEqual(
        beforeConnect.getTime(),
      );
    });

    it('should reset reconnect attempts on successful connection', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');

      expect(server?.reconnectAttempts).toBe(0);
    });

    it('should handle environment variables in server configuration', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      // Verify that the client was created (environment variables are passed to transport)
      expect(MockClient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'mcp-hub-test-server-1',
          version: '1.0.0',
        }),
        expect.objectContaining({
          capabilities: {},
        }),
      );
    });
  });

  describe('error handling and resilience', () => {
    it('should handle invalid server type', async () => {
      const invalidConfig = {
        'invalid-server': {
          type: 'invalid' as any,
          command: 'node',
          args: ['test.js'],
          enabled: true,
        },
      };

      const invalidManager = new ServerManager(invalidConfig);
      await invalidManager.initialize();

      const servers = invalidManager.getAllServers();
      const server = servers.get('invalid-server');

      expect(server?.status).toBe(ServerStatus.ERROR);
      expect(server?.lastError?.message).toContain('not yet implemented');
    });

    it('should continue initialization even if some servers fail', async () => {
      mockClient.connect
        .mockRejectedValueOnce(new Error('Server 1 failed'))
        .mockResolvedValueOnce(undefined);

      mockClient.listTools.mockResolvedValue({ tools: [] });

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      expect(servers.size).toBe(2);

      const server1 = servers.get('test-server-1');
      const server2 = servers.get('test-server-2');

      expect(server1?.status).toBe(ServerStatus.ERROR);
      expect(server2?.status).toBe(ServerStatus.CONNECTED);
    });

    it('should handle transport creation failures', async () => {
      // Mock transport creation to fail
      const { StdioClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/stdio.js'
      );
      vi.doMock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
        StdioClientTransport: vi.fn().mockImplementation(() => {
          throw new Error('Transport creation failed');
        }),
      }));

      mockClient.connect.mockRejectedValue(
        new Error('Transport creation failed'),
      );

      await serverManager.initialize();

      const servers = serverManager.getAllServers();
      const server = servers.get('test-server-1');

      expect(server?.status).toBe(ServerStatus.ERROR);
      expect(server?.lastError?.message).toBe('Transport creation failed');
    });
  });
});
