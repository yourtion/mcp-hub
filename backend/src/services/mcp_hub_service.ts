import type { GroupConfig, ServerConfig } from '@mcp-core/mcp-hub-share';
import type {
  Group,
  McpHubService as IMcpHubService,
  Tool,
  ToolResult,
} from '../types/mcp-hub.js';
import { ServerStatus } from '../types/mcp-hub.js';
import { logger } from '../utils/logger.js';
import { ApiToolIntegrationService } from './api_tool_integration_service.js';
import { GroupManager } from './group_manager.js';
import { ServerManager } from './server_manager.js';
import { ToolManager } from './tool_manager.js';

// Error types for better error handling
export class McpHubError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpHubError';
  }
}

export class ServiceNotInitializedError extends McpHubError {
  constructor() {
    super(
      'MCP Hub Service must be initialized before use',
      'SERVICE_NOT_INITIALIZED',
    );
  }
}

export class GroupNotFoundError extends McpHubError {
  constructor(groupId: string) {
    super(`Group '${groupId}' not found`, 'GROUP_NOT_FOUND', { groupId });
  }
}

export class ToolNotFoundError extends McpHubError {
  constructor(toolName: string, groupId: string) {
    super(
      `Tool '${toolName}' not found in group '${groupId}'`,
      'TOOL_NOT_FOUND',
      { toolName, groupId },
    );
  }
}

export class ServiceInitializationError extends McpHubError {
  constructor(message: string, cause?: Error) {
    super(
      `Service initialization failed: ${message}`,
      'INITIALIZATION_FAILED',
      { cause: cause?.message },
    );
  }
}

export class McpHubService implements IMcpHubService {
  private serverManager: ServerManager;
  private groupManager: GroupManager;
  private toolManager: ToolManager;
  private apiToolService: ApiToolIntegrationService;
  private isInitialized = false;
  private readonly DEFAULT_GROUP = 'default';

  // Message tracking for debugging
  private mcpMessages: Array<{
    id: string;
    timestamp: string;
    serverId: string;
    type: 'request' | 'response' | 'notification';
    method: string;
    content: unknown;
  }> = [];

  // Lifecycle management properties
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private shutdownInProgress = false;
  private initializationTime?: Date;
  private lastHealthCheck?: Date;
  private healthCheckEnabled = true;

  constructor(
    private serverConfigs: Record<string, ServerConfig>,
    private groupConfigs: GroupConfig,
    private apiToolConfigPath?: string,
  ) {
    // Initialize managers
    this.serverManager = new ServerManager(serverConfigs);
    this.groupManager = new GroupManager(groupConfigs, this.serverManager);
    this.apiToolService = new ApiToolIntegrationService();
    this.toolManager = new ToolManager(
      this.serverManager,
      this.groupManager,
      this.apiToolService,
    );

    // Set up message tracking
    this.serverManager.setMessageTracker(
      (serverId, type, method, content) => {
        this.addMcpMessage(serverId, type, method, content);
      }
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn(
        'McpHubService already initialized, skipping re-initialization',
      );
      return;
    }

    const initStartTime = Date.now();
    logger.info('Starting MCP Hub Service initialization', {
      serverCount: Object.keys(this.serverConfigs).length,
      groupCount: Object.keys(this.groupConfigs).length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize components in order: servers first, then groups, then tools
      logger.debug('Initializing server manager');
      await this.serverManager.initialize();

      const connectedServers = this.getConnectedServerCount();
      logger.info('Server manager initialized', {
        totalServers: Object.keys(this.serverConfigs).length,
        connectedServers,
        failedServers:
          Object.keys(this.serverConfigs).length - connectedServers,
      });

      logger.debug('Initializing group manager');
      await this.groupManager.initialize();

      const loadedGroups = this.groupManager.getAllGroups().size;
      logger.info('Group manager initialized', {
        totalGroups: Object.keys(this.groupConfigs).length,
        loadedGroups,
        failedGroups: Object.keys(this.groupConfigs).length - loadedGroups,
      });

      // Initialize API tool service if config path is provided
      logger.debug('Initializing API tool integration service');
      await this.apiToolService.initialize(this.apiToolConfigPath);

      const apiToolStats = await this.apiToolService.getStats();
      logger.info('API tool integration service initialized', {
        apiToolsEnabled: apiToolStats.initialized,
        totalApiTools: apiToolStats.totalApiTools,
      });

      // Validate service health after initialization
      await this.validateServiceHealth();

      this.isInitialized = true;
      this.initializationTime = new Date();

      // Start health monitoring
      this.startHealthMonitoring();

      const initDuration = Date.now() - initStartTime;
      logger.info('MCP Hub Service initialization completed successfully', {
        connectedServers,
        loadedGroups,
        initializationTimeMs: initDuration,
        timestamp: new Date().toISOString(),
        healthMonitoringEnabled: this.healthCheckEnabled,
      });
    } catch (error) {
      const initDuration = Date.now() - initStartTime;
      logger.error('MCP Hub Service initialization failed', error as Error, {
        initializationTimeMs: initDuration,
        serverCount: Object.keys(this.serverConfigs).length,
        groupCount: Object.keys(this.groupConfigs).length,
      });

      // Attempt cleanup on failed initialization
      await this.cleanupFailedInitialization();

      throw new ServiceInitializationError(
        (error as Error).message,
        error as Error,
      );
    }
  }

  async listTools(groupId?: string): Promise<Tool[]> {
    this.ensureInitialized();

    const targetGroupId = groupId || this.DEFAULT_GROUP;
    const operationId = `list-tools-${targetGroupId}-${Date.now()}`;

    logger.debug('Starting tool listing operation', {
      operationId,
      groupId: targetGroupId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate group exists
      if (!this.groupManager.getGroup(targetGroupId)) {
        const error = new GroupNotFoundError(targetGroupId);
        logger.warn('Tool listing failed: group not found', {
          operationId,
          groupId: targetGroupId,
          availableGroups: Array.from(this.groupManager.getAllGroups().keys()),
        });
        throw error;
      }

      const startTime = Date.now();
      const tools = await this.toolManager.getToolsForGroup(targetGroupId);
      const duration = Date.now() - startTime;

      logger.info('Tools listed successfully', {
        operationId,
        groupId: targetGroupId,
        toolCount: tools.length,
        durationMs: duration,
        toolNames: tools.map((t) => t.name),
      });

      return tools;
    } catch (error) {
      logger.error('Tool listing operation failed', error as Error, {
        operationId,
        groupId: targetGroupId,
        errorType: (error as Error).constructor.name,
      });

      // Re-throw known errors, wrap unknown ones
      if (error instanceof McpHubError) {
        throw error;
      }

      throw new McpHubError(
        `Failed to list tools for group '${targetGroupId}': ${(error as Error).message}`,
        'TOOL_LISTING_FAILED',
        { groupId: targetGroupId, originalError: (error as Error).message },
      );
    }
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    groupId?: string,
  ): Promise<ToolResult> {
    this.ensureInitialized();

    const targetGroupId = groupId || this.DEFAULT_GROUP;
    const executionId = `exec-${targetGroupId}-${toolName}-${Date.now()}`;

    logger.logToolExecution(toolName, targetGroupId, 'started', {
      executionId,
      args,
      timestamp: new Date().toISOString(),
    });

    try {
      // Pre-execution validation
      await this.validateToolExecution(toolName, targetGroupId, executionId);

      const startTime = Date.now();
      const result = await this.toolManager.executeTool(
        targetGroupId,
        toolName,
        args,
      );
      const duration = Date.now() - startTime;

      // Log execution result
      const status = result.isError ? 'failed' : 'completed';
      logger.logToolExecution(toolName, targetGroupId, status, {
        executionId,
        durationMs: duration,
        resultSize: JSON.stringify(result.content).length,
        contentTypes: result.content.map((c: any) => c.type || 'unknown'),
      });

      // Additional error logging for failed executions
      if (result.isError) {
        logger.warn('Tool execution completed with error result', {
          executionId,
          toolName,
          groupId: targetGroupId,
          errorContent: result.content,
        });
      }

      return result;
    } catch (error) {
      logger.logToolExecution(toolName, targetGroupId, 'failed', {
        executionId,
        error: (error as Error).message,
        errorType: (error as Error).constructor.name,
      });

      // Enhanced error context for debugging
      logger.error('Tool execution failed with exception', error as Error, {
        executionId,
        toolName,
        groupId: targetGroupId,
        args,
        serviceHealth: this.getServiceHealthSummary(),
      });

      // Re-throw known errors, wrap unknown ones
      if (error instanceof McpHubError) {
        throw error;
      }

      throw new McpHubError(
        `Tool execution failed: ${(error as Error).message}`,
        'TOOL_EXECUTION_FAILED',
        {
          toolName,
          groupId: targetGroupId,
          executionId,
          originalError: (error as Error).message,
        },
      );
    }
  }

  getGroupInfo(groupId: string): Group | undefined {
    this.ensureInitialized();

    logger.debug('Retrieving group information', {
      groupId,
      timestamp: new Date().toISOString(),
    });

    try {
      const group = this.groupManager.getGroup(groupId);

      if (group) {
        // Get additional runtime information
        const availableServers = this.groupManager.getGroupServers(groupId);
        const connectedServers = availableServers.filter((serverId) => {
          const server = this.serverManager.getAllServers().get(serverId);
          return server?.status === ServerStatus.CONNECTED;
        });

        logger.debug('Group information retrieved successfully', {
          groupId,
          groupName: group.name,
          configuredServers: group.servers.length,
          availableServers: availableServers.length,
          connectedServers: connectedServers.length,
          configuredTools: group.tools.length,
        });
      } else {
        logger.warn('Group information request for non-existent group', {
          groupId,
          availableGroups: Array.from(this.groupManager.getAllGroups().keys()),
        });
      }

      return group;
    } catch (error) {
      logger.error('Error retrieving group information', error as Error, {
        groupId,
      });

      // Don't throw for group info retrieval, return undefined
      return undefined;
    }
  }

  getServerHealth(): Map<string, ServerStatus> {
    this.ensureInitialized();

    logger.debug('Getting server health status');

    const healthMap = new Map<string, ServerStatus>();
    const allServers = this.serverManager.getAllServers();

    for (const [serverId, server] of allServers) {
      healthMap.set(serverId, server.status);
    }

    logger.debug('Server health retrieved', {
      totalServers: healthMap.size,
      connectedServers: Array.from(healthMap.values()).filter(
        (status) => status === ServerStatus.CONNECTED,
      ).length,
    });

    return healthMap;
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('MCP Hub Service not initialized, skipping shutdown');
      return;
    }

    if (this.shutdownInProgress) {
      logger.warn('Shutdown already in progress, waiting for completion');
      return;
    }

    this.shutdownInProgress = true;
    const shutdownStartTime = Date.now();

    logger.info('Starting graceful MCP Hub Service shutdown', {
      timestamp: new Date().toISOString(),
      connectedServers: this.getConnectedServerCount(),
      uptime: this.getServiceUptime(),
    });

    const errors: Error[] = [];

    try {
      // Stop health monitoring first
      logger.debug('Stopping health monitoring');
      this.stopHealthMonitoring();

      // Graceful shutdown with timeout
      const shutdownPromise = this.performGracefulShutdown();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Shutdown timeout')), 10000); // 10 second timeout
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch (error) {
      const shutdownError = error as Error;
      logger.error('Error during graceful shutdown', shutdownError);
      errors.push(shutdownError);

      // Attempt force shutdown
      try {
        logger.warn(
          'Attempting force shutdown due to graceful shutdown failure',
        );
        await this.performForceShutdown();
      } catch (forceError) {
        logger.error('Force shutdown also failed', forceError as Error);
        errors.push(forceError as Error);
      }
    }

    // Mark as not initialized even if there were errors
    this.isInitialized = false;
    this.shutdownInProgress = false;

    const shutdownDuration = Date.now() - shutdownStartTime;

    if (errors.length > 0) {
      logger.error(
        'MCP Hub Service shutdown completed with errors',
        new Error('Shutdown errors occurred'),
        {
          shutdownTimeMs: shutdownDuration,
          errorCount: errors.length,
          errors: errors.map((e) => e.message),
        },
      );

      // Throw aggregated error
      throw new McpHubError(
        `Shutdown completed with ${errors.length} errors: ${errors.map((e) => e.message).join(', ')}`,
        'SHUTDOWN_ERRORS',
        { errorCount: errors.length, shutdownTimeMs: shutdownDuration },
      );
    } else {
      logger.info('MCP Hub Service shutdown completed successfully', {
        shutdownTimeMs: shutdownDuration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Additional utility methods for service management

  /**
   * Get all available groups
   */
  getAllGroups(): Map<string, Group> {
    this.ensureInitialized();
    return this.groupManager.getAllGroups();
  }

  /**
   * Get detailed service status (synchronous version for backward compatibility)
   */
  getServiceStatus(): {
    isInitialized: boolean;
    serverCount: number;
    connectedServers: number;
    groupCount: number;
    totalTools: number;
  } {
    const serverHealth = this.isInitialized
      ? this.getServerHealth()
      : new Map();
    const connectedServers = Array.from(serverHealth.values()).filter(
      (status) => status === ServerStatus.CONNECTED,
    ).length;

    return {
      isInitialized: this.isInitialized,
      serverCount: Object.keys(this.serverConfigs).length,
      connectedServers,
      groupCount: this.isInitialized
        ? this.groupManager.getAllGroups().size
        : 0,
      totalTools: 0, // 保持简单的同步版本
    };
  }

  /**
   * Get detailed service status with API tools information (async version)
   */
  async getDetailedServiceStatus(): Promise<{
    isInitialized: boolean;
    serverCount: number;
    connectedServers: number;
    groupCount: number;
    totalTools: number;
    apiTools: number;
  }> {
    const serverHealth = this.isInitialized
      ? this.getServerHealth()
      : new Map();
    const connectedServers = Array.from(serverHealth.values()).filter(
      (status) => status === ServerStatus.CONNECTED,
    ).length;

    // 获取API工具统计
    let apiToolCount = 0;
    if (this.isInitialized) {
      try {
        const apiStats = await this.apiToolService.getStats();
        apiToolCount = apiStats.totalApiTools;
      } catch (error) {
        logger.warn('获取API工具统计失败', {
          error: (error as Error).message,
        });
      }
    }

    // 计算总工具数（包括MCP工具和API工具）
    let totalMcpTools = 0;
    if (this.isInitialized) {
      try {
        // 获取默认组的工具数量作为总数的估算
        const tools = await this.listTools();
        totalMcpTools = tools.length - apiToolCount; // 减去API工具数量避免重复计算
      } catch (error) {
        logger.warn('获取MCP工具统计失败', {
          error: (error as Error).message,
        });
      }
    }

    return {
      isInitialized: this.isInitialized,
      serverCount: Object.keys(this.serverConfigs).length,
      connectedServers,
      groupCount: this.isInitialized
        ? this.groupManager.getAllGroups().size
        : 0,
      totalTools: totalMcpTools + apiToolCount,
      apiTools: apiToolCount,
    };
  }

  /**
   * Check if a specific tool is available in a group
   */
  async isToolAvailable(toolName: string, groupId?: string): Promise<boolean> {
    this.ensureInitialized();

    const targetGroupId = groupId || this.DEFAULT_GROUP;

    try {
      const tools = await this.listTools(targetGroupId);
      return tools.some((tool) => tool.name === toolName);
    } catch (error) {
      logger.error('Error checking tool availability', error as Error, {
        toolName,
        groupId: targetGroupId,
      });
      return false;
    }
  }

  /**
   * Get tool details for a specific tool in a group
   */
  async getToolDetails(
    toolName: string,
    groupId?: string,
  ): Promise<Tool | null> {
    this.ensureInitialized();

    const targetGroupId = groupId || this.DEFAULT_GROUP;

    try {
      const tools = await this.listTools(targetGroupId);
      return tools.find((tool) => tool.name === toolName) || null;
    } catch (error) {
      logger.error('Error getting tool details', error as Error, {
        toolName,
        groupId: targetGroupId,
      });
      return null;
    }
  }

  /**
   * Get API tool service health status
   */
  getApiToolServiceHealth(): {
    initialized: boolean;
    healthy: boolean;
    serviceStatus?: string;
    errors?: string[];
  } {
    this.ensureInitialized();

    try {
      return this.apiToolService.getHealthStatus();
    } catch (error) {
      logger.error('Error getting API tool service health', error as Error);
      return {
        initialized: false,
        healthy: false,
        errors: [`获取API工具服务健康状态失败: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Perform API tool service health check
   */
  async performApiToolHealthCheck(): Promise<{
    initialized: boolean;
    healthy: boolean;
    serviceStatus?: string;
    errors?: string[];
  }> {
    this.ensureInitialized();

    try {
      return await this.apiToolService.performHealthCheck();
    } catch (error) {
      logger.error('Error performing API tool health check', error as Error);
      return {
        initialized: false,
        healthy: false,
        errors: [`API工具健康检查失败: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Reload API tool configuration
   */
  async reloadApiToolConfig(): Promise<void> {
    this.ensureInitialized();

    logger.info('重新加载API工具配置');

    try {
      await this.apiToolService.reloadConfig();
      logger.info('API工具配置重新加载完成');
    } catch (error) {
      logger.error('重新加载API工具配置失败', error as Error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('McpHubService must be initialized before use');
    }
  }

  private getConnectedServerCount(): number {
    const allServers = this.serverManager.getAllServers();
    return Array.from(allServers.values()).filter(
      (server) => server.status === ServerStatus.CONNECTED,
    ).length;
  }

  /**
   * Validate service health after initialization
   */
  private async validateServiceHealth(): Promise<void> {
    logger.debug('Validating service health after initialization');

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check server connectivity
    const connectedServers = this.getConnectedServerCount();
    const totalServers = Object.keys(this.serverConfigs).length;

    if (connectedServers === 0) {
      warnings.push(
        'No servers are connected - service will have limited functionality',
      );
    } else if (connectedServers < totalServers) {
      warnings.push(
        `Only ${connectedServers} of ${totalServers} servers are connected`,
      );
    }

    // Check group validity
    const loadedGroups = this.groupManager.getAllGroups().size;
    const totalGroups = Object.keys(this.groupConfigs).length;

    if (loadedGroups === 0) {
      issues.push('No groups are loaded');
    } else if (loadedGroups < totalGroups) {
      warnings.push(`Only ${loadedGroups} of ${totalGroups} groups are loaded`);
    }

    // Log health status
    if (issues.length > 0) {
      logger.error(
        'Service health validation failed',
        new Error('Critical health issues detected'),
        {
          issues,
          warnings,
          connectedServers,
          totalServers,
          loadedGroups,
          totalGroups,
        },
      );
      throw new ServiceInitializationError(
        `Critical health issues: ${issues.join(', ')}`,
      );
    }

    if (warnings.length > 0) {
      logger.warn('Service health validation completed with warnings', {
        warnings,
        connectedServers,
        totalServers,
        loadedGroups,
        totalGroups,
      });
    } else {
      logger.info('Service health validation passed', {
        connectedServers,
        totalServers,
        loadedGroups,
        totalGroups,
      });
    }
  }

  /**
   * Clean up resources after failed initialization
   */
  private async cleanupFailedInitialization(): Promise<void> {
    logger.debug('Cleaning up after failed initialization');

    try {
      // Attempt to shutdown any partially initialized components
      if (this.serverManager) {
        await this.serverManager.shutdown();
      }
      logger.debug('Cleanup completed successfully');
    } catch (cleanupError) {
      logger.error(
        'Error during initialization cleanup',
        cleanupError as Error,
      );
      // Don't throw cleanup errors, just log them
    }
  }

  /**
   * Validate tool execution prerequisites
   */
  private async validateToolExecution(
    toolName: string,
    groupId: string,
    executionId: string,
  ): Promise<void> {
    logger.debug('Validating tool execution prerequisites', {
      executionId,
      toolName,
      groupId,
    });

    // Check if group exists
    const group = this.groupManager.getGroup(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    // Check if tool is available in group
    const isAvailable = await this.isToolAvailable(toolName, groupId);
    if (!isAvailable) {
      throw new ToolNotFoundError(toolName, groupId);
    }

    // Check if any servers in the group are connected
    const availableServers = this.groupManager.getGroupServers(groupId);
    const connectedServers = availableServers.filter((serverId) => {
      const server = this.serverManager.getAllServers().get(serverId);
      return server?.status === ServerStatus.CONNECTED;
    });

    if (connectedServers.length === 0) {
      throw new McpHubError(
        `No servers are available in group '${groupId}'`,
        'NO_SERVERS_AVAILABLE',
        { groupId, availableServers, connectedServers },
      );
    }

    logger.debug('Tool execution validation passed', {
      executionId,
      toolName,
      groupId,
      availableServers: availableServers.length,
      connectedServers: connectedServers.length,
    });
  }

  /**
   * Get a summary of service health for error context
   */
  private getServiceHealthSummary(): Record<string, unknown> {
    try {
      const serverHealth = this.getServerHealth();
      const connectedServers = Array.from(serverHealth.values()).filter(
        (status) => status === ServerStatus.CONNECTED,
      ).length;

      return {
        isInitialized: this.isInitialized,
        totalServers: serverHealth.size,
        connectedServers,
        totalGroups: this.groupManager.getAllGroups().size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: 'Failed to get health summary',
        message: (error as Error).message,
      };
    }
  }

  /**
   * Format error responses for API consumers
   */
  public static formatErrorResponse(error: Error): {
    error: {
      code: string;
      message: string;
      context?: Record<string, unknown>;
    };
  } {
    if (error instanceof McpHubError) {
      return {
        error: {
          code: error.code,
          message: error.message,
          context: error.context,
        },
      };
    }

    // Generic error formatting
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  /**
   * Get comprehensive service diagnostics
   */
  async getServiceDiagnostics(): Promise<{
    service: {
      isInitialized: boolean;
      uptime: number;
      version: string;
    };
    servers: {
      total: number;
      connected: number;
      failed: number;
      details: Array<{
        id: string;
        status: string;
        lastConnected?: string;
        error?: string;
        toolCount: number;
      }>;
    };
    groups: {
      total: number;
      loaded: number;
      details: Array<{
        id: string;
        name: string;
        serverCount: number;
        toolCount: number;
        isHealthy: boolean;
      }>;
    };
    apiTools: {
      initialized: boolean;
      healthy: boolean;
      totalTools: number;
      errors: string[];
    };
    performance: {
      cacheStats: any;
    };
  }> {
    this.ensureInitialized();

    logger.debug('Generating service diagnostics');

    try {
      const allServers = this.serverManager.getAllServers();
      const allGroups = this.groupManager.getAllGroups();

      // Server diagnostics
      const serverDetails = Array.from(allServers.entries()).map(
        ([id, server]) => ({
          id,
          status: server.status,
          lastConnected: server.lastConnected?.toISOString(),
          error: server.lastError?.message,
          toolCount: server.tools.length,
        }),
      );

      const connectedServers = serverDetails.filter(
        (s) => s.status === ServerStatus.CONNECTED,
      ).length;
      const failedServers = serverDetails.filter(
        (s) => s.status === ServerStatus.ERROR,
      ).length;

      // Group diagnostics
      const groupDetails = await Promise.all(
        Array.from(allGroups.entries()).map(async ([id, group]) => {
          try {
            const tools = await this.toolManager.getToolsForGroup(id);
            return {
              id,
              name: group.name,
              serverCount: group.servers.length,
              toolCount: tools.length,
              isHealthy: tools.length > 0,
            };
          } catch (_error) {
            return {
              id,
              name: group.name,
              serverCount: group.servers.length,
              toolCount: 0,
              isHealthy: false,
            };
          }
        }),
      );

      // Performance diagnostics
      const cacheStats = (this.toolManager as any).getCacheStats?.() || {};

      // API tool diagnostics
      let apiToolDiagnostics = {
        initialized: false,
        healthy: false,
        totalTools: 0,
        errors: [] as string[],
      };

      try {
        const apiHealth = await this.apiToolService.performHealthCheck();
        const apiStats = await this.apiToolService.getStats();
        apiToolDiagnostics = {
          initialized: apiHealth.initialized,
          healthy: apiHealth.healthy,
          totalTools: apiStats.totalApiTools,
          errors: apiHealth.errors || [],
        };
      } catch (error) {
        apiToolDiagnostics.errors.push(
          `API工具诊断失败: ${(error as Error).message}`,
        );
      }

      const diagnostics = {
        service: {
          isInitialized: this.isInitialized,
          uptime: process.uptime(),
          version: '1.0.0', // TODO: Get from package.json
        },
        servers: {
          total: allServers.size,
          connected: connectedServers,
          failed: failedServers,
          details: serverDetails,
        },
        groups: {
          total: allGroups.size,
          loaded: allGroups.size,
          details: groupDetails,
        },
        apiTools: apiToolDiagnostics,
        performance: {
          cacheStats,
        },
      };

      logger.info('Service diagnostics generated', {
        serverCount: diagnostics.servers.total,
        connectedServers: diagnostics.servers.connected,
        groupCount: diagnostics.groups.total,
      });

      return diagnostics;
    } catch (error) {
      logger.error('Failed to generate service diagnostics', error as Error);
      throw new McpHubError(
        'Failed to generate diagnostics',
        'DIAGNOSTICS_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  // Lifecycle Management Methods

  /**
   * Start health monitoring for the service
   */
  private startHealthMonitoring(): void {
    if (!this.healthCheckEnabled) {
      logger.debug('Health monitoring disabled, skipping start');
      return;
    }

    if (this.healthCheckInterval) {
      logger.debug('Health monitoring already running');
      return;
    }

    logger.info('Starting service health monitoring', {
      intervalMs: this.HEALTH_CHECK_INTERVAL_MS,
    });

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed', error as Error);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);

    // Perform initial health check
    setImmediate(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Initial health check failed', error as Error);
      }
    });
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Perform a comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    this.lastHealthCheck = new Date();

    logger.debug('Performing service health check', {
      timestamp: this.lastHealthCheck.toISOString(),
    });

    try {
      const healthReport = await this.generateHealthReport();

      // Log health status
      if (healthReport.critical.length > 0) {
        logger.error(
          'Critical health issues detected',
          new Error('Service health critical'),
          {
            criticalIssues: healthReport.critical,
            warnings: healthReport.warnings,
            healthScore: healthReport.healthScore,
          },
        );
      } else if (healthReport.warnings.length > 0) {
        logger.warn('Service health warnings detected', {
          warnings: healthReport.warnings,
          healthScore: healthReport.healthScore,
        });
      } else {
        logger.debug('Service health check passed', {
          healthScore: healthReport.healthScore,
          connectedServers: healthReport.servers.connected,
          totalServers: healthReport.servers.total,
        });
      }

      // Handle server disconnections
      await this.handleServerDisconnections(healthReport);
    } catch (error) {
      logger.error('Health check execution failed', error as Error);
    }
  }

  /**
   * Generate comprehensive health report
   */
  private async generateHealthReport(): Promise<{
    healthScore: number;
    critical: string[];
    warnings: string[];
    servers: {
      total: number;
      connected: number;
      disconnected: number;
      failed: number;
    };
    groups: {
      total: number;
      healthy: number;
      unhealthy: number;
    };
    uptime: number;
  }> {
    const critical: string[] = [];
    const warnings: string[] = [];

    // Server health analysis
    const allServers = this.serverManager.getAllServers();
    const serverStats = {
      total: allServers.size,
      connected: 0,
      disconnected: 0,
      failed: 0,
    };

    for (const server of allServers.values()) {
      switch (server.status) {
        case ServerStatus.CONNECTED:
          serverStats.connected++;
          break;
        case ServerStatus.DISCONNECTED:
          serverStats.disconnected++;
          break;
        case ServerStatus.ERROR:
          serverStats.failed++;
          break;
      }
    }

    // Analyze server health
    if (serverStats.connected === 0) {
      critical.push('No servers are connected');
    } else if (serverStats.connected < serverStats.total * 0.5) {
      warnings.push(
        `Only ${serverStats.connected} of ${serverStats.total} servers are connected`,
      );
    }

    if (serverStats.failed > 0) {
      warnings.push(`${serverStats.failed} servers are in error state`);
    }

    // Group health analysis
    const allGroups = this.groupManager.getAllGroups();
    const groupStats = {
      total: allGroups.size,
      healthy: 0,
      unhealthy: 0,
    };

    for (const [groupId] of allGroups) {
      try {
        const availableServers = this.groupManager.getGroupServers(groupId);
        const connectedServers = availableServers.filter((serverId) => {
          const server = allServers.get(serverId);
          return server?.status === ServerStatus.CONNECTED;
        });

        if (connectedServers.length > 0) {
          groupStats.healthy++;
        } else {
          groupStats.unhealthy++;
          warnings.push(`Group '${groupId}' has no connected servers`);
        }
      } catch (error) {
        groupStats.unhealthy++;
        warnings.push(
          `Group '${groupId}' health check failed: ${(error as Error).message}`,
        );
      }
    }

    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= critical.length * 30; // Critical issues heavily impact score
    healthScore -= warnings.length * 10; // Warnings moderately impact score
    healthScore = Math.max(0, healthScore);

    return {
      healthScore,
      critical,
      warnings,
      servers: serverStats,
      groups: groupStats,
      uptime: this.getServiceUptime(),
    };
  }

  /**
   * Handle server disconnections gracefully
   */
  private async handleServerDisconnections(healthReport: {
    servers: { disconnected: number; failed: number };
  }): Promise<void> {
    if (
      healthReport.servers.disconnected === 0 &&
      healthReport.servers.failed === 0
    ) {
      return; // No disconnections to handle
    }

    logger.info('Handling server disconnections', {
      disconnectedServers: healthReport.servers.disconnected,
      failedServers: healthReport.servers.failed,
    });

    try {
      // Clear tool cache to ensure stale data is removed
      if (
        this.toolManager &&
        typeof (this.toolManager as any).clearCache === 'function'
      ) {
        (this.toolManager as any).clearCache();
        logger.debug('Tool cache cleared due to server disconnections');
      }

      // Log affected groups
      const allGroups = this.groupManager.getAllGroups();
      const affectedGroups: string[] = [];

      for (const [groupId] of allGroups) {
        const availableServers = this.groupManager.getGroupServers(groupId);
        const connectedServers = availableServers.filter((serverId) => {
          const server = this.serverManager.getAllServers().get(serverId);
          return server?.status === ServerStatus.CONNECTED;
        });

        if (connectedServers.length === 0) {
          affectedGroups.push(groupId);
        }
      }

      if (affectedGroups.length > 0) {
        logger.warn('Groups affected by server disconnections', {
          affectedGroups,
          totalGroups: allGroups.size,
        });
      }
    } catch (error) {
      logger.error('Error handling server disconnections', error as Error);
    }
  }

  /**
   * Perform graceful shutdown
   */
  private async performGracefulShutdown(): Promise<void> {
    logger.debug('Performing graceful shutdown');

    // Shutdown API tool service
    try {
      await this.apiToolService.shutdown();
      logger.debug('API tool service shutdown completed');
    } catch (error) {
      logger.error('API tool service shutdown failed', error as Error);
    }

    // Shutdown server manager with proper cleanup
    await this.serverManager.shutdown();

    logger.debug('Graceful shutdown completed');
  }

  /**
   * Perform force shutdown when graceful shutdown fails
   */
  private async performForceShutdown(): Promise<void> {
    logger.debug('Performing force shutdown');

    try {
      // Force close all server connections
      const allServers = this.serverManager.getAllServers();
      const forceClosePromises = Array.from(allServers.values()).map(
        async (server) => {
          try {
            if (server.client && typeof server.client.close === 'function') {
              await Promise.race([
                server.client.close(),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error('Force close timeout')),
                    2000,
                  ),
                ),
              ]);
            }
          } catch (error) {
            logger.debug('Force close server connection failed', {
              serverId: server.id,
              error: (error as Error).message,
            });
          }
        },
      );

      await Promise.allSettled(forceClosePromises);
      logger.debug('Force shutdown completed');
    } catch (error) {
      logger.error('Force shutdown failed', error as Error);
      throw error;
    }
  }

  /**
   * Get service uptime in seconds
   */
  private getServiceUptime(): number {
    if (!this.initializationTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.initializationTime.getTime()) / 1000);
  }

  /**
   * Enable or disable health monitoring
   */
  public setHealthMonitoring(enabled: boolean): void {
    this.healthCheckEnabled = enabled;

    if (enabled && this.isInitialized && !this.healthCheckInterval) {
      this.startHealthMonitoring();
    } else if (!enabled && this.healthCheckInterval) {
      this.stopHealthMonitoring();
    }

    logger.info('Health monitoring setting changed', { enabled });
  }

  /**
   * Get current service lifecycle status
   */
  public getLifecycleStatus(): {
    isInitialized: boolean;
    shutdownInProgress: boolean;
    healthMonitoringEnabled: boolean;
    uptime: number;
    lastHealthCheck?: string;
    initializationTime?: string;
  } {
    return {
      isInitialized: this.isInitialized,
      shutdownInProgress: this.shutdownInProgress,
      healthMonitoringEnabled: this.healthCheckEnabled,
      uptime: this.getServiceUptime(),
      lastHealthCheck: this.lastHealthCheck?.toISOString(),
      initializationTime: this.initializationTime?.toISOString(),
    };
  }

  /**
   * Manually trigger a health check
   */
  public async triggerHealthCheck(): Promise<void> {
    this.ensureInitialized();

    logger.info('Manual health check triggered');
    await this.performHealthCheck();
  }

  // Debug and Message Tracking Methods

  /**
   * Add an MCP message to the tracking log
   * @param serverId The server ID
   * @param type The message type
   * @param method The method name
   * @param content The message content
   */
  public addMcpMessage(
    serverId: string,
    type: 'request' | 'response' | 'notification',
    method: string,
    content: unknown,
  ): void {
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      serverId,
      type,
      method,
      content,
    };

    // Add to the beginning of the array
    this.mcpMessages.unshift(message);

    // Keep only the last 1000 messages to prevent memory issues
    if (this.mcpMessages.length > 1000) {
      this.mcpMessages = this.mcpMessages.slice(0, 1000);
    }

    logger.debug('MCP message tracked', {
      serverId,
      type,
      method,
      messageId: message.id,
    });
  }

  /**
   * Get recent MCP messages
   * @param limit Maximum number of messages to return (default: 50)
   * @param serverId Filter by server ID (optional)
   * @param type Filter by message type (optional)
   */
  public getMcpMessages(
    limit: number = 50,
    serverId?: string,
    type?: 'request' | 'response' | 'notification',
  ): Array<{
    id: string;
    timestamp: string;
    serverId: string;
    type: 'request' | 'response' | 'notification';
    method: string;
    content: unknown;
  }> {
    let messages = this.mcpMessages;

    // Apply filters
    if (serverId) {
      messages = messages.filter(msg => msg.serverId === serverId);
    }

    if (type) {
      messages = messages.filter(msg => msg.type === type);
    }

    // Return limited results
    return messages.slice(0, Math.min(limit, messages.length));
  }

  /**
   * Clear all tracked MCP messages
   */
  public clearMcpMessages(): void {
    this.mcpMessages = [];
    logger.info('MCP message tracking cleared');
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topTools: Array<{
      name: string;
      calls: number;
      avgTime: number;
    }>;
  } {
    // For now, return basic stats
    // In a real implementation, we would track execution times and calculate proper stats
    return {
      totalRequests: this.mcpMessages.filter(msg => msg.type === 'request').length,
      averageResponseTime: 0,
      errorRate: 0,
      topTools: [],
    };
  }
}
