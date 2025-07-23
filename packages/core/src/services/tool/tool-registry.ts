/**
 * 工具注册和管理系统
 * 负责工具发现、注册和调用功能
 */

import type { ToolFilter, ToolInfo } from '../../types/tool.js';

/**
 * 工具注册表接口
 */
export interface ToolRegistryInterface {
  /**
   * 注册工具
   */
  registerTool(serverId: string, tool: ToolInfo): void;

  /**
   * 获取所有工具
   */
  getAllTools(filter?: ToolFilter): ToolInfo[];

  /**
   * 根据名称获取工具
   */
  getToolByName(toolName: string): ToolInfo | null;

  /**
   * 获取服务器的工具
   */
  getToolsByServer(serverId: string): ToolInfo[];

  /**
   * 移除工具
   */
  removeTool(serverId: string, toolName: string): void;

  /**
   * 清空服务器的所有工具
   */
  clearServerTools(serverId: string): void;
}

/**
 * 工具注册表实现
 */
export class ToolRegistry implements ToolRegistryInterface {
  private tools = new Map<string, ToolInfo>();
  private serverTools = new Map<string, Set<string>>();

  registerTool(serverId: string, tool: ToolInfo): void {
    const toolKey = `${serverId}:${tool.name}`;
    this.tools.set(toolKey, { ...tool, serverId });

    if (!this.serverTools.has(serverId)) {
      this.serverTools.set(serverId, new Set());
    }
    const serverToolNames = this.serverTools.get(serverId);
    if (serverToolNames) {
      serverToolNames.add(tool.name);
    }
  }

  getAllTools(filter?: ToolFilter): ToolInfo[] {
    let tools = Array.from(this.tools.values());

    if (filter) {
      // 按服务器ID过滤
      if (filter.serverIds && filter.serverIds.length > 0) {
        tools = tools.filter(
          (tool) => tool.serverId && filter.serverIds?.includes(tool.serverId),
        );
      }

      // 按工具分类过滤
      if (filter.categories && filter.categories.length > 0) {
        tools = tools.filter(
          (tool) => tool.category && filter.categories?.includes(tool.category),
        );
      }

      // 按包含的工具名称过滤
      if (filter.toolNames && filter.toolNames.length > 0) {
        tools = tools.filter((tool) => filter.toolNames?.includes(tool.name));
      }

      // 按排除的工具名称过滤
      if (filter.excludeToolNames && filter.excludeToolNames.length > 0) {
        tools = tools.filter(
          (tool) => !filter.excludeToolNames?.includes(tool.name),
        );
      }

      // 是否包含已弃用的工具
      if (filter.includeDeprecated === false) {
        tools = tools.filter((tool) => !tool.deprecated);
      }
    }

    return tools;
  }

  getToolByName(toolName: string): ToolInfo | null {
    for (const tool of this.tools.values()) {
      if (tool.name === toolName) {
        return tool;
      }
    }
    return null;
  }

  getToolsByServer(serverId: string): ToolInfo[] {
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
    return tools;
  }

  removeTool(serverId: string, toolName: string): void {
    const toolKey = `${serverId}:${toolName}`;
    this.tools.delete(toolKey);

    const serverToolNames = this.serverTools.get(serverId);
    if (serverToolNames) {
      serverToolNames.delete(toolName);
    }
  }

  clearServerTools(serverId: string): void {
    const serverToolNames = this.serverTools.get(serverId);
    if (serverToolNames) {
      for (const toolName of serverToolNames) {
        const toolKey = `${serverId}:${toolName}`;
        this.tools.delete(toolKey);
      }
      serverToolNames.clear();
    }
  }
}
