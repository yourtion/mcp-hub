import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // 排除可能导致挂起的端到端测试
      'src/e2e/scenarios/**',
      'src/e2e/mcp-protocol/**',
    ],
    testTimeout: 10000, // 减少超时时间
    hookTimeout: 5000,
    teardownTimeout: 3000,
    // 强制退出配置
    forceRerunTriggers: ['**/vitest.config.*', '**/vite.config.*'],
    // 测试完成后强制退出
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'src/e2e/**',
      ],
    },
  },
});
