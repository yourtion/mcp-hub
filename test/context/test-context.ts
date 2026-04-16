/**
 * TestContext - 统一的测试资源生命周期管理器
 *
 * 设计原则：
 * 1. 注册式资源管理 - 测试代码注册资源，框架保证清理
 * 2. LIFO 清理顺序 - 后注册的资源先清理（依赖关系）
 * 3. 容错清理 - 单个资源清理失败不影响其他资源
 */

type CleanupFn = () => Promise<void> | void;

export class TestContext {
  private resources = new Map<string, CleanupFn>();
  private cleanupOrder: string[] = [];
  private disposed = false;

  private static activeContext: TestContext | null = null;

  /** 获取当前测试的 TestContext */
  static getCurrent(): TestContext {
    if (!TestContext.activeContext) {
      TestContext.activeContext = new TestContext();
    }
    return TestContext.activeContext;
  }

  /** 重置当前 context（清理所有资源） */
  static async resetCurrent(): Promise<void> {
    const ctx = TestContext.activeContext;
    if (ctx) {
      await ctx.dispose();
    }
    TestContext.activeContext = null;
  }

  /**
   * 注册一个需要清理的资源
   * @param name 资源标识符（用于调试）
   * @param cleanupFn 清理函数
   */
  register(name: string, cleanupFn: CleanupFn): void {
    if (this.resources.has(name)) {
      const existing = this.resources.get(name)!;
      Promise.resolve(existing()).catch(() => {});
    }
    this.resources.set(name, cleanupFn);
    this.cleanupOrder = this.cleanupOrder.filter((n) => n !== name);
    this.cleanupOrder.push(name);
  }

  /**
   * 注销指定资源（立即清理并移除）
   */
  async unregister(name: string): Promise<void> {
    const fn = this.resources.get(name);
    if (fn) {
      await fn();
      this.resources.delete(name);
      this.cleanupOrder = this.cleanupOrder.filter((n) => n !== name);
    }
  }

  /** 检查资源是否已注册 */
  has(name: string): boolean {
    return this.resources.has(name);
  }

  /**
   * 按 LIFO 顺序清理所有资源
   * 容错：单个失败不阻止其他资源的清理
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    const errors: Array<{ name: string; error: unknown }> = [];

    for (const name of [...this.cleanupOrder].reverse()) {
      const fn = this.resources.get(name);
      if (fn) {
        try {
          await fn();
        } catch (error) {
          errors.push({ name, error });
        }
      }
    }

    this.resources.clear();
    this.cleanupOrder = [];

    if (errors.length > 0) {
      console.warn(
        `[TestContext] ${errors.length} resource(s) failed to clean up:`,
        errors.map((e) => e.name),
      );
    }
  }
}

/**
 * 在测试中使用的 hook 函数
 * 返回当前测试的 TestContext 实例
 *
 * @example
 * const ctx = useTestContext();
 * ctx.register('test-server', () => server.stop());
 */
export function useTestContext(): TestContext {
  return TestContext.getCurrent();
}
