import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    include: ['src/**/*.test.ts'],

    // 修复 vitest 不退出问题
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // 测试超时配置
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 10000,

    // 限制并发
    maxConcurrency: 1,
    fileParallelism: false,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'vitest.config.ts',
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
