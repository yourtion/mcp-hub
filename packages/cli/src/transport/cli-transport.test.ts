/**
 * CLI传输层单元测试
 */

import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliTransport } from './cli-transport';

// Mock MCP SDK
const mockTransport = {
  start: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  onmessage: undefined as ((message: JSONRPCMessage) => void) | undefined,
  onerror: undefined as ((error: Error) => void) | undefined,
  onclose: undefined as (() => void) | undefined,
};

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => mockTransport),
}));

describe('CliTransport', () => {
  let transport: CliTransport;

  beforeEach(() => {
    transport = new CliTransport();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await transport.shutdown();
    } catch {
      // 忽略关闭错误
    }
  });

  describe('initialize', () => {
    it('应该成功初始化传输层', async () => {
      await transport.initialize();

      const status = transport.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.hasTransport).toBe(true);
    });

    it('应该跳过重复初始化', async () => {
      await transport.initialize();

      // 第二次初始化应该被跳过
      await transport.initialize();

      const status = transport.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('应该设置事件处理器', async () => {
      await transport.initialize();

      const underlyingTransport = transport.getTransport();
      expect(underlyingTransport?.onmessage).toBeDefined();
      expect(underlyingTransport?.onerror).toBeDefined();
      expect(underlyingTransport?.onclose).toBeDefined();
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('应该成功启动传输层', async () => {
      await transport.start();

      const status = transport.getStatus();
      expect(status.started).toBe(true);
      expect(mockTransport.start).toHaveBeenCalledOnce();
    });

    it('应该在未初始化时抛出错误', async () => {
      const uninitializedTransport = new CliTransport();

      await expect(uninitializedTransport.start()).rejects.toThrow(
        '传输层必须先初始化',
      );
    });

    it('应该跳过重复启动', async () => {
      await transport.start();

      // 第二次启动应该被跳过
      await transport.start();

      const status = transport.getStatus();
      expect(status.started).toBe(true);
      expect(mockTransport.start).toHaveBeenCalledOnce();
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await transport.initialize();
      await transport.start();
    });

    it('应该成功关闭传输层', async () => {
      await transport.shutdown();

      const status = transport.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);
      expect(status.hasTransport).toBe(false);
      expect(mockTransport.close).toHaveBeenCalledOnce();
    });

    it('应该在未初始化时也能安全关闭', async () => {
      const uninitializedTransport = new CliTransport();

      // 应该不抛出错误
      await expect(uninitializedTransport.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('sendMessage', () => {
    const testMessage: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
      params: {},
    };

    beforeEach(async () => {
      await transport.initialize();
      await transport.start();
    });

    it('应该成功发送消息', async () => {
      await transport.sendMessage(testMessage);

      expect(mockTransport.send).toHaveBeenCalledWith(testMessage);
    });

    it('应该在未初始化时抛出错误', async () => {
      const uninitializedTransport = new CliTransport();

      await expect(
        uninitializedTransport.sendMessage(testMessage),
      ).rejects.toThrow('传输层未初始化');
    });

    it('应该在未启动时抛出错误', async () => {
      const transport = new CliTransport();
      await transport.initialize();
      // 不启动传输层

      await expect(transport.sendMessage(testMessage)).rejects.toThrow(
        '传输层未启动',
      );
    });
  });

  describe('事件处理', () => {
    beforeEach(async () => {
      await transport.initialize();
    });

    it('应该处理消息事件', async () => {
      const mockOnMessage = vi.fn();
      transport.onMessage = mockOnMessage;

      const testMessage: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      };

      // 模拟收到消息
      const underlyingTransport = transport.getTransport();
      underlyingTransport?.onmessage?.(testMessage);

      expect(mockOnMessage).toHaveBeenCalledWith(testMessage);

      const status = transport.getStatus();
      expect(status.messageCount).toBe(1);
    });

    it('应该处理错误事件', async () => {
      const mockOnError = vi.fn();
      transport.onError = mockOnError;

      const testError = new Error('测试错误');

      // 模拟错误
      const underlyingTransport = transport.getTransport();
      underlyingTransport?.onerror?.(testError);

      expect(mockOnError).toHaveBeenCalledWith(testError);
    });

    it('应该处理关闭事件', async () => {
      const mockOnClose = vi.fn();
      transport.onClose = mockOnClose;

      await transport.start();

      // 模拟连接关闭
      const underlyingTransport = transport.getTransport();
      underlyingTransport?.onclose?.();

      expect(mockOnClose).toHaveBeenCalled();

      const status = transport.getStatus();
      expect(status.started).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的初始状态', () => {
      const status = transport.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.started).toBe(false);
      expect(status.messageCount).toBe(0);
      expect(status.hasTransport).toBe(false);
    });

    it('应该在初始化后返回正确状态', async () => {
      await transport.initialize();

      const status = transport.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.hasTransport).toBe(true);
    });

    it('应该在启动后返回正确状态', async () => {
      await transport.initialize();
      await transport.start();

      const status = transport.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.started).toBe(true);
    });
  });

  describe('getTransport', () => {
    it('应该在未初始化时返回null', () => {
      expect(transport.getTransport()).toBeNull();
    });

    it('应该在初始化后返回传输层实例', async () => {
      await transport.initialize();

      const underlyingTransport = transport.getTransport();
      expect(underlyingTransport).not.toBeNull();
    });
  });
});
