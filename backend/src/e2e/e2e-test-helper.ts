/**
 * E2E 测试辅助工具
 * 提供等待、健康检查、工具执行等辅助函数
 */

/**
 * E2E 测试辅助类
 */
// biome-ignore lint/complexity/noStaticOnlyClass: test utility grouping
export class E2ETestHelper {
  /**
   * 等待条件满足
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number;
      interval?: number;
      message?: string;
    } = {},
  ): Promise<void> {
    const {
      timeout: _timeout = 10000,
      interval: _interval = 100,
      message = 'Condition not met',
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < _timeout) {
      if (await condition()) {
        return;
      }

      await E2ETestHelper.delay(_interval);
    }

    throw new Error(`${message} (timeout: ${_timeout}ms)`);
  }

  /**
   * 等待服务器健康
   */
  static async waitForServerHealthy(
    baseUrl: string,
    serverId: string,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<void> {
    const { timeout = 30000, interval = 500 } = options;

    await E2ETestHelper.waitFor(
      async () => {
        try {
          const response = await fetch(`${baseUrl}/api/servers/${serverId}/health`);
          const data = await response.json();
          return data.healthy === true;
        } catch {
          return false;
        }
      },
      {
        timeout,
        interval,
        message: `Server ${serverId} did not become healthy`,
      },
    );
  }

  /**
   * 等待工具可用
   */
  static async waitForToolAvailable(
    baseUrl: string,
    toolName: string,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<void> {
    const { timeout = 10000, interval = 500 } = options;

    await E2ETestHelper.waitFor(
      async () => {
        try {
          const response = await fetch(`${baseUrl}/api/tools`);
          const data = await response.json();
          return data.tools?.some((t: { name: string }) => t.name === toolName);
        } catch {
          return false;
        }
      },
      {
        timeout,
        interval,
        message: `Tool ${toolName} did not become available`,
      },
    );
  }

  /**
   * 执行工具并等待结果
   */
  static async executeToolAndWait(
    baseUrl: string,
    toolName: string,
    args: Record<string, unknown>,
    options: { timeout?: number; interval?: number } = {},
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { timeout: _timeout = 30000, interval: _interval = 500 } = options;

    try {
      const response = await fetch(`${baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: args }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json();
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 性能基准测试
   */
  static async benchmark(
    operation: () => Promise<unknown>,
    options: {
      iterations?: number;
      warmupIterations?: number;
      concurrency?: number;
    } = {},
  ): Promise<{
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    p95Time: number;
    p99Time: number;
    opsPerSecond: number;
  }> {
    const { iterations = 100, warmupIterations = 10, concurrency: _concurrency = 10 } = options;

    // 预热
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }

    // 实际测试
    const times: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const opStart = Date.now();
      await operation();
      times.push(Date.now() - opStart);
    }

    const totalTime = Date.now() - startTime;

    times.sort((a, b) => a - b);

    return {
      totalTime,
      avgTime: totalTime / iterations,
      minTime: times[0],
      maxTime: times[times.length - 1],
      p95Time: times[Math.floor(times.length * 0.95)],
      p99Time: times[Math.floor(times.length * 0.99)],
      opsPerSecond: (iterations / totalTime) * 1000,
    };
  }

  /**
   * 并发执行基准测试
   */
  static async concurrentBenchmark(
    operation: () => Promise<unknown>,
    options: {
      concurrency?: number;
      iterations?: number;
    } = {},
  ): Promise<{
    totalTime: number;
    avgTime: number;
    successRate: number;
    opsPerSecond: number;
  }> {
    const { concurrency = 10, iterations = 100 } = options;

    const operations = Array.from({ length: iterations }, () => operation);
    const startTime = Date.now();

    // 使用第二阶段创建的并发执行器
    const { execute } = await import('@mcp-core/mcp-hub-core/test-utils');

    const results = await execute(operations, { concurrency });

    const totalTime = Date.now() - startTime;
    const successful = results.filter((r) => r.success);

    return {
      totalTime,
      avgTime: totalTime / iterations,
      successRate: (successful.length / results.length) * 100,
      opsPerSecond: (iterations / totalTime) * 1000,
    };
  }

  /**
   * 重试操作
   */
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: number;
      retryIf?: (error: Error) => boolean;
    } = {},
  ): Promise<T> {
    const { maxAttempts = 3, delay = 100, backoff = 2, retryIf = () => true } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!retryIf(lastError) || attempt === maxAttempts - 1) {
          throw lastError ?? new Error('Operation failed');
        }

        // 指数退避
        await E2ETestHelper.delay(delay * backoff ** attempt);
      }
    }

    throw lastError ?? new Error('Operation failed after retries');
  }

  /**
   * 批量执行操作
   */
  static async batchExecute<T>(
    operations: Array<() => Promise<T>>,
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {},
  ): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
    const { batchSize = 10, delayBetweenBatches = 100 } = options;

    const results: Array<{
      success: boolean;
      result?: T;
      error?: Error;
    }> = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(batch.map((op) => op()));

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push({ success: true, result: result.value });
        } else {
          results.push({
            success: false,
            error: result.reason,
          });
        }
      });

      // 批次间延迟
      if (i + batchSize < operations.length) {
        await E2ETestHelper.delay(delayBetweenBatches);
      }
    }

    return results;
  }

  /**
   * 监控资源使用
   */
  static async monitorResources(
    operation: () => Promise<unknown>,
    options: {
      sampleInterval?: number;
    } = {},
  ): Promise<{
    memoryUsage: Array<{ timestamp: number; used: number; total: number }>;
    cpuUsage: number;
    duration: number;
  }> {
    const { sampleInterval = 100 } = options;

    const memoryUsage: Array<{
      timestamp: number;
      used: number;
      total: number;
    }> = [];

    const startTime = Date.now();
    let _lastSample = Date.now();

    // 开始监控
    const monitorInterval = setInterval(() => {
      const usage = process.memoryUsage();
      memoryUsage.push({
        timestamp: Date.now() - startTime,
        used: usage.heapUsed,
        total: usage.heapTotal,
      });
      _lastSample = Date.now();
    }, sampleInterval);

    try {
      await operation();
    } finally {
      clearInterval(monitorInterval);
    }

    const duration = Date.now() - startTime;

    // 简单的 CPU 使用率估算（不准确但有用）
    const cpuUsage = (memoryUsage.length * sampleInterval) / duration;

    return {
      memoryUsage,
      cpuUsage,
      duration,
    };
  }

  /**
   * 清理资源
   */
  static async cleanup(
    cleanupFns: Array<() => Promise<void> | void>,
    options: {
      timeout?: number;
      ignoreErrors?: boolean;
    } = {},
  ): Promise<void> {
    const { timeout = 5000, ignoreErrors = true } = options;

    const results = await Promise.allSettled(
      cleanupFns.map((fn) =>
        (() => {
          let timeoutId: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Cleanup timeout')), timeout);
            timeoutId.unref?.();
          });

          return Promise.race([fn(), timeoutPromise]).finally(() => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          });
        })(),
      ),
    );

    if (!ignoreErrors) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason);

      if (errors.length > 0) {
        throw new Error(`Cleanup failed: ${errors.map((e) => String(e)).join(', ')}`);
      }
    }
  }

  /**
   * 延迟函数
   */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 生成随机 ID
   */
  static randomId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 等待多个条件
   */
  static async waitForAll(
    conditions: Array<() => boolean | Promise<boolean>>,
    options: {
      timeout?: number;
      interval?: number;
    } = {},
  ): Promise<void> {
    const { timeout = 10000, interval = 100 } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(conditions.map((c) => c()));

      if (results.every((r) => r === true)) {
        return;
      }

      await E2ETestHelper.delay(interval);
    }

    throw new Error('Not all conditions met within timeout');
  }

  /**
   * 等待任意条件
   */
  static async waitForAny(
    conditions: Array<() => boolean | Promise<boolean>>,
    options: {
      timeout?: number;
      interval?: number;
    } = {},
  ): Promise<number> {
    const { timeout = 10000, interval = 100 } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(conditions.map((c) => c()));

      const firstTrue = results.findIndex((r) => r === true);
      if (firstTrue !== -1) {
        return firstTrue;
      }

      await E2ETestHelper.delay(interval);
    }

    throw new Error('No condition met within timeout');
  }

  /**
   * 测试网络延迟
   */
  static async measureNetworkLatency(
    baseUrl: string,
    options: {
      samples?: number;
      endpoint?: string;
    } = {},
  ): Promise<{
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    stdDev: number;
  }> {
    const { samples = 10, endpoint = '/api/health' } = options;

    const latencies: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = Date.now();

      try {
        await fetch(`${baseUrl}${endpoint}`);
        latencies.push(Date.now() - start);
      } catch {
        // 忽略错误
      }

      await E2ETestHelper.delay(100);
    }

    if (latencies.length === 0) {
      throw new Error('Failed to measure latency');
    }

    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);

    // 计算标准差
    const variance = latencies.reduce((sum, l) => sum + (l - avg) ** 2, 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    return {
      avgLatency: avg,
      minLatency: min,
      maxLatency: max,
      stdDev,
    };
  }

  /**
   * 模拟网络条件
   */
  static async simulateNetworkCondition<T>(
    operation: () => Promise<T>,
    condition: {
      latency?: number;
      packetLoss?: number;
    } = {},
  ): Promise<T> {
    const { latency = 0, packetLoss = 0 } = condition;

    // 模拟丢包
    if (packetLoss > 0 && Math.random() < packetLoss) {
      throw new Error('Simulated packet loss');
    }

    // 模拟延迟
    if (latency > 0) {
      // 添加一些随机抖动
      const jitter = latency * 0.2;
      const actualDelay = latency + (Math.random() - 0.5) * jitter;
      await E2ETestHelper.delay(actualDelay);
    }

    return operation();
  }
}

/**
 * E2E 测试场景辅助类
 */
// biome-ignore lint/complexity/noStaticOnlyClass: test utility grouping
export class E2EScenarioHelper {
  /**
   * 创建完整用户流程场景
   */
  static async completeUserJourney(baseUrl: string): Promise<{
    success: boolean;
    steps: Array<{ name: string; success: boolean; duration: number }>;
  }> {
    const steps: Array<{ name: string; success: boolean; duration: number }> = [];

    try {
      // 步骤 1: 系统启动
      const step1Start = Date.now();
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/health`);
            return response.ok;
          } catch {
            return false;
          }
        },
        { timeout: 10000, message: 'System health check failed' },
      );
      steps.push({
        name: 'System startup',
        success: true,
        duration: Date.now() - step1Start,
      });

      // 步骤 2: 配置加载
      const step2Start = Date.now();
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/config`);
            return response.ok;
          } catch {
            return false;
          }
        },
        { timeout: 5000, message: 'Config loading failed' },
      );
      steps.push({
        name: 'Config loaded',
        success: true,
        duration: Date.now() - step2Start,
      });

      // 步骤 3: 服务器注册
      const step3Start = Date.now();
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/servers`);
            const data = await response.json();
            return data.servers?.length > 0;
          } catch {
            return false;
          }
        },
        { timeout: 10000, message: 'Server registration failed' },
      );
      steps.push({
        name: 'Servers registered',
        success: true,
        duration: Date.now() - step3Start,
      });

      // 步骤 4: 工具发现
      const step4Start = Date.now();
      await E2ETestHelper.waitFor(
        async () => {
          try {
            const response = await fetch(`${baseUrl}/api/tools`);
            const data = await response.json();
            return data.tools?.length > 0;
          } catch {
            return false;
          }
        },
        { timeout: 10000, message: 'Tool discovery failed' },
      );
      steps.push({
        name: 'Tools discovered',
        success: true,
        duration: Date.now() - step4Start,
      });

      return { success: true, steps };
    } catch (_error) {
      return { success: false, steps };
    }
  }

  /**
   * 创建故障恢复场景
   */
  static async serverFailureRecovery(
    baseUrl: string,
    serverId: string,
  ): Promise<{
    success: boolean;
    recoveryTime: number;
    steps: Array<{ name: string; success: boolean; duration: number }>;
  }> {
    const steps: Array<{ name: string; success: boolean; duration: number }> = [];

    try {
      // 步骤 1: 检查初始健康状态
      const step1Start = Date.now();
      const initialHealth = await E2ETestHelper.waitForServerHealthy(baseUrl, serverId, {
        timeout: 5000,
      });
      steps.push({
        name: 'Initial health check',
        success: initialHealth,
        duration: Date.now() - step1Start,
      });

      // 步骤 2: 模拟服务器故障
      const step2Start = Date.now();
      await fetch(`${baseUrl}/api/servers/${serverId}/simulate-failure`, {
        method: 'POST',
      });
      steps.push({
        name: 'Simulate failure',
        success: true,
        duration: Date.now() - step2Start,
      });

      // 步骤 3: 等待故障检测
      const step3Start = Date.now();
      await E2ETestHelper.waitFor(
        async () => {
          const response = await fetch(`${baseUrl}/api/servers/${serverId}/health`);
          const data = await response.json();
          return data.healthy === false;
        },
        { timeout: 5000, message: 'Failure not detected' },
      );
      steps.push({
        name: 'Failure detected',
        success: true,
        duration: Date.now() - step3Start,
      });

      // 步骤 4: 等待自动恢复
      const step4Start = Date.now();
      const recoveryStartTime = Date.now();
      await E2ETestHelper.waitForServerHealthy(baseUrl, serverId, {
        timeout: 30000,
      });
      const recoveryTime = Date.now() - recoveryStartTime;
      steps.push({
        name: 'Server recovered',
        success: true,
        duration: Date.now() - step4Start,
      });

      return { success: true, recoveryTime, steps };
    } catch (_error) {
      return {
        success: false,
        recoveryTime: 0,
        steps,
      };
    }
  }
}
