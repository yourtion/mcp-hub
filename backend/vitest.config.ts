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
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'src/e2e/**',
        'src/test-app.ts',
        'src/index.ts',
        'scripts/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      all: true,
      include: ['src/**/*.ts'],
    },
  },
});
