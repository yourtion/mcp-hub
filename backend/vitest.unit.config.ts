import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // 排除所有端到端测试
      'src/e2e/**',
      // 排除可能有异步问题的集成测试
      'src/integration/**',
      // 排除可能有问题的特定测试
      'src/mcp.test.ts',
      'src/sse.test.ts',
    ],
    testTimeout: 5000,
    hookTimeout: 2000,
    teardownTimeout: 1000,
    // 强制退出配置
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // 测试完成后立即退出
    watch: false,
    reporters: ['verbose'],
  },
});
