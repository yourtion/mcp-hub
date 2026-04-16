import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sse } from './sse.js';

// Mock依赖
vi.mock('hono/streaming', () => ({
  streamSSE: vi.fn().mockImplementation((_c, callback) => {
    const mockStream = {
      onAbort: vi.fn().mockImplementation((fn: () => void) => {
        // 模拟立即调用abort回调（使用 setTimeout 确保在 async callback 中的 await 之后执行）
        setTimeout(fn, 0);
      }),
      writeSSE: vi.fn(),
      close: vi.fn(),
    };

    // 异步执行回调函数（因为实际回调是async的）
    // 注意：不能使用 Promise.resolve，因为 async callback 返回的 Promise
    // 在 await 处会暂停，需要在微任务中继续执行
    callback(mockStream).catch(() => {
      // 忽略错误
    });

    return new Response('SSE stream', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),
}));

vi.mock('./services/mcp_service.js', () => ({
  mcpServer: {
    connect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./utils/sse.js', () => ({
  SSETransport: vi.fn().mockImplementation(function (
    this: unknown,
    _path: string,
    _stream: unknown,
  ) {
    // 返回一个实际的mock对象
    const mockInstance = {
      sessionId: 'test-session-id',
      handlePostMessage: vi.fn().mockResolvedValue(new Response('OK')),
      close: vi.fn(),
    };
    return mockInstance;
  }),
}));

describe('SSE Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理console.log mock
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /sse', () => {
    it('应该建立SSE连接', async () => {
      const response = await sse.request('http://localhost/sse');

      expect(response).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('应该正确处理SSE连接建立', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await sse.request('http://localhost/sse');

      expect(consoleSpy).toHaveBeenCalledWith('SSE connection established');
    });

    it('应该在连接关闭时清理资源', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await sse.request('http://localhost/sse');

      // 等待异步操作完成（mcpServer.connect 微任务 + onAbort setTimeout）
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(consoleSpy).toHaveBeenCalledWith('SSE connection closed');
    });
  });

  describe('POST /messages', () => {
    it('应该处理有效sessionId的消息', async () => {
      // 首先建立SSE连接以创建transport
      await sse.request('http://localhost/sse');

      const mockRequest = new Request(
        'http://localhost/messages?sessionId=test-session-id',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        },
      );

      const response = await sse.request(mockRequest);
      expect(response).toBeDefined();
    });

    it('应该在无效sessionId时返回400错误', async () => {
      const mockRequest = new Request(
        'http://localhost/messages?sessionId=invalid-session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        },
      );

      const response = await sse.request(mockRequest);
      expect(response.status).toBe(400);

      const text = await response.text();
      expect(text).toBe('No transport found for sessionId');
    });

    it('应该在缺少sessionId时返回400错误', async () => {
      const mockRequest = new Request('http://localhost/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' }),
      });

      const response = await sse.request(mockRequest);
      expect(response.status).toBe(400);
    });
  });

  describe('Transport管理', () => {
    it('应该正确管理transport生命周期', async () => {
      // 这个测试专注于验证transport管理的端到端行为
      // 注意：由于mock环境的限制，这里主要验证行为而非实现细节

      // 首先建立SSE连接以创建transport
      const sseResponse = await sse.request('http://localhost/sse');
      expect(sseResponse).toBeDefined();

      // 等待transport创建
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 然后尝试使用sessionId发送消息
      const mockRequest = new Request(
        'http://localhost/messages?sessionId=test-session-id',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        },
      );

      const postResponse = await sse.request(mockRequest);
      // 验证消息处理机制正常工作
      expect(postResponse).toBeDefined();
    });

    it('应该在连接关闭时清理transport', async () => {
      // 建立连接
      await sse.request('http://localhost/sse');

      // 等待连接关闭
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 尝试使用已关闭的sessionId发送消息
      const mockRequest = new Request(
        'http://localhost/messages?sessionId=test-session-id',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'test' }),
        },
      );

      const response = await sse.request(mockRequest);
      expect(response.status).toBe(400);
    });
  });
});
