import { describe, expect, it, vi } from 'vitest';

import { BackendCoreServiceAdapter } from './backend-core-service-adapter.js';

import type { McpServiceManagerInterface } from '@mcp-core/mcp-hub-core';
import type { ServerManager } from './server_manager.js';
import type { ServerConnection, ServerStatus, Tool } from '../types/mcp-hub.js';

// 构造一个 mock ServerManager，仅 stub 适配器用到的方法
function makeMockServerManager(overrides: Partial<ServerManager> = {}): ServerManager {
  return {
    getAllServers: vi.fn(),
    getServerTools: vi.fn(),
    executeToolOnServer: vi.fn(),
    getServerStatus: vi.fn(),
    initialize: vi.fn(),
    shutdown: vi.fn(),
    ...overrides,
  } as unknown as ServerManager;
}

describe('BackendCoreServiceAdapter', () => {
  it('实现 McpServiceManagerInterface（类型契约）', () => {
    const adapter = new BackendCoreServiceAdapter(makeMockServerManager());
    // 适配器必须可赋值给 McpServiceManagerInterface（编译期保证）
    const _asInterface: McpServiceManagerInterface = adapter;
    expect(_asInterface).toBe(adapter);
  });

  it('executeToolCall 委托 ServerManager.executeToolOnServer 并透传 MCP 原生结果（带 content）', async () => {
    const mcpResult = { content: [{ type: 'text', text: 'real result' }] };
    const sm = makeMockServerManager({
      executeToolOnServer: vi.fn().mockResolvedValue(mcpResult),
    });
    const adapter = new BackendCoreServiceAdapter(sm);

    const result = await adapter.executeToolCall('my-tool', { q: 'x' }, 'srv-1');

    expect(sm.executeToolOnServer).toHaveBeenCalledWith('srv-1', 'my-tool', { q: 'x' });
    // 关键：透传 MCP 原生结果（含 content），不转成 {success, data}
    expect(result).toEqual(mcpResult);
    expect((result as { content?: unknown }).content).toBeDefined();
  });

  it('executeToolCall 无 serverId 时抛错（适配器不猜 server）', async () => {
    const adapter = new BackendCoreServiceAdapter(makeMockServerManager());
    await expect(adapter.executeToolCall('tool', {})).rejects.toThrow(/serverId/i);
  });

  it('getAllTools 聚合所有 server 的工具（结构兼容 ToolInfo）', async () => {
    const toolsA: Tool[] = [
      { name: 'a_tool', inputSchema: {}, serverId: 'srv-a' },
    ];
    const toolsB: Tool[] = [
      { name: 'b_tool', inputSchema: {}, serverId: 'srv-b' },
    ];
    const sm = makeMockServerManager({
      getAllServers: vi.fn().mockReturnValue(
        new Map<string, ServerConnection>([
          ['srv-a', { id: 'srv-a', status: 'connected' as ServerStatus } as ServerConnection],
          ['srv-b', { id: 'srv-b', status: 'connected' as ServerStatus } as ServerConnection],
        ]),
      ),
      getServerTools: vi.fn().mockImplementation((serverId: string) =>
        serverId === 'srv-a' ? Promise.resolve(toolsA) : Promise.resolve(toolsB),
      ),
    });
    const adapter = new BackendCoreServiceAdapter(sm);

    const all = await adapter.getAllTools();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name).sort()).toEqual(['a_tool', 'b_tool']);
    // 每个工具带 serverId（group-service 按此过滤组内工具）
    expect(all.every((t) => t.serverId)).toBe(true);
  });

  it('getServerTools 委托 ServerManager.getServerTools', async () => {
    const sm = makeMockServerManager({
      getServerTools: vi.fn().mockResolvedValue([{ name: 't', inputSchema: {}, serverId: 's' }]),
    });
    const adapter = new BackendCoreServiceAdapter(sm);
    const tools = await adapter.getServerTools('s');
    expect(sm.getServerTools).toHaveBeenCalledWith('s');
    expect(tools).toHaveLength(1);
  });

  it('getServerConnections 委托 getAllServers', () => {
    const conns = new Map([['s', { id: 's' } as ServerConnection]]);
    const sm = makeMockServerManager({ getAllServers: vi.fn().mockReturnValue(conns) });
    const adapter = new BackendCoreServiceAdapter(sm);
    expect(adapter.getServerConnections()).toBe(conns);
    expect(sm.getAllServers).toHaveBeenCalled();
  });

  it('getServiceStatus 返回含 serverCount 与 connected 数', () => {
    const sm = makeMockServerManager({
      getAllServers: vi.fn().mockReturnValue(
        new Map([
          ['s1', { id: 's1', status: 'connected' as ServerStatus } as ServerConnection],
          ['s2', { id: 's2', status: 'disconnected' as ServerStatus } as ServerConnection],
        ]),
      ),
    });
    const adapter = new BackendCoreServiceAdapter(sm);
    const status = adapter.getServiceStatus();
    expect(status.serverCount).toBe(2);
    expect(status.connectedServers).toBe(1);
  });

  it('isToolAvailable 检查 server 的 tools 是否含该工具', async () => {
    const sm = makeMockServerManager({
      getServerTools: vi.fn().mockResolvedValue([
        { name: 'find-me', inputSchema: {}, serverId: 's' },
      ]),
    });
    const adapter = new BackendCoreServiceAdapter(sm);
    expect(await adapter.isToolAvailable('find-me', 's')).toBe(true);
    expect(await adapter.isToolAvailable('missing', 's')).toBe(false);
  });

  it('initializeFromConfig / shutdown / registerServer 委托 ServerManager', async () => {
    const sm = makeMockServerManager({
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });
    const adapter = new BackendCoreServiceAdapter(sm);
    await adapter.initializeFromConfig({ servers: {} } as never);
    await adapter.registerServer('s', { type: 'stdio', command: 'x' } as never);
    await adapter.shutdown();
    expect(sm.initialize).toHaveBeenCalled();
    expect(sm.shutdown).toHaveBeenCalled();
  });
});
