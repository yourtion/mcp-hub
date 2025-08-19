/**
 * 日志系统测试
 */

// 移除未使用的导入
import {
  ConsoleWriter,
  createLogger,
  JsonFormatter,
  type LoggerConfig,
  LogLevel,
  McpLogger,
  TextFormatter,
  UnifiedLogger,
} from '@mcp-core/mcp-hub-share';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs promises
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    promises: {
      mkdir: vi.fn(),
      stat: vi.fn(),
      open: vi.fn(),
      access: vi.fn(),
      rename: vi.fn(),
    },
  };
});

describe('JsonFormatter', () => {
  it('应该正确格式化日志条目为JSON', () => {
    const formatter = new JsonFormatter();
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '测试消息',
      component: 'TestComponent',
      operation: 'testOperation',
      serverId: 'server1',
      metadata: { key: 'value' },
    };

    const result = formatter.format(entry);
    const parsed = JSON.parse(result);

    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.level).toBe(LogLevel.INFO);
    expect(parsed.message).toBe('测试消息');
    expect(parsed.component).toBe('TestComponent');
    expect(parsed.serverId).toBe('server1');
    expect(parsed.metadata).toEqual({ key: 'value' });
  });
});

describe('TextFormatter', () => {
  it('应该正确格式化日志条目为文本', () => {
    const formatter = new TextFormatter(false); // 禁用颜色
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '测试消息',
      component: 'TestComponent',
      operation: 'testOperation',
      serverId: 'server1',
    };

    const result = formatter.format(entry);

    expect(result).toContain('2024-01-01T00:00:00.000Z');
    expect(result).toContain('INFO');
    expect(result).toContain('[TestComponent]');
    expect(result).toContain('testOperation');
    expect(result).toContain('测试消息');
    expect(result).toContain('server:server1');
  });

  it('应该正确格式化包含错误的日志条目', () => {
    const formatter = new TextFormatter(false);
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.ERROR,
      levelName: 'ERROR',
      message: '操作失败',
      component: 'TestComponent',
      error: {
        name: 'TestError',
        message: '测试错误',
        stack: 'Error stack trace',
      },
    };

    const result = formatter.format(entry);

    expect(result).toContain('操作失败');
    expect(result).toContain('测试错误');
  });

  it('应该正确格式化包含持续时间的日志条目', () => {
    const formatter = new TextFormatter(false);
    const entry: LogEntry = {
      timestamp: '2024-01-01T00:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '操作完成',
      component: 'TestComponent',
      duration: 1500,
    };

    const result = formatter.format(entry);

    expect(result).toContain('操作完成');
    expect(result).toContain('(1500ms)');
  });
});

describe('ConsoleWriter', () => {
  it('应该写入到控制台', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writer = new ConsoleWriter();

    await writer.write('测试日志消息');

    expect(consoleSpy).toHaveBeenCalledWith('测试日志消息');
    consoleSpy.mockRestore();
  });
});

// FileWriter 测试已移除，因为该类现在在共享包中

describe('UnifiedLogger', () => {
  let logger: UnifiedLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger = new UnifiedLogger({
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableFile: false,
      format: 'text',
      enableColors: false,
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

    expect(consoleSpy).toHaveBeenCalledTimes(4);
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
      metadata: { key: 'value' },
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logMessage = consoleSpy.mock.calls[0][0];
    expect(logMessage).toContain('TestComponent');
    expect(logMessage).toContain('server:server1');
  });

  it('应该正确记录错误信息', () => {
    const error = new Error('测试错误');
    logger.error('操作失败', error, { component: 'TestComponent' });

    expect(consoleSpy).toHaveBeenCalled();
    const logMessage = consoleSpy.mock.calls[0][0];
    expect(logMessage).toContain('操作失败');
    expect(logMessage).toContain('测试错误');
  });

  // 这些方法在 McpLogger 中，需要单独测试
});

describe('McpLogger', () => {
  let mcpLogger: McpLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mcpLogger = new McpLogger({
      level: LogLevel.DEBUG,
      enableConsole: true,
      enableFile: false,
      format: 'text',
      enableColors: false,
      enableTimestamp: false,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('应该正确记录服务器连接事件', () => {
    mcpLogger.logServerConnection('server1', 'connected');
    mcpLogger.logServerConnection('server2', 'failed');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('Server connected');
    expect(consoleSpy.mock.calls[1][0]).toContain('Server failed');
  });

  it('应该正确记录工具发现事件', () => {
    mcpLogger.logToolDiscovery('server1', 5);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Discovered 5 tools'),
    );
  });

  it('应该正确记录工具执行事件', () => {
    mcpLogger.logToolExecution('testTool', 'group1', 'started');
    mcpLogger.logToolExecution('testTool', 'group1', 'failed');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('Tool execution started');
    expect(consoleSpy.mock.calls[1][0]).toContain('Tool execution failed');
  });

  it('应该正确记录配置重载事件', () => {
    mcpLogger.logConfigReload(['server1', 'server2']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Configuration reloaded with changes: server1, server2',
      ),
    );
  });
});

describe('createLogger', () => {
  it('应该使用默认配置创建日志记录器', () => {
    const logger = createLogger();

    expect(logger).toBeInstanceOf(UnifiedLogger);
    // 在测试环境中，默认日志级别是 WARN
    expect(logger.getLevel()).toBe(LogLevel.WARN);
  });

  it('应该使用自定义配置创建日志记录器', () => {
    const config: Partial<LoggerConfig> = {
      level: LogLevel.DEBUG,
      format: 'json',
      enableColors: false,
    };

    const logger = createLogger(config);

    expect(logger).toBeInstanceOf(UnifiedLogger);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });
});
