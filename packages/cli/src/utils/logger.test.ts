/**
 * CLI日志系统测试
 */

import { type LogEntry, LogLevel } from '@mcp-core/mcp-hub-core/utils/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CliLogger,
  CliTextFormatter,
  createCliLogger,
  DEFAULT_CLI_LOGGER_CONFIG,
} from './logger';

describe('CliTextFormatter', () => {
  it('应该正确格式化普通日志条目', () => {
    const formatter = new CliTextFormatter(false, true, false); // 无颜色，有时间戳，非静默
    const entry: LogEntry = {
      timestamp: '2024-01-01T12:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '测试消息',
      component: 'TestComponent',
      operation: 'testOperation',
    };

    const result = formatter.format(entry);

    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(result).toContain('[INFO]');
    expect(result).toContain('[TestComponent]');
    expect(result).toContain('测试消息');
  });

  it('应该在静默模式下过滤低级别日志', () => {
    const formatter = new CliTextFormatter(false, true, true); // 静默模式
    const infoEntry: LogEntry = {
      timestamp: '2024-01-01T12:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '信息消息',
      component: 'TestComponent',
    };

    const warnEntry: LogEntry = {
      timestamp: '2024-01-01T12:00:00.000Z',
      level: LogLevel.WARN,
      levelName: 'WARN',
      message: '警告消息',
      component: 'TestComponent',
    };

    expect(formatter.format(infoEntry)).toBe('');
    expect(formatter.format(warnEntry)).toContain('警告消息');
  });

  it('应该正确格式化包含上下文的日志条目', () => {
    const formatter = new CliTextFormatter(false, false, false); // 无颜色，无时间戳
    const entry: LogEntry = {
      timestamp: '2024-01-01T12:00:00.000Z',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: '测试消息',
      component: 'TestComponent',
      serverId: 'server1',
      groupId: 'group1',
      toolName: 'testTool',
      duration: 1500,
    };

    const result = formatter.format(entry);

    expect(result).toContain('[INFO]');
    expect(result).toContain('测试消息');
    expect(result).toContain('[server:server1, group:group1, tool:testTool]');
    expect(result).toContain('(1500ms)');
  });

  it('应该正确格式化错误日志', () => {
    const formatter = new CliTextFormatter(false, false, false);
    const entry: LogEntry = {
      timestamp: '2024-01-01T12:00:00.000Z',
      level: LogLevel.ERROR,
      levelName: 'ERROR',
      message: '操作失败',
      component: 'TestComponent',
      error: {
        name: 'TestError',
        message: '测试错误消息',
      },
    };

    const result = formatter.format(entry);

    expect(result).toContain('[ERROR]');
    expect(result).toContain('操作失败');
    expect(result).toContain('错误: 测试错误消息');
  });
});

describe('CliLogger', () => {
  let logger: CliLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // 在测试中明确禁用静默模式，以便测试日志输出
    logger = new CliLogger({
      ...DEFAULT_CLI_LOGGER_CONFIG,
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamp: false,
      quiet: false, // 明确禁用静默模式
      enableConsole: true, // 明确启用控制台输出
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('应该记录成功消息', () => {
    logger.success('操作成功');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ 操作成功'),
    );
  });

  it('应该记录警告消息', () => {
    logger.warning('这是一个警告');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('⚠️  这是一个警告'),
    );
  });

  it('应该记录失败消息', () => {
    const error = new Error('测试错误');
    logger.failure('操作失败', error);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ 操作失败'),
    );
  });

  it('应该记录进度消息', () => {
    logger.progress('正在处理...');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔄 正在处理...'),
    );
  });

  it('应该显示启动横幅', () => {
    // 在非测试环境中测试横幅显示
    const originalEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    delete process.env.NODE_ENV;
    delete process.env.VITEST;

    const nonTestLogger = new CliLogger({
      ...DEFAULT_CLI_LOGGER_CONFIG,
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamp: false,
      quiet: false,
      enableConsole: true,
    });

    nonTestLogger.showBanner('1.0.0');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('MCP Hub CLI'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('版本 1.0.0'),
    );

    // 恢复环境变量
    if (originalEnv) process.env.NODE_ENV = originalEnv;
    if (originalVitest) process.env.VITEST = originalVitest;
  });

  it('应该显示配置信息', () => {
    const config = {
      level: 'INFO',
      enableFile: false,
      servers: ['server1', 'server2'],
    };

    logger.showConfig(config);

    // 只检查 info 日志调用，因为在测试环境中 console.log 被阻止
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('当前配置:'),
    );
  });

  it('应该显示服务器列表', () => {
    const servers = [
      { id: 'server1', status: 'connected', tools: 5 },
      { id: 'server2', status: 'disconnected', tools: 3 },
    ];

    logger.showServers(servers);

    // 只检查 info 日志调用，因为在测试环境中 console.log 被阻止
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('已配置的服务器:'),
    );
  });

  it('应该显示工具列表', () => {
    const tools = [
      { name: 'tool1', description: '工具1描述', serverId: 'server1' },
      { name: 'tool2', serverId: 'server2' },
    ];

    logger.showTools(tools);

    // 只检查 info 日志调用，因为在测试环境中 console.log 被阻止
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('可用工具:'),
    );
  });

  it('应该显示帮助信息', () => {
    const commands = [
      { name: 'start', description: '启动MCP服务器' },
      { name: 'list', description: '列出可用工具' },
    ];

    // 在非测试环境中测试帮助信息显示
    const originalEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    delete process.env.NODE_ENV;
    delete process.env.VITEST;

    const nonTestLogger = new CliLogger({
      ...DEFAULT_CLI_LOGGER_CONFIG,
      level: LogLevel.DEBUG,
      enableColors: false,
      enableTimestamp: false,
      quiet: false,
      enableConsole: true,
    });

    nonTestLogger.showHelp(commands);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('可用命令:'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('start                启动MCP服务器'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('list                 列出可用工具'),
    );

    // 恢复环境变量
    if (originalEnv) process.env.NODE_ENV = originalEnv;
    if (originalVitest) process.env.VITEST = originalVitest;
  });

  it('应该在静默模式下调整日志级别', () => {
    const quietLogger = new CliLogger({
      ...DEFAULT_CLI_LOGGER_CONFIG,
      quiet: true,
    });

    expect(quietLogger.getLevel()).toBe(LogLevel.WARN);
  });

  it('应该在详细模式下调整日志级别', () => {
    // 在非测试环境中测试详细模式
    const originalEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    delete process.env.NODE_ENV;
    delete process.env.VITEST;

    const verboseLogger = new CliLogger({
      ...DEFAULT_CLI_LOGGER_CONFIG,
      verbose: true,
      quiet: false, // 明确禁用静默模式
    });

    expect(verboseLogger.getLevel()).toBe(LogLevel.DEBUG);

    // 恢复环境变量
    if (originalEnv) process.env.NODE_ENV = originalEnv;
    if (originalVitest) process.env.VITEST = originalVitest;
  });
});

describe('createCliLogger', () => {
  it('应该根据选项创建CLI日志记录器', () => {
    const logger = createCliLogger({
      verbose: true,
      quiet: false,
      logFile: '/tmp/test.log',
      noColor: true,
      logLevel: 'DEBUG',
    });

    expect(logger).toBeInstanceOf(CliLogger);
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('应该处理静默模式', () => {
    const logger = createCliLogger({
      quiet: true,
    });

    expect(logger.getLevel()).toBe(LogLevel.WARN);
  });

  it('应该处理详细模式', () => {
    const logger = createCliLogger({
      verbose: true,
    });

    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('应该处理无效的日志级别', () => {
    const logger = createCliLogger({
      logLevel: 'INVALID',
    });

    // 应该使用默认级别
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });

  it('应该启用文件日志当提供日志文件路径时', () => {
    const logger = createCliLogger({
      logFile: '/tmp/test.log',
    });

    expect(logger).toBeInstanceOf(CliLogger);
  });
});
