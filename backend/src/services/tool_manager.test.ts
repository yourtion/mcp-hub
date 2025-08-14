import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupManager, ServerManager, Tool } from '../types/mcp-hub.js';
import { ServerStatus } from '../types/mcp-hub.js';
import { ToolManager } from './tool_manager.js';

// Mock the logger
vi.mock('../utils/logger.js');

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let mockServerManager: ServerManager;
  let mockGroupManager: GroupManager;

  const mockTools: Tool[] = [
    {
      name: 'tool1',
      description: 'Test tool 1',
      inputSchema: {
        type: 'object',
        properties: {
          arg1: { type: 'string' },
          arg2: { type: 'number' },
        },
        required: ['arg1'],
      },
      serverId: 'server1',
    },
    {
      name: 'tool2',
      description: 'Test tool 2',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      serverId: 'server2',
    },
    {
      name: 'tool3',
      description: 'Test tool 3 with no schema',
      inputSchema: {},
      serverId: 'server1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock server manager
    mockServerManager = {
      getAllServers: vi.fn().mockReturnValue(
        new Map([
          [
            'server1',
            {
              id: 'server1',
              status: ServerStatus.CONNECTED,
              tools: [mockTools[0], mockTools[2]],
            },
          ],
          [
            'server2',
            {
              id: 'server2',
              status: ServerStatus.CONNECTED,
              tools: [mockTools[1]],
            },
          ],
          [
            'server3',
            {
              id: 'server3',
              status: ServerStatus.DISCONNECTED,
              tools: [],
            },
          ],
        ]),
      ),
      executeToolOnServer: vi.fn(),
      getServerTools: vi.fn(),
      initialize: vi.fn(),
      getServerStatus: vi.fn(),
      shutdown: vi.fn(),
    };

    // Setup mock group manager
    mockGroupManager = {
      getGroup: vi.fn().mockImplementation((groupId: string) => {
        const groups = {
          default: {
            id: 'default',
            name: 'Default Group',
            servers: ['server1', 'server2'],
            tools: [], // No restrictions
          },
          filtered: {
            id: 'filtered',
            name: 'Filtered Group',
            servers: ['server1'],
            tools: ['tool1'], // Only tool1 allowed
          },
          empty: {
            id: 'empty',
            name: 'Empty Group',
            servers: ['server3'], // Disconnected server
            tools: [],
          },
        };
        return groups[groupId as keyof typeof groups];
      }),
      getAllGroups: vi.fn().mockReturnValue(
        new Map([
          [
            'default',
            { id: 'default', servers: ['server1', 'server2'], tools: [] },
          ],
          [
            'filtered',
            { id: 'filtered', servers: ['server1'], tools: ['tool1'] },
          ],
        ]),
      ),
      getGroupTools: vi.fn().mockImplementation((groupId: string) => {
        if (groupId === 'default') return Promise.resolve(mockTools);
        if (groupId === 'filtered') return Promise.resolve([mockTools[0]]);
        if (groupId === 'empty') return Promise.resolve([]);
        throw new Error(`Group ${groupId} not found`);
      }),
      validateToolAccess: vi
        .fn()
        .mockImplementation((groupId: string, toolName: string) => {
          if (groupId === 'filtered') return toolName === 'tool1';
          if (groupId === 'default') return true;
          return false;
        }),
      getGroupServers: vi.fn().mockImplementation((groupId: string) => {
        if (groupId === 'default') return ['server1', 'server2'];
        if (groupId === 'filtered') return ['server1'];
        if (groupId === 'empty') return ['server3'];
        return [];
      }),
      initialize: vi.fn(),
      findToolInGroup: vi.fn(),
      getAvailableGroupServers: vi.fn(),
      getGroupStats: vi.fn(),
      validateGroupHealth: vi.fn(),
      getAllGroupsHealth: vi.fn(),
      getGroupToolsByServer: vi.fn(),
    };

    toolManager = new ToolManager(mockServerManager, mockGroupManager);
  });

  describe('constructor', () => {
    it('should initialize with server and group managers', () => {
      expect(toolManager).toBeInstanceOf(ToolManager);
    });
  });

  describe('getToolsForGroup', () => {
    it('should return tools for valid group', async () => {
      const tools = await toolManager.getToolsForGroup('default');
      expect(tools).toEqual(mockTools);
      expect(mockGroupManager.getGroupTools).toHaveBeenCalledWith('default');
    });

    it('should cache tools for subsequent requests', async () => {
      // First call
      await toolManager.getToolsForGroup('default');
      // Second call should use cache
      await toolManager.getToolsForGroup('default');

      // Should only call group manager once
      expect(mockGroupManager.getGroupTools).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      // Mock Date constructor to control cache timestamps
      const originalDate = Date;
      let mockTime = 1000;

      // Mock both Date.now and Date constructor
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
      vi.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) {
          return new originalDate(mockTime);
        }
        return new originalDate(...(args as [number]));
      });

      // First call
      await toolManager.getToolsForGroup('default');

      // Advance time beyond cache TTL (30 seconds)
      mockTime += 31000;

      // Second call should refresh cache
      await toolManager.getToolsForGroup('default');

      expect(mockGroupManager.getGroupTools).toHaveBeenCalledTimes(2);

      vi.restoreAllMocks();
    });

    it('should throw error for non-existent group', async () => {
      await expect(
        toolManager.getToolsForGroup('non-existent'),
      ).rejects.toThrow('Group non-existent not found');
    });

    it('should handle group manager errors', async () => {
      vi.mocked(mockGroupManager.getGroupTools).mockRejectedValueOnce(
        new Error('Group manager error'),
      );

      await expect(toolManager.getToolsForGroup('default')).rejects.toThrow(
        'Group manager error',
      );
    });
  });

  describe('executeTool', () => {
    beforeEach(() => {
      // Setup successful tool execution by default
      vi.mocked(mockServerManager.executeToolOnServer).mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
    });

    it('should execute tool successfully', async () => {
      const result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });

      expect(result.isError).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: 'Success' }]);
      expect(mockServerManager.executeToolOnServer).toHaveBeenCalledWith(
        'server1',
        'tool1',
        { arg1: 'test' },
      );
    });

    it('should validate group access before execution', async () => {
      const result = await toolManager.executeTool('non-existent', 'tool1', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
      expect(mockServerManager.executeToolOnServer).not.toHaveBeenCalled();
    });

    it('should validate tool access in group', async () => {
      const result = await toolManager.executeTool('filtered', 'tool2', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not accessible in group');
      expect(mockServerManager.executeToolOnServer).not.toHaveBeenCalled();
    });

    it('should validate tool arguments against schema', async () => {
      const result = await toolManager.executeTool('default', 'tool1', {}); // Missing required arg1

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Missing required argument: arg1',
      );
      expect(mockServerManager.executeToolOnServer).not.toHaveBeenCalled();
    });

    it('should handle tool execution failures', async () => {
      vi.mocked(mockServerManager.executeToolOnServer).mockRejectedValueOnce(
        new Error('Tool execution failed'),
      );

      const result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Tool execution failed after 2 attempts',
      );
    });

    it('should retry on retryable errors', async () => {
      vi.mocked(mockServerManager.executeToolOnServer)
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Success on retry' }],
        });

      const result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });

      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        { type: 'text', text: 'Success on retry' },
      ]);
      expect(mockServerManager.executeToolOnServer).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      vi.mocked(mockServerManager.executeToolOnServer).mockRejectedValueOnce(
        new Error('Invalid arguments'),
      );

      const result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });

      expect(result.isError).toBe(true);
      expect(mockServerManager.executeToolOnServer).toHaveBeenCalledTimes(1);
    });

    it('should handle tools with no schema validation', async () => {
      const result = await toolManager.executeTool('default', 'tool3', {
        anyArg: 'value',
      });

      expect(result.isError).toBe(false);
      expect(mockServerManager.executeToolOnServer).toHaveBeenCalledWith(
        'server1',
        'tool3',
        { anyArg: 'value' },
      );
    });
  });

  describe('findToolServer', () => {
    it('should find server for existing tool', () => {
      const serverId = toolManager.findToolServer('tool1', 'default');
      expect(serverId).toBe('server1');
    });

    it('should return undefined for non-existent tool', () => {
      const serverId = toolManager.findToolServer(
        'non-existent-tool',
        'default',
      );
      expect(serverId).toBeUndefined();
    });

    it('should return undefined for non-existent group', () => {
      const serverId = toolManager.findToolServer('tool1', 'non-existent');
      expect(serverId).toBeUndefined();
    });

    it('should only search in group servers', () => {
      // tool2 is on server2, but filtered group only has server1
      const serverId = toolManager.findToolServer('tool2', 'filtered');
      expect(serverId).toBeUndefined();
    });

    it('should skip disconnected servers', () => {
      // Mock server3 as having the tool but disconnected
      vi.mocked(mockServerManager.getAllServers).mockReturnValue(
        new Map([
          [
            'server3',
            {
              id: 'server3',
              config: {} as any,
              client: {} as any,
              status: ServerStatus.DISCONNECTED,
              tools: [{ name: 'tool4', serverId: 'server3', inputSchema: {} }],
              reconnectAttempts: 0,
            },
          ],
        ]),
      );

      vi.mocked(mockGroupManager.getGroupServers).mockReturnValue(['server3']);

      const serverId = toolManager.findToolServer('tool4', 'empty');
      expect(serverId).toBeUndefined();
    });
  });

  describe('validateToolArgs', () => {
    it('should validate required arguments', () => {
      const isValid = toolManager.validateToolArgs('tool1', {
        arg1: 'test',
        arg2: 123,
      });
      expect(isValid).toBe(true);
    });

    it('should reject missing required arguments', () => {
      const isValid = toolManager.validateToolArgs('tool1', { arg2: 123 }); // Missing arg1
      expect(isValid).toBe(false);
    });

    it('should validate argument types', () => {
      const isValid = toolManager.validateToolArgs('tool1', {
        arg1: 'test',
        arg2: 'not-a-number',
      });
      expect(isValid).toBe(false);
    });

    it('should allow tools with no schema', () => {
      const isValid = toolManager.validateToolArgs('tool3', {
        anyArg: 'value',
      });
      expect(isValid).toBe(true);
    });

    it('should handle non-existent tools gracefully', () => {
      const isValid = toolManager.validateToolArgs('non-existent', {
        arg: 'value',
      });
      expect(isValid).toBe(true); // Should allow and let server handle validation
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific group', async () => {
      // Populate cache
      await toolManager.getToolsForGroup('default');
      expect(mockGroupManager.getGroupTools).toHaveBeenCalledTimes(1);

      // Clear cache for group
      toolManager.clearCacheForGroup('default');

      // Next call should hit group manager again
      await toolManager.getToolsForGroup('default');
      expect(mockGroupManager.getGroupTools).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      // Populate cache for multiple groups
      await toolManager.getToolsForGroup('default');
      await toolManager.getToolsForGroup('filtered');

      // Clear all cache
      toolManager.clearCache();

      // Next calls should hit group manager again
      await toolManager.getToolsForGroup('default');
      await toolManager.getToolsForGroup('filtered');

      expect(mockGroupManager.getGroupTools).toHaveBeenCalledTimes(4);
    });

    it('should refresh cache for specific group', async () => {
      await toolManager.refreshToolCache('default');
      expect(mockGroupManager.getGroupTools).toHaveBeenCalledWith('default');
    });

    it('should refresh cache for all groups', async () => {
      await toolManager.refreshToolCache();
      // Should refresh cache for all known groups
      expect(mockGroupManager.getGroupTools).toHaveBeenCalled();
    });

    it('should get cache statistics', async () => {
      // Populate cache
      await toolManager.getToolsForGroup('default');
      await toolManager.getToolsForGroup('filtered');

      const stats = toolManager.getCacheStats();
      expect(stats.totalGroups).toBe(2);
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.oldestCache).toBeInstanceOf(Date);
      expect(stats.newestCache).toBeInstanceOf(Date);
    });
  });

  describe('tool discovery and aggregation', () => {
    it('should get tools by server for group', async () => {
      const toolsByServer = await toolManager.getToolsByServer('default');
      expect(toolsByServer).toBeInstanceOf(Map);
      expect(toolsByServer.size).toBeGreaterThan(0);
    });

    it('should get available tool names for group', async () => {
      const toolNames = await toolManager.getAvailableToolNames('default');
      expect(toolNames).toEqual(['tool1', 'tool2', 'tool3']);
    });

    it('should check tool availability in group', async () => {
      const isAvailable = await toolManager.isToolAvailableInGroup(
        'default',
        'tool1',
      );
      expect(isAvailable).toBe(true);

      const isNotAvailable = await toolManager.isToolAvailableInGroup(
        'filtered',
        'tool2',
      );
      expect(isNotAvailable).toBe(false);
    });

    it('should get tool details', async () => {
      const toolDetails = await toolManager.getToolDetails('default', 'tool1');
      expect(toolDetails).toEqual(mockTools[0]);

      const noDetails = await toolManager.getToolDetails('filtered', 'tool2');
      expect(noDetails).toBeNull();
    });
  });

  describe('group access validation', () => {
    it('should validate group access successfully', async () => {
      const validation = await toolManager.validateGroupAccess('default');
      expect(validation.isValid).toBe(true);
      expect(validation.serverCount).toBeGreaterThan(0);
      expect(validation.toolCount).toBeGreaterThan(0);
    });

    it('should handle non-existent group validation', async () => {
      const validation = await toolManager.validateGroupAccess('non-existent');
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('not found');
    });
  });

  describe('execution health monitoring', () => {
    it('should get execution health status', async () => {
      const health = await toolManager.getExecutionHealth();
      expect(health).toHaveProperty('cacheHealth');
      expect(health).toHaveProperty('serverHealth');
      expect(health).toHaveProperty('groupHealth');
      expect(health.cacheHealth).toHaveProperty('totalGroups');
      expect(health.serverHealth).toBeInstanceOf(Map);
      expect(health.groupHealth).toBeInstanceOf(Map);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle server manager failures gracefully', async () => {
      vi.mocked(mockServerManager.executeToolOnServer).mockRejectedValue(
        new Error('Server manager failure'),
      );

      const result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Tool execution failed after 2 attempts',
      );
    });

    it('should handle group manager failures gracefully', async () => {
      vi.mocked(mockGroupManager.getGroupTools).mockRejectedValue(
        new Error('Group manager failure'),
      );

      await expect(toolManager.getToolsForGroup('default')).rejects.toThrow(
        'Group manager failure',
      );
    });

    it('should transform different result formats correctly', async () => {
      // Test string result
      vi.mocked(mockServerManager.executeToolOnServer).mockResolvedValueOnce(
        'Simple string result',
      );
      let result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });
      expect(result.content[0].text).toBe('Simple string result');

      // Test number result
      vi.mocked(mockServerManager.executeToolOnServer).mockResolvedValueOnce(
        42,
      );
      result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });
      expect(result.content[0].text).toBe('42');

      // Test object result
      vi.mocked(mockServerManager.executeToolOnServer).mockResolvedValueOnce({
        key: 'value',
      });
      result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });
      expect(result.content[0].text).toContain('key');
      expect(result.content[0].text).toContain('value');

      // Test null result
      vi.mocked(mockServerManager.executeToolOnServer).mockResolvedValueOnce(
        null,
      );
      result = await toolManager.executeTool('default', 'tool1', {
        arg1: 'test',
      });
      expect(result.content[0].text).toBe('null');
    });

    it('should handle argument validation edge cases', () => {
      // Test with null values in required fields
      const isValid1 = toolManager.validateToolArgs('tool1', { arg1: null });
      expect(isValid1).toBe(false);

      // Test with undefined values in required fields
      const isValid2 = toolManager.validateToolArgs('tool1', {
        arg1: undefined,
      });
      expect(isValid2).toBe(false);

      // Test with additional properties when not allowed
      const toolWithStrictSchema = {
        name: 'strict-tool',
        inputSchema: {
          type: 'object',
          properties: { arg1: { type: 'string' } },
          additionalProperties: false,
        },
      };

      // Mock finding this tool by replacing the private method temporarily
      const originalFindTool = (toolManager as any).findToolDefinition.bind(
        toolManager,
      );
      Object.defineProperty(toolManager, 'findToolDefinition', {
        value: vi.fn().mockReturnValue(toolWithStrictSchema),
        writable: true,
        configurable: true,
      });

      const isValid3 = toolManager.validateToolArgs('strict-tool', {
        arg1: 'test',
        extraArg: 'not allowed',
      });
      expect(isValid3).toBe(false);

      // Restore original method
      Object.defineProperty(toolManager, 'findToolDefinition', {
        value: originalFindTool,
        writable: true,
        configurable: true,
      });
    });
  });
});
