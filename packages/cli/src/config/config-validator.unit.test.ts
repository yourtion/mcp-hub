import { beforeEach, describe, expect, it } from 'vitest';
import type { CliConfig } from '../types';
import { ConfigValidator } from './config-validator';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateConfig', () => {
    it('应该验证有效的基础配置', () => {
      const validConfig: CliConfig = {
        servers: {
          test_server: {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = validator.validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝null配置', () => {
      const result = validator.validateConfig(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: [],
        message: '配置不能为空',
        code: 'CONFIG_NULL',
        severity: 'error',
      });
    });

    it('应该拒绝非对象配置', () => {
      const result = validator.validateConfig('invalid config');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: [],
        message: '配置必须是对象',
        code: 'CONFIG_NOT_OBJECT',
        severity: 'error',
      });
    });

    it('应该拒绝缺少servers字段的配置', () => {
      const result = validator.validateConfig({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers'],
        message: '缺少必需字段: servers',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
      });
    });

    it('应该处理验证异常', () => {
      // 创建一个会导致验证异常的配置
      const invalidConfig = {
        get servers() {
          throw new Error('测试异常');
        },
      };

      const result = validator.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('配置验证失败');
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
    });
  });

  describe('服务器配置验证', () => {
    it('应该拒绝空的servers对象', () => {
      const config = { servers: {} };
      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers'],
        message: '至少需要配置一个服务器',
        code: 'NO_SERVERS',
        severity: 'error',
      });
    });

    it('应该拒绝非对象的servers', () => {
      const config = { servers: 'invalid' };
      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers'],
        message: 'servers 必须是对象',
        code: 'SERVERS_NOT_OBJECT',
        severity: 'error',
      });
    });

    it('应该警告所有服务器都被禁用', () => {
      const config: CliConfig = {
        servers: {
          server1: { command: 'node', args: [], disabled: true },
          server2: { command: 'python', args: [], disabled: true },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual({
        path: ['servers'],
        message: '所有服务器都被禁用',
        suggestion: '至少启用一个服务器以确保CLI正常工作',
      });
    });
  });

  describe('单个服务器配置验证', () => {
    it('应该拒绝非对象的服务器配置', () => {
      const config = { servers: { test: 'invalid' } };
      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test'],
        message: '服务器配置必须是对象',
        code: 'SERVER_CONFIG_NOT_OBJECT',
        severity: 'error',
      });
    });

    it('应该拒绝空的command', () => {
      const config = {
        servers: {
          test: { command: '', args: [] },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test', 'command'],
        message: '服务器命令不能为空',
        code: 'EMPTY_COMMAND',
        severity: 'error',
      });
    });

    it('应该拒绝非字符串的command', () => {
      const config = {
        servers: {
          test: { command: 123, args: [] },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test', 'command'],
        message: '服务器命令不能为空',
        code: 'EMPTY_COMMAND',
        severity: 'error',
      });
    });

    it('应该拒绝非数组的args', () => {
      const config = {
        servers: {
          test: { command: 'node', args: 'invalid' },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test', 'args'],
        message: 'args 必须是字符串数组',
        code: 'INVALID_ARGS_TYPE',
        severity: 'error',
      });
    });

    it('应该拒绝非对象的env', () => {
      const config = {
        servers: {
          test: { command: 'node', env: 'invalid' },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test', 'env'],
        message: 'env 必须是对象',
        code: 'INVALID_ENV_TYPE',
        severity: 'error',
      });
    });

    it('应该拒绝无效的timeout', () => {
      const config = {
        servers: {
          test: { command: 'node', timeout: -1 },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['servers', 'test', 'timeout'],
        message: 'timeout 必须是正数',
        code: 'INVALID_TIMEOUT',
        severity: 'error',
      });
    });

    it('应该警告过短的timeout', () => {
      const config: CliConfig = {
        servers: {
          test: { command: 'node', timeout: 1000 },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual({
        path: ['servers', 'test', 'timeout'],
        message: '超时时间可能过短',
        suggestion: '建议设置至少5秒的超时时间',
      });
    });

    it('应该警告过长的timeout', () => {
      const config: CliConfig = {
        servers: {
          test: { command: 'node', timeout: 400000 },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual({
        path: ['servers', 'test', 'timeout'],
        message: '超时时间可能过长',
        suggestion: '超过5分钟的超时时间可能不合理',
      });
    });
  });

  describe('日志配置验证', () => {
    it('应该接受空的logging配置', () => {
      const config: CliConfig = {
        servers: { test: { command: 'node' } },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝非对象的logging', () => {
      const config = {
        servers: { test: { command: 'node' } },
        logging: 'invalid',
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['logging'],
        message: 'logging 必须是对象',
        code: 'LOGGING_NOT_OBJECT',
        severity: 'error',
      });
    });

    it('应该拒绝无效的日志级别', () => {
      const config = {
        servers: { test: { command: 'node' } },
        logging: { level: 'invalid' },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['logging', 'level'],
        message: '无效的日志级别: invalid',
        code: 'INVALID_LOG_LEVEL',
        severity: 'error',
      });
    });

    it('应该接受有效的日志级别', () => {
      const validLevels = ['debug', 'info', 'warn', 'error'];

      for (const level of validLevels) {
        const config: CliConfig = {
          servers: { test: { command: 'node' } },
          logging: { level: level as any },
        };

        const result = validator.validateConfig(config);
        expect(result.valid).toBe(true);
      }
    });

    it('应该拒绝非字符串的日志文件路径', () => {
      const config = {
        servers: { test: { command: 'node' } },
        logging: { file: 123 },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['logging', 'file'],
        message: '日志文件路径必须是字符串',
        code: 'INVALID_LOG_FILE_TYPE',
        severity: 'error',
      });
    });
  });

  describe('传输配置验证', () => {
    it('应该接受空的transport配置', () => {
      const config: CliConfig = {
        servers: { test: { command: 'node' } },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
    });

    it('应该拒绝非对象的transport', () => {
      const config = {
        servers: { test: { command: 'node' } },
        transport: 'invalid',
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['transport'],
        message: 'transport 必须是对象',
        code: 'TRANSPORT_NOT_OBJECT',
        severity: 'error',
      });
    });

    it('应该拒绝不支持的传输类型', () => {
      const config = {
        servers: { test: { command: 'node' } },
        transport: { type: 'websocket' },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: ['transport', 'type'],
        message: '不支持的传输类型: websocket',
        code: 'UNSUPPORTED_TRANSPORT_TYPE',
        severity: 'error',
      });
    });

    it('应该接受stdio传输类型', () => {
      const config: CliConfig = {
        servers: { test: { command: 'node' } },
        transport: { type: 'stdio' },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('业务逻辑验证', () => {
    it('应该警告无效的服务器ID命名', () => {
      const config: CliConfig = {
        servers: {
          '123invalid': { command: 'node' },
          'invalid-name!': { command: 'python' },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some(
          (w) =>
            w.path.includes('123invalid') &&
            w.message.includes('服务器ID建议使用字母开头'),
        ),
      ).toBe(true);
    });

    it('应该警告重复的服务器命令', () => {
      const config: CliConfig = {
        servers: {
          server1: { command: 'node', args: ['app.js'] },
          server2: { command: 'node', args: ['app.js'] },
        },
      };

      const result = validator.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) =>
          w.message.includes('检测到重复的服务器命令'),
        ),
      ).toBe(true);
    });
  });

  describe('工具方法', () => {
    it('应该创建验证错误', () => {
      const error = validator.createValidationError('测试错误', { test: true });

      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('INVALID_CONFIG_FORMAT');
      expect(error.details).toEqual({ test: true });
    });

    it('应该格式化验证结果', () => {
      const result = {
        valid: false,
        errors: [
          {
            path: ['servers', 'test'],
            message: '测试错误',
            code: 'TEST_ERROR',
            severity: 'error' as const,
          },
        ],
        warnings: [
          {
            path: ['logging'],
            message: '测试警告',
            suggestion: '测试建议',
          },
        ],
      };

      const formatted = validator.formatValidationResult(result);

      expect(formatted).toContain('❌ 配置验证失败');
      expect(formatted).toContain('错误:');
      expect(formatted).toContain('[servers.test] 测试错误');
      expect(formatted).toContain('警告:');
      expect(formatted).toContain('[logging] 测试警告');
      expect(formatted).toContain('建议: 测试建议');
    });

    it('应该格式化成功的验证结果', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const formatted = validator.formatValidationResult(result);

      expect(formatted).toContain('✅ 配置验证通过');
    });
  });
});
