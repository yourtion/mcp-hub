import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../packages/core/src'),
      '@mcp-core/mcp-hub-share': path.resolve(
        __dirname,
        '../packages/share/src',
      ),
    },
  },
  test: {
    name: 'api-unit',
    globals: true,
    environment: 'node',
    watch: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/e2e/**',
      'src/integration/**',
      'src/mcp.test.ts',
      'src/sse.test.ts',
    ],

    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    maxConcurrency: 1,
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
    },
  },
});
