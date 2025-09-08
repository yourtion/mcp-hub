/**
 * Vitest 测试设置文件
 * 用于配置全局测试环境和 mock
 */

import { afterEach, beforeEach, vi } from 'vitest';

// Mock console 输出以减少测试时的噪音
const originalConsole = { ...console };

// 检查是否启用调试模式
const isDebugMode =
  process.env.VITEST_DEBUG === 'true' || process.env.DEBUG === 'true';

// 在测试环境中静默大部分 console 输出（除非在调试模式下）
if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && !isDebugMode) {
  // 保留 console.error 用于真正的错误
  console.log = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
  console.warn = vi.fn();

  // 静默所有错误输出，包括预期的错误
  console.error = vi.fn();
} else if (isDebugMode) {
  // 调试模式下显示所有日志
  console.log('🐛 Core 测试调试模式已启用 - 将显示所有日志输出');
}

// 全局测试钩子
beforeEach(() => {
  // 清理所有 mock 调用记录
  vi.clearAllMocks();
});

afterEach(() => {
  // 测试后清理
  vi.restoreAllMocks();
});

// 导出原始 console 供需要时使用
export { originalConsole };
