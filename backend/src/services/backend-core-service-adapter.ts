import type { ServerStatus as BackendServerStatus } from '../types/mcp-knot.js';
import type { ServerManager } from './server_manager.js';
/**
 * BackendCoreServiceAdapter（P6 架构修正，spec §10.3）
 *
 * 让 group-service（依赖 core 的 McpServiceManagerInterface 抽象接口）拿到真实的
 * backend ServerManager 实现，而非 core 包的 mock McpServiceManager。
 *
 * core 当壳（抽象接口），backend 当引擎（真实连接 + client.callTool）。
 * 委托的 ServerManager.executeToolOnServer 已含 P6 Task 2 的 trace _meta 注入，
 * 故 trace 链路（group-service handler → 适配器 → ServerManager）自动打通。
 *
 * 注入点：service-registry.ts 的 initCoreServiceManager（Task 7）。
 */
import type { McpServiceManagerInterface } from '@mcp-core/mcp-knot-core';
import type {
  InputRequiredResult,
  McpServerConfig,
  RetryContext,
  ServiceStatus,
  ToolInfo,
  ToolResult,
} from '@mcp-core/mcp-knot-core';
import type { ServerConfig } from '@mcp-core/mcp-knot-share';

export class BackendCoreServiceAdapter implements McpServiceManagerInterface {
  constructor(private readonly serverManager: ServerManager) {}

  async initializeFromConfig(_config: McpServerConfig): Promise<void> {
    // ServerManager 在 McpKnotService 构造时已按配置初始化，此处委托 ensure initialized。
    await this.serverManager.initialize();
  }

  async registerServer(_serverId: string, _config: ServerConfig): Promise<void> {
    // 配置驱动的注册由 McpKnotService 管理；适配器保留接口契约，no-op。
    // （group-service 不调用此方法；保留仅为满足接口完整性。）
  }

  async getAllTools(): Promise<ToolInfo[]> {
    const servers = this.serverManager.getAllServers();
    const perServer = await Promise.all(
      Array.from(servers.keys()).map((id) => this.serverManager.getServerTools(id)),
    );
    // backend Tool 是 ToolInfo 的结构超集（name/description/serverId/inputSchema），
    // 直接扁平化返回，结构兼容。
    return perServer.flat() as unknown as ToolInfo[];
  }

  async getServerTools(serverId: string): Promise<ToolInfo[]> {
    return (await this.serverManager.getServerTools(serverId)) as unknown as ToolInfo[];
  }

  async executeToolCall(toolName: string, args: unknown, serverId?: string): Promise<ToolResult> {
    if (!serverId) {
      throw new Error(
        `BackendCoreServiceAdapter.executeToolCall 需要 serverId（工具 ${toolName} 未绑定 server）`,
      );
    }
    // 直接透传 MCP 原生结果（带 content/isError），供 group-service handler 的
    // 'content' in result 判定使用。类型上 ToolResult.data: unknown 兼容。
    const mcpResult = await this.serverManager.executeToolOnServer(
      serverId,
      toolName,
      args as Record<string, unknown>,
    );
    return mcpResult as unknown as ToolResult;
  }

  /**
   * P5 MRTR：带重试上下文（inputResponses + requestState）的工具调用路径。
   *
   * 多轮中转时，group-service 在客户端收集应答后经此方法把 retryContext 透传给
   * ServerManager.executeToolOnServerWithContext，后者把它注入上游 callTool 的
   * request params 顶层字段（inputResponses / requestState），继续本轮调用。
   * 返回 MCP 原生结果（ToolResult 或 InputRequiredResult），不转 {success, data}。
   */
  async executeToolCallWithContext(
    toolName: string,
    args: unknown,
    serverId: string,
    retryContext: RetryContext,
  ): Promise<ToolResult | InputRequiredResult> {
    if (!serverId) {
      throw new Error(
        `BackendCoreServiceAdapter.executeToolCallWithContext 需要 serverId（工具 ${toolName} 未绑定 server）`,
      );
    }
    const mcpResult = await this.serverManager.executeToolOnServerWithContext(
      serverId,
      toolName,
      args as Record<string, unknown>,
      retryContext,
    );
    return mcpResult as unknown as ToolResult | InputRequiredResult;
  }

  getServiceStatus(): ServiceStatus {
    const servers = this.serverManager.getAllServers();
    const values = Array.from(servers.values());
    const connected = values.filter((s) => s.status === ('connected' as BackendServerStatus));
    // 补齐 core ServiceStatus 必填字段（activeConnections），其余可选字段由消费者防御性读取。
    // connectedServers 为 group-service 自定义字段，core ServiceStatus 通过索引签名/断言忽略。
    return {
      initialized: connected.length > 0,
      serverCount: values.length,
      activeConnections: connected.length,
      connectedServers: connected.length,
    } as ServiceStatus;
  }

  getServerConnections(): Map<string, import('@mcp-core/mcp-knot-core').ServerConnection> {
    // core 接口的 ServerConnection.tools 是 ToolInfo[]（description 必填），
    // backend Tool.description 可选；结构是子集，运行时一致，断言满足接口契约。
    return this.serverManager.getAllServers() as unknown as Map<
      string,
      import('@mcp-core/mcp-knot-core').ServerConnection
    >;
  }

  async isToolAvailable(toolName: string, serverId?: string): Promise<boolean> {
    const ids = serverId ? [serverId] : Array.from(this.serverManager.getAllServers().keys());
    for (const id of ids) {
      const tools = await this.serverManager.getServerTools(id);
      if (tools.some((t) => t.name === toolName)) return true;
    }
    return false;
  }

  async shutdown(): Promise<void> {
    // 不关闭 ServerManager：适配器只是"借"用 hubService 的 ServerManager（非拥有者），
    // 其生命周期由 McpKnotService.shutdown() 统一管理。
    //
    // 若此处委托 serverManager.shutdown()，会在 service-registry 的
    // reloadCoreServiceManager() 路径（groups API 增删改后调用）中把真实上游连接全部断开，
    // 随后重建的适配器仍指向同一个已关闭的 ServerManager——连接无法恢复，group-service
    // 将拿到全断开的连接状态。同理 shutdownGroupsApi() 也会经由 hubService.shutdown()
    // 重复关闭。故此处保持 no-op，由真正的拥有者负责关闭。
  }
}
