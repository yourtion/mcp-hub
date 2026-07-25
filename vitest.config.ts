import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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

    // 项目定义
    projects: [
      './packages/share/vitest.config.ts',
      './packages/core/vitest.config.ts',
      './packages/cli/vitest.config.ts',
      './backend/vitest.config.ts',
      './backend/vitest.e2e.config.ts',
      './frontend/vitest.config.ts',
    ],
  },
});
