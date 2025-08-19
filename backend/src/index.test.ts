import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAllConfigs } from './validation/config.js';

// Mock 依赖
vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./utils/config', () => ({
  getAllConfig: vi.fn(),
}));

vi.mock('./services/config', () => ({
  initConfig: vi.fn(),
}));

vi.mock('./services/mcp_hub_service', () => ({
  McpHubService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@hono/node-server', () => ({
  serve: vi.fn().mockReturnValue({
    close: vi.fn(),
  }),
}));

describe('服务初始化测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('配置验证', () => {
    it('应该正确验证有效的配置组合', () => {
      const mcpConfig = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default Group',
          servers: ['test-server'],
          tools: [],
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.mcpConfig).toBeDefined();
        expect(result.data.groupConfig).toBeDefined();
        expect(Object.keys(result.data.mcpConfig.mcpServers)).toContain(
          'test-server',
        );
        expect(Object.keys(result.data.groupConfig)).toContain('default');
      }
    });

    it('应该拒绝无效的配置组合', () => {
      const mcpConfig = {
        mcpServers: {}, // 空配置，应该失败
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default Group',
          servers: ['nonexistent-server'],
          tools: [],
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('MCP配置错误'))).toBe(
          true,
        );
      }
    });

    it('应该检测交叉引用错误', () => {
      const mcpConfig = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'node',
            args: ['server1.js'],
          },
        },
      };

      const groupConfig = {
        'test-group': {
          id: 'test-group',
          name: 'Test Group',
          servers: ['server1', 'nonexistent-server'], // 引用不存在的服务器
          tools: [],
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig);
      expect(result.success).toBe(false);

      if (!result.success) {
        // 检查是否包含交叉引用错误或组配置错误
        const hasRelevantError = result.errors.some(
          (err) =>
            err.includes('交叉引用错误') ||
            err.includes('引用了不存在的服务器') ||
            err.includes('引用了未在MCP配置中定义的服务器'),
        );
        expect(hasRelevantError).toBe(true);
      }
    });
  });

  describe('错误处理', () => {
    it('应该正确处理配置验证错误', () => {
      const invalidConfig = {
        mcpServers: {
          'invalid-server': {
            type: 'stdio',
            command: '', // 无效的空命令
          },
        },
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default Group',
          servers: ['invalid-server'],
          tools: [],
        },
      };

      const result = validateAllConfigs(invalidConfig, groupConfig);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('命令不能为空'))).toBe(
          true,
        );
      }
    });

    it('应该处理复杂的配置验证场景', () => {
      const mcpConfig = {
        mcpServers: {
          'stdio-server': {
            type: 'stdio',
            command: 'node',
            args: ['stdio.js'],
            enabled: true,
          },
          'sse-server': {
            type: 'sse',
            url: 'http://localhost:3001/sse',
            headers: { Authorization: 'Bearer token' },
            enabled: false,
          },
        },
      };

      const groupConfig = {
        'stdio-group': {
          id: 'stdio-group',
          name: 'STDIO Group',
          description: 'Group for stdio servers',
          servers: ['stdio-server'],
          tools: ['tool1', 'tool2'],
        },
        'sse-group': {
          id: 'sse-group',
          name: 'SSE Group',
          description: 'Group for SSE servers',
          servers: ['sse-server'],
          tools: [],
        },
        'combined-group': {
          id: 'combined-group',
          name: 'Combined Group',
          servers: ['stdio-server', 'sse-server'],
          tools: ['tool1'],
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(Object.keys(result.data.mcpConfig.mcpServers)).toHaveLength(2);
        expect(Object.keys(result.data.groupConfig)).toHaveLength(3);

        // 验证服务器配置
        expect(result.data.mcpConfig.mcpServers['stdio-server'].type).toBe(
          'stdio',
        );
        expect(result.data.mcpConfig.mcpServers['sse-server'].type).toBe('sse');

        // 验证组配置
        expect(result.data.groupConfig['stdio-group'].servers).toContain(
          'stdio-server',
        );
        expect(result.data.groupConfig['combined-group'].servers).toHaveLength(
          2,
        );
      }
    });
  });

  describe('系统配置验证', () => {
    it('应该验证包含系统配置的完整配置', () => {
      const mcpConfig = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default Group',
          servers: ['test-server'],
          tools: [],
        },
      };

      const systemConfig = {
        users: {
          admin: {
            password: 'admin123',
            groups: ['default'],
          },
          user: {
            password: 'user123',
            groups: ['default'],
          },
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig, systemConfig);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.systemConfig).toBeDefined();
        expect(result.data.systemConfig?.users.admin.password).toBe('admin123');
        expect(result.data.systemConfig?.users.user.groups).toContain(
          'default',
        );
      }
    });

    it('应该拒绝无效的系统配置', () => {
      const mcpConfig = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default Group',
          servers: ['test-server'],
          tools: [],
        },
      };

      const invalidSystemConfig = {
        users: {
          user: {
            password: '', // 无效的空密码
            groups: ['default'],
          },
        },
      };

      const result = validateAllConfigs(
        mcpConfig,
        groupConfig,
        invalidSystemConfig,
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.errors.some((err) => err.includes('系统配置错误'))).toBe(
          true,
        );
      }
    });
  });
});
