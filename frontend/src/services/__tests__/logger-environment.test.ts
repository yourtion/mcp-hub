/**
 * 测试前端日志系统在不同环境下的行为
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FrontendLogger,
  LogLevel,
} from '../../../../packages/share/src/frontend-logger';

describe('FrontendLogger Environment Behavior', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    // 清理可能的 localStorage 设置
    try {
      localStorage.clear();
    } catch {
      // Ignore errors
    }
  });

  it('应该根据日志级别过滤消息', () => {
    const logger = new FrontendLogger({
      level: LogLevel.WARN,
      enableConsole: true,
      enableColors: false,
      enableTimestamp: false,
    });

    logger.debug('调试消息');
    logger.info('信息消息');
    logger.warn('警告消息');
    logger.error('错误消息');

    // 只有 WARN 和 ERROR 级别的消息应该被记录
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('应该在不同格式下正确工作', () => {
    const jsonLogger = new FrontendLogger({
      level: LogLevel.INFO,
      format: 'json',
      enableConsole: true,
      enableColors: false,
      enableTimestamp: false,
    });

    const textLogger = new FrontendLogger({
      level: LogLevel.INFO,
      format: 'text',
      enableConsole: true,
      enableColors: false,
      enableTimestamp: false,
    });

    jsonLogger.info('JSON格式消息');
    textLogger.info('文本格式消息');

    // 两种格式都应该记录消息
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('应该正确处理错误日志', () => {
    const logger = new FrontendLogger({
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableColors: false,
      enableTimestamp: false,
    });

    const error = new Error('测试错误');
    logger.error('操作失败', error, { component: 'TestComponent' });

    expect(consoleSpy).toHaveBeenCalled();
  });
});
