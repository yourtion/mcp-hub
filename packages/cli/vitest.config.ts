import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts'
      ]
    },
    // 处理 ES 模块
    deps: {
      external: [/node_modules/]
    }
  },
  // 确保正确处理工作区依赖
  resolve: {
    alias: {
      '@mcp-core/mcp-hub-core': new URL('../core/src/index.ts', import.meta.url).pathname,
      '@mcp-core/mcp-hub-share': new URL('../share/src/index.ts', import.meta.url).pathname
    }
  }
})