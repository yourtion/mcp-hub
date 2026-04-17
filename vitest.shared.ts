import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * 共享 vitest 配置
 * 所有子项目通过 mergeConfig 继承此配置
 */
export default defineConfig({
  test: {
    globals: true,
    watch: false,
    environment: 'node',

    // Mock 行为
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    // 默认超时
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 10000,

    // 并行配置
    pool: 'forks',
    fileParallelism: true,
    maxConcurrency: Math.min(availableParallelism(), 8),

    // setup 文件由各子项目自行声明（路径相对于子项目根目录）
  },
});
