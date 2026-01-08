/**
 * Config 类型单元测试
 * 测试配置类型的结构和验证
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Group,
  GroupConfig,
  McpConfig,
  SystemConfig,
} from './config.js';

describe('Config Types', () => {
  describe('McpConfig', () => {
    it('应该创建有效的 MCP 配置', () => {
      const config: McpConfig = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            enabled: true,
          },
        },
      };

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers['test-server']).toBeDefined();
      expect(config.mcpServers['test-server'].command).toBe('node');
    });

    it('应该支持多个服务器', () => {
      const config: McpConfig = {
        mcpServers: {
          server1: {
            type: 'stdio',
            command: 'node',
            args: ['server1.js'],
            enabled: true,
          },
          server2: {
            type: 'sse',
            url: 'http://localhost:8080/sse',
            enabled: true,
          },
        },
      };

      expect(Object.keys(config.mcpServers)).toHaveLength(2);
    });

    it('应该支持禁用服务器', () => {
      const config: McpConfig = {
        mcpServers: {
          'disabled-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            disabled: true,
          },
        },
      };

      expect(config.mcpServers['disabled-server'].disabled).toBe(true);
    });
  });

  describe('Group', () => {
    it('应该创建有效的组', () => {
      const group: Group = {
        id: 'test-group-1',
        name: 'Test Group',
        description: 'A test group',
        servers: ['server1', 'server2'],
        tools: ['tool1', 'tool2'],
      };

      expect(group.id).toBe('test-group-1');
      expect(group.name).toBe('Test Group');
      expect(group.servers).toEqual(['server1', 'server2']);
      expect(group.tools).toEqual(['tool1', 'tool2']);
    });

    it('应该支持验证配置', () => {
      const group: Group = {
        id: 'test-group',
        name: 'Test Group',
        servers: [],
        tools: [],
        validation: {
          enabled: true,
          validationKey: 'test-key',
          createdAt: '2024-01-01T00:00:00Z',
          lastUpdated: '2024-01-01T00:00:00Z',
        },
      };

      expect(group.validation).toBeDefined();
      expect(group.validation?.enabled).toBe(true);
      expect(group.validation?.validationKey).toBe('test-key');
    });

    it('应该允许可选字段', () => {
      const group: Group = {
        id: 'minimal-group',
        name: 'Minimal Group',
        servers: [],
        tools: [],
      };

      expect(group.description).toBeUndefined();
      expect(group.validation).toBeUndefined();
    });
  });

  describe('GroupConfig', () => {
    it('应该创建有效的组配置', () => {
      const groupConfig: GroupConfig = {
        'group-1': {
          id: 'group-1',
          name: 'Group 1',
          servers: ['server1'],
          tools: [],
        },
        'group-2': {
          id: 'group-2',
          name: 'Group 2',
          servers: ['server2'],
          tools: [],
        },
      };

      expect(Object.keys(groupConfig)).toHaveLength(2);
      expect(groupConfig['group-1']).toBeDefined();
      expect(groupConfig['group-2']).toBeDefined();
    });
  });

  describe('SystemConfig', () => {
    it('应该创建有效的系统配置', () => {
      const config: SystemConfig = {
        server: {
          port: 3000,
          host: 'localhost',
        },
        auth: {
          jwt: {
            secret: 'test-secret',
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
        users: {},
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

      expect(config.server.port).toBe(3000);
      expect(config.auth.jwt.secret).toBe('test-secret');
      expect(config.ui.title).toBe('MCP Hub');
      expect(config.monitoring.metricsEnabled).toBe(true);
    });

    it('应该支持用户配置', () => {
      const config: SystemConfig = {
        server: {
          port: 3000,
          host: 'localhost',
        },
        auth: {
          jwt: {
            secret: 'secret',
            expiresIn: '1h',
            refreshExpiresIn: '7d',
            issuer: 'test',
          },
          security: {
            maxLoginAttempts: 3,
            lockoutDuration: 300000,
            passwordMinLength: 8,
            requireStrongPassword: true,
          },
        },
        users: {
          admin: {
            id: '1',
            username: 'admin',
            password: 'password',
            passwordHash: 'hash',
            role: 'admin',
            groups: ['group1'],
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
        ui: {
          title: 'Test',
          theme: 'dark',
          features: {
            apiToMcp: false,
            debugging: false,
            monitoring: false,
          },
        },
        monitoring: {
          metricsEnabled: false,
          logLevel: 'warn',
          retentionDays: 7,
        },
      };

      expect(config.users.admin).toBeDefined();
      expect(config.users.admin.username).toBe('admin');
      expect(config.users.admin.role).toBe('admin');
    });

    it('应该支持不同的 UI 主题', () => {
      const config: SystemConfig = {
        server: { port: 3000, host: 'localhost' },
        auth: {
          jwt: {
            secret: 's',
            expiresIn: '1h',
            refreshExpiresIn: '7d',
            issuer: 't',
          },
          security: {
            maxLoginAttempts: 5,
            lockoutDuration: 900000,
            passwordMinLength: 6,
            requireStrongPassword: false,
          },
        },
        users: {},
        ui: {
          title: 'Test',
          theme: 'dark',
          features: {
            apiToMcp: true,
            debugging: true,
            monitoring: true,
          },
        },
        monitoring: {
          metricsEnabled: true,
          logLevel: 'debug',
          retentionDays: 90,
        },
      };

      expect(config.ui.theme).toBe('dark');
    });
  });

  describe('类型别名', () => {
    it('应该支持 GroupInfo 别名', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group: any = {
        id: 'test',
        name: 'Test',
        servers: [],
        tools: [],
      };

      // GroupInfo 是 Group 的别名
      const groupInfo: Group = group;

      expect(groupInfo).toEqual(group);
    });
  });
});
