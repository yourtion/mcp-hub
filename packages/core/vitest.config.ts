import path from 'node:path';
import { mergeConfig } from 'vitest/config';

import configShared from '../../vitest.shared.js';

export default mergeConfig(configShared, {
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../share/src'),
    },
  },
  test: {
    name: 'core',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],

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
        'src/test-utils/',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
});
