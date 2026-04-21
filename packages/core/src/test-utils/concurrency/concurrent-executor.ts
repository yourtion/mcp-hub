/**
 * 并发测试执行器
 * 用于测试并发操作和竞态条件
 */

export interface ConcurrentResult<T> {
  /** 操作索引 */
  index: number;
  /** 操作是否成功 */
  success: boolean;
  /** 操作结果 */
  result?: T;
  /** 错误信息 */
  error?: Error;
  /** 执行时间（毫秒） */
  duration: number;
}

export interface ConcurrentExecutionOptions {
  /** 并发数 */
  concurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否在失败时停止 */
  stopOnError?: boolean;
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * 并发执行器
 */
export class ConcurrentExecutor {
  /**
   * 并发执行多个操作
   */
  static async execute<T>(
    operations: Array<() => Promise<T>>,
    options: ConcurrentExecutionOptions = {},
  ): Promise<ConcurrentResult<T>[]> {
    const { concurrency = 10, timeout = 30000, stopOnError = false, onProgress } = options;

    const results: ConcurrentResult<T>[] = [];
    const executing: Promise<void>[] = [];
    let completed = 0;
    let shouldStop = false;

    for (let i = 0; i < operations.length; i++) {
      if (shouldStop) break;

      const operation = operations[i];
      const startTime = Date.now();

      const promise = (async () => {
        try {
          // 添加超时控制
          let timeoutId: NodeJS.Timeout | undefined;
          const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Operation timeout')), timeout);
              timeoutId.unref?.();
            }),
          ]);
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          results[i] = {
            index: i,
            success: true,
            result,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          results[i] = {
            index: i,
            success: false,
            error: error as Error,
            duration: Date.now() - startTime,
          };

          if (stopOnError) {
            shouldStop = true;
          }
        } finally {
          completed++;
          onProgress?.(completed, operations.length);
        }
      })();

      executing.push(promise);

      // 控制并发数
      if (executing.length >= concurrency) {
        // 等待至少一个完成
        await Promise.race(executing);

        // 移除已完成的 promise
        const stillExecuting = [];
        for (const p of executing) {
          // 创建一个立即完成的 race 来检查状态
          const checked = await Promise.race([
            p.then(() => ({ done: true })),
            Promise.resolve({ done: false }).then(() => ({ done: false })),
          ]);

          if (!checked.done) {
            stillExecuting.push(p);
          }
        }

        executing.length = 0;
        executing.push(...stillExecuting);
      }
    }

    // 等待所有剩余操作完成
    await Promise.allSettled(executing);

    return results;
  }

  /**
   * 执行并发操作并收集统计信息
   */
  static async executeWithStats<T>(
    operations: Array<() => Promise<T>>,
    options: ConcurrentExecutionOptions = {},
  ) {
    const results = await ConcurrentExecutor.execute(operations, options);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const durations = results.map((r) => r.duration);

    return {
      results,
      stats: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: (successful.length / results.length) * 100,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
      },
    };
  }

  /**
   * 测试并发安全性
   * 执行相同的操作多次，检查是否有竞态条件
   */
  static async testConcurrencySafety<T>(
    operation: () => Promise<T>,
    iterations: number = 100,
    concurrency: number = 10,
  ): Promise<{
    safe: boolean;
    results: ConcurrentResult<T>[];
    inconsistencies: number;
  }> {
    const operations = Array.from({ length: iterations }, () => operation);

    const results = await ConcurrentExecutor.execute(operations, {
      concurrency,
    });

    // 检查结果一致性
    const successfulResults = results.filter((r) => r.success && r.result !== undefined);
    const uniqueResults = new Set(successfulResults.map((r) => JSON.stringify(r.result)));

    const inconsistencies = Math.max(0, uniqueResults.size - 1);

    return {
      safe: inconsistencies === 0,
      results,
      inconsistencies,
    };
  }

  /**
   * 压力测试
   * 持续增加并发数，直到达到失败阈值
   */
  static async stressTest<T>(
    operation: () => Promise<T>,
    options: {
      startConcurrency?: number;
      maxConcurrency?: number;
      increment?: number;
      operationsPerLevel?: number;
      failureThreshold?: number; // 失败率百分比
    } = {},
  ): Promise<{
    maxSafeConcurrency: number;
    breakdown: Array<{
      concurrency: number;
      successRate: number;
      avgDuration: number;
    }>;
  }> {
    const {
      startConcurrency = 10,
      maxConcurrency = 200,
      increment = 10,
      operationsPerLevel = 100,
      failureThreshold = 5, // 5%
    } = options;

    const breakdown = [];
    let maxSafeConcurrency = startConcurrency;

    for (
      let concurrency = startConcurrency;
      concurrency <= maxConcurrency;
      concurrency += increment
    ) {
      const operations = Array.from({ length: operationsPerLevel }, () => operation);

      const { stats } = await ConcurrentExecutor.executeWithStats(operations, {
        concurrency,
      });

      const successRate = stats.successRate;

      breakdown.push({
        concurrency,
        successRate,
        avgDuration: stats.avgDuration,
      });

      if (successRate >= 100 - failureThreshold) {
        maxSafeConcurrency = concurrency;
      } else {
        // 达到失败阈值，停止测试
        break;
      }
    }

    return {
      maxSafeConcurrency,
      breakdown,
    };
  }

  /**
   * 性能基准测试
   */
  static async benchmark<T>(
    operation: () => Promise<T>,
    options: {
      iterations?: number;
      warmupIterations?: number;
      concurrency?: number;
    } = {},
  ) {
    const { iterations = 100, warmupIterations = 10, concurrency = 10 } = options;

    // 预热
    const warmupOperations = Array.from({ length: warmupIterations }, () => operation);
    await ConcurrentExecutor.execute(warmupOperations, { concurrency });

    // 实际测试
    const operations = Array.from({ length: iterations }, () => operation);
    const startTime = Date.now();

    const { stats, results } = await ConcurrentExecutor.executeWithStats(operations, {
      concurrency,
    });

    const endTime = Date.now();

    return {
      stats,
      results,
      benchmark: {
        totalTime: endTime - startTime,
        operationsPerSecond: (iterations / (endTime - startTime)) * 1000,
        avgLatency: stats.avgDuration,
        minLatency: stats.minDuration,
        maxLatency: stats.maxDuration,
        p95Latency: ConcurrentExecutor.calculatePercentile(
          results.map((r) => r.duration),
          95,
        ),
        p99Latency: ConcurrentExecutor.calculatePercentile(
          results.map((r) => r.duration),
          99,
        ),
      },
    };
  }

  /**
   * 计算百分位数
   */
  private static calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].toSorted((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * 竞态条件检测
   */
  static async detectRaceConditions<T>(
    operation: () => Promise<T>,
    iterations: number = 100,
    concurrency: number = 10,
  ): Promise<{
    hasRaceConditions: boolean;
    details: Array<{
      iteration: number;
      result: T;
      timestamp: number;
    }>;
  }> {
    const results: Array<{
      iteration: number;
      result: T;
      timestamp: number;
    }> = [];

    const operations = Array.from({ length: iterations }, (_, i) => async () => {
      const result = await operation();
      results.push({
        iteration: i,
        result,
        timestamp: Date.now(),
      });
      return result;
    });

    await ConcurrentExecutor.execute(operations, { concurrency });

    // 按时间戳排序，检查是否有异常的时间顺序
    const sorted = [...results].toSorted((a, b) => a.timestamp - b.timestamp);

    // 简单的竞态条件检测：如果结果的时间戳顺序与执行顺序不符
    const hasRaceConditions = sorted.some((item, index) => {
      // 如果结果的执行顺序远大于其在时间序列中的位置，可能有竞态条件
      return Math.abs(item.iteration - index) > concurrency;
    });

    return {
      hasRaceConditions,
      details: sorted,
    };
  }
}

/**
 * 并发操作辅助类
 */
export class ConcurrentOperations {
  /**
   * 并发工具执行
   */
  static async executeTools(
    toolExecutor: (toolName: string, args: Record<string, unknown>) => Promise<unknown>,
    tools: Array<{ name: string; args: Record<string, unknown> }>,
    concurrency: number = 10,
  ) {
    const operations = tools.map((tool) => () => toolExecutor(tool.name, tool.args));

    return ConcurrentExecutor.execute(operations, { concurrency });
  }

  /**
   * 并发服务器连接
   */
  static async connectServers(
    serverConnector: (serverId: string) => Promise<void>,
    serverIds: string[],
    concurrency: number = 5,
  ) {
    const operations = serverIds.map((id) => () => serverConnector(id));

    return ConcurrentExecutor.execute(operations, { concurrency });
  }

  /**
   * 并发配置加载
   */
  static async loadConfigs(
    configLoader: (configPath: string) => Promise<unknown>,
    configPaths: string[],
    concurrency: number = 3,
  ) {
    const operations = configPaths.map((path) => () => configLoader(path));

    return ConcurrentExecutor.execute(operations, { concurrency });
  }
}
