/**
 * MCP协议处理器
 * 处理MCP协议的请求和响应格式化
 */

import type { McpServiceManager } from '@mcp-core/mcp-hub-core';
import { createCliLogger } from '@mcp-core/mcp-hub-share';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP协议错误代码
 */
export enum McpErrorCode {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  TOOL_NOT_FOUND = -32000,
  TOOL_EXECUTION_FAILED = -32001,
}

/**
 * MCP协议错误
 */
export interface McpError {
  code: McpErrorCode;
  message: string;
  data?: unknown;
}

/**
 * MCP协议处理器类
 */
export class McpProtocolHandler {
  private logger = createCliLogger({ component: 'Protocol' });

  constructor(private coreService: McpServiceManager) {}

  /**
   * 处理list_tools请求
   */
  async handleListTools(): Promise<{
    tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  }> {
    try {
      this.logger.debug('处理list_tools请求');

      // 获取所有可用工具
      const toolInfos = await this.coreService.getAllTools();

      // 转换为MCP工具格式
      const tools = toolInfos.map((toolInfo) => ({
        name: toolInfo.name,
        description:
          toolInfo.description || `来自服务器 ${toolInfo.serverId} 的工具`,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
      }));

      this.logger.debug(`返回 ${tools.length} 个工具`);

      return { tools };
    } catch (error) {
      console.error('处理list_tools请求失败:', error);
      throw this.createMcpError(
        McpErrorCode.INTERNAL_ERROR,
        '获取工具列表失败',
        { originalError: (error as Error).message },
      );
    }
  }

  /**
   * 处理call_tool请求
   */
  async handleCallTool(
    toolName: string,
    args: unknown,
  ): Promise<CallToolResult> {
    try {
      console.debug('处理call_tool请求', { toolName, args });

      // 验证工具是否存在
      const isAvailable = await this.coreService.isToolAvailable(toolName);
      if (!isAvailable) {
        throw this.createMcpError(
          McpErrorCode.TOOL_NOT_FOUND,
          `工具 '${toolName}' 未找到`,
          { toolName },
        );
      }

      // 执行工具调用
      const result = await this.coreService.executeToolCall(toolName, args);

      // 格式化响应
      const response = this.formatToolCallResponse(result, toolName);

      console.debug('工具调用完成', {
        toolName,
        success: result.success,
        executionTime: result.executionTime,
      });

      return response;
    } catch (error) {
      console.error('处理call_tool请求失败:', error);

      // 如果是MCP错误，直接抛出
      if (this.isMcpError(error)) {
        throw error;
      }

      // 否则包装为工具执行失败错误
      throw this.createMcpError(
        McpErrorCode.TOOL_EXECUTION_FAILED,
        `工具执行失败: ${(error as Error).message}`,
        { toolName, originalError: (error as Error).message },
      );
    }
  }

  /**
   * 格式化工具调用响应
   */
  private formatToolCallResponse(
    result: any,
    toolName: string,
  ): CallToolResult {
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: this.formatSuccessResponse(result.data),
          },
        ],
        isError: false,
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: this.formatErrorResponse(
              result.error || '工具执行失败',
              toolName,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 格式化成功响应
   */
  private formatSuccessResponse(data: unknown): string {
    try {
      if (typeof data === 'string') {
        return data;
      }

      if (data === null || data === undefined) {
        return '操作成功完成';
      }

      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.warn('格式化响应数据失败:', error);
      return '操作成功完成，但响应数据格式化失败';
    }
  }

  /**
   * 格式化错误响应
   */
  private formatErrorResponse(error: string, toolName: string): string {
    return `工具 '${toolName}' 执行失败: ${error}`;
  }

  /**
   * 创建MCP错误
   */
  private createMcpError(
    code: McpErrorCode,
    message: string,
    data?: unknown,
  ): Error {
    const error = new Error(message) as Error & {
      code: McpErrorCode;
      data?: unknown;
    };
    error.code = code;
    error.data = data;
    return error;
  }

  /**
   * 检查是否为MCP错误
   */
  private isMcpError(error: unknown): error is Error & { code: McpErrorCode } {
    return (
      error instanceof Error &&
      'code' in error &&
      typeof (error as any).code === 'number'
    );
  }

  /**
   * 处理协议错误并格式化为标准MCP错误响应
   */
  handleProtocolError(error: unknown): CallToolResult {
    console.error('MCP协议错误:', error);

    let errorMessage = '未知错误';
    let errorCode = McpErrorCode.INTERNAL_ERROR;

    if (this.isMcpError(error)) {
      errorMessage = error.message;
      errorCode = error.code;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      content: [
        {
          type: 'text',
          text: `协议错误 (${errorCode}): ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * 验证请求参数
   */
  validateCallToolParams(params: unknown): { toolName: string; args: unknown } {
    if (!params || typeof params !== 'object') {
      throw this.createMcpError(
        McpErrorCode.INVALID_PARAMS,
        '请求参数无效：参数必须是对象',
      );
    }

    const { name, arguments: args } = params as any;

    if (!name || typeof name !== 'string') {
      throw this.createMcpError(
        McpErrorCode.INVALID_PARAMS,
        '请求参数无效：缺少工具名称或工具名称不是字符串',
      );
    }

    return { toolName: name, args };
  }

  /**
   * 获取协议处理器状态
   */
  getStatus() {
    return {
      coreServiceStatus: this.coreService.getServiceStatus(),
      supportedMethods: ['tools/list', 'tools/call'],
      errorCodes: Object.values(McpErrorCode),
    };
  }
}
