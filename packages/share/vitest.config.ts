import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'share',
    globals: true,
    environment: 'node',
    watch: false,
    include: ['src/**/*.test.ts'],

    // 修复 vitest 不退出问题
    pool: 'forks',
    maxWorkers: 1,

    // 测试超时配置
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 10000,

    // 限制并发
    maxConcurrency: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
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
    },
  },
});
