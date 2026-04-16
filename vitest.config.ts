import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 全局共享配置（所有 project 继承）
    globals: true,
    watch: false,

    // Mock 行为
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    // 默认超时
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 10000,

    // 共享 setup 文件
    setupFiles: ['./vitest.setup.ts'],

    // coverage 默认配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.*',
        'vitest.setup.*',
        'test/',
      ],
    },

    // 项目定义 - 使用 glob 匹配子包配置文件
    projects: [
      './packages/share/vitest.config.ts',
      './packages/core/vitest.config.ts',
      './packages/cli/vitest.config.ts',
      './backend/vitest.config.ts',
      './frontend/vitest.config.ts',
    ],
  },
});
