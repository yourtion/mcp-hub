/**
 * 性能监控系统测试
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPerformanceMonitor,
  DEFAULT_PERFORMANCE_CONFIG,
  PerformanceMonitor,
  type PerformanceMonitorConfig,
  type RequestPerformance,
} from './performance-monitor';

// Mock Node.js modules
vi.mock('node:os', () => ({
  totalmem: vi.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: vi.fn(() => 4 * 1024 * 1024 * 1024), // 4GB
  cpus: vi.fn(() => Array(4).fill({})), // 4 CPUs
  loadavg: vi.fn(() => [1.0, 1.5, 2.0]),
  uptime: vi.fn(() => 3600), // 1 hour
}));

vi.mock('node:process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:process')>();
  return {
    ...actual,
    memoryUsage: vi.fn(() => ({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      heapUsed: 60 * 1024 * 1024, // 60MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024, // 5MB
    })),
    cpuUsage: vi.fn(() => ({
      user: 1000000, // 1 second
      system: 500000, // 0.5 seconds
    })),
    env: {
      PERFORMANCE_MONITORING: 'false',
    },
  };
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let config: PerformanceMonitorConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    config = {
      ...DEFAULT_PERFORMANCE_CONFIG,
      enabled: true, // 启用监控
      collectInterval: 1000, // 1秒用于测试
    };
    monitor = new PerformanceMonitor(config);
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建监控器', () => {
      const defaultMonitor = new PerformanceMonitor();
      expect(defaultMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('应该使用自定义配置创建监控器', () => {
      const customConfig = { enabled: false, collectInterval: 5000 };
      const customMonitor = new PerformanceMonitor(customConfig);
      expect(customMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });

  describe('启动和停止', () => {
    it('应该正确启动监控', () => {
      const startedSpy = vi.fn();
      const testMonitor = new PerformanceMonitor({ ...config, enabled: false });
      testMonitor.on('started', startedSpy);

      testMonitor.start();

      expect(startedSpy).toHaveBeenCalled();
      testMonitor.stop();
    });

    it('应该正确停止监控', () => {
      const stoppedSpy = vi.fn();
      monitor.on('stopped', stoppedSpy);

      monitor.start();
      monitor.stop();

      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('应该防止重复启动', () => {
      const startedSpy = vi.fn();
      const testMonitor = new PerformanceMonitor({ ...config, enabled: false });
      testMonitor.on('started', startedSpy);

      testMonitor.start();
      testMonitor.start(); // 第二次启动应该被忽略

      expect(startedSpy).toHaveBeenCalledTimes(1);
      testMonitor.stop();
    });
  });

  describe('请求监控', () => {
    it('应该正确记录请求开始和结束', () => {
      const requestCompletedSpy = vi.fn();
      monitor.on('requestCompleted', requestCompletedSpy);

      const requestId = 'test-request-1';
      const operation = 'testOperation';
      const component = 'TestComponent';

      monitor.startRequest(requestId, operation, component);

      // 模拟请求处理时间
      vi.advanceTimersByTime(100);

      monitor.endRequest(requestId, true);

      expect(requestCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          operation,
          component,
          success: true,
          duration: 100,
        }),
      );
    });

    it('应该正确记录失败的请求', () => {
      const requestCompletedSpy = vi.fn();
      monitor.on('requestCompleted', requestCompletedSpy);

      const requestId = 'test-request-2';
      const error = '测试错误';

      monitor.startRequest(requestId, 'testOperation', 'TestComponent');
      vi.advanceTimersByTime(50);
      monitor.endRequest(requestId, false, error);

      expect(requestCompletedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId,
          success: false,
          error,
          duration: 50,
        }),
      );
    });

    it('应该忽略未开始的请求结束', () => {
      const requestCompletedSpy = vi.fn();
      monitor.on('requestCompleted', requestCompletedSpy);

      monitor.endRequest('non-existent-request', true);

      expect(requestCompletedSpy).not.toHaveBeenCalled();
    });

    it('应该限制请求历史记录大小', () => {
      const smallConfig = { ...config, maxHistorySize: 2 };
      const smallMonitor = new PerformanceMonitor(smallConfig);

      // 添加3个请求，应该只保留最后2个
      for (let i = 1; i <= 3; i++) {
        smallMonitor.startRequest(`req-${i}`, 'test', 'test');
        smallMonitor.endRequest(`req-${i}`, true);
      }

      const history = smallMonitor.getRequestHistory();
      expect(history).toHaveLength(2);
      expect(history[0].requestId).toBe('req-2');
      expect(history[1].requestId).toBe('req-3');

      smallMonitor.stop();
    });
  });

  describe('指标收集', () => {
    it('应该定期收集指标', () => {
      const metricsCollectedSpy = vi.fn();
      monitor.on('metricsCollected', metricsCollectedSpy);

      monitor.start();

      // 推进时间触发指标收集
      vi.advanceTimersByTime(1000);

      expect(metricsCollectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestCount: expect.any(Number),
          averageRequestTime: expect.any(Number),
          errorCount: expect.any(Number),
          errorRate: expect.any(Number),
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Object),
          timestamp: expect.any(Number),
          uptime: expect.any(Number),
        }),
      );
    });

    it('应该正确计算请求统计', () => {
      monitor.start();

      // 添加一些测试请求
      monitor.startRequest('req-1', 'test', 'test');
      vi.advanceTimersByTime(100);
      monitor.endRequest('req-1', true);

      monitor.startRequest('req-2', 'test', 'test');
      vi.advanceTimersByTime(200);
      monitor.endRequest('req-2', false, '错误');

      // 触发指标收集
      vi.advanceTimersByTime(1000);

      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics!.requestCount).toBe(2);
      expect(metrics!.errorCount).toBe(1);
      expect(metrics!.errorRate).toBe(0.5);
    });
  });

  describe('阈值检查', () => {
    it('应该在请求时间超过阈值时发出警告', () => {
      const thresholdExceededSpy = vi.fn();

      const fastConfig = {
        ...config,
        thresholds: { ...config.thresholds, maxRequestTime: 50 },
        enableAlerts: true,
      };
      const fastMonitor = new PerformanceMonitor(fastConfig);
      fastMonitor.on('thresholdExceeded', thresholdExceededSpy);

      fastMonitor.startRequest('slow-request', 'test', 'test');
      vi.advanceTimersByTime(100); // 超过50ms阈值
      fastMonitor.endRequest('slow-request', true);

      expect(thresholdExceededSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'requestTime',
          value: 100,
          threshold: 50,
        }),
      );

      fastMonitor.stop();
    });

    it('应该在错误率超过阈值时发出警告', () => {
      const thresholdExceededSpy = vi.fn();

      const strictConfig = {
        ...config,
        thresholds: { ...config.thresholds, maxErrorRate: 0.3 },
        collectInterval: 100,
        enableAlerts: true,
      };
      const strictMonitor = new PerformanceMonitor(strictConfig);
      strictMonitor.on('thresholdExceeded', thresholdExceededSpy);

      // 添加多个失败请求以超过错误率阈值
      for (let i = 1; i <= 5; i++) {
        strictMonitor.startRequest(`req-${i}`, 'test', 'test');
        strictMonitor.endRequest(`req-${i}`, i <= 2); // 前2个成功，后3个失败
      }

      expect(thresholdExceededSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'errorRate',
          value: 0.6, // 3/5 = 0.6
          threshold: 0.3,
        }),
      );

      strictMonitor.stop();
    });
  });

  describe('系统资源监控', () => {
    it('应该正确获取系统资源使用情况', () => {
      const resourceUsage = monitor.getSystemResourceUsage();

      expect(resourceUsage).toEqual({
        memory: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number),
          usagePercentage: expect.any(Number),
        },
        cpu: {
          user: expect.any(Number),
          system: expect.any(Number),
          usagePercentage: expect.any(Number),
        },
        system: {
          totalMemory: expect.any(Number),
          freeMemory: expect.any(Number),
          loadAverage: expect.any(Array),
          uptime: expect.any(Number),
        },
      });
    });
  });

  describe('性能报告', () => {
    it('应该生成完整的性能报告', () => {
      // 添加一些测试数据
      monitor.startRequest('req-1', 'test', 'test');
      vi.advanceTimersByTime(100);
      monitor.endRequest('req-1', true);

      monitor.startRequest('req-2', 'test', 'test');
      vi.advanceTimersByTime(200);
      monitor.endRequest('req-2', false, '错误');

      const report = monitor.getPerformanceReport();

      expect(report).toEqual({
        summary: {
          totalRequests: 2,
          successfulRequests: 1,
          failedRequests: 1,
          averageResponseTime: 150, // (100 + 200) / 2
          errorRate: 0.5, // 1/2
          uptime: expect.any(Number),
        },
        resourceUsage: expect.any(Object),
        recentMetrics: expect.any(Array),
        topSlowRequests: expect.arrayContaining([
          expect.objectContaining({
            requestId: 'req-2',
            duration: 200,
          }),
          expect.objectContaining({
            requestId: 'req-1',
            duration: 100,
          }),
        ]),
      });
    });

    it('应该支持时间窗口过滤', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // 添加旧请求
      monitor.startRequest('old-req', 'test', 'test');
      monitor.endRequest('old-req', true);

      // 推进时间
      vi.advanceTimersByTime(2000);

      // 添加新请求
      monitor.startRequest('new-req', 'test', 'test');
      monitor.endRequest('new-req', true);

      // 获取最近1秒的报告
      const report = monitor.getPerformanceReport(1000);

      expect(report.summary.totalRequests).toBe(1);
      expect(report.topSlowRequests[0].requestId).toBe('new-req');
    });
  });

  describe('数据管理', () => {
    it('应该正确获取请求历史', () => {
      monitor.startRequest('req-1', 'test', 'test');
      monitor.endRequest('req-1', true);

      monitor.startRequest('req-2', 'test', 'test');
      monitor.endRequest('req-2', true);

      const allHistory = monitor.getRequestHistory();
      expect(allHistory).toHaveLength(2);

      const limitedHistory = monitor.getRequestHistory(1);
      expect(limitedHistory).toHaveLength(1);
      expect(limitedHistory[0].requestId).toBe('req-2');
    });

    it('应该正确重置数据', () => {
      const resetSpy = vi.fn();
      monitor.on('reset', resetSpy);

      // 添加一些数据
      monitor.startRequest('req-1', 'test', 'test');
      monitor.endRequest('req-1', true);

      monitor.reset();

      expect(resetSpy).toHaveBeenCalled();
      expect(monitor.getRequestHistory()).toHaveLength(0);
      expect(monitor.getMetricsHistory()).toHaveLength(0);
    });

    it('应该正确更新配置', () => {
      const configUpdatedSpy = vi.fn();
      monitor.on('configUpdated', configUpdatedSpy);

      const newConfig = { collectInterval: 2000 };
      monitor.updateConfig(newConfig);

      expect(configUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining(newConfig),
      );
    });
  });

  describe('数据清理', () => {
    it('应该定期清理过期数据', () => {
      const dataCleanupSpy = vi.fn();

      const shortRetentionConfig = {
        ...config,
        retentionPeriod: 1000, // 1秒保留期
        enabled: false, // 手动启动
      };
      const shortMonitor = new PerformanceMonitor(shortRetentionConfig);
      shortMonitor.on('dataCleanup', dataCleanupSpy);

      shortMonitor.start();

      // 添加数据
      shortMonitor.startRequest('req-1', 'test', 'test');
      shortMonitor.endRequest('req-1', true);

      // 推进时间触发清理（清理间隔是保留期的1/10）
      vi.advanceTimersByTime(200); // 200ms > 100ms (1000/10)

      expect(dataCleanupSpy).toHaveBeenCalled();

      shortMonitor.stop();
    });
  });
});

describe('createPerformanceMonitor', () => {
  it('应该创建性能监控器实例', () => {
    const monitor = createPerformanceMonitor();
    expect(monitor).toBeInstanceOf(PerformanceMonitor);
    monitor.stop();
  });

  it('应该使用自定义配置创建监控器', () => {
    const config = { enabled: false, collectInterval: 5000 };
    const monitor = createPerformanceMonitor(config);
    expect(monitor).toBeInstanceOf(PerformanceMonitor);
  });
});
