import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import { pluginVue } from '@rsbuild/plugin-vue';

export default defineConfig({
  plugins: [pluginVue()],
  source: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // 定义全局常量
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  html: {
    title: 'MCP Hub 管理界面',
  },
  performance: {
    // 代码分割配置
    chunkSplit: {
      strategy: 'split-by-experience',
      override: {
        chunks: 'all',
        cacheGroups: {
          // 将Vue相关库打包到一起
          vue: {
            test: /[\\/]node_modules[\\/](vue|vue-router|pinia)[\\/]/,
            name: 'vendor-vue',
            priority: 20,
          },
          // 将TDesign UI库单独打包
          tdesign: {
            test: /[\\/]node_modules[\\/]tdesign-vue-next[\\/]/,
            name: 'vendor-tdesign',
            priority: 15,
          },
          // 其他第三方库
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
          },
        },
      },
    },
    // 预加载和预获取
    preload: {
      type: 'all-chunks',
    },
    prefetch: {
      type: 'async-chunks',
    },
  },
  output: {
    // 生产环境优化
    minify: {
      js: true,
      css: true,
      html: true,
    },
    // 启用source map用于生产环境调试
    sourceMap: {
      js: 'source-map',
      css: true,
    },
    // 文件名hash用于缓存
    filenameHash: true,
    // 清理输出目录
    cleanDistPath: true,
  },
});
