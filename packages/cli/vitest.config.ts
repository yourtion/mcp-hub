import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': path.resolve(__dirname, '../core/src'),
      '@mcp-core/mcp-hub-share': path.resolve(__dirname, '../share/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts'],
    },
  },
});
