import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../core/src'),
      '@mcp-core/mcp-hub-share/config': path.resolve(
        __dirname,
        '../share/src/config/index.ts',
      ),
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../share/src'),
    },
  },
  test: {
    name: 'cli',
    globals: true,
    environment: 'node',
    watch: false,
    include: ['src/**/*.test.ts'],
    exclude: ['src/e2e/**', 'src/integration/**'],
    setupFiles: ['./vitest.setup.ts'],

    // 修复 vitest 不退出问题
    pool: 'forks',
    maxWorkers: 1,

    // 测试超时配置
    testTimeout: 5000,
    hookTimeout: 2000,
    teardownTimeout: 1000,

    // 限制并发
    maxConcurrency: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    reporters: ['verbose'],
  },
});
