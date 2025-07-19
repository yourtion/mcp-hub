import type {
  Group,
  GroupManager,
  ToolManager as IToolManager,
  ServerManager,
  Tool,
  ToolResult,
} from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';

export class ToolManager implements IToolManager {
  private toolCache: Map<string, { tools: Tool[]; lastUpdated: Date }> =
    new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache TTL

  constructor(
    private serverManager: ServerManager,
    private groupManager: GroupManager,
  ) {}

  async getToolsForGroup(groupId: string): Promise<Tool[]> {
    logger.debug('Getting tools for group', { groupId });

    try {
      // Check cache first
      const cached = this.getCachedTools(groupId);
      if (cached) {
        logger.debug('Returning cached tools for group', {
          groupId,
          toolCount: cached.length,
        });
        return cached;
      }

      // Get tools from group manager
      const tools = await this.groupManager.getGroupTools(groupId);

      // Cache the results
      this.cacheTools(groupId, tools);

      logger.debug('Retrieved and cached tools for group', {
        groupId,
        toolCount: tools.length,
      });

      return tools;
    } catch (error) {
      logger.error('Failed to get tools for group', error as Error, {
        groupId,
      });
      throw error;
    }
  }

  async executeTool(
    groupId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const executionId = `${groupId}-${toolName}-${Date.now()}`;
    logger.info('Starting tool execution', {
      executionId,
      groupId,
      toolName,
      args,
    });

    try {
      // Step 1: Validate group exists and is accessible
      const groupValidation = await this.validateGroupAccess(groupId);
      if (!groupValidation.isValid) {
        const error = new Error(
          groupValidation.error || `Invalid group '${groupId}'`,
        );
        logger.warn('Group validation failed', {
          executionId,
          groupId,
          error: error.message,
        });
        return this.createErrorResult(error.message);
      }

      // Step 2: Validate tool access in group
      if (!this.groupManager.validateToolAccess(groupId, toolName)) {
        const error = new Error(
          `Tool '${toolName}' is not accessible in group '${groupId}'`,
        );
        logger.warn('Tool access denied', { executionId, groupId, toolName });
        return this.createErrorResult(error.message);
      }

      // Step 3: Route tool to appropriate server
      const routingResult = await this.routeToolExecution(
        groupId,
        toolName,
        executionId,
      );
      if (!routingResult.success) {
        logger.warn('Tool routing failed', {
          executionId,
          groupId,
          toolName,
          error: routingResult.error,
        });
        return this.createErrorResult(routingResult.error);
      }

      const { serverId, tool } = routingResult;

      // Step 4: Validate tool arguments against schema
      const argsValidation = this.validateToolArgsWithSchema(tool, args);
      if (!argsValidation.isValid) {
        const error = new Error(
          `Invalid arguments for tool '${toolName}': ${argsValidation.error}`,
        );
        logger.warn('Tool argument validation failed', {
          executionId,
          groupId,
          toolName,
          args,
          error: error.message,
        });
        return this.createErrorResult(error.message);
      }

      // Step 5: Execute the tool with comprehensive error handling
      const result = await this.executeToolWithRetry(
        serverId,
        toolName,
        args,
        executionId,
      );

      logger.info('Tool execution completed successfully', {
        executionId,
        groupId,
        toolName,
        serverId,
      });

      return result;
    } catch (error) {
      logger.error('Unexpected error during tool execution', error as Error, {
        executionId,
        groupId,
        toolName,
        args,
      });

      return this.createErrorResult(
        `Unexpected error: ${(error as Error).message}`,
      );
    }
  }

  private async routeToolExecution(
    groupId: string,
    toolName: string,
    executionId: string,
  ): Promise<
    | { success: true; serverId: string; tool: Tool }
    | { success: false; error: string }
  > {
    logger.debug('Routing tool execution', { executionId, groupId, toolName });

    try {
      // Find the server that has this tool
      const serverId = this.findToolServer(toolName, groupId);
      if (!serverId) {
        return {
          success: false,
          error: `Tool '${toolName}' not found in group '${groupId}'`,
        };
      }

      // Verify server is still connected
      const serverConnection = this.serverManager.getAllServers().get(serverId);
      if (!serverConnection || serverConnection.status !== 'connected') {
        return {
          success: false,
          error: `Server '${serverId}' is not available (status: ${
            serverConnection?.status || 'not found'
          })`,
        };
      }

      // Get the tool definition
      const tool = serverConnection.tools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool '${toolName}' definition not found on server '${serverId}'`,
        };
      }

      logger.debug('Tool routing successful', {
        executionId,
        toolName,
        serverId,
        groupId,
      });

      return { success: true, serverId, tool };
    } catch (error) {
      logger.error('Error during tool routing', error as Error, {
        executionId,
        groupId,
        toolName,
      });

      return {
        success: false,
        error: `Routing failed: ${(error as Error).message}`,
      };
    }
  }

  private async executeToolWithRetry(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    executionId: string,
    maxRetries: number = 2,
  ): Promise<ToolResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Attempting tool execution', {
          executionId,
          serverId,
          toolName,
          attempt,
          maxRetries,
        });

        const result = await this.serverManager.executeToolOnServer(
          serverId,
          toolName,
          args,
        );

        logger.debug('Tool execution attempt successful', {
          executionId,
          serverId,
          toolName,
          attempt,
        });

        return this.transformToolResult(result);
      } catch (error) {
        lastError = error as Error;
        logger.warn('Tool execution attempt failed', {
          executionId,
          serverId,
          toolName,
          attempt,
          maxRetries,
          error: lastError.message,
        });

        // Check if this is a retryable error
        if (!this.isRetryableError(lastError) || attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
        logger.debug('Waiting before retry', {
          executionId,
          attempt,
          delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    const errorMessage = `Tool execution failed after ${maxRetries} attempts: ${
      lastError?.message || 'Unknown error'
    }`;

    logger.error(
      'Tool execution failed after all retries',
      lastError || new Error('Unknown error'),
      {
        executionId,
        serverId,
        toolName,
        maxRetries,
        finalError: lastError?.message,
      },
    );

    return this.createErrorResult(errorMessage);
  }

  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /connection/i,
      /timeout/i,
      /network/i,
      /temporary/i,
      /unavailable/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  private createErrorResult(message: string): ToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }

  findToolServer(toolName: string, groupId: string): string | undefined {
    logger.debug('Finding server for tool', { toolName, groupId });

    try {
      // Get the group configuration
      const group = this.groupManager.getGroup(groupId);
      if (!group) {
        logger.debug('Group not found', { groupId });
        return undefined;
      }

      // Get available servers for the group
      const availableServers = this.groupManager.getGroupServers(groupId);
      if (availableServers.length === 0) {
        logger.debug('No available servers in group', { groupId });
        return undefined;
      }

      // Search through each server's tools
      for (const serverId of availableServers) {
        try {
          const serverConnection = this.serverManager
            .getAllServers()
            .get(serverId);
          if (!serverConnection || serverConnection.status !== 'connected') {
            continue;
          }

          // Check if this server has the tool
          const hasTool = serverConnection.tools.some(
            (tool) => tool.name === toolName,
          );
          if (hasTool) {
            logger.debug('Found tool on server', {
              toolName,
              serverId,
              groupId,
            });
            return serverId;
          }
        } catch (error) {
          logger.warn('Error checking server for tool', {
            serverId,
            toolName,
            error: (error as Error).message,
          });
        }
      }

      logger.debug('Tool not found on any server in group', {
        toolName,
        groupId,
        searchedServers: availableServers,
      });
      return undefined;
    } catch (error) {
      logger.error('Error finding tool server', error as Error, {
        toolName,
        groupId,
      });
      return undefined;
    }
  }

  validateToolArgs(toolName: string, args: Record<string, unknown>): boolean {
    logger.debug('Validating tool arguments', { toolName, args });

    try {
      // Find the tool definition to get its schema
      const tool = this.findToolDefinition(toolName);
      if (!tool) {
        logger.debug('Tool definition not found for validation', { toolName });
        // If we can't find the tool definition, we'll allow the execution
        // and let the server handle validation
        return true;
      }

      const validation = this.validateToolArgsWithSchema(tool, args);
      return validation.isValid;
    } catch (error) {
      logger.error('Error validating tool arguments', error as Error, {
        toolName,
        args,
      });
      // On validation error, allow execution and let server handle it
      return true;
    }
  }

  private validateToolArgsWithSchema(
    tool: Tool,
    args: Record<string, unknown>,
  ): { isValid: boolean; error?: string } {
    logger.debug('Validating tool arguments with schema', {
      toolName: tool.name,
      args,
      schema: tool.inputSchema,
    });

    try {
      // If no schema provided, allow all arguments
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        logger.debug('No schema provided, allowing all arguments', {
          toolName: tool.name,
        });
        return { isValid: true };
      }

      const schema = tool.inputSchema as {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
        additionalProperties?: boolean;
      };

      // Validate required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in args)) {
            const error = `Missing required argument: ${requiredField}`;
            logger.warn('Missing required argument', {
              toolName: tool.name,
              requiredField,
              providedArgs: Object.keys(args),
            });
            return { isValid: false, error };
          }

          // Check for null/undefined values in required fields
          if (
            args[requiredField] === null ||
            args[requiredField] === undefined
          ) {
            const error = `Required argument '${requiredField}' cannot be null or undefined`;
            logger.warn('Required argument is null/undefined', {
              toolName: tool.name,
              requiredField,
            });
            return { isValid: false, error };
          }
        }
      }

      // Validate property types if schema properties are defined
      if (schema.properties && typeof schema.properties === 'object') {
        for (const [argName, argValue] of Object.entries(args)) {
          const propSchema = (schema.properties as Record<string, any>)[
            argName
          ];
          if (propSchema && typeof propSchema === 'object') {
            const typeValidation = this.validateArgumentType(
              argName,
              argValue,
              propSchema,
            );
            if (!typeValidation.isValid) {
              logger.warn('Argument type validation failed', {
                toolName: tool.name,
                argName,
                argValue,
                expectedType: propSchema.type,
                error: typeValidation.error,
              });
              return typeValidation;
            }
          }
        }
      }

      // Check for additional properties if not allowed
      if (
        schema.additionalProperties === false &&
        schema.properties &&
        typeof schema.properties === 'object'
      ) {
        const allowedProps = Object.keys(schema.properties);
        const providedProps = Object.keys(args);
        const extraProps = providedProps.filter(
          (prop) => !allowedProps.includes(prop),
        );

        if (extraProps.length > 0) {
          const error = `Additional properties not allowed: ${extraProps.join(
            ', ',
          )}`;
          logger.warn('Additional properties provided', {
            toolName: tool.name,
            extraProps,
            allowedProps,
          });
          return { isValid: false, error };
        }
      }

      logger.debug('Tool arguments validation passed', {
        toolName: tool.name,
      });
      return { isValid: true };
    } catch (error) {
      logger.error('Error during schema validation', error as Error, {
        toolName: tool.name,
        args,
      });
      // On validation error, allow execution and let server handle it
      return { isValid: true };
    }
  }

  private validateArgumentType(
    argName: string,
    argValue: unknown,
    propSchema: any,
  ): { isValid: boolean; error?: string } {
    if (!propSchema.type) {
      return { isValid: true }; // No type specified, allow any
    }

    const expectedType = propSchema.type;
    const actualType = typeof argValue;

    switch (expectedType) {
      case 'string':
        if (actualType !== 'string') {
          return {
            isValid: false,
            error: `Argument '${argName}' must be a string, got ${actualType}`,
          };
        }
        break;

      case 'number':
        if (actualType !== 'number' || isNaN(argValue as number)) {
          return {
            isValid: false,
            error: `Argument '${argName}' must be a number, got ${actualType}`,
          };
        }
        break;

      case 'integer':
        if (actualType !== 'number' || !Number.isInteger(argValue as number)) {
          return {
            isValid: false,
            error: `Argument '${argName}' must be an integer, got ${actualType}`,
          };
        }
        break;

      case 'boolean':
        if (actualType !== 'boolean') {
          return {
            isValid: false,
            error: `Argument '${argName}' must be a boolean, got ${actualType}`,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(argValue)) {
          return {
            isValid: false,
            error: `Argument '${argName}' must be an array, got ${actualType}`,
          };
        }
        break;

      case 'object':
        if (
          actualType !== 'object' ||
          argValue === null ||
          Array.isArray(argValue)
        ) {
          return {
            isValid: false,
            error: `Argument '${argName}' must be an object, got ${actualType}`,
          };
        }
        break;

      default:
        // Unknown type, allow it
        logger.debug('Unknown type in schema, allowing', {
          argName,
          expectedType,
        });
        break;
    }

    return { isValid: true };
  }

  private getCachedTools(groupId: string): Tool[] | null {
    const cached = this.toolCache.get(groupId);
    if (!cached) {
      return null;
    }

    const now = new Date();
    const age = now.getTime() - cached.lastUpdated.getTime();

    if (age > this.CACHE_TTL_MS) {
      // Cache expired
      this.toolCache.delete(groupId);
      logger.debug('Tool cache expired for group', { groupId, age });
      return null;
    }

    return cached.tools;
  }

  private cacheTools(groupId: string, tools: Tool[]): void {
    this.toolCache.set(groupId, {
      tools: [...tools], // Create a copy to avoid mutations
      lastUpdated: new Date(),
    });

    logger.debug('Cached tools for group', {
      groupId,
      toolCount: tools.length,
    });
  }

  private findToolDefinition(toolName: string): Tool | undefined {
    // Search through all cached tools to find the definition
    for (const cached of this.toolCache.values()) {
      const tool = cached.tools.find((t) => t.name === toolName);
      if (tool) {
        return tool;
      }
    }

    // If not in cache, search through all connected servers
    const allServers = this.serverManager.getAllServers();
    for (const server of allServers.values()) {
      if (server.status === 'connected') {
        const tool = server.tools.find((t) => t.name === toolName);
        if (tool) {
          return tool;
        }
      }
    }

    return undefined;
  }

  private transformToolResult(result: unknown): ToolResult {
    logger.debug('Transforming tool result', { result });

    try {
      // Handle different result formats from MCP servers
      if (result && typeof result === 'object') {
        const mcpResult = result as {
          content?: unknown[];
          isError?: boolean;
          error?: unknown;
          _meta?: {
            progressToken?: string;
          };
        };

        // If it's already in the expected format
        if (mcpResult.content && Array.isArray(mcpResult.content)) {
          logger.debug('Result already in expected format', {
            contentLength: mcpResult.content.length,
            isError: mcpResult.isError,
          });
          return {
            content: mcpResult.content,
            isError: mcpResult.isError || false,
          };
        }

        // If it's an error result
        if (mcpResult.error) {
          logger.debug('Transforming error result', { error: mcpResult.error });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${this.formatError(mcpResult.error)}`,
              },
            ],
            isError: true,
          };
        }

        // Handle other object formats
        if (Object.keys(mcpResult).length > 0) {
          logger.debug('Transforming object result to text');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(mcpResult, null, 2),
              },
            ],
            isError: false,
          };
        }
      }

      // Handle primitive types
      if (typeof result === 'string') {
        logger.debug('Transforming string result');
        return {
          content: [{ type: 'text', text: result }],
          isError: false,
        };
      }

      if (typeof result === 'number' || typeof result === 'boolean') {
        logger.debug('Transforming primitive result', { type: typeof result });
        return {
          content: [{ type: 'text', text: String(result) }],
          isError: false,
        };
      }

      // Handle null/undefined
      if (result === null || result === undefined) {
        logger.debug('Transforming null/undefined result');
        return {
          content: [{ type: 'text', text: String(result) }],
          isError: false,
        };
      }

      // Default transformation - stringify everything else
      logger.debug('Using default transformation');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      logger.error('Error transforming tool result', error as Error, {
        originalResult: result,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Error transforming result: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const errorObj = error as {
        message?: string;
        code?: string | number;
        data?: unknown;
      };

      if (errorObj.message) {
        let formatted = errorObj.message;
        if (errorObj.code) {
          formatted = `[${errorObj.code}] ${formatted}`;
        }
        if (errorObj.data) {
          formatted += ` (${JSON.stringify(errorObj.data)})`;
        }
        return formatted;
      }

      return JSON.stringify(error);
    }

    return String(error);
  }

  // Error handling and monitoring methods
  async getExecutionHealth(): Promise<{
    cacheHealth: {
      totalGroups: number;
      totalTools: number;
      oldestCache: Date | null;
      newestCache: Date | null;
    };
    serverHealth: Map<string, string>;
    groupHealth: Map<string, boolean>;
  }> {
    logger.debug('Getting execution health status');

    try {
      const cacheHealth = this.getCacheStats();
      const serverHealth = new Map<string, string>();
      const groupHealth = new Map<string, boolean>();

      // Get server health
      const allServers = this.serverManager.getAllServers();
      for (const [serverId, server] of allServers) {
        serverHealth.set(serverId, server.status);
      }

      // Get group health
      const allGroups = this.groupManager.getAllGroups();
      for (const [groupId] of allGroups) {
        try {
          const validation = await this.validateGroupAccess(groupId);
          groupHealth.set(groupId, validation.isValid);
        } catch (error) {
          groupHealth.set(groupId, false);
        }
      }

      return {
        cacheHealth,
        serverHealth,
        groupHealth,
      };
    } catch (error) {
      logger.error('Error getting execution health', error as Error);
      throw error;
    }
  }

  async refreshToolCache(groupId?: string): Promise<void> {
    if (groupId) {
      logger.info('Refreshing tool cache for group', { groupId });
      this.clearCacheForGroup(groupId);
      // Pre-populate cache
      try {
        await this.getToolsForGroup(groupId);
        logger.info('Tool cache refreshed for group', { groupId });
      } catch (error) {
        logger.error('Failed to refresh cache for group', error as Error, {
          groupId,
        });
        throw error;
      }
    } else {
      logger.info('Refreshing all tool caches');
      this.clearCache();
      // Pre-populate cache for all groups
      const allGroups = this.groupManager.getAllGroups();
      const refreshPromises = Array.from(allGroups.keys()).map(async (gId) => {
        try {
          await this.getToolsForGroup(gId);
        } catch (error) {
          logger.warn('Failed to refresh cache for group during bulk refresh', {
            groupId: gId,
            error: (error as Error).message,
          });
        }
      });

      await Promise.allSettled(refreshPromises);
      logger.info('All tool caches refreshed');
    }
  }

  // Additional utility methods for cache management
  clearCache(): void {
    this.toolCache.clear();
    logger.info('Tool cache cleared');
  }

  clearCacheForGroup(groupId: string): void {
    this.toolCache.delete(groupId);
    logger.debug('Tool cache cleared for group', { groupId });
  }

  getCacheStats(): {
    totalGroups: number;
    totalTools: number;
    oldestCache: Date | null;
    newestCache: Date | null;
  } {
    let totalTools = 0;
    let oldestCache: Date | null = null;
    let newestCache: Date | null = null;

    for (const cached of this.toolCache.values()) {
      totalTools += cached.tools.length;

      if (!oldestCache || cached.lastUpdated < oldestCache) {
        oldestCache = cached.lastUpdated;
      }

      if (!newestCache || cached.lastUpdated > newestCache) {
        newestCache = cached.lastUpdated;
      }
    }

    return {
      totalGroups: this.toolCache.size,
      totalTools,
      oldestCache,
      newestCache,
    };
  }

  // Group-based filtering and access control methods
  async getToolsByServer(groupId: string): Promise<Map<string, Tool[]>> {
    logger.debug('Getting tools by server for group', { groupId });

    try {
      // Get the group and its servers
      const group = this.groupManager.getGroup(groupId);
      if (!group) {
        throw new Error(`Group ${groupId} not found`);
      }

      const toolsByServer = new Map<string, Tool[]>();
      const availableServers = this.groupManager.getGroupServers(groupId);

      // Get tools from each server in the group
      for (const serverId of availableServers) {
        try {
          const serverTools = await this.serverManager.getServerTools(serverId);
          // Apply group-based filtering
          const filteredTools = this.filterToolsForGroup(group, serverTools);
          toolsByServer.set(serverId, filteredTools);
        } catch (error) {
          logger.warn('Failed to get tools from server', {
            serverId,
            groupId,
            error: (error as Error).message,
          });
          toolsByServer.set(serverId, []);
        }
      }

      return toolsByServer;
    } catch (error) {
      logger.error('Failed to get tools by server for group', error as Error, {
        groupId,
      });
      throw error;
    }
  }

  private filterToolsForGroup(group: Group, tools: Tool[]): Tool[] {
    // If group has specific tools listed, filter to only those tools
    if (group.tools.length > 0) {
      return tools.filter((tool) => group.tools.includes(tool.name));
    }
    // If no specific tools listed, return all tools
    return tools;
  }

  async getAvailableToolNames(groupId: string): Promise<string[]> {
    logger.debug('Getting available tool names for group', { groupId });

    try {
      const tools = await this.getToolsForGroup(groupId);
      const toolNames = tools.map((tool) => tool.name);

      logger.debug('Retrieved tool names for group', {
        groupId,
        toolCount: toolNames.length,
        toolNames,
      });

      return toolNames;
    } catch (error) {
      logger.error('Failed to get tool names for group', error as Error, {
        groupId,
      });
      throw error;
    }
  }

  async isToolAvailableInGroup(
    groupId: string,
    toolName: string,
  ): Promise<boolean> {
    logger.debug('Checking tool availability in group', { groupId, toolName });

    try {
      // First check access control
      if (!this.groupManager.validateToolAccess(groupId, toolName)) {
        logger.debug('Tool access denied by group policy', {
          groupId,
          toolName,
        });
        return false;
      }

      // Then check if tool actually exists in the group
      const serverId = this.findToolServer(toolName, groupId);
      const isAvailable = serverId !== undefined;

      logger.debug('Tool availability check result', {
        groupId,
        toolName,
        isAvailable,
        serverId,
      });

      return isAvailable;
    } catch (error) {
      logger.error('Error checking tool availability', error as Error, {
        groupId,
        toolName,
      });
      return false;
    }
  }

  async getToolDetails(
    groupId: string,
    toolName: string,
  ): Promise<Tool | null> {
    logger.debug('Getting tool details', { groupId, toolName });

    try {
      // Check if tool is available in group
      if (!(await this.isToolAvailableInGroup(groupId, toolName))) {
        logger.debug('Tool not available in group', { groupId, toolName });
        return null;
      }

      // Get all tools for the group and find the specific tool
      const tools = await this.getToolsForGroup(groupId);
      const tool = tools.find((t) => t.name === toolName);

      if (tool) {
        logger.debug('Found tool details', {
          groupId,
          toolName,
          serverId: tool.serverId,
        });
      } else {
        logger.debug('Tool details not found', { groupId, toolName });
      }

      return tool || null;
    } catch (error) {
      logger.error('Error getting tool details', error as Error, {
        groupId,
        toolName,
      });
      return null;
    }
  }

  async validateGroupAccess(groupId: string): Promise<{
    isValid: boolean;
    error?: string;
    serverCount: number;
    toolCount: number;
  }> {
    logger.debug('Validating group access', { groupId });

    try {
      // Check if group exists
      const group = this.groupManager.getGroup(groupId);
      if (!group) {
        return {
          isValid: false,
          error: `Group '${groupId}' not found`,
          serverCount: 0,
          toolCount: 0,
        };
      }

      // Get available servers
      const availableServers = this.groupManager.getGroupServers(groupId);
      if (availableServers.length === 0) {
        return {
          isValid: false,
          error: `No servers available in group '${groupId}'`,
          serverCount: 0,
          toolCount: 0,
        };
      }

      // Get available tools
      const tools = await this.getToolsForGroup(groupId);

      logger.debug('Group access validation result', {
        groupId,
        isValid: true,
        serverCount: availableServers.length,
        toolCount: tools.length,
      });

      return {
        isValid: true,
        serverCount: availableServers.length,
        toolCount: tools.length,
      };
    } catch (error) {
      logger.error('Error validating group access', error as Error, {
        groupId,
      });

      return {
        isValid: false,
        error: `Validation failed: ${(error as Error).message}`,
        serverCount: 0,
        toolCount: 0,
      };
    }
  }
}
