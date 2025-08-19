import type { GroupConfig } from '@mcp-core/mcp-hub-share';
import type {
  Group,
  GroupManager as IGroupManager,
  ServerManager,
  Tool,
} from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';

export class GroupManager implements IGroupManager {
  private groups: Map<string, Group> = new Map();
  private serverManager: ServerManager;

  constructor(
    private groupConfig: GroupConfig,
    serverManager: ServerManager,
  ) {
    this.serverManager = serverManager;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing GroupManager', {
      groupCount: Object.keys(this.groupConfig).length,
    });

    // Load and validate group configurations
    for (const [groupName, groupData] of Object.entries(this.groupConfig)) {
      try {
        await this.loadGroup(groupName, groupData);
      } catch (error) {
        logger.error('Failed to load group', error as Error, {
          groupName,
        });
        // Continue with other groups even if one fails
      }
    }

    logger.info('GroupManager initialization completed', {
      totalGroups: Object.keys(this.groupConfig).length,
      loadedGroups: this.groups.size,
    });
  }

  private async loadGroup(groupName: string, groupData: Group): Promise<void> {
    logger.debug('Loading group', { groupName, groupData });

    try {
      // Validate group configuration structure
      this.validateGroupConfig(groupName, groupData);

      // Validate and filter servers to only valid ones
      const validServers = await this.validateGroupServers(
        groupName,
        groupData.servers,
      );

      // Store the group with validated servers
      this.groups.set(groupName, {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        servers: validServers, // Use only valid servers
        tools: [...groupData.tools],
      });

      logger.info('Group loaded successfully', {
        groupName,
        groupId: groupData.id,
        serverCount: validServers.length,
        toolCount: groupData.tools.length,
      });
    } catch (error) {
      logger.error('Failed to load group', error as Error, {
        groupName,
        groupId: groupData.id,
      });

      // Try to create a fallback group if possible
      await this.createFallbackGroup(groupName, groupData, error as Error);
    }
  }

  private async createFallbackGroup(
    groupName: string,
    groupData: Group,
    originalError: Error,
  ): Promise<void> {
    logger.info('Attempting to create fallback group', {
      groupName,
      originalError: originalError.message,
    });

    try {
      // Try to create a minimal valid group
      const allServers = this.serverManager.getAllServers();
      const availableServers = Array.from(allServers.keys());

      if (availableServers.length === 0) {
        logger.warn('Cannot create fallback group: no servers available', {
          groupName,
        });
        return;
      }

      // Create a fallback group with basic configuration
      const fallbackGroup: Group = {
        id: groupData.id || `fallback-${groupName}`,
        name: groupData.name || `Fallback ${groupName}`,
        description: `Fallback group created due to configuration errors: ${originalError.message}`,
        servers: [], // Start with no servers for safety
        tools: [], // Start with no tool restrictions
      };

      this.groups.set(groupName, fallbackGroup);

      logger.warn('Fallback group created', {
        groupName,
        fallbackGroupId: fallbackGroup.id,
        originalError: originalError.message,
      });
    } catch (fallbackError) {
      logger.error('Failed to create fallback group', fallbackError as Error, {
        groupName,
        originalError: originalError.message,
      });
    }
  }

  private validateGroupConfig(groupName: string, groupData: Group): void {
    const errors: string[] = [];

    // Validate required fields
    if (!groupData.id || typeof groupData.id !== 'string') {
      errors.push('id must be a non-empty string');
    }

    if (!groupData.name || typeof groupData.name !== 'string') {
      errors.push('name must be a non-empty string');
    }

    // Validate servers array
    if (!Array.isArray(groupData.servers)) {
      errors.push('servers must be an array');
    } else {
      // Validate each server ID
      for (let i = 0; i < groupData.servers.length; i++) {
        const serverId = groupData.servers[i];
        if (!serverId || typeof serverId !== 'string') {
          errors.push(`servers[${i}] must be a non-empty string`);
        }
      }

      // Check for duplicate server IDs
      const uniqueServers = new Set(groupData.servers);
      if (uniqueServers.size !== groupData.servers.length) {
        errors.push('servers array contains duplicate entries');
      }
    }

    // Validate tools array
    if (!Array.isArray(groupData.tools)) {
      errors.push('tools must be an array');
    } else {
      // Validate each tool name
      for (let i = 0; i < groupData.tools.length; i++) {
        const toolName = groupData.tools[i];
        if (!toolName || typeof toolName !== 'string') {
          errors.push(`tools[${i}] must be a non-empty string`);
        }
      }

      // Check for duplicate tool names
      const uniqueTools = new Set(groupData.tools);
      if (uniqueTools.size !== groupData.tools.length) {
        errors.push('tools array contains duplicate entries');
      }
    }

    // Validate optional description
    if (
      groupData.description !== undefined &&
      typeof groupData.description !== 'string'
    ) {
      errors.push('description must be a string if provided');
    }

    if (errors.length > 0) {
      throw new Error(
        `Group ${groupName} validation failed: ${errors.join(', ')}`,
      );
    }
  }

  private async validateGroupServers(
    groupName: string,
    servers: string[],
  ): Promise<string[]> {
    const allServers = this.serverManager.getAllServers();
    const validServers: string[] = [];
    const invalidServers: string[] = [];

    for (const serverId of servers) {
      if (allServers.has(serverId)) {
        validServers.push(serverId);
      } else {
        invalidServers.push(serverId);
      }
    }

    // Log warnings for invalid server references
    if (invalidServers.length > 0) {
      logger.warn('Group references non-existent servers', {
        groupName,
        invalidServers,
        validServers,
      });
    }

    // Check if group has any valid servers
    if (validServers.length === 0) {
      const errorMsg = `Group ${groupName} has no valid server references`;
      const error = new Error(errorMsg);
      logger.error(errorMsg, error, { groupName, invalidServers });
      throw error;
    }

    // Log info about server validation results
    if (invalidServers.length > 0) {
      logger.info('Group loaded with partial server list', {
        groupName,
        totalServers: servers.length,
        validServers: validServers.length,
        invalidServers: invalidServers.length,
      });
    }

    return validServers;
  }

  getGroup(groupId: string): Group | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): Map<string, Group> {
    return new Map(this.groups);
  }

  async getGroupTools(groupId: string): Promise<Tool[]> {
    const group = this.groups.get(groupId);
    if (!group) {
      const error = new Error(`Group ${groupId} not found`);
      logger.error('Attempted to get tools for non-existent group', error, {
        groupId,
        availableGroups: Array.from(this.groups.keys()),
      });
      throw error;
    }

    try {
      return await this.resolveGroupTools(group);
    } catch (error) {
      logger.error('Failed to resolve tools for group', error as Error, {
        groupId,
        groupName: group.name,
      });

      // Return empty array as fallback instead of throwing
      logger.warn('Returning empty tool list as fallback', { groupId });
      return [];
    }
  }

  private async resolveGroupTools(group: Group): Promise<Tool[]> {
    // Get available servers for this group
    const availableServers = this.getAvailableServersForGroup(group);
    const groupTools: Tool[] = [];

    // Collect tools from all available servers in the group
    for (const serverId of availableServers) {
      try {
        const serverTools = await this.serverManager.getServerTools(serverId);
        groupTools.push(...serverTools);
      } catch (error) {
        logger.warn('Failed to get tools from server', {
          serverId,
          groupId: group.id,
          error: (error as Error).message,
        });
        // Continue with other servers
      }
    }

    // Apply tool filtering based on group configuration
    return this.applyToolFiltering(group, groupTools);
  }

  private getAvailableServersForGroup(group: Group): string[] {
    const allServers = this.serverManager.getAllServers();
    return group.servers.filter((serverId) => {
      const server = allServers.get(serverId);
      return server && server.status === 'connected';
    });
  }

  private applyToolFiltering(group: Group, allTools: Tool[]): Tool[] {
    // If group has specific tools listed, filter to only those tools
    if (group.tools.length > 0) {
      const filteredTools = allTools.filter((tool) =>
        group.tools.includes(tool.name),
      );

      // Log if some specified tools are not available
      const availableToolNames = allTools.map((tool) => tool.name);
      const missingTools = group.tools.filter(
        (toolName) => !availableToolNames.includes(toolName),
      );

      if (missingTools.length > 0) {
        logger.warn('Some tools specified in group are not available', {
          groupId: group.id,
          missingTools,
        });
      }

      return filteredTools;
    }

    // If no specific tools listed, return all tools from group servers
    return allTools;
  }

  validateToolAccess(groupId: string, toolName: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      logger.debug('Tool access denied: group not found', {
        groupId,
        toolName,
      });
      return false;
    }

    return this.isToolAccessibleInGroup(group, toolName);
  }

  private isToolAccessibleInGroup(group: Group, toolName: string): boolean {
    // If group has specific tools listed, check if tool is in the allowed list
    if (group.tools.length > 0) {
      const isAllowed = group.tools.includes(toolName);
      if (!isAllowed) {
        logger.debug('Tool access denied: not in group tool allowlist', {
          groupId: group.id,
          toolName,
          allowedTools: group.tools,
        });
      }
      return isAllowed;
    }

    // If no specific tools listed, check if tool could exist in any of the group's servers
    const availableServers = this.getAvailableServersForGroup(group);
    if (availableServers.length === 0) {
      logger.debug('Tool access denied: no available servers in group', {
        groupId: group.id,
        toolName,
      });
      return false;
    }

    // Allow access - actual tool existence will be validated during execution
    return true;
  }

  async findToolInGroup(
    groupId: string,
    toolName: string,
  ): Promise<{
    tool: Tool;
    serverId: string;
  } | null> {
    const group = this.groups.get(groupId);
    if (!group) {
      return null;
    }

    // Check if tool access is allowed in this group
    if (!this.isToolAccessibleInGroup(group, toolName)) {
      return null;
    }

    // Search for the tool in group's available servers
    const availableServers = this.getAvailableServersForGroup(group);

    for (const serverId of availableServers) {
      try {
        const serverTools = await this.serverManager.getServerTools(serverId);
        const tool = serverTools.find((t) => t.name === toolName);
        if (tool) {
          return { tool, serverId };
        }
      } catch (error) {
        logger.warn('Failed to search for tool in server', {
          serverId,
          toolName,
          error: (error as Error).message,
        });
        // Continue searching in other servers
      }
    }

    return null;
  }

  getGroupServers(groupId: string): string[] {
    const group = this.groups.get(groupId);
    if (!group) {
      return [];
    }

    // Return only servers that actually exist
    const allServers = this.serverManager.getAllServers();
    return group.servers.filter((serverId) => allServers.has(serverId));
  }

  getAvailableGroupServers(groupId: string): string[] {
    const group = this.groups.get(groupId);
    if (!group) {
      return [];
    }

    return this.getAvailableServersForGroup(group);
  }

  async getGroupToolsByServer(groupId: string): Promise<Map<string, Tool[]>> {
    const group = this.groups.get(groupId);
    if (!group) {
      const error = new Error(`Group ${groupId} not found`);
      logger.error(
        'Attempted to get tools by server for non-existent group',
        error,
        {
          groupId,
          availableGroups: Array.from(this.groups.keys()),
        },
      );
      throw error;
    }

    const toolsByServer = new Map<string, Tool[]>();
    const availableServers = this.getAvailableServersForGroup(group);

    if (availableServers.length === 0) {
      logger.warn('No available servers for group', {
        groupId,
        configuredServers: group.servers,
      });
      return toolsByServer;
    }

    for (const serverId of availableServers) {
      try {
        const serverTools = await this.serverManager.getServerTools(serverId);
        const filteredTools = this.applyToolFiltering(group, serverTools);
        toolsByServer.set(serverId, filteredTools);

        logger.debug('Retrieved tools from server for group', {
          serverId,
          groupId,
          toolCount: filteredTools.length,
        });
      } catch (error) {
        logger.warn('Failed to get tools from server for group breakdown', {
          serverId,
          groupId,
          error: (error as Error).message,
        });
        // Set empty array for failed servers to maintain consistency
        toolsByServer.set(serverId, []);
      }
    }

    return toolsByServer;
  }

  getGroupStats(groupId: string): {
    totalServers: number;
    availableServers: number;
    configuredTools: number;
  } {
    const group = this.groups.get(groupId);
    if (!group) {
      return { totalServers: 0, availableServers: 0, configuredTools: 0 };
    }

    const availableServers = this.getAvailableServersForGroup(group);

    return {
      totalServers: group.servers.length,
      availableServers: availableServers.length,
      configuredTools: group.tools.length,
    };
  }

  async validateGroupHealth(groupId: string): Promise<{
    isHealthy: boolean;
    issues: string[];
    warnings: string[];
    stats: {
      totalServers: number;
      availableServers: number;
      configuredTools: number;
      actualTools: number;
    };
  }> {
    const group = this.groups.get(groupId);
    if (!group) {
      return {
        isHealthy: false,
        issues: [`Group ${groupId} not found`],
        warnings: [],
        stats: {
          totalServers: 0,
          availableServers: 0,
          configuredTools: 0,
          actualTools: 0,
        },
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];
    const availableServers = this.getAvailableServersForGroup(group);

    // Check server availability
    if (availableServers.length === 0) {
      issues.push('No servers are currently available');
    } else if (availableServers.length < group.servers.length) {
      warnings.push(
        `Only ${availableServers.length} of ${group.servers.length} servers are available`,
      );
    }

    // Check tool availability
    let actualToolCount = 0;
    try {
      const tools = await this.resolveGroupTools(group);
      actualToolCount = tools.length;

      if (group.tools.length > 0 && actualToolCount === 0) {
        issues.push('No configured tools are available');
      } else if (
        group.tools.length > 0 &&
        actualToolCount < group.tools.length
      ) {
        warnings.push(
          `Only ${actualToolCount} of ${group.tools.length} configured tools are available`,
        );
      }
    } catch (error) {
      issues.push(`Failed to resolve group tools: ${(error as Error).message}`);
    }

    const isHealthy = issues.length === 0;

    return {
      isHealthy,
      issues,
      warnings,
      stats: {
        totalServers: group.servers.length,
        availableServers: availableServers.length,
        configuredTools: group.tools.length,
        actualTools: actualToolCount,
      },
    };
  }

  async getAllGroupsHealth(): Promise<
    Map<
      string,
      {
        isHealthy: boolean;
        issues: string[];
        warnings: string[];
      }
    >
  > {
    const healthMap = new Map();

    for (const groupId of this.groups.keys()) {
      try {
        const health = await this.validateGroupHealth(groupId);
        healthMap.set(groupId, {
          isHealthy: health.isHealthy,
          issues: health.issues,
          warnings: health.warnings,
        });
      } catch (error) {
        healthMap.set(groupId, {
          isHealthy: false,
          issues: [`Health check failed: ${(error as Error).message}`],
          warnings: [],
        });
      }
    }

    return healthMap;
  }
}
