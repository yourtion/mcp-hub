import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [pluginVue()],
  source: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  html: {
    title: 'MCP Hub 管理界面',
  },
});
