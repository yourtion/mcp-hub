import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sse } from './sse';

// Mock依赖
vi.mock('hono/streaming', () => ({
  streamSSE: vi.fn().mockImplementation((c, callback) => {
    const mockStream = {
      onAbort: vi.fn().mockImplementation((fn) => {
        // 模拟立即调用abort回调
        setTimeout(fn, 0);
      }),
      writeSSE: vi.fn(),
      close: vi.fn(),
    };

    // 执行回调函数
    callback(mockStream);

    return new Response('SSE stream', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),
}));

vi.mock('./services/mcp_service', () => ({
  mcpServer: {
    connect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./utils/sse.js', () => ({
  SSETransport: vi.fn().mockImplementation((path, stream) => ({
    sessionId: 'test-session-id',
    handlePostMessage: vi.fn().mockResolvedValue(new Response('OK')),
    close: vi.fn(),
  })),
}));

describe('SSE Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理console.log mock
    vi.spyOn(console, 'log').mockImplementation(() => {});
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

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 10));

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
      const { SSETransport } = await import('./utils/sse.js');

      // 建立连接
      await sse.request('http://localhost/sse');

      expect(SSETransport).toHaveBeenCalledWith(
        '/messages',
        expect.any(Object),
      );
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
