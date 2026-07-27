/**
 * MCP协议测试配置
 * 统一管理MCP协议测试的配置和工具函数
 *
 * v2（协议 2026-07-28）：客户端改用 StreamableHTTPClientTransport，
 * 连接 `/:group/mcp` 端点（无状态，createMcpHandler + legacy:reject）。
 * 出站版本协商 `{ mode: 'auto' }`：探测到 modern server 时走 2026-07-28，
 * 否则回退到 legacy initialize——保证客户端对服务端的兼容性。
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { checkServerHealth } from '../test-server.js';

export interface McpTestConfig {
  /** 测试服务器监听端口（TestServer 默认 3000） */
  serverPort: number;
  /** 测试服务器基址 */
  baseUrl: string;
  /** 组 ID，对应 `/:group/mcp` 端点 */
  group: string;
  /** MCP 端点（相对 baseUrl），总是 `/<group>/mcp` */
  mcpEndpoint: string;
  timeout: number;
  retries: number;
}

/**
 * 默认测试配置：连 `default` 组的 `/default/mcp`。
 * `setupTestConfig()` 写入的 group.json 里包含 `default` 组。
 *
 * 端口由各 vitest project 通过 `E2E_PORT` 环境变量隔离：
 *   api-e2e=3000 / api-e2e-oauth=3010 / api-e2e-validation=3020 / api-e2e-outbound=3030
 * 缺省回退 3000（保持与历史 open profile 一致）。
 */
const e2ePort = Number(process.env.E2E_PORT) || 3000;
export const defaultMcpTestConfig: McpTestConfig = {
  serverPort: e2ePort,
  baseUrl: `http://localhost:${e2ePort}`,
  group: 'default',
  mcpEndpoint: '/default/mcp',
  timeout: 30000,
  retries: 3,
};

/**
 * 创建MCP测试客户端
 *
 * 用 StreamableHTTPClientTransport 连接 `/:group/mcp`。
 * `versionNegotiation: { mode: 'auto' }` 让 SDK 自动探测服务端协议版本。
 */
export async function createMcpTestClient(
  clientName: string,
  config: McpTestConfig = defaultMcpTestConfig,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> {
  const mcpUrl = `${config.baseUrl}${config.mcpEndpoint}`;

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
  const client = new Client(
    {
      name: clientName,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      // 出站兼容：探测到 modern (2026-07-28) 则走 discover，否则回退 legacy initialize
      versionNegotiation: { mode: 'auto' },
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
  transport: StreamableHTTPClientTransport | null,
): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch (_error) {
      // 忽略关闭错误
    }
  }

  if (transport) {
    try {
      await transport.close();
    } catch (_error) {
      // 忽略关闭错误
    }
  }
}

/**
 * 确保测试服务器运行 + 测试配置已写入。
 *
 * 配置写入与服务器启动由 api-e2e 项目的全局 setup
 * （backend/vitest.e2e.setup.ts）在 worker 启动时一次性完成，
 * 所有协议测试文件复用同一个运行中的服务器实例，避免文件间因
 * cleanupTestConfig/resetConfigInstances 互相踩踏。
 *
 * 此处仅做健康检查：若全局 setup 未能起服务，返回 false 让测试自我跳过。
 */
export async function ensureTestServerRunning(
  config: McpTestConfig = defaultMcpTestConfig,
): Promise<boolean> {
  return checkServerHealth(config.baseUrl);
}

/**
 * 清理钩子（空操作）。
 *
 * 配置生命周期由全局 setup 管理；单测文件在 afterAll 调用此函数是安全的空操作，
 * 仅为保持调用对称。真正的清理在 worker 退出时由进程回收完成。
 */
export function cleanupMcpTestConfig(): void {
  // no-op：配置由全局 setup 管理
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
): Promise<{ client: Client; transport: StreamableHTTPClientTransport } | null> {
  for (let attempt = 1; attempt <= config.retries; attempt++) {
    try {
      return await createMcpTestClient(clientName, config);
    } catch (error) {
      console.warn(`MCP客户端连接尝试 ${attempt}/${config.retries} 失败:`, error);

      // 连接失败时先关掉残留 transport，再重试
      if (attempt < config.retries) {
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
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
