/**
 * 日志系统测试
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConsoleWriter,
  createLogger,
  FileWriter,
  JsonFormatter,
  type LogEntry,
  type LoggerConfig,
  LogLevel,
  StructuredLogger,
  TextFormatter,
} from './logger';

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

describe('FileWriter', () => {
  let mockFileHandle: any;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), 'mcp-hub-test-logs');
    mockFileHandle = {
      write: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.stat).mockResolvedValue({ size: 0 } as any);
    vi.mocked(fs.promises.open).mockResolvedValue(mockFileHandle);
    vi.mocked(fs.promises.access).mockResolvedValue(undefined);
    vi.mocked(fs.promises.rename).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应该写入到文件', async () => {
    const filePath = path.join(tempDir, 'test.log');
    const writer = new FileWriter(filePath, 1024 * 1024, 5, false);

    await writer.write('测试日志消息');

    expect(fs.promises.mkdir).toHaveBeenCalledWith(tempDir, {
      recursive: true,
    });
    expect(fs.promises.open).toHaveBeenCalledWith(filePath, 'a');
    expect(mockFileHandle.write).toHaveBeenCalledWith('测试日志消息\n');
  });

  it('应该在文件大小超限时进行轮转', async () => {
    const filePath = path.join(tempDir, 'test.log');
    const writer = new FileWriter(filePath, 10, 3, true); // 很小的文件大小限制

    // 模拟当前文件大小
    vi.mocked(fs.promises.stat).mockResolvedValue({ size: 5 } as any);

    await writer.write('这是一个很长的日志消息，会超过文件大小限制');

    // 应该调用文件轮转相关的方法
    expect(fs.promises.rename).toHaveBeenCalled();
  });

  it('应该正确关闭文件句柄', async () => {
    const filePath = path.join(tempDir, 'test.log');
    const writer = new FileWriter(filePath, 1024 * 1024, 5, false);

    await writer.write('测试消息');
    await writer.close();

    expect(mockFileHandle.close).toHaveBeenCalled();
  });
});

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger = new StructuredLogger({
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

  it('应该正确记录操作开始和结束', () => {
    const startTime = Date.now();
    const requestId = logger.startOperation('testOperation', 'TestComponent');

    expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('开始执行 testOperation'),
    );

    logger.endOperation('testOperation', 'TestComponent', requestId, startTime);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('完成执行 testOperation'),
    );
  });

  it('应该正确记录操作失败', () => {
    const startTime = Date.now();
    const requestId = 'test-request-id';
    const error = new Error('操作失败');

    logger.failOperation(
      'testOperation',
      'TestComponent',
      requestId,
      startTime,
      error,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('执行 testOperation 失败'),
    );
  });

  it('应该正确记录服务器连接事件', () => {
    logger.logServerConnection('server1', 'connected');
    logger.logServerConnection('server2', 'failed');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('服务器已连接');
    expect(consoleSpy.mock.calls[1][0]).toContain('服务器连接失败');
  });

  it('应该正确记录工具发现事件', () => {
    logger.logToolDiscovery('server1', 5);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('发现 5 个工具'),
    );
  });

  it('应该正确记录工具执行事件', () => {
    logger.logToolExecution('testTool', 'started', { groupId: 'group1' });
    logger.logToolExecution('testTool', 'failed', { groupId: 'group1' });

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('工具执行开始');
    expect(consoleSpy.mock.calls[1][0]).toContain('工具执行失败');
  });

  it('应该正确记录配置重载事件', () => {
    logger.logConfigReload(['server1', 'server2']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('配置已重载'),
    );
  });
});

describe('createLogger', () => {
  it('应该使用默认配置创建日志记录器', () => {
    const logger = createLogger();

    expect(logger).toBeInstanceOf(StructuredLogger);
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

    expect(logger).toBeInstanceOf(StructuredLogger);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });
});
