import { afterAll, afterEach, beforeEach, vi } from 'vitest';

import { TestContext } from './test/context/index.js';

// 每个测试前：重置 timers
beforeEach(() => {
  vi.useRealTimers();
});

// 每个测试后：清理所有已注册资源 + mocks + 环境变量
afterEach(async () => {
  // 1. 清理所有已注册资源
  await TestContext.resetCurrent();

  // 2. 重置 timers
  vi.useRealTimers();

  // 3. 清理环境变量
  delete process.env.CONFIG_PATH;
});

// 最终清理
afterAll(async () => {
  await TestContext.resetCurrent();
  vi.useRealTimers();
  delete process.env.CONFIG_PATH;
});
