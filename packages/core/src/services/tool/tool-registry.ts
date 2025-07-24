/**
 * 工具注册和管理系统
 * 负责工具发现、注册和调用功能
 */

import type { ToolFilter, ToolInfo, ToolResult } from '../../types/tool.js';

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
  executionId: string;
  timestamp: Date;
}

/**
 * 工具验证结果
 */
export interface ToolValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 工具统计信息
 */
export interface ToolStats {
  totalTools: number;
  toolsByServer: Record<string, number>;
  toolsByCategory: Record<string, number>;
  deprecatedTools: number;
  executionCount: number;
  errorCount: number;
  averageExecutionTime: number;
}

/**
 * 工具注册表错误类
 */
export class ToolRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ToolRegistryError';
  }
}

export class ToolNotFoundError extends ToolRegistryError {
  constructor(toolName: string, serverId?: string) {
    super(
      `工具 '${toolName}' 未找到${serverId ? ` 在服务器 '${serverId}'` : ''}`,
      'TOOL_NOT_FOUND',
      { toolName, serverId },
    );
  }
}

export class ToolValidationError extends ToolRegistryError {
  constructor(toolName: string, validationError: string) {
    super(
      `工具 '${toolName}' 验证失败: ${validationError}`,
      'TOOL_VALIDATION_FAILED',
      { toolName, validationError },
    );
  }
}

export class DuplicateToolError extends ToolRegistryError {
  constructor(toolName: string, serverId: string) {
    super(
      `工具 '${toolName}' 在服务器 '${serverId}' 上已存在`,
      'DUPLICATE_TOOL',
      { toolName, serverId },
    );
  }
}

/**
 * 工具注册表接口
 */
export interface ToolRegistryInterface {
  /**
   * 初始化工具注册表
   */
  initialize(): Promise<void>;

  /**
   * 注册工具
   */
  registerTool(serverId: string, tool: ToolInfo): void;

  /**
   * 批量注册工具
   */
  registerTools(serverId: string, tools: ToolInfo[]): void;

  /**
   * 获取所有工具
   */
  getAllTools(filter?: ToolFilter): ToolInfo[];

  /**
   * 根据名称获取工具
   */
  getToolByName(toolName: string, serverId?: string): ToolInfo | null;

  /**
   * 获取服务器的工具
   */
  getToolsByServer(serverId: string): ToolInfo[];

  /**
   * 查找工具所在的服务器
   */
  findToolServer(toolName: string): string | undefined;

  /**
   * 验证工具参数
   */
  validateToolArgs(
    toolName: string,
    args: Record<string, unknown>,
    serverId?: string,
  ): ToolValidationResult;

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName: string, serverId?: string): boolean;

  /**
   * 移除工具
   */
  removeTool(serverId: string, toolName: string): void;

  /**
   * 清空服务器的所有工具
   */
  clearServerTools(serverId: string): void;

  /**
   * 获取工具统计信息
   */
  getToolStats(): ToolStats;

  /**
   * 记录工具执行
   */
  recordToolExecution(context: ToolExecutionContext, result: ToolResult): void;

  /**
   * 获取工具执行历史
   */
  getToolExecutionHistory(
    toolName?: string,
    serverId?: string,
  ): ToolExecutionContext[];

  /**
   * 清理工具注册表
   */
  cleanup(): void;
}

/**
 * 工具注册表实现
 */
export class ToolRegistry implements ToolRegistryInterface {
  private tools = new Map<string, ToolInfo>();
  private serverTools = new Map<string, Set<string>>();
  private toolExecutions = new Map<string, ToolExecutionContext[]>();
  private executionStats = new Map<
    string,
    { count: number; errors: number; totalTime: number }
  >();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('工具注册表已初始化，跳过重复初始化');
      return;
    }

    console.info('初始化工具注册表');

    try {
      // 清理现有数据
      this.tools.clear();
      this.serverTools.clear();
      this.toolExecutions.clear();
      this.executionStats.clear();

      this.initialized = true;
      console.info('工具注册表初始化完成');
    } catch (error) {
      console.error('工具注册表初始化失败', error);
      throw new ToolRegistryError(
        `工具注册表初始化失败: ${(error as Error).message}`,
        'INITIALIZATION_FAILED',
        { originalError: (error as Error).message },
      );
    }
  }

  registerTool(serverId: string, tool: ToolInfo): void {
    this.ensureInitialized();

    console.debug('注册工具', { serverId, toolName: tool.name });

    // 验证工具信息
    this.validateToolInfo(tool);

    const toolKey = `${serverId}:${tool.name}`;

    // 检查是否已存在
    if (this.tools.has(toolKey)) {
      console.warn('工具已存在，将覆盖', { serverId, toolName: tool.name });
    }

    // 注册工具
    this.tools.set(toolKey, { ...tool, serverId });

    // 更新服务器工具集合
    if (!this.serverTools.has(serverId)) {
      this.serverTools.set(serverId, new Set());
    }
    const serverToolNames = this.serverTools.get(serverId);
    if (serverToolNames) {
      serverToolNames.add(tool.name);
    }

    // 初始化执行统计
    if (!this.executionStats.has(toolKey)) {
      this.executionStats.set(toolKey, { count: 0, errors: 0, totalTime: 0 });
    }

    console.debug('工具注册成功', { serverId, toolName: tool.name });
  }

  registerTools(serverId: string, tools: ToolInfo[]): void {
    this.ensureInitialized();

    console.info('批量注册工具', { serverId, toolCount: tools.length });

    let successCount = 0;
    let errorCount = 0;

    for (const tool of tools) {
      try {
        this.registerTool(serverId, tool);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('工具注册失败', error, { serverId, toolName: tool.name });
      }
    }

    console.info('批量工具注册完成', {
      serverId,
      totalTools: tools.length,
      successCount,
      errorCount,
    });
  }

  getAllTools(filter?: ToolFilter): ToolInfo[] {
    this.ensureInitialized();

    let tools = Array.from(this.tools.values());

    if (filter) {
      tools = this.applyToolFilter(tools, filter);
    }

    console.debug('获取所有工具', {
      totalTools: this.tools.size,
      filteredTools: tools.length,
      filter,
    });

    return tools;
  }

  getToolByName(toolName: string, serverId?: string): ToolInfo | null {
    this.ensureInitialized();

    if (serverId) {
      // 在指定服务器中查找
      const toolKey = `${serverId}:${toolName}`;
      return this.tools.get(toolKey) || null;
    }

    // 在所有服务器中查找
    for (const tool of this.tools.values()) {
      if (tool.name === toolName) {
        return tool;
      }
    }

    return null;
  }

  getToolsByServer(serverId: string): ToolInfo[] {
    this.ensureInitialized();

    const serverToolNames = this.serverTools.get(serverId);
    if (!serverToolNames) {
      return [];
    }

    const tools: ToolInfo[] = [];
    for (const toolName of serverToolNames) {
      const toolKey = `${serverId}:${toolName}`;
      const tool = this.tools.get(toolKey);
      if (tool) {
        tools.push(tool);
      }
    }

    console.debug('获取服务器工具', { serverId, toolCount: tools.length });
    return tools;
  }

  findToolServer(toolName: string): string | undefined {
    this.ensureInitialized();

    for (const [serverId, toolNames] of this.serverTools) {
      if (toolNames.has(toolName)) {
        return serverId;
      }
    }

    return undefined;
  }

  validateToolArgs(
    toolName: string,
    args: Record<string, unknown>,
    serverId?: string,
  ): ToolValidationResult {
    this.ensureInitialized();

    console.debug('验证工具参数', { toolName, serverId, args });

    try {
      // 获取工具定义
      const tool = this.getToolByName(toolName, serverId);
      if (!tool) {
        return {
          isValid: false,
          error: `工具 '${toolName}' 未找到`,
        };
      }

      // 如果没有参数定义，允许所有参数
      if (!tool.parameters || tool.parameters.length === 0) {
        return { isValid: true };
      }

      const warnings: string[] = [];

      // 验证必需参数
      const requiredParams = tool.parameters.filter((p) => p.required);
      for (const param of requiredParams) {
        if (!(param.name in args)) {
          return {
            isValid: false,
            error: `缺少必需参数: ${param.name}`,
          };
        }

        const value = args[param.name];
        if (value === null || value === undefined) {
          return {
            isValid: false,
            error: `必需参数 '${param.name}' 不能为空`,
          };
        }
      }

      // 验证参数类型
      for (const param of tool.parameters) {
        if (param.name in args) {
          const value = args[param.name];
          const typeValidation = this.validateParameterType(param, value);
          if (!typeValidation.isValid) {
            return typeValidation;
          }
        }
      }

      // 检查未知参数
      const knownParams = new Set(tool.parameters.map((p) => p.name));
      const unknownParams = Object.keys(args).filter(
        (key) => !knownParams.has(key),
      );
      if (unknownParams.length > 0) {
        warnings.push(`未知参数: ${unknownParams.join(', ')}`);
      }

      return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error('工具参数验证失败', error, { toolName, serverId });
      return {
        isValid: false,
        error: `验证失败: ${(error as Error).message}`,
      };
    }
  }

  isToolAvailable(toolName: string, serverId?: string): boolean {
    this.ensureInitialized();

    if (serverId) {
      const toolKey = `${serverId}:${toolName}`;
      return this.tools.has(toolKey);
    }

    // 在所有服务器中查找
    for (const tool of this.tools.values()) {
      if (tool.name === toolName) {
        return true;
      }
    }

    return false;
  }

  removeTool(serverId: string, toolName: string): void {
    this.ensureInitialized();

    console.debug('移除工具', { serverId, toolName });

    const toolKey = `${serverId}:${toolName}`;
    const removed = this.tools.delete(toolKey);

    if (removed) {
      // 从服务器工具集合中移除
      const serverToolNames = this.serverTools.get(serverId);
      if (serverToolNames) {
        serverToolNames.delete(toolName);
      }

      // 清理执行统计
      this.executionStats.delete(toolKey);
      this.toolExecutions.delete(toolKey);

      console.debug('工具移除成功', { serverId, toolName });
    } else {
      console.warn('尝试移除不存在的工具', { serverId, toolName });
    }
  }

  clearServerTools(serverId: string): void {
    this.ensureInitialized();

    console.info('清空服务器工具', { serverId });

    const serverToolNames = this.serverTools.get(serverId);
    if (serverToolNames) {
      let removedCount = 0;

      for (const toolName of serverToolNames) {
        const toolKey = `${serverId}:${toolName}`;
        if (this.tools.delete(toolKey)) {
          removedCount++;
        }

        // 清理执行统计
        this.executionStats.delete(toolKey);
        this.toolExecutions.delete(toolKey);
      }

      serverToolNames.clear();
      console.info('服务器工具清空完成', { serverId, removedCount });
    } else {
      console.warn('尝试清空不存在服务器的工具', { serverId });
    }
  }

  getToolStats(): ToolStats {
    this.ensureInitialized();

    const toolsByServer: Record<string, number> = {};
    const toolsByCategory: Record<string, number> = {};
    let deprecatedTools = 0;
    let totalExecutions = 0;
    let totalErrors = 0;
    let totalExecutionTime = 0;

    // 统计工具分布
    for (const tool of this.tools.values()) {
      // 按服务器统计
      if (tool.serverId) {
        toolsByServer[tool.serverId] = (toolsByServer[tool.serverId] || 0) + 1;
      }

      // 按分类统计
      const category = tool.category || 'uncategorized';
      toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;

      // 统计已弃用工具
      if (tool.deprecated) {
        deprecatedTools++;
      }
    }

    // 统计执行信息
    for (const stats of this.executionStats.values()) {
      totalExecutions += stats.count;
      totalErrors += stats.errors;
      totalExecutionTime += stats.totalTime;
    }

    const averageExecutionTime =
      totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0;

    return {
      totalTools: this.tools.size,
      toolsByServer,
      toolsByCategory,
      deprecatedTools,
      executionCount: totalExecutions,
      errorCount: totalErrors,
      averageExecutionTime,
    };
  }

  recordToolExecution(context: ToolExecutionContext, result: ToolResult): void {
    this.ensureInitialized();

    const toolKey = `${context.serverId}:${context.toolName}`;

    // 记录执行历史
    if (!this.toolExecutions.has(toolKey)) {
      this.toolExecutions.set(toolKey, []);
    }
    const executions = this.toolExecutions.get(toolKey);
    if (executions) {
      executions.push(context);
      // 保持最近100次执行记录
      if (executions.length > 100) {
        executions.shift();
      }
    }

    // 更新统计信息
    if (!this.executionStats.has(toolKey)) {
      this.executionStats.set(toolKey, { count: 0, errors: 0, totalTime: 0 });
    }
    const stats = this.executionStats.get(toolKey);
    if (stats) {
      stats.count++;
      if (!result.success) {
        stats.errors++;
      }
      if (result.executionTime) {
        stats.totalTime += result.executionTime;
      }
    }

    console.debug('工具执行记录已保存', {
      toolName: context.toolName,
      serverId: context.serverId,
      executionId: context.executionId,
      success: result.success,
    });
  }

  getToolExecutionHistory(
    toolName?: string,
    serverId?: string,
  ): ToolExecutionContext[] {
    this.ensureInitialized();

    if (toolName && serverId) {
      // 获取特定工具的执行历史
      const toolKey = `${serverId}:${toolName}`;
      return this.toolExecutions.get(toolKey) || [];
    }

    // 获取所有执行历史
    const allExecutions: ToolExecutionContext[] = [];
    for (const executions of this.toolExecutions.values()) {
      allExecutions.push(...executions);
    }

    // 按时间排序
    return allExecutions.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  cleanup(): void {
    console.info('清理工具注册表');

    this.tools.clear();
    this.serverTools.clear();
    this.toolExecutions.clear();
    this.executionStats.clear();
    this.initialized = false;

    console.info('工具注册表清理完成');
  }

  // 私有辅助方法

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ToolRegistryError(
        '工具注册表必须在使用前初始化',
        'NOT_INITIALIZED',
      );
    }
  }

  private validateToolInfo(tool: ToolInfo): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new ToolValidationError(tool.name || 'unknown', '工具名称无效');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new ToolValidationError(tool.name, '工具描述无效');
    }

    // 验证参数定义
    if (tool.parameters) {
      for (const param of tool.parameters) {
        if (!param.name || typeof param.name !== 'string') {
          throw new ToolValidationError(
            tool.name,
            `参数名称无效: ${param.name}`,
          );
        }

        if (
          !param.type ||
          !['string', 'number', 'boolean', 'object', 'array'].includes(
            param.type,
          )
        ) {
          throw new ToolValidationError(
            tool.name,
            `参数类型无效: ${param.type}`,
          );
        }
      }
    }
  }

  private applyToolFilter(tools: ToolInfo[], filter: ToolFilter): ToolInfo[] {
    let filteredTools = tools;

    // 按服务器ID过滤
    if (filter.serverIds && filter.serverIds.length > 0) {
      filteredTools = filteredTools.filter(
        (tool) => tool.serverId && filter.serverIds?.includes(tool.serverId),
      );
    }

    // 按工具分类过滤
    if (filter.categories && filter.categories.length > 0) {
      filteredTools = filteredTools.filter(
        (tool) => tool.category && filter.categories?.includes(tool.category),
      );
    }

    // 按包含的工具名称过滤
    if (filter.toolNames && filter.toolNames.length > 0) {
      filteredTools = filteredTools.filter((tool) =>
        filter.toolNames?.includes(tool.name),
      );
    }

    // 按排除的工具名称过滤
    if (filter.excludeToolNames && filter.excludeToolNames.length > 0) {
      filteredTools = filteredTools.filter(
        (tool) => !filter.excludeToolNames?.includes(tool.name),
      );
    }

    // 是否包含已弃用的工具
    if (filter.includeDeprecated === false) {
      filteredTools = filteredTools.filter((tool) => !tool.deprecated);
    }

    return filteredTools;
  }

  private validateParameterType(
    param: { name: string; type: string; enum?: unknown[] },
    value: unknown,
  ): ToolValidationResult {
    const { name, type, enum: enumValues } = param;

    // 检查枚举值
    if (enumValues && enumValues.length > 0) {
      if (!enumValues.includes(value)) {
        return {
          isValid: false,
          error: `参数 '${name}' 必须是以下值之一: ${enumValues.join(', ')}`,
        };
      }
    }

    // 检查基本类型
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return {
            isValid: false,
            error: `参数 '${name}' 必须是字符串类型`,
          };
        }
        break;

      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return {
            isValid: false,
            error: `参数 '${name}' 必须是数字类型`,
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            isValid: false,
            error: `参数 '${name}' 必须是布尔类型`,
          };
        }
        break;

      case 'object':
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return {
            isValid: false,
            error: `参数 '${name}' 必须是对象类型`,
          };
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return {
            isValid: false,
            error: `参数 '${name}' 必须是数组类型`,
          };
        }
        break;

      default:
        console.warn('未知参数类型', { paramName: name, type });
        break;
    }

    return { isValid: true };
  }
}
