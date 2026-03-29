import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../core/src'),
      '@mcp-core/mcp-hub-share/config': path.resolve(__dirname, '../share/src/config/index.ts'),
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../share/src'),
    },
  },
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
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'src/test-utils/', // 排除测试工具
      ],
    },
  },
});
