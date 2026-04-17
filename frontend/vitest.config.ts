import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { mergeConfig } from 'vitest/config';
import configShared from '../vitest.shared.js';

export default mergeConfig(configShared, {
  plugins: [vue()],
  test: {
    name: 'frontend',
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // jsdom 环境下 localStorage 等全局状态不支持并行
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
