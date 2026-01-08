/**
 * MCP服务工厂测试
 */

import { describe, expect, it } from 'vitest';
import { McpServiceFactoryImpl, mcpServiceFactory } from './index.js';

describe('McpServiceFactory', () => {
  it('应该创建工厂实例', () => {
    const factory = new McpServiceFactoryImpl();
    expect(factory).toBeInstanceOf(McpServiceFactoryImpl);
  });

  it('应该导出默认工厂实例', () => {
    expect(mcpServiceFactory).toBeInstanceOf(McpServiceFactoryImpl);
  });

  it('应该能创建核心服务', () => {
    const config = { servers: {} };
    const coreService = mcpServiceFactory.createCoreService(config);
    expect(coreService).toBeDefined();
  });

  it('组服务包装器应该抛出未实现错误', () => {
    const config = { servers: {} };
    const coreService = mcpServiceFactory.createCoreService(config);
    const groupConfig = { name: 'test', servers: [] };

    expect(() => {
      mcpServiceFactory.createGroupServiceWrapper(coreService, groupConfig);
    }).toThrow('GroupMcpService implementation not yet available');
  });

  it('CLI聚合器应该抛出未实现错误', () => {
    const config = { servers: {} };
    const coreService = mcpServiceFactory.createCoreService(config);

    expect(() => {
      mcpServiceFactory.createCliAggregator(coreService);
    }).toThrow('CliMcpAggregator implementation not yet available');
  });
});
