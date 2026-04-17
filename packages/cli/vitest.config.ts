import path from 'node:path';
import { mergeConfig } from 'vitest/config';
import configShared from '../../vitest.shared.js';

export default mergeConfig(configShared, {
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
    include: ['src/**/*.test.ts'],
    exclude: ['src/e2e/**', 'src/integration/**'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 5000,
    hookTimeout: 2000,
    teardownTimeout: 1000,
    reporters: ['verbose'],
  },
});
