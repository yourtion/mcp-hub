/**
 * CLI MCP服务器实现
 * 使用核心包的McpServiceManager和MCP SDK的StdioServerTransport
 */

import { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { McpProtocolHandler } from '../protocol/mcp-protocol-handler';
import type { CliConfig } from '../types';

/**
 * CLI MCP服务器类
 * 聚合多个MCP服务并通过stdio提供统一的MCP接口
 */
export class CliMcpServer {
  private server: McpServer | null = null;
  private transport: StdioServerTransport | null = null;
  private coreService: McpServiceManager | null = null;
  private protocolHandler: McpProtocolHandler | null = null;
  private config: CliConfig | null = null;
  private isInitialized = false;
  private isStarted = false;

  /**
   * 创建服务管理器（可被测试覆盖）
   */
  private createServiceManager(): McpServiceManager {
    return new McpServiceManager();
  }

  /**
   * 初始化CLI MCP服务器
   */
  async initialize(config: CliConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('CLI MCP服务器已初始化，跳过重复初始化');
      return;
    }

    console.info('开始初始化CLI MCP服务器');

    try {
      this.config = config;

      // 创建核心服务管理器
      this.coreService = this.createServiceManager();

      // 从配置初始化核心服务
      await this.coreService.initializeFromConfig({
        servers: config.servers,
      });

      // 创建协议处理器
      this.protocolHandler = new McpProtocolHandler(this.coreService);

      // 创建MCP服务器实例
      this.server = new McpServer(
        {
          name: 'mcp-hub-cli',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
          instructions: 'MCP Hub CLI - 聚合多个MCP服务的命令行界面',
        },
      );

      // 注册工具
      await this.registerTools();

      // 创建stdio传输层
      this.transport = new StdioServerTransport();

      this.isInitialized = true;
      console.info('CLI MCP服务器初始化完成');
    } catch (error) {
      console.error('CLI MCP服务器初始化失败:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * 启动MCP服务器
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('CLI MCP服务器必须先初始化');
    }

    if (this.isStarted) {
      console.warn('CLI MCP服务器已启动');
      return;
    }

    console.info('启动CLI MCP服务器');

    try {
      if (!this.server || !this.transport) {
        throw new Error('服务器或传输层未初始化');
      }

      // 连接服务器和传输层（McpServer会自动启动传输层）
      await this.server.connect(this.transport);

      this.isStarted = true;
      console.info('CLI MCP服务器启动成功，等待客户端连接...');
    } catch (error) {
      console.error('CLI MCP服务器启动失败:', error);
      throw error;
    }
  }

  /**
   * 关闭服务器
   */
  async shutdown(): Promise<void> {
    console.info('开始关闭CLI MCP服务器');

    try {
      // 关闭MCP服务器（会自动关闭传输层）
      if (this.server) {
        await this.server.close();
      }

      // 关闭核心服务
      if (this.coreService) {
        await this.coreService.shutdown();
        this.coreService = null;
      }

      await this.cleanup();

      console.info('CLI MCP服务器关闭完成');
    } catch (error) {
      console.error('CLI MCP服务器关闭时出错:', error);
      throw error;
    }
  }

  /**
   * 注册工具到MCP服务器
   */
  private async registerTools(): Promise<void> {
    if (!this.server || !this.coreService) {
      throw new Error('服务器或核心服务未初始化');
    }

    try {
      // 获取所有可用工具
      const toolInfos = await this.coreService.getAllTools();

      console.debug(`注册 ${toolInfos.length} 个工具`);

      // 为每个工具注册处理器
      for (const toolInfo of toolInfos) {
        this.server.registerTool(
          toolInfo.name,
          {
            description:
              toolInfo.description || `来自服务器 ${toolInfo.serverId} 的工具`,
            inputSchema: {
              // 使用通用的输入模式，允许任意参数
              args: z.record(z.unknown()).optional(),
            },
          },
          async ({ args }) => {
            try {
              if (!this.protocolHandler) {
                throw new Error('协议处理器未初始化');
              }

              // 使用协议处理器执行工具调用
              return await this.protocolHandler.handleCallTool(
                toolInfo.name,
                args,
              );
            } catch (error) {
              // 使用协议处理器处理错误
              if (this.protocolHandler) {
                return this.protocolHandler.handleProtocolError(error);
              }

              // 降级错误处理
              return {
                content: [
                  {
                    type: 'text',
                    text: `工具执行失败: ${(error as Error).message}`,
                  },
                ],
                isError: true,
              };
            }
          },
        );
      }

      console.debug('所有工具注册完成');
    } catch (error) {
      console.error('注册工具失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.server = null;
    this.protocolHandler = null;
    this.config = null;
    this.isInitialized = false;
    this.isStarted = false;
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      started: this.isStarted,
      coreServiceStatus: this.coreService?.getServiceStatus(),
      protocolHandlerStatus: this.protocolHandler?.getStatus(),
      config: this.config
        ? {
            serverCount: Object.keys(this.config.servers).length,
            loggingLevel: this.config.logging.level,
          }
        : null,
    };
  }
}
