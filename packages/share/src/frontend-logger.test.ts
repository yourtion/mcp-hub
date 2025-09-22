/**
 * 前端日志系统测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFrontendLogger,
  EnvironmentDetector,
  FrontendLogger,
  LogLevel,
} from './frontend-logger';

describe('FrontendLogger', () => {
  let logger: FrontendLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger = new FrontendLogger({
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamp: false,
      enableConsole: true,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('应该记录不同级别的日志', () => {
    logger.debug('调试消息');
    logger.info('信息消息');
    logger.warn('警告消息');
    logger.error('错误消息');
    logger.fatal('致命错误消息');

    expect(consoleSpy).toHaveBeenCalledTimes(5);
  });

  it('应该根据日志级别过滤消息', () => {
    logger.setLevel(LogLevel.WARN);

    logger.debug('调试消息');
    logger.info('信息消息');
    logger.warn('警告消息');
    logger.error('错误消息');

    expect(consoleSpy).toHaveBeenCalledTimes(2); // 只有 WARN 和 ERROR
  });

  it('应该正确记录带上下文的日志', () => {
    logger.info('测试消息', {
      component: 'TestComponent',
      serverId: 'server1',
      context: { key: 'value' },
    });

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('应该正确记录错误信息', () => {
    const error = new Error('测试错误');
    logger.error('操作失败', error, { component: 'TestComponent' });

    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('EnvironmentDetector', () => {
  it('应该检测测试环境', () => {
    // 在 Vitest 环境中应该返回 true
    expect(EnvironmentDetector.isTestEnvironment()).toBe(true);
  });

  it('应该检测调试模式', () => {
    // 在正常测试环境中应该返回 false
    expect(EnvironmentDetector.isDebugMode()).toBe(false);
  });

  it('应该在测试环境中返回 WARN 级别', () => {
    const level = EnvironmentDetector.getEnvironmentLogLevel();
    expect(level).toBe(LogLevel.WARN);
  });

  it('应该在调试模式下返回 DEBUG 级别', () => {
    // 模拟调试模式，同时确保不是测试环境
    const originalProcess = global.process;
    global.process = {
      ...global.process,
      env: {
        ...global.process?.env,
        VITEST_DEBUG: 'true',
        NODE_ENV: 'development', // 不是测试环境
      },
    } as any;

    const level = EnvironmentDetector.getEnvironmentLogLevel();
    expect(level).toBe(LogLevel.DEBUG);

    // 恢复原始状态
    global.process = originalProcess;
  });
});

describe('createFrontendLogger', () => {
  it('应该创建前端日志记录器', () => {
    const logger = createFrontendLogger();
    expect(logger).toBeInstanceOf(FrontendLogger);
  });

  it('应该使用自定义配置创建日志记录器', () => {
    const logger = createFrontendLogger({
      level: LogLevel.DEBUG,
      format: 'json',
    });

    expect(logger).toBeInstanceOf(FrontendLogger);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });
});
