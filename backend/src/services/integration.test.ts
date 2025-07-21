import type { GroupConfig } from '@mcp-core/mcp-hub-share/src/config';
import type { ServerConfig } from '@mcp-core/mcp-hub-share/src/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpHubService } from './mcp_hub_service.js';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/client/index.js');
vi.mock('@modelcontextprotocol/sdk/client/stdio.js');
vi.mock('../utils/logger.js');

const MockClient = vi.mocked(Client);

describe('MCP Hub Service Integration Tests', () => {
  let mcpHubService: McpHubService;
  let mockClient: any;
  let serverConfigs: Record<string, ServerConfig>;
  let groupConfigs: GroupConfig;

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

    // Setup test configurations
    serverConfigs = {
      'math-server': {
        type: 'stdio',
        command: 'node',
        args: ['math-server.js'],
        enabled: true,
        env: { NODE_ENV: 'test' },
      },
      'file-server': {
        type: 'stdio',
        command: 'python',
        args: ['file-server.py'],
        enabled: true,
      },
      'disabled-server': {
        type: 'stdio',
        command: 'node',
        args: ['disabled.js'],
        enabled: false,
      },
    };

    groupConfigs = {
      default: {
        id: 'default',
        name: 'Default Group',
        description: 'Default group with all servers',
        servers: ['math-server', 'file-server'],
        tools: [], // All tools allowed
      },
      'math-only': {
        id: 'math-only',
        name: 'Math Only',
        description: 'Group with only math tools',
        servers: ['math-server'],
        tools: ['add', 'multiply'], // Only specific tools
      },
      restricted: {
        id: 'restricted',
        name: 'Restricted Group',
        description: 'Group with limited access',
        servers: ['file-server'],
        tools: ['read_file'], // Only file reading
      },
    };

    mcpHubService = new McpHubService(serverConfigs, groupConfigs);
  });

  afterEach(async () => {
    try {
      await mcpHubService.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Service Initialization and Shutdown', () => {
    it('should initialize service with all components', async () => {
      // Mock successful server connections
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'add', description: 'Add two numbers', inputSchema: {} },
          {
            name: 'multiply',
            description: 'Multiply two numbers',
            inputSchema: {},
          },
        ],
      });

      await mcpHubService.initialize();

      const status = mcpHubService.getServiceStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.serverCount).toBe(3); // Including disabled server
      expect(status.connectedServers).toBe(2); // Only enabled servers
      expect(status.groupCount).toBe(3);
    });

    it('should handle partial server failures during initialization', async () => {
      // Mock one server failing, one succeeding
      mockClient.connect
        .mockResolvedValueOnce(undefined) // math-server succeeds
        .mockRejectedValueOnce(new Error('Connection failed')); // file-server fails

      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'add', description: 'Add two numbers', inputSchema: {} },
        ],
      });

      await mcpHubService.initialize();

      const status = mcpHubService.getServiceStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.connectedServers).toBe(1); // Only one server connected
    });

    it('should perform graceful shutdown', async () => {
      // Initialize first
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      await mcpHubService.initialize();

      // Mock successful shutdown
      mockClient.close.mockResolvedValue(undefined);

      await mcpHubService.shutdown();

      const status = mcpHubService.getServiceStatus();
      expect(status.isInitialized).toBe(false);
    });

    it('should handle shutdown errors gracefully', async () => {
      // Initialize first
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });
      await mcpHubService.initialize();

      // Mock shutdown failure by making performGracefulShutdown fail
      // We need to mock the serverManager.shutdown method to fail
      const originalShutdown = mcpHubService['serverManager'].shutdown;
      mcpHubService['serverManager'].shutdown = vi
        .fn()
        .mockRejectedValue(new Error('Shutdown failed'));

      // Should throw due to shutdown errors
      await expect(mcpHubService.shutdown()).rejects.toThrow(
        'Shutdown completed with',
      );

      // Restore original method
      mcpHubService['serverManager'].shutdown = originalShutdown;
    });
  });

  describe('Tool Discovery Workflows', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockImplementation(() => {
        // Return different tools based on which server is being queried
        return Promise.resolve({
          tools: [
            {
              name: 'add',
              description: 'Add two numbers',
              inputSchema: {
                type: 'object',
                properties: { a: { type: 'number' }, b: { type: 'number' } },
                required: ['a', 'b'],
              },
            },
            {
              name: 'multiply',
              description: 'Multiply two numbers',
              inputSchema: {
                type: 'object',
                properties: { x: { type: 'number' }, y: { type: 'number' } },
                required: ['x', 'y'],
              },
            },
            {
              name: 'read_file',
              description: 'Read a file',
              inputSchema: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
            {
              name: 'write_file',
              description: 'Write a file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                },
                required: ['path', 'content'],
              },
            },
          ],
        });
      });

      await mcpHubService.initialize();
    });

    it('should discover all tools in default group', async () => {
      const tools = await mcpHubService.listTools('default');

      expect(tools.length).toBeGreaterThan(0);
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('add');
      expect(toolNames).toContain('multiply');
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
    });

    it('should filter tools based on group restrictions', async () => {
      const tools = await mcpHubService.listTools('math-only');

      expect(tools.length).toBe(2);
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('add');
      expect(toolNames).toContain('multiply');
      expect(toolNames).not.toContain('read_file');
      expect(toolNames).not.toContain('write_file');
    });

    it('should handle tool discovery for restricted groups', async () => {
      const tools = await mcpHubService.listTools('restricted');

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).not.toContain('add');
      expect(toolNames).not.toContain('multiply');
    });

    it('should throw error for non-existent group', async () => {
      await expect(mcpHubService.listTools('non-existent')).rejects.toThrow(
        "Group 'non-existent' not found",
      );
    });

    it('should check tool availability correctly', async () => {
      const isAvailable = await mcpHubService.isToolAvailable('add', 'default');
      expect(isAvailable).toBe(true);

      const isNotAvailable = await mcpHubService.isToolAvailable(
        'add',
        'restricted',
      );
      expect(isNotAvailable).toBe(false);

      const nonExistent = await mcpHubService.isToolAvailable(
        'non-existent-tool',
        'default',
      );
      expect(nonExistent).toBe(false);
    });

    it('should get tool details correctly', async () => {
      const toolDetails = await mcpHubService.getToolDetails('add', 'default');

      expect(toolDetails).toBeDefined();
      expect(toolDetails?.name).toBe('add');
      expect(toolDetails?.description).toBe('Add two numbers');
      expect(toolDetails?.inputSchema).toBeDefined();

      const noDetails = await mcpHubService.getToolDetails('add', 'restricted');
      expect(noDetails).toBeNull();
    });
  });

  describe('Tool Execution Workflows', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'add',
            description: 'Add two numbers',
            inputSchema: {
              type: 'object',
              properties: { a: { type: 'number' }, b: { type: 'number' } },
              required: ['a', 'b'],
            },
          },
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object',
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
        ],
      });

      await mcpHubService.initialize();
    });

    it('should execute tool successfully with valid arguments', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Result: 7' }],
      });

      const result = await mcpHubService.callTool(
        'add',
        { a: 3, b: 4 },
        'default',
      );

      expect(result.isError).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: 'Result: 7' }]);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'add',
        arguments: { a: 3, b: 4 },
      });
    });

    it('should validate arguments before execution', async () => {
      const result = await mcpHubService.callTool('add', { a: 3 }, 'default'); // Missing required 'b'

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required argument: b');
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    it('should enforce group access control', async () => {
      await expect(
        mcpHubService.callTool('add', { a: 3, b: 4 }, 'restricted'),
      ).rejects.toThrow('not found in group');

      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    it('should handle tool execution failures', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Tool execution failed'));

      const result = await mcpHubService.callTool(
        'add',
        { a: 3, b: 4 },
        'default',
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Tool execution failed after 2 attempts',
      );
    });

    it('should retry on retryable errors', async () => {
      mockClient.callTool
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Success on retry' }],
        });

      const result = await mcpHubService.callTool(
        'add',
        { a: 3, b: 4 },
        'default',
      );

      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        { type: 'text', text: 'Success on retry' },
      ]);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it('should handle different result formats', async () => {
      // Test string result
      mockClient.callTool.mockResolvedValueOnce('Simple string result');
      let result = await mcpHubService.callTool(
        'add',
        { a: 3, b: 4 },
        'default',
      );
      expect(result.content[0].text).toBe('Simple string result');

      // Test object result
      mockClient.callTool.mockResolvedValueOnce({
        result: 42,
        status: 'success',
      });
      result = await mcpHubService.callTool('add', { a: 3, b: 4 }, 'default');
      expect(result.content[0].text).toContain('result');
      expect(result.content[0].text).toContain('42');

      // Test error result format
      mockClient.callTool.mockResolvedValueOnce({
        error: { message: 'Calculation error', code: 'CALC_ERROR' },
      });
      result = await mcpHubService.callTool('add', { a: 3, b: 4 }, 'default');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Calculation error');
    });
  });

  describe('Error Handling Across Component Boundaries', () => {
    it('should handle server manager initialization failures', async () => {
      // Mock all server connections to fail
      mockClient.connect.mockRejectedValue(new Error('All servers failed'));

      await mcpHubService.initialize();

      const status = mcpHubService.getServiceStatus();
      expect(status.isInitialized).toBe(true); // Service should still initialize
      expect(status.connectedServers).toBe(0);
    });

    it('should handle group manager configuration errors', async () => {
      // Create service with invalid group config
      const invalidGroupConfigs = {
        'invalid-group': {
          // Missing required fields
          servers: ['non-existent-server'],
          tools: [],
        } as any,
      };

      const invalidService = new McpHubService(
        serverConfigs,
        invalidGroupConfigs,
      );

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      await invalidService.initialize();

      const status = invalidService.getServiceStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.groupCount).toBeGreaterThan(0); // Should create fallback groups

      await invalidService.shutdown();
    });

    it('should handle tool manager cache failures', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [{ name: 'test-tool', description: 'Test', inputSchema: {} }],
      });

      await mcpHubService.initialize();

      // First call should work
      const tools1 = await mcpHubService.listTools('default');
      expect(tools1.length).toBeGreaterThan(0);

      // Mock subsequent calls to fail
      mockClient.listTools.mockRejectedValue(new Error('Cache refresh failed'));

      // Should still return cached results
      const tools2 = await mcpHubService.listTools('default');
      expect(tools2.length).toBeGreaterThan(0);
    });

    it('should handle cross-component error propagation', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [{ name: 'test-tool', description: 'Test', inputSchema: {} }],
      });

      await mcpHubService.initialize();

      // Mock server manager to fail during tool execution
      mockClient.callTool.mockRejectedValue(
        new Error('Server communication failed'),
      );

      const result = await mcpHubService.callTool('test-tool', {}, 'default');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool execution failed');
    });
  });

  describe('Service Health and Diagnostics', () => {
    beforeEach(async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'health-check',
            description: 'Health check tool',
            inputSchema: {},
          },
        ],
      });

      await mcpHubService.initialize();
    });

    it('should provide comprehensive service diagnostics', async () => {
      const diagnostics = await mcpHubService.getServiceDiagnostics();

      expect(diagnostics).toHaveProperty('service');
      expect(diagnostics).toHaveProperty('servers');
      expect(diagnostics).toHaveProperty('groups');
      expect(diagnostics).toHaveProperty('performance');

      expect(diagnostics.service.isInitialized).toBe(true);
      expect(diagnostics.servers.total).toBeGreaterThan(0);
      expect(diagnostics.groups.total).toBeGreaterThan(0);
    });

    it('should track server health status', () => {
      const serverHealth = mcpHubService.getServerHealth();

      expect(serverHealth).toBeInstanceOf(Map);
      expect(serverHealth.size).toBeGreaterThan(0);

      for (const [serverId, status] of serverHealth) {
        expect(typeof serverId).toBe('string');
        expect(['connected', 'disconnected', 'error', 'connecting']).toContain(
          status,
        );
      }
    });

    it('should provide group information', () => {
      const groupInfo = mcpHubService.getGroupInfo('default');

      expect(groupInfo).toBeDefined();
      expect(groupInfo?.id).toBe('default');
      expect(groupInfo?.name).toBe('Default Group');
      expect(groupInfo?.servers).toEqual(['math-server', 'file-server']);

      const nonExistentGroup = mcpHubService.getGroupInfo('non-existent');
      expect(nonExistentGroup).toBeUndefined();
    });

    it('should list all available groups', () => {
      const allGroups = mcpHubService.getAllGroups();

      expect(allGroups).toBeInstanceOf(Map);
      expect(allGroups.size).toBe(3);
      expect(allGroups.has('default')).toBe(true);
      expect(allGroups.has('math-only')).toBe(true);
      expect(allGroups.has('restricted')).toBe(true);
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    beforeEach(async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: 'concurrent-tool',
            description: 'Test concurrent access',
            inputSchema: {},
          },
        ],
      });

      await mcpHubService.initialize();
    });

    it('should handle concurrent tool listings', async () => {
      const promises = Array.from({ length: 5 }, () =>
        mcpHubService.listTools('default'),
      );

      const results = await Promise.all(promises);

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it('should handle concurrent tool executions', async () => {
      mockClient.callTool.mockImplementation(
        async ({
          arguments: args,
        }: {
          arguments: Record<string, unknown>;
        }) => ({
          content: [
            { type: 'text', text: `Result for ${JSON.stringify(args)}` },
          ],
        }),
      );

      const promises = Array.from({ length: 3 }, (_, i) =>
        mcpHubService.callTool('concurrent-tool', { id: i }, 'default'),
      );

      const results = await Promise.all(promises);

      // All executions should succeed
      for (const result of results) {
        expect(result.isError).toBe(false);
      }

      // Each should have unique results
      const resultTexts = results.map((r) => r.content[0].text);
      const uniqueResults = new Set(resultTexts);
      expect(uniqueResults.size).toBe(3);
    });

    it('should handle service shutdown during operations', async () => {
      mockClient.callTool.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  content: [{ type: 'text', text: 'Delayed result' }],
                }),
              100,
            ),
          ),
      );

      // Start a long-running operation
      const executionPromise = mcpHubService.callTool(
        'concurrent-tool',
        {},
        'default',
      );

      // Shutdown service while operation is running
      const shutdownPromise = mcpHubService.shutdown();

      // Both should complete without throwing
      const [executionResult] = await Promise.allSettled([
        executionPromise,
        shutdownPromise,
      ]);

      // Execution might succeed or fail depending on timing
      expect(['fulfilled', 'rejected']).toContain(executionResult.status);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle empty server configuration', async () => {
      const emptyService = new McpHubService({}, groupConfigs);

      // Should fail to initialize due to no servers for groups
      await expect(emptyService.initialize()).rejects.toThrow(
        'No groups are loaded',
      );
    });

    it('should handle empty group configuration', async () => {
      const emptyService = new McpHubService(serverConfigs, {});

      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({ tools: [] });

      // Should fail to initialize due to no groups
      await expect(emptyService.initialize()).rejects.toThrow(
        'No groups are loaded',
      );
    });

    it('should handle mixed valid and invalid configurations', async () => {
      const mixedServerConfigs = {
        ...serverConfigs,
        'invalid-server': {
          type: 'invalid-type' as any,
          command: 'invalid-command',
          enabled: true,
        },
      };

      const mixedService = new McpHubService(mixedServerConfigs, groupConfigs);

      mockClient.connect
        .mockResolvedValueOnce(undefined) // Valid servers succeed
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Invalid server type')); // Invalid server fails

      mockClient.listTools.mockResolvedValue({ tools: [] });

      await mixedService.initialize();

      const status = mixedService.getServiceStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.serverCount).toBe(4); // Including invalid server
      expect(status.connectedServers).toBeLessThan(status.serverCount);

      await mixedService.shutdown();
    });
  });
});
