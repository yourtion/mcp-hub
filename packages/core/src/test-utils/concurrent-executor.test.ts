/**
 * 并发执行器单元测试
 * 测试并发测试工具的功能
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ConcurrentExecutor,
  ConcurrentOperations,
} from './concurrency/concurrent-executor.js';
import { MockToolFactory } from './mocks/factory.js';

describe('ConcurrentExecutor', () => {
  describe('execute', () => {
    it('应该成功执行并发操作', async () => {
      const operations = Array.from({ length: 10 }, () => async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      const results = await ConcurrentExecutor.execute(operations, {
        concurrency: 5,
      });

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('应该处理部分操作失败', async () => {
      let callCount = 0;
      const operations = Array.from({ length: 10 }, () => async () => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Simulated failure');
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      const results = await ConcurrentExecutor.execute(operations, {
        concurrency: 5,
      });

      expect(results).toHaveLength(10);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
    });

    it('应该支持超时控制', async () => {
      const operations = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'fast';
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 会超时
          return 'slow';
        },
      ];

      const results = await ConcurrentExecutor.execute(operations, {
        concurrency: 2,
        timeout: 200, // 200ms 超时
      });

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error?.message).toContain('timeout');
    });

    it('应该在错误时停止', async () => {
      let callCount = 0;
      const operations = Array.from({ length: 20 }, () => async () => {
        callCount++;
        if (callCount === 5) {
          throw new Error('Stop here');
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'success';
      });

      const results = await ConcurrentExecutor.execute(operations, {
        concurrency: 10,
        stopOnError: true,
      });

      // 第5个操作失败后应该停止
      const executed = results.filter(r => r !== undefined);
      expect(executed.length).toBeLessThan(20);
    });

    it('应该提供进度回调', async () => {
      const progressUpdates: number[] = [];
      const total = 10;

      const operations = Array.from({ length: total }, () => async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });

      await ConcurrentExecutor.execute(operations, {
        concurrency: 3,
        onProgress: (completed) => {
          progressUpdates.push(completed);
        },
      });

      // 应该有多个进度更新
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(total);
    });

    it('应该记录执行时间', async () => {
      const operations = [
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'slow';
        },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'fast';
        },
      ];

      const results = await ConcurrentExecutor.execute(operations, {
        concurrency: 2,
      });

      expect(results[0].duration).toBeGreaterThanOrEqual(50);
      expect(results[1].duration).toBeLessThan(results[0].duration);
    });
  });

  describe('executeWithStats', () => {
    it('应该收集统计信息', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => async () => {
        if (i % 4 === 0) {
          throw new Error('Failed');
        }
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return 'success';
      });

      const { results, stats } = await ConcurrentExecutor.executeWithStats(
        operations,
        { concurrency: 5 },
      );

      expect(results).toHaveLength(20);
      expect(stats.total).toBe(20);
      expect(stats.successful).toBe(15); // 5 个失败（每4个中1个）
      expect(stats.failed).toBe(5);
      expect(stats.successRate).toBe(75);
      expect(stats.avgDuration).toBeGreaterThan(0);
      expect(stats.minDuration).toBeLessThan(stats.maxDuration);
      expect(stats.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('testConcurrencySafety', () => {
    it('应该检测并发安全性', async () => {
      let counter = 0;

      const unsafeOperation = async () => {
        // 不安全的操作
        const old = counter;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        counter = old + 1;
        return counter;
      };

      const { safe, inconsistencies } =
        await ConcurrentExecutor.testConcurrencySafety(unsafeOperation, 50, 10);

      // 不安全的操作应该检测到不一致
      expect(inconsistencies).toBeGreaterThan(0);
      expect(safe).toBe(false);
    });

    it('应该验证安全的操作', async () => {
      const safeOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return { value: 42 }; // 每次返回相同的值
      };

      const { safe } = await ConcurrentExecutor.testConcurrencySafety(
        safeOperation,
        20,
        5,
      );

      expect(safe).toBe(true);
    });
  });

  describe('stressTest', () => {
    it('应该找到最大安全并发数', async () => {
      let failureThreshold = 100; // 在并发超过100时开始失败

      const operation = async () => {
        // 模拟在特定并发下失败
        if (Math.random() * 1000 < failureThreshold) {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        } else {
          throw new Error('Overloaded');
        }
      };

      const { maxSafeConcurrency, breakdown } =
        await ConcurrentExecutor.stressTest(operation, {
          startConcurrency: 10,
          maxConcurrency: 50,
          increment: 10,
          operationsPerLevel: 20,
          failureThreshold: 10, // 10% 失败率
        });

      expect(maxSafeConcurrency).toBeGreaterThan(0);
      expect(breakdown.length).toBeGreaterThan(0);
      expect(breakdown.every(b => b.concurrency > 0)).toBe(true);
    }, 30000); // 30秒超时
  });

  describe('benchmark', () => {
    it('应该执行性能基准测试', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: 'test' };
      };

      const { stats, benchmark } = await ConcurrentExecutor.benchmark(
        operation,
        {
          iterations: 20,
          warmupIterations: 5,
          concurrency: 5,
        },
      );

      expect(stats.total).toBe(20);
      expect(benchmark.totalTime).toBeGreaterThan(0);
      expect(benchmark.operationsPerSecond).toBeGreaterThan(0);
      expect(benchmark.avgLatency).toBeGreaterThan(0);
      expect(benchmark.minLatency).toBeLessThanOrEqual(benchmark.avgLatency);
      expect(benchmark.maxLatency).toBeGreaterThanOrEqual(benchmark.avgLatency);
      expect(benchmark.p95Latency).toBeGreaterThan(0);
      expect(benchmark.p99Latency).toBeGreaterThan(0);
    });
  });

  describe('detectRaceConditions', () => {
    it('应该检测竞态条件', async () => {
      const results: string[] = [];

      const operation = async () => {
        const id = Math.random().toString(36).substring(7);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        results.push(id);
        return id;
      };

      const { hasRaceConditions, details } =
        await ConcurrentExecutor.detectRaceConditions(operation, 50, 10);

      expect(details).toHaveLength(50);
      expect(details.every(d => d.result)).toBe(true);
      // 并发操作可能产生竞态条件
      expect(typeof hasRaceConditions).toBe('boolean');
    });
  });
});

describe('ConcurrentOperations', () => {
  describe('executeTools', () => {
    it('应该并发执行多个工具', async () => {
      const tools = [
        { name: 'tool1', args: { param1: 'value1' } },
        { name: 'tool2', args: { param1: 'value2' } },
        { name: 'tool3', args: { param1: 'value3' } },
      ];

      const executor = vi.fn().mockResolvedValue({ success: true });

      const results = await ConcurrentOperations.executeTools(executor, tools, 2);

      expect(results).toHaveLength(3);
      expect(executor).toHaveBeenCalledTimes(3);
    });

    it('应该处理工具执行失败', async () => {
      const tools = [
        { name: 'tool1', args: {} },
        { name: 'tool2', args: {} },
      ];

      const executor = vi.fn().mockImplementation(async (name) => {
        if (name === 'tool2') {
          throw new Error('Tool failed');
        }
        return { success: true };
      });

      const results = await ConcurrentOperations.executeTools(executor, tools, 2);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('connectServers', () => {
    it('应该并发连接多个服务器', async () => {
      const serverIds = ['server1', 'server2', 'server3'];

      const connector = vi.fn().mockResolvedValue(undefined);

      await ConcurrentOperations.connectServers(connector, serverIds, 2);

      expect(connector).toHaveBeenCalledTimes(3);
      serverIds.forEach(id => {
        expect(connector).toHaveBeenCalledWith(id);
      });
    });
  });

  describe('loadConfigs', () => {
    it('应该并发加载多个配置', async () => {
      const configPaths = ['config1.json', 'config2.json', 'config3.json'];

      const loader = vi.fn().mockResolvedValue({ loaded: true });

      await ConcurrentOperations.loadConfigs(loader, configPaths, 2);

      expect(loader).toHaveBeenCalledTimes(3);
      configPaths.forEach(path => {
        expect(loader).toHaveBeenCalledWith(path);
      });
    });
  });
});

describe('测试工具集成', () => {
  it('应该结合 Mock 工厂和并发执行器', async () => {
    // 使用 Mock 工厂创建测试数据
    const tools = MockToolFactory.createTools(20, 'server1');

    // 创建模拟的工具执行器
    const executor = vi.fn().mockImplementation(async (toolName) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
      return { executed: toolName };
    });

    // 使用并发操作执行工具
    const operations = tools.map(tool => () => executor(tool.name));

    const { stats } = await ConcurrentExecutor.executeWithStats(operations, {
      concurrency: 5,
    });

    expect(stats.total).toBe(20);
    expect(stats.successful).toBe(20);
    expect(executor).toHaveBeenCalledTimes(20);
  });
});
