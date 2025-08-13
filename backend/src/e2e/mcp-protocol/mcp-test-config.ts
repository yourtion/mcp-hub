/**
 * MCP协议测试配置
 * 统一管理MCP协议测试的配置和工具函数
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  checkServerHealth,
  startTestServer,
  waitForServer,
} from '../test-server.js';

export interface McpTestConfig {
  serverPort: number;
  baseUrl: string;
  sseEndpoint: string;
  timeout: number;
  retries: number;
}

export const defaultMcpTestConfig: McpTestConfig = {
  serverPort: 3000,
  baseUrl: 'http://localhost:3000',
  sseEndpoint: '/sse',
  timeout: 30000,
  retries: 3,
};

/**
 * 创建MCP测试客户端
 */
export async function createMcpTestClient(
  clientName: string,
  config: McpTestConfig = defaultMcpTestConfig,
): Promise<{ client: Client; transport: SSEClientTransport }> {
  const sseUrl = `${config.baseUrl}${config.sseEndpoint}`;

  const transport = new SSEClientTransport(new URL(sseUrl));
  const client = new Client(
    {
      name: clientName,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  await client.connect(transport);
  return { client, transport };
}

/**
 * 安全地关闭MCP客户端和传输
 */
export async function closeMcpClient(
  client: Client | null,
  transport: SSEClientTransport | null,
): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch (error) {
      // 忽略关闭错误
    }
  }

  if (transport) {
    try {
      await transport.close();
    } catch (error) {
      // 忽略关闭错误
    }
  }
}

/**
 * 确保测试服务器运行
 */
export async function ensureTestServerRunning(
  config: McpTestConfig = defaultMcpTestConfig,
): Promise<boolean> {
  // 首先检查服务器是否已经运行
  if (await checkServerHealth(config.baseUrl)) {
    return true;
  }

  // 尝试启动测试服务器
  try {
    await startTestServer(config.serverPort);

    // 等待服务器就绪
    const isReady = await waitForServer(config.baseUrl, 10, 1000);
    return isReady;
  } catch (error) {
    console.error('无法启动测试服务器:', error);
    return false;
  }
}

/**
 * MCP协议测试装饰器
 * 确保测试前服务器已启动
 */
export function withMcpServer(testFn: () => Promise<void>) {
  return async () => {
    const serverReady = await ensureTestServerRunning();
    if (!serverReady) {
      throw new Error('测试服务器未就绪，跳过MCP协议测试');
    }

    await testFn();
  };
}

/**
 * 创建带有重试机制的MCP客户端
 */
export async function createResilientMcpClient(
  clientName: string,
  config: McpTestConfig = defaultMcpTestConfig,
): Promise<{ client: Client; transport: SSEClientTransport } | null> {
  for (let attempt = 1; attempt <= config.retries; attempt++) {
    try {
      return await createMcpTestClient(clientName, config);
    } catch (error) {
      console.warn(
        `MCP客户端连接尝试 ${attempt}/${config.retries} 失败:`,
        error,
      );

      if (attempt < config.retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  return null;
}

/**
 * 验证MCP连接是否正常工作
 */
export async function validateMcpConnection(
  client: Client,
): Promise<{ isValid: boolean; toolCount: number; error?: string }> {
  try {
    const toolsResult = await client.listTools();
    return {
      isValid: true,
      toolCount: toolsResult.tools.length,
    };
  } catch (error) {
    return {
      isValid: false,
      toolCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
