/**
 * MCP 类型单元测试
 * 测试 MCP 配置类型定义
 */

import { describe, expect, it } from 'vitest';

import type { ServerConfig } from './mcp.js';

describe('ServerConfig Types', () => {
  describe('StdioServerConfig', () => {
    it('应该创建有效的 stdio 服务器配置', () => {
      const config: ServerConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      expect(config.type).toBe('stdio');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
    });

    it('应该支持可选的环境变量', () => {
      const config: ServerConfig = {
        type: 'stdio',
        command: 'python',
        args: ['-m', 'server'],
        env: {
          PYTHONPATH: '/usr/lib/python',
          DEBUG: 'true',
        },
      };

      expect(config.env).toBeDefined();
      expect(config.env?.PYTHONPATH).toBe('/usr/lib/python');
      expect(config.env?.DEBUG).toBe('true');
    });

    it('应该支持启用/禁用标志', () => {
      const enabledConfig: ServerConfig = {
        type: 'stdio',
        command: 'node',
        enabled: true,
      };

      const disabledConfig: ServerConfig = {
        type: 'stdio',
        command: 'node',
        enabled: false,
      };

      expect(enabledConfig.enabled).toBe(true);
      expect(disabledConfig.enabled).toBe(false);
    });

    it('应该支持无参数的命令', () => {
      const config: ServerConfig = {
        type: 'stdio',
        command: 'server',
      };

      expect(config.command).toBe('server');
      expect(config.args).toBeUndefined();
    });
  });

  describe('HTTPServerConfig', () => {
    it('应该创建有效的 SSE 服务器配置', () => {
      const config: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
      };

      expect(config.type).toBe('sse');
      expect(config.url).toBe('http://localhost:8080/sse');
    });

    it('应该创建有效的 streaming 服务器配置', () => {
      const config: ServerConfig = {
        type: 'streaming',
        url: 'http://localhost:3000/stream',
      };

      expect(config.type).toBe('streaming');
      expect(config.url).toBe('http://localhost:3000/stream');
    });

    it('应该支持自定义请求头', () => {
      const config: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
      };

      expect(config.headers).toBeDefined();
      expect(config.headers?.Authorization).toBe('Bearer token123');
      expect(config.headers?.['Content-Type']).toBe('application/json');
    });

    it('应该支持环境变量', () => {
      const config: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
        env: {
          API_KEY: 'secret',
        },
      };

      expect(config.env?.API_KEY).toBe('secret');
    });

    it('应该支持启用/禁用标志', () => {
      const enabledConfig: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
        enabled: true,
      };

      const disabledConfig: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
        enabled: false,
      };

      expect(enabledConfig.enabled).toBe(true);
      expect(disabledConfig.enabled).toBe(false);
    });
  });

  describe('类型区分', () => {
    it('应该能通过 type 字段区分配置类型', () => {
      const stdioConfig: ServerConfig = {
        type: 'stdio',
        command: 'node',
      };

      const sseConfig: ServerConfig = {
        type: 'sse',
        url: 'http://localhost:8080/sse',
      };

      const streamingConfig: ServerConfig = {
        type: 'streaming',
        url: 'http://localhost:3000/stream',
      };

      if (stdioConfig.type === 'stdio') {
        expect(stdioConfig.command).toBeDefined();
      }

      if (sseConfig.type === 'sse' || sseConfig.type === 'streaming') {
        expect(sseConfig.url).toBeDefined();
      }

      if (streamingConfig.type === 'sse' || streamingConfig.type === 'streaming') {
        expect(streamingConfig.url).toBeDefined();
      }
    });
  });

  describe('完整配置示例', () => {
    it('应该支持复杂的 stdio 配置', () => {
      const config: ServerConfig = {
        type: 'stdio',
        command: 'python',
        args: ['-m', 'mcp_server', '--port', '8080'],
        env: {
          PYTHONPATH: '/usr/lib/python',
          LOG_LEVEL: 'debug',
          API_KEY: 'test-key',
        },
        enabled: true,
      };

      expect(config.type).toBe('stdio');
      expect(config.args).toHaveLength(4);
      expect(config.env).toBeDefined();
      expect(Object.keys(config.env || {})).toHaveLength(3);
    });

    it('应该支持复杂的 HTTP 配置', () => {
      const config: ServerConfig = {
        type: 'sse',
        url: 'https://api.example.com/mcp/sse',
        headers: {
          Authorization: 'Bearer secret-token',
          'X-Custom-Header': 'custom-value',
        },
        env: {
          TIMEOUT: '5000',
        },
        enabled: true,
      };

      expect(config.type).toBe('sse');
      expect(config.url).toContain('https://');
      expect(config.headers).toBeDefined();
      expect(Object.keys(config.headers || {})).toHaveLength(2);
    });
  });
});
