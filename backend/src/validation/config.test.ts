import type { GroupConfig, McpConfig } from '@mcp-core/mcp-hub-share';
import { describe, expect, it } from 'vitest';
import {
  validateAllConfigs,
  validateConfigCrossReferences,
  validateGroupConfig,
  validateMcpConfig,
  validateSystemConfig,
} from './config.js';

describe('配置验证工具', () => {
  describe('validateMcpConfig', () => {
    it('应该验证有效的stdio服务器配置', () => {
      const config = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: { NODE_ENV: 'test' },
            enabled: true,
          },
        },
      };

      const result = validateMcpConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcpServers['test-server'].type).toBe('stdio');
      }
    });

    it('应该验证有效的SSE服务器配置', () => {
      const config = {
        mcpServers: {
          'sse-server': {
            type: 'sse',
            url: 'http://localhost:3000/sse',
            headers: { Authorization: 'Bearer token' },
            enabled: true,
          },
        },
      };

      const result = validateMcpConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcpServers['sse-server'].type).toBe('sse');
      }
    });

    it('应该拒绝空的服务器配置', () => {
      const config = {
        mcpServers: {},
      };

      const result = validateMcpConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toContain(
          'mcpServers: 至少需要配置一个MCP服务器',
        );
      }
    });

    it('应该拒绝无效的命令配置', () => {
      const config = {
        mcpServers: {
          'invalid-server': {
            type: 'stdio',
            command: '', // 空命令
          },
        },
      };

      const result = validateMcpConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((err) => err.includes('命令不能为空'))).toBe(
          true,
        );
      }
    });

    it('应该拒绝无效的URL配置', () => {
      const config = {
        mcpServers: {
          'invalid-sse': {
            type: 'sse',
            url: 'not-a-url',
          },
        },
      };

      const result = validateMcpConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.includes('必须是有效的URL')),
        ).toBe(true);
      }
    });
  });

  describe('validateGroupConfig', () => {
    it('应该验证有效的组配置', () => {
      const config = {
        default: {
          id: 'default-group',
          name: 'Default Group',
          description: 'Default group',
          servers: ['server1', 'server2'],
          tools: [],
        },
      };

      const result = validateGroupConfig(config, ['server1', 'server2']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.default.name).toBe('Default Group');
      }
    });

    it('应该拒绝引用不存在服务器的组配置', () => {
      const config = {
        'test-group': {
          id: 'test-group',
          name: 'Test Group',
          servers: ['nonexistent-server'],
          tools: [],
        },
      };

      const result = validateGroupConfig(config, ['server1']);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.includes('引用了不存在的服务器')),
        ).toBe(true);
      }
    });

    it('应该拒绝空服务器列表的组配置', () => {
      const config = {
        'empty-group': {
          id: 'empty-group',
          name: 'Empty Group',
          servers: [],
          tools: [],
        },
      };

      const result = validateGroupConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) =>
            err.includes('每个组至少需要包含一个服务器'),
          ),
        ).toBe(true);
      }
    });

    it('应该拒绝空组名的配置', () => {
      const config = {
        'test-group': {
          id: 'test-group',
          name: '',
          servers: ['server1'],
          tools: [],
        },
      };

      const result = validateGroupConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) => err.includes('组名称不能为空')),
        ).toBe(true);
      }
    });
  });

  describe('validateSystemConfig', () => {
    it('应该验证有效的系统配置', () => {
      const config = {
        server: {
          port: 3000,
          host: 'localhost',
        },
        auth: {
          jwt: {
            secret: 'test-secret-key-with-sufficient-length-for-security',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            issuer: 'mcp-hub',
          },
          security: {
            maxLoginAttempts: 5,
            lockoutDuration: 900000,
            passwordMinLength: 6,
            requireStrongPassword: false,
          },
        },
        users: {
          admin: {
            id: 'admin',
            username: 'admin',
            password: 'admin123',
            passwordHash: 'hash',
            role: 'admin',
            groups: ['default', 'admin'],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          user: {
            id: 'user',
            username: 'user',
            password: 'user123',
            passwordHash: 'hash',
            role: 'user',
            groups: ['default'],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        },
        ui: {
          title: 'MCP Hub',
          theme: 'light',
          features: {
            apiToMcp: true,
            debugging: true,
            monitoring: true,
          },
        },
        monitoring: {
          metricsEnabled: true,
          logLevel: 'info',
          retentionDays: 30,
        },
      };

      const result = validateSystemConfig(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.users.admin.password).toBe('admin123');
      }
    });

    it('应该拒绝空密码的用户配置', () => {
      const config = {
        users: {
          user: {
            password: '',
            groups: ['default'],
          },
        },
      };

      const result = validateSystemConfig(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((err) => err.includes('密码不能为空'))).toBe(
          true,
        );
      }
    });
  });

  describe('validateConfigCrossReferences', () => {
    it('应该验证有效的交叉引用', () => {
      const mcpConfig: McpConfig = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'node',
            args: ['server1.js'],
          },
          server2: {
            type: 'stdio',
            command: 'node',
            args: ['server2.js'],
          },
        },
      };

      const groupConfig: GroupConfig = {
        group1: {
          id: 'group1',
          name: 'Group 1',
          servers: ['server1'],
          tools: [],
        },
        group2: {
          id: 'group2',
          name: 'Group 2',
          servers: ['server2'],
          tools: [],
        },
      };

      const result = validateConfigCrossReferences(mcpConfig, groupConfig);
      expect(result.success).toBe(true);
    });

    it('应该拒绝引用不存在服务器的交叉引用', () => {
      const mcpConfig: McpConfig = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'node',
            args: ['server1.js'],
          },
        },
      };

      const groupConfig: GroupConfig = {
        group1: {
          id: 'group1',
          name: 'Group 1',
          servers: ['server1', 'nonexistent-server'],
          tools: [],
        },
      };

      const result = validateConfigCrossReferences(mcpConfig, groupConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.errors.some((err) =>
            err.includes('引用了未在MCP配置中定义的服务器'),
          ),
        ).toBe(true);
      }
    });
  });

  describe('validateAllConfigs', () => {
    it('应该验证所有有效配置', () => {
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
        default: {
          id: 'default',
          name: 'Default',
          servers: ['server1'],
          tools: [],
        },
      };

      const systemConfig = {
        server: {
          port: 3000,
          host: 'localhost',
        },
        auth: {
          jwt: {
            secret: 'test-secret-key-with-sufficient-length-for-security',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            issuer: 'mcp-hub',
          },
          security: {
            maxLoginAttempts: 5,
            lockoutDuration: 900000,
            passwordMinLength: 6,
            requireStrongPassword: false,
          },
        },
        users: {
          admin: {
            id: 'admin',
            username: 'admin',
            password: 'admin123',
            passwordHash: 'hash',
            role: 'admin',
            groups: ['default'],
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        },
        ui: {
          title: 'MCP Hub',
          theme: 'light',
          features: {
            apiToMcp: true,
            debugging: true,
            monitoring: true,
          },
        },
        monitoring: {
          metricsEnabled: true,
          logLevel: 'info',
          retentionDays: 30,
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig, systemConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mcpConfig).toBeDefined();
        expect(result.data.groupConfig).toBeDefined();
        expect(result.data.systemConfig).toBeDefined();
      }
    });

    it('应该在任何配置无效时返回错误', () => {
      const mcpConfig = {
        mcpServers: {}, // 无效：空服务器配置
      };

      const groupConfig = {
        default: {
          id: 'default',
          name: 'Default',
          servers: ['server1'],
          tools: [],
        },
      };

      const result = validateAllConfigs(mcpConfig, groupConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((err) => err.includes('MCP配置错误'))).toBe(
          true,
        );
      }
    });
  });
});
