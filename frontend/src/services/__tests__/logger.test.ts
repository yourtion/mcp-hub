/**
 * 测试前端日志系统
 */

import { describe, expect, it } from 'vitest';
import {
  createFrontendLogger,
  EnvironmentDetector,
  FrontendLogger,
  LogLevel,
} from '../../../../packages/share/src/frontend-logger';

describe('FrontendLogger Integration', () => {
  it('应该能够创建和使用前端日志记录器', () => {
    const logger = createFrontendLogger({
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableColors: false,
      enableTimestamp: false,
    });

    expect(logger).toBeInstanceOf(FrontendLogger);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);

    // 测试日志记录功能
    logger.debug('测试调试消息');
    logger.info('测试信息消息');
    logger.warn('测试警告消息');
    logger.error('测试错误消息');

    // 测试应该不会抛出异常
    expect(true).toBe(true);
  });

  it('应该正确检测环境', () => {
    // 在测试环境中应该返回适当的值
    const isTestEnv = EnvironmentDetector.isTestEnvironment();
    expect(typeof isTestEnv).toBe('boolean');

    const isDebug = EnvironmentDetector.isDebugMode();
    expect(typeof isDebug).toBe('boolean');
  });
});
