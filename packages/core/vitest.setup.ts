/**
 * Core 包 Vitest setup 文件
 * 仅负责 console mock，其他清理逻辑由根 vitest.setup.ts 处理
 */
import { vi } from 'vitest';

const isDebugMode = process.env.VITEST_DEBUG === 'true' || process.env.DEBUG === 'true';

if ((process.env.NODE_ENV === 'test' || process.env.VITEST) && !isDebugMode) {
  console.log = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
} else if (isDebugMode) {
  console.log('Core test debug mode enabled');
}

export const originalConsole = console;
