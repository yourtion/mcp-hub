import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../share/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    watch: false,

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
        'src/test-utils/', // 排除测试工具
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      all: true,
      include: ['src/**/*.ts'],
    },
  },
});
