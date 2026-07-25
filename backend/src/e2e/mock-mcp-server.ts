/**
 * 增强 Mock MCP 服务器
 * 支持多模拟 MCP 服务器、延迟响应、错误注入、请求监控
 */
import type { Tool } from "@modelcontextprotocol/server";

export interface MockServerConfig {
  /** 服务器 ID */
  id: string;
  /** 服务器名称 */
  name: string;
  /** 工具数量 */
  toolCount?: number;
  /** 响应延迟（毫秒） */
  delay?: number;
  /** 失败率（0-1） */
  failureRate?: number;
  /** 超时率（0-1） */
  timeoutRate?: number;
  /** 端口 */
  port?: number;
}

export interface MockServerStats {
  /** 服务器 ID */
  serverId: string;
  /** 请求总数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 超时请求数 */
  timeoutRequests: number;
  /** 平均响应时间 */
  avgResponseTime: number;
  /** 最后请求时间 */
  lastRequestTime: number;
}

export interface ServerInjectionConfig {
  /** 错误类型 */
  errorType?: 'timeout' | 'crash' | 'error' | 'network';
  /** 注入时间（毫秒，从现在开始） */
  injectAt?: number;
  /** 持续时间（毫秒） */
  duration?: number;
}

/**
 * 增强 Mock MCP 服务器
 */
export class EnhancedMockMcpServer {
  private config: MockServerConfig;
  private tools: Tool[] = [];
  private stats: MockServerStats;
  private requestHistory: Array<{
    timestamp: number;
    method: string;
    params: unknown;
    success: boolean;
    duration: number;
  }> = [];
  private injectionConfig: ServerInjectionConfig | null = null;
  private isRunning = false;
  private crashMode = false;

  constructor(config: MockServerConfig) {
    this.config = {
      toolCount: 5,
      delay: 0,
      failureRate: 0,
      timeoutRate: 0,
      ...config,
    };

    this.stats = {
      serverId: this.config.id,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      avgResponseTime: 0,
      lastRequestTime: 0,
    };

    this.generateTools();
  }

  /**
   * 生成工具列表
   */
  private generateTools(): void {
    this.tools = Array.from({ length: this.config.toolCount }, (_, i) => ({
      name: `${this.config.id}_tool${i + 1}`,
      description: `Tool ${i + 1} from ${this.config.name}`,
      inputSchema: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: `Parameter for tool ${i + 1}`,
          },
          param2: {
            type: 'number',
            description: 'Numeric parameter',
          },
        },
        required: ['param1'],
      },
    }));
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.crashMode = false;
    // 模拟服务器启动
    await this.delay(this.config.delay || 100);
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
  }

  /**
   * 处理 list_tools 请求
   */
  async handleListTools(): Promise<{ tools: Tool[] }> {
    return this.handleRequest('list_tools', {}, () => {
      return { tools: this.tools };
    });
  }

  /**
   * 处理 call_tool 请求
   */
  async handleCallTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    return this.handleRequest('call_tool', params, () => {
      const tool = this.tools.find((t) => t.name === params.name);

      if (!tool) {
        throw new Error(`Tool ${params.name} not found`);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Executed ${params.name} with args: ${JSON.stringify(params.arguments)}`,
          },
        ],
      };
    });
  }

  /**
   * 通用请求处理器
   */
  private async handleRequest<T>(method: string, params: unknown, handler: () => T): Promise<T> {
    const startTime = Date.now();

    // 检查服务器是否崩溃
    if (this.crashMode) {
      throw new Error(`Server ${this.config.id} has crashed`);
    }

    // 检查是否应该注入错误
    if (this.shouldInjectError()) {
      return this.injectError(method);
    }

    try {
      // 更新统计
      this.stats.totalRequests++;
      this.stats.lastRequestTime = startTime;

      // 应用延迟
      if (this.config.delay) {
        await this.delay(this.config.delay);
      }

      // 检查是否超时
      if (Math.random() < (this.config.timeoutRate || 0)) {
        this.stats.timeoutRequests++;
        throw new Error('Request timeout');
      }

      // 检查是否应该失败
      if (Math.random() < (this.config.failureRate || 0)) {
        this.stats.failedRequests++;
        throw new Error(`Server ${this.config.id} request failed`);
      }

      // 执行处理器
      const result = handler();

      // 更新成功统计
      this.stats.successfulRequests++;
      const duration = Date.now() - startTime;
      this.updateAvgResponseTime(duration);

      // 记录请求历史
      this.requestHistory.push({
        timestamp: startTime,
        method,
        params,
        success: true,
        duration,
      });

      // 限制历史记录大小
      if (this.requestHistory.length > 1000) {
        this.requestHistory = this.requestHistory.slice(-1000);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.requestHistory.push({
        timestamp: startTime,
        method,
        params,
        success: false,
        duration,
      });
      throw error;
    }
  }

  /**
   * 检查是否应该注入错误
   */
  private shouldInjectError(): boolean {
    if (!this.injectionConfig) {
      return false;
    }

    const now = Date.now();
    const { injectAt, duration } = this.injectionConfig;

    if (injectAt && duration) {
      return now >= injectAt && now <= injectAt + duration;
    }

    return false;
  }

  /**
   * 注入错误
   */
  private injectError(_method: string): never {
    const errorType = this.injectionConfig?.errorType || 'error';

    switch (errorType) {
      case 'timeout':
        throw new Error('Injected timeout error');
      case 'crash':
        this.crashMode = true;
        throw new Error('Server crashed');
      case 'network':
        throw new Error('Network error');
      default:
        throw new Error('Injected error');
    }
  }

  /**
   * 更新平均响应时间
   */
  private updateAvgResponseTime(duration: number): void {
    const total = this.stats.avgResponseTime * (this.stats.successfulRequests - 1) + duration;
    this.stats.avgResponseTime = total / this.stats.successfulRequests;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 配置错误注入
   */
  configureErrorInjection(config: ServerInjectionConfig): void {
    this.injectionConfig = config;
  }

  /**
   * 清除错误注入配置
   */
  clearErrorInjection(): void {
    this.injectionConfig = null;
    this.crashMode = false;
  }

  /**
   * 恢复服务器
   */
  async recover(): Promise<void> {
    this.crashMode = false;
    this.clearErrorInjection();
    await this.start();
  }

  /**
   * 获取统计信息
   */
  getStats(): MockServerStats {
    return { ...this.stats };
  }

  /**
   * 获取请求历史
   */
  getRequestHistory(limit?: number): Array<{
    timestamp: number;
    method: string;
    params: unknown;
    success: boolean;
    duration: number;
  }> {
    if (limit) {
      return this.requestHistory.slice(-limit);
    }
    return [...this.requestHistory];
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      serverId: this.config.id,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      avgResponseTime: 0,
      lastRequestTime: 0,
    };
    this.requestHistory = [];
  }

  /**
   * 检查服务器健康状态
   */
  isHealthy(): boolean {
    return this.isRunning && !this.crashMode;
  }

  /**
   * 获取服务器 ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * 获取服务器配置
   */
  getConfig(): MockServerConfig {
    return { ...this.config };
  }
}

/**
 * Mock 服务器管理器
 */
export class MockServerManager {
  private servers: Map<string, EnhancedMockMcpServer> = new Map();

  /**
   * 添加服务器
   */
  addServer(config: MockServerConfig): EnhancedMockMcpServer {
    const server = new EnhancedMockMcpServer(config);
    this.servers.set(config.id, server);
    return server;
  }

  /**
   * 获取服务器
   */
  getServer(id: string): EnhancedMockMcpServer | undefined {
    return this.servers.get(id);
  }

  /**
   * 移除服务器
   */
  removeServer(id: string): boolean {
    return this.servers.delete(id);
  }

  /**
   * 启动所有服务器
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.servers.values()).map((server) => server.start());
    await Promise.all(startPromises);
  }

  /**
   * 停止所有服务器
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map((server) => server.stop());
    await Promise.all(stopPromises);
  }

  /**
   * 获取所有服务器统计
   */
  getAllStats(): MockServerStats[] {
    return Array.from(this.servers.values()).map((server) => server.getStats());
  }

  /**
   * 重置所有服务器统计
   */
  resetAllStats(): void {
    this.servers.forEach((server) => server.resetStats());
  }

  /**
   * 检查所有服务器健康状态
   */
  checkHealth(): Record<string, boolean> {
    const health: Record<string, boolean> = {};
    this.servers.forEach((server, id) => {
      health[id] = server.isHealthy();
    });
    return health;
  }

  /**
   * 获取服务器数量
   */
  getCount(): number {
    return this.servers.size;
  }
}
