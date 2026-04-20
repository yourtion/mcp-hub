import type {
  DeepReadonly,
  GroupConfig,
  ServerConfig,
} from '@mcp-core/mcp-hub-share';
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
import { HealthMonitorService } from './health-monitor-service.js';
import { MessageAuditService } from './message-audit-service.js';
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
  private messageAudit: MessageAuditService;
  private healthMonitor: HealthMonitorService;
  private isInitialized = false;
  private readonly DEFAULT_GROUP = 'default';
  private shutdownInProgress = false;
  private serverConfigs: Record<string, ServerConfig> = {} as Record<
    string,
    ServerConfig
  >;
  private groupConfigs: GroupConfig = {} as GroupConfig;

  constructor(
    serverConfigs: DeepReadonly<Record<string, ServerConfig>>,
    groupConfigs: DeepReadonly<GroupConfig>,
    private apiToolConfigPath?: string,
  ) {
    this.serverConfigs = JSON.parse(JSON.stringify(serverConfigs));
    this.groupConfigs = JSON.parse(JSON.stringify(groupConfigs));

    this.serverManager = new ServerManager(this.serverConfigs);
    this.groupManager = new GroupManager(this.groupConfigs, this.serverManager);
    this.apiToolService = new ApiToolIntegrationService();
    this.toolManager = new ToolManager(
      this.serverManager,
      this.groupManager,
      this.apiToolService,
    );
    this.messageAudit = new MessageAuditService();
    this.healthMonitor = new HealthMonitorService(
      this.serverManager,
      this.groupManager,
      async () => {
        // 健康检查回调：清理工具缓存
        if (
          this.toolManager &&
          typeof this.toolManager.clearCache === 'function'
        ) {
          this.toolManager.clearCache();
          logger.debug('Tool cache cleared due to server disconnections');
        }
      },
    );

    // Set up message tracking
    this.serverManager.setMessageTracker((serverId, type, method, content) => {
      this.messageAudit.addMessage(serverId, type, method, content);
    });
  }

  // ========== Lifecycle ==========

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

      logger.debug('Initializing API tool integration service');
      await this.apiToolService.initialize(this.apiToolConfigPath);

      const apiToolStats = await this.apiToolService.getStats();
      logger.info('API tool integration service initialized', {
        apiToolsEnabled: apiToolStats.initialized,
        totalApiTools: apiToolStats.totalApiTools,
      });

      await this.validateServiceHealth();

      this.isInitialized = true;
      this.healthMonitor.markInitialized();
      this.healthMonitor.start();

      const initDuration = Date.now() - initStartTime;
      logger.info('MCP Hub Service initialization completed successfully', {
        connectedServers,
        loadedGroups,
        initializationTimeMs: initDuration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const initDuration = Date.now() - initStartTime;
      logger.error('MCP Hub Service initialization failed', error as Error, {
        initializationTimeMs: initDuration,
        serverCount: Object.keys(this.serverConfigs).length,
        groupCount: Object.keys(this.groupConfigs).length,
      });

      await this.cleanupFailedInitialization();

      throw new ServiceInitializationError(
        (error as Error).message,
        error as Error,
      );
    }
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
    });

    const errors: Error[] = [];

    try {
      this.healthMonitor.stop();
      this.messageAudit.clearMessages();

      const shutdownPromise = this.performGracefulShutdown();
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Shutdown timeout')),
          10000,
        );
        timeoutId.unref?.();
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const shutdownError = error as Error;
      logger.error('Error during graceful shutdown', shutdownError);
      errors.push(shutdownError);

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

      throw new McpHubError(
        `Shutdown completed with ${errors.length} errors: ${errors.map((e) => e.message).join(', ')}`,
        'SHUTDOWN_ERRORS',
        { errorCount: errors.length, shutdownTimeMs: shutdownDuration },
      );
    }
    logger.info('MCP Hub Service shutdown completed successfully', {
      shutdownTimeMs: shutdownDuration,
      timestamp: new Date().toISOString(),
    });
  }

  // ========== Group Routing ==========

  getAllGroups(): Map<string, Group> {
    this.ensureInitialized();
    return this.groupManager.getAllGroups();
  }

  getGroupInfo(groupId: string): Group | undefined {
    this.ensureInitialized();

    try {
      const group = this.groupManager.getGroup(groupId);

      if (group) {
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
      return undefined;
    }
  }

  // ========== Tool Execution ==========

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
      await this.validateToolExecution(toolName, targetGroupId, executionId);

      const startTime = Date.now();
      const result = await this.toolManager.executeTool(
        targetGroupId,
        toolName,
        args,
      );
      const duration = Date.now() - startTime;

      const status = result.isError ? 'failed' : 'completed';
      logger.logToolExecution(toolName, targetGroupId, status, {
        executionId,
        durationMs: duration,
        resultSize: JSON.stringify(result.content).length,
        contentTypes: result.content.map(
          (c: { type: string }) => c.type || 'unknown',
        ),
      });

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

      logger.error('Tool execution failed with exception', error as Error, {
        executionId,
        toolName,
        groupId: targetGroupId,
        args,
        serviceHealth: this.getServiceHealthSummary(),
      });

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

  // ========== Health & Status ==========

  getServerHealth(): Map<string, ServerStatus> {
    this.ensureInitialized();

    const healthMap = new Map<string, ServerStatus>();
    const allServers = this.serverManager.getAllServers();

    for (const [serverId, server] of allServers) {
      healthMap.set(serverId, server.status);
    }

    return healthMap;
  }

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
      totalTools: 0,
    };
  }

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

    let totalMcpTools = 0;
    if (this.isInitialized) {
      try {
        const tools = await this.listTools();
        totalMcpTools = tools.length - apiToolCount;
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
      cacheStats: Record<string, unknown>;
    };
  }> {
    this.ensureInitialized();

    try {
      const allServers = this.serverManager.getAllServers();
      const allGroups = this.groupManager.getAllGroups();

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

      const cacheStats = this.toolManager.getCacheStats();

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
          version: '1.0.0',
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

  setHealthMonitoring(enabled: boolean): void {
    this.healthMonitor.setEnabled(enabled);
  }

  getLifecycleStatus(): {
    isInitialized: boolean;
    shutdownInProgress: boolean;
    healthMonitoringEnabled: boolean;
    uptime: number;
    lastHealthCheck?: string;
    initializationTime?: string;
  } {
    const lifecycle = this.healthMonitor.getLifecycleStatus();
    return {
      ...lifecycle,
      shutdownInProgress: this.shutdownInProgress,
    };
  }

  async triggerHealthCheck(): Promise<void> {
    this.ensureInitialized();
    await this.healthMonitor.triggerCheck();
  }

  // ========== Message Audit (delegated) ==========

  addMcpMessage(
    serverId: string,
    type: 'request' | 'response' | 'notification',
    method: string,
    content: unknown,
  ): void {
    this.messageAudit.addMessage(serverId, type, method, content);
  }

  getMcpMessages(
    limit?: number,
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
    return this.messageAudit.getMessages(limit, serverId, type);
  }

  clearMcpMessages(): void {
    this.messageAudit.clearMessages();
  }

  getPerformanceStats(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topTools: Array<{ name: string; calls: number; avgTime: number }>;
  } {
    return this.messageAudit.getPerformanceStats();
  }

  // ========== Utility ==========

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

    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }

  // ========== Private Helpers ==========

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

  private async validateServiceHealth(): Promise<void> {
    logger.debug('Validating service health after initialization');

    const issues: string[] = [];
    const warnings: string[] = [];

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

    const loadedGroups = this.groupManager.getAllGroups().size;
    const totalGroups = Object.keys(this.groupConfigs).length;

    if (loadedGroups === 0 && totalGroups > 0) {
      issues.push('No groups are loaded');
    } else if (loadedGroups < totalGroups) {
      warnings.push(`Only ${loadedGroups} of ${totalGroups} groups are loaded`);
    }

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

  private async cleanupFailedInitialization(): Promise<void> {
    logger.debug('Cleaning up after failed initialization');

    try {
      if (this.serverManager) {
        await this.serverManager.shutdown();
      }
      logger.debug('Cleanup completed successfully');
    } catch (cleanupError) {
      logger.error(
        'Error during initialization cleanup',
        cleanupError as Error,
      );
    }
  }

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

    const group = this.groupManager.getGroup(groupId);
    if (!group) {
      throw new GroupNotFoundError(groupId);
    }

    const isAvailable = await this.isToolAvailable(toolName, groupId);
    if (!isAvailable) {
      throw new ToolNotFoundError(toolName, groupId);
    }

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

  private async performGracefulShutdown(): Promise<void> {
    logger.debug('Performing graceful shutdown');

    try {
      await this.apiToolService.shutdown();
      logger.debug('API tool service shutdown completed');
    } catch (error) {
      logger.error('API tool service shutdown failed', error as Error);
    }

    await this.serverManager.shutdown();
    logger.debug('Graceful shutdown completed');
  }

  private async performForceShutdown(): Promise<void> {
    logger.debug('Performing force shutdown');

    try {
      const allServers = this.serverManager.getAllServers();
      const forceClosePromises = Array.from(allServers.values()).map(
        async (server) => {
          try {
            if (server.client && typeof server.client.close === 'function') {
              let timeoutId: NodeJS.Timeout | undefined;
              await Promise.race([
                server.client.close(),
                new Promise((_, reject) => {
                  timeoutId = setTimeout(
                    () => reject(new Error('Force close timeout')),
                    2000,
                  );
                  timeoutId.unref?.();
                }),
              ]);
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
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
}
