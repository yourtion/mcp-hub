import { beforeEach, describe, expect, it } from 'vitest';
import type { McpServerConfig, ServerConfig } from '../types';
import { ConfigValidator } from './validator';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateMcpServerConfig', () => {
    it('应该验证有效的MCP服务器配置', () => {
      const validConfig: McpServerConfig = {
        servers: {
          test_server: {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = validator.validateMcpServerConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝没有服务器的配置', () => {
      const invalidConfig: McpServerConfig = {
        servers: {},
      };

      const result = validator.validateMcpServerConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('配置中必须包含至少一个服务器');
    });

    it('应该拒绝缺少servers字段的配置', () => {
      const invalidConfig = {} as McpServerConfig;

      const result = validator.validateMcpServerConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('配置中必须包含至少一个服务器');
    });

    it('应该验证包含多个服务器的配置', () => {
      const validConfig: McpServerConfig = {
        servers: {
          server1: {
            command: 'node',
            args: ['server1.js'],
          },
          server2: {
            command: 'python',
            args: ['-m', 'server2'],
          },
        },
      };

      const result = validator.validateMcpServerConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该返回警告信息（如果有）', () => {
      const validConfig: McpServerConfig = {
        servers: {
          test_server: {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = validator.validateMcpServerConfig(validConfig);

      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('validateServerConfig', () => {
    it('应该验证有效的服务器配置', () => {
      const validConfig: ServerConfig = {
        command: 'node',
        args: ['server.js'],
      };

      const result = validator.validateServerConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺少command字段的配置', () => {
      const invalidConfig = {
        args: ['server.js'],
      } as ServerConfig;

      const result = validator.validateServerConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('服务器配置必须包含command字段');
    });

    it('应该拒绝command为空字符串的配置', () => {
      const invalidConfig: ServerConfig = {
        command: '',
        args: ['server.js'],
      };

      const result = validator.validateServerConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('服务器配置必须包含command字段');
    });

    it('应该验证包含环境变量的配置', () => {
      const validConfig: ServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: {
          NODE_ENV: 'production',
          DEBUG: 'true',
        },
      };

      const result = validator.validateServerConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证包含disabled字段的配置', () => {
      const validConfig: ServerConfig = {
        command: 'node',
        args: ['server.js'],
        disabled: true,
      };

      const result = validator.validateServerConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该返回警告信息（如果有）', () => {
      const validConfig: ServerConfig = {
        command: 'node',
        args: ['server.js'],
      };

      const result = validator.validateServerConfig(validConfig);

      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
