import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  GroupConfig,
  McpConfig,
  SystemConfig,
} from '@mcp-core/mcp-hub-share';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './config_service.js';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('../utils/config.js');

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockFs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new ConfigService();
    mockFs = vi.mocked(fs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentConfig', () => {
    it('应该成功获取当前配置', async () => {
      const mockConfig = {
        system: {
          server: { port: 3000, host: 'localhost' },
          auth: {
            jwt: {
              secret: 'test-secret-key-with-sufficient-length',
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
        } as SystemConfig,
        mcps: { mcpServers: {} } as McpConfig,
        groups: {} as GroupConfig,
      };

      // Mock getAllConfig
      const { getAllConfig } = await import('../utils/config.js');
      vi.mocked(getAllConfig).mockResolvedValue(mockConfig);

      const result = await configService.getCurrentConfig();

      expect(result).toEqual(mockConfig);
    });
  });

  describe('validateConfig', () => {
    it('应该成功验证有效的系统配置', async () => {
      const validSystemConfig = {
        server: { port: 3000, host: 'localhost' },
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

      const result = await configService.validateConfig(
        'system',
        validSystemConfig,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测到无效的系统配置', async () => {
      const invalidSystemConfig = {
        server: { port: -1, host: '' },
        auth: {
          jwt: {
            secret: 'short', // 太短的密钥
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            issuer: 'mcp-hub',
          },
          security: {
            maxLoginAttempts: 0, // 无效值
            lockoutDuration: -1, // 无效值
            passwordMinLength: 1, // 太短
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
          retentionDays: 0, // 无效值
        },
      };

      const result = await configService.validateConfig(
        'system',
        invalidSystemConfig,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 检查是否包含JWT密钥长度错误
      const jwtSecretError = result.errors.find(
        (error) =>
          error.path === 'auth.jwt.secret' &&
          error.code === 'JWT_SECRET_TOO_SHORT',
      );
      expect(jwtSecretError).toBeDefined();
    });

    it('应该成功验证有效的MCP配置', async () => {
      const validMcpConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            env: { NODE_ENV: 'production' },
            transport: {
              type: 'stdio' as const,
            },
          },
        },
      };

      const result = await configService.validateConfig('mcp', validMcpConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测到无效的MCP配置', async () => {
      const invalidMcpConfig = {
        mcpServers: {
          'invalid-server': {
            command: '', // 空命令
            transport: {
              type: 'sse' as const,
              // 缺少必需的URL
            },
          },
        },
      };

      const result = await configService.validateConfig(
        'mcp',
        invalidMcpConfig,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 检查是否包含命令为空的错误
      const commandError = result.errors.find(
        (error) =>
          error.path.includes('command') && error.code === 'MISSING_COMMAND',
      );
      expect(commandError).toBeDefined();

      // 检查是否包含SSE URL缺失的错误
      const sseUrlError = result.errors.find(
        (error) =>
          error.path.includes('url') && error.code === 'MISSING_SSE_URL',
      );
      expect(sseUrlError).toBeDefined();
    });

    it('应该成功验证有效的组配置', async () => {
      // Mock getCurrentConfig for group validation
      const mockCurrentConfig = {
        system: {} as SystemConfig,
        mcps: {
          mcpServers: {
            server1: { command: 'test' },
            server2: { command: 'test' },
          },
        } as McpConfig,
        groups: {} as GroupConfig,
      };

      const { getAllConfig } = await import('../utils/config.js');
      vi.mocked(getAllConfig).mockResolvedValue(mockCurrentConfig);

      const validGroupConfig = {
        'test-group': {
          id: 'test-group',
          name: '测试组',
          description: '测试组描述',
          servers: ['server1', 'server2'],
          tools: ['tool1', 'tool2'],
          validation: {
            enabled: true,
            validationKey: 'test-key-123',
          },
        },
      };

      const result = await configService.validateConfig(
        'groups',
        validGroupConfig,
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测到无效的组配置', async () => {
      // Mock getCurrentConfig for group validation
      const mockCurrentConfig = {
        system: {} as SystemConfig,
        mcps: {
          mcpServers: {
            server1: { command: 'test' },
          },
        } as McpConfig,
        groups: {} as GroupConfig,
      };

      const { getAllConfig } = await import('../utils/config.js');
      vi.mocked(getAllConfig).mockResolvedValue(mockCurrentConfig);

      const invalidGroupConfig = {
        'invalid-group': {
          id: 'invalid-group',
          name: '无效组',
          servers: ['nonexistent-server'], // 不存在的服务器
          tools: [],
          validation: {
            enabled: true,
            // 缺少验证密钥
          },
        },
      };

      const result = await configService.validateConfig(
        'groups',
        invalidGroupConfig,
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 检查是否包含验证密钥缺失的错误
      const validationKeyError = result.errors.find(
        (error) =>
          error.path.includes('validationKey') &&
          error.code === 'MISSING_VALIDATION_KEY',
      );
      expect(validationKeyError).toBeDefined();

      // 检查是否包含服务器不存在的警告
      expect(result.warnings.length).toBeGreaterThan(0);
      const serverNotFoundWarning = result.warnings.find(
        (warning) => warning.code === 'SERVER_NOT_FOUND',
      );
      expect(serverNotFoundWarning).toBeDefined();
    });
  });

  describe('analyzeConfigImpact', () => {
    it('应该正确分析系统配置的影响', async () => {
      const systemConfig = {
        server: { port: 3001, host: 'localhost' },
      };

      const result = await configService.analyzeConfigImpact(
        'system',
        systemConfig,
      );

      expect(result.affectedServices).toContain('认证服务');
      expect(result.affectedServices).toContain('Web服务器');
      expect(result.requiresRestart).toBe(true);
      expect(result.recommendations).toContain(
        '建议在维护窗口期间进行系统配置更新',
      );
    });

    it('应该正确分析MCP配置的影响', async () => {
      const mcpConfig = {
        mcpServers: {
          'new-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = await configService.analyzeConfigImpact('mcp', mcpConfig);

      expect(result.affectedServices).toContain('MCP服务管理器');
      expect(result.requiresRestart).toBe(false);
      expect(result.recommendations).toContain(
        'MCP服务器配置更改将在下次连接时生效',
      );
    });

    it('应该正确分析组配置的影响', async () => {
      const groupConfig = {
        'test-group': {
          id: 'test-group',
          name: '测试组',
          servers: ['server1'],
          tools: ['tool1'],
        },
      };

      const result = await configService.analyzeConfigImpact(
        'groups',
        groupConfig,
      );

      expect(result.affectedServices).toContain('组管理器');
      expect(result.requiresRestart).toBe(false);
      expect(result.recommendations).toContain('组配置更改将立即生效');
    });
  });

  describe('createBackup', () => {
    it('应该成功创建配置备份', async () => {
      // Mock getCurrentConfig
      const mockConfig = {
        system: { server: { port: 3000, host: 'localhost' } } as SystemConfig,
        mcps: { mcpServers: {} } as McpConfig,
        groups: {} as GroupConfig,
      };

      const { getAllConfig } = await import('../utils/config.js');
      vi.mocked(getAllConfig).mockResolvedValue(mockConfig);

      // Mock fs operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const backupId = await configService.createBackup('测试备份', [
        'system',
        'mcp',
      ]);

      expect(backupId).toBeDefined();
      expect(typeof backupId).toBe('string');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getLastUpdatedTime', () => {
    it('应该返回最新的配置文件修改时间', async () => {
      const mockStats = {
        mtime: new Date('2024-01-01T12:00:00.000Z'),
      };

      mockFs.stat.mockResolvedValue(mockStats);

      const result = await configService.getLastUpdatedTime();

      expect(result).toBe('2024-01-01T12:00:00.000Z');
    });

    it('应该处理文件不存在的情况', async () => {
      mockFs.stat.mockRejectedValue(new Error('文件不存在'));

      const result = await configService.getLastUpdatedTime();

      // 应该返回当前时间的ISO字符串
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('getConfigVersion', () => {
    it('应该基于最后更新时间生成版本号', async () => {
      const mockStats = {
        mtime: new Date('2024-01-01T12:00:00.000Z'),
      };

      mockFs.stat.mockResolvedValue(mockStats);

      const version = await configService.getConfigVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version).toHaveLength(8); // MD5 hash的前8位
    });
  });

  describe('testConfig', () => {
    it('应该成功测试有效的系统配置', async () => {
      const validSystemConfig = {
        server: { port: 3000, host: 'localhost' },
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
            password: 'admin',
            passwordHash: 'hash',
            role: 'admin',
            groups: [],
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

      const result = await configService.testConfig(
        'system',
        validSystemConfig,
      );

      expect(result.success).toBe(true);
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);

      // 检查是否包含模式验证测试
      const schemaTest = result.tests.find(
        (test: any) => test.name === 'schema_validation',
      );
      expect(schemaTest).toBeDefined();
      expect(schemaTest?.status).toBe('passed');
    });

    it('应该检测到系统配置中的问题', async () => {
      const invalidSystemConfig = {
        server: { port: -1, host: '' },
        auth: {
          jwt: {
            secret: 'short',
            expiresIn: '15m',
            refreshExpiresIn: '7d',
            issuer: 'mcp-hub',
          },
          security: {
            maxLoginAttempts: 0,
            lockoutDuration: -1,
            passwordMinLength: 1,
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
          retentionDays: 0,
        },
      };

      const result = await configService.testConfig(
        'system',
        invalidSystemConfig,
      );

      expect(result.success).toBe(false);
      expect(result.summary.failed).toBeGreaterThan(0);

      // 检查是否包含模式验证失败
      const schemaTest = result.tests.find(
        (test: any) => test.name === 'schema_validation',
      );
      expect(schemaTest).toBeDefined();
      expect(schemaTest?.status).toBe('failed');
    });

    it('应该测试MCP配置', async () => {
      const mcpConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            env: { NODE_ENV: 'test' },
            transport: {
              type: 'stdio' as const,
            },
          },
        },
      };

      const result = await configService.testConfig('mcp', mcpConfig);

      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);

      // 检查是否包含服务器配置测试
      const serverTests = result.tests.filter((test: any) =>
        test.name.includes('server_test-server'),
      );
      expect(serverTests.length).toBeGreaterThan(0);
    });
  });

  describe('previewConfigChanges', () => {
    it('应该成功预览配置更改', async () => {
      const mockCurrentConfig = {
        system: {
          server: { port: 3000, host: 'localhost' },
        } as SystemConfig,
        mcps: { mcpServers: {} } as McpConfig,
        groups: {} as GroupConfig,
      };

      const { getAllConfig } = await import('../utils/config.js');
      vi.mocked(getAllConfig).mockResolvedValue(mockCurrentConfig);

      const newConfig = {
        server: { port: 3001, host: 'localhost' },
      };

      const result = await configService.previewConfigChanges(
        'system',
        newConfig,
      );

      expect(result).toBeDefined();
      expect(result.changes).toBeDefined();
      expect(result.affectedServices).toBeDefined();
      expect(result.rollbackPlan).toBeDefined();
      expect(result.rollbackPlan.length).toBeGreaterThan(0);
    });
  });
});
