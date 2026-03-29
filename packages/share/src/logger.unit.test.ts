/**
 * Logger 单元测试
 * 测试核心日志功能
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLogger,
  EnvironmentDetector,
  JsonFormatter,
  LOG_LEVEL_NAMES,
  LogLevel,
  TextFormatter,
} from './logger.js';

describe('LogLevel', () => {
  it('应该有正确的级别值', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
    expect(LogLevel.FATAL).toBe(4);
  });

  it('应该有正确的级别名称映射', () => {
    expect(LOG_LEVEL_NAMES[LogLevel.DEBUG]).toBe('DEBUG');
    expect(LOG_LEVEL_NAMES[LogLevel.INFO]).toBe('INFO');
    expect(LOG_LEVEL_NAMES[LogLevel.WARN]).toBe('WARN');
    expect(LOG_LEVEL_NAMES[LogLevel.ERROR]).toBe('ERROR');
    expect(LOG_LEVEL_NAMES[LogLevel.FATAL]).toBe('FATAL');
  });
});

describe('EnvironmentDetector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 恢复环境变量
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
    delete process.env.LOG_LEVEL;
    delete process.env.VITEST_DEBUG;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    // 清理环境变量
    delete process.env.NODE_ENV;
    delete process.env.VITEST;
    delete process.env.LOG_LEVEL;
    delete process.env.VITEST_DEBUG;
    delete process.env.DEBUG;
  });

  it('应该检测测试环境', () => {
    process.env.NODE_ENV = 'test';
    expect(EnvironmentDetector.isTestEnvironment()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(EnvironmentDetector.isTestEnvironment()).toBe(false);
  });

  it('应该检测 VITEST 环境变量', () => {
    delete process.env.NODE_ENV;
    process.env.VITEST = 'true';
    expect(EnvironmentDetector.isTestEnvironment()).toBe(true);
  });

  it('应该检测调试模式', () => {
    process.env.VITEST_DEBUG = 'true';
    expect(EnvironmentDetector.isDebugMode()).toBe(true);

    delete process.env.VITEST_DEBUG;
    process.env.DEBUG = 'true';
    expect(EnvironmentDetector.isDebugMode()).toBe(true);
  });

  it('应该从环境变量获取日志级别', () => {
    process.env.LOG_LEVEL = 'DEBUG';
    expect(EnvironmentDetector.getEnvironmentLogLevel()).toBe(LogLevel.DEBUG);

    process.env.LOG_LEVEL = 'INFO';
    expect(EnvironmentDetector.getEnvironmentLogLevel()).toBe(LogLevel.INFO);
  });

  it('应该在测试环境中默认使用 WARN 级别', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;

    expect(EnvironmentDetector.getEnvironmentLogLevel()).toBe(LogLevel.WARN);
  });

  it('应该在测试调试模式下启用控制台', () => {
    process.env.NODE_ENV = 'test';
    process.env.VITEST_DEBUG = 'true';

    expect(EnvironmentDetector.getEnvironmentConsoleEnabled()).toBe(true);
  });

  it('应该在测试环境中默认禁用控制台', () => {
    process.env.NODE_ENV = 'test';

    expect(EnvironmentDetector.getEnvironmentConsoleEnabled()).toBe(false);
  });
});

describe('JsonFormatter', () => {
  it('应该格式化日志条目为 JSON', () => {
    const formatter = new JsonFormatter();
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'Test message',
      component: 'TestComponent',
    };

    const result = formatter.format(entry);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual(entry);
  });

  it('应该处理包含错误的日志条目', () => {
    const formatter = new JsonFormatter();
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.ERROR,
      levelName: 'ERROR',
      message: 'Test error',
      error: {
        name: 'Error',
        message: 'Test error message',
        stack: 'Error: Test error message\n    at test.ts:1:1',
      },
    };

    const result = formatter.format(entry);
    const parsed = JSON.parse(result);

    expect(parsed.error).toBeDefined();
    expect(parsed.error.message).toBe('Test error message');
  });
});

describe('TextFormatter', () => {
  it('应该格式化日志条目为文本', () => {
    const formatter = new TextFormatter(true, true);
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'Test message',
    };

    const result = formatter.format(entry);

    expect(result).toContain('INFO');
    expect(result).toContain('Test message');
    expect(result).toContain('2024-01-01');
  });

  it('应该包含组件信息', () => {
    const formatter = new TextFormatter(true, true);
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'Test message',
      component: 'TestComponent',
    };

    const result = formatter.format(entry);

    expect(result).toContain('[TestComponent]');
  });

  it('应该包含持续时间', () => {
    const formatter = new TextFormatter(true, true);
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'Test message',
      duration: 1234,
    };

    const result = formatter.format(entry);

    expect(result).toContain('(1234ms)');
  });

  it('应该禁用颜色和时间戳', () => {
    const formatter = new TextFormatter(false, false);
    const entry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'Test message',
    };

    const result = formatter.format(entry);

    // 不应包含 ANSI 颜色代码
    expect(result).not.toContain('\x1b[');
    // 不应包含时间戳（被禁用）
    expect(result).not.toContain('2024-01-01');
  });
});

describe('createLogger', () => {
  it('应该创建带组件名的 logger', () => {
    const logger = createLogger('TestComponent');

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('应该创建带自定义配置的 logger', () => {
    const logger = createLogger({
      level: LogLevel.DEBUG,
      enableConsole: false,
      component: 'TestComponent',
    });

    expect(logger).toBeDefined();
  });

  it('应该支持不同日志级别的方法', () => {
    const logger = createLogger('Test', {
      level: LogLevel.DEBUG,
      enableConsole: false,
    });

    // 这些方法不应该抛出错误
    expect(() => logger.debug('Debug')).not.toThrow();
    expect(() => logger.info('Info')).not.toThrow();
    expect(() => logger.warn('Warn')).not.toThrow();
    expect(() => logger.error('Error')).not.toThrow();
  });

  it('应该支持上下文对象', () => {
    const logger = createLogger('Test', {
      level: LogLevel.INFO,
      enableConsole: false,
    });

    // 不应该抛出错误
    expect(() =>
      logger.info('Test message', { userId: '123', action: 'test' }),
    ).not.toThrow();
  });
});
