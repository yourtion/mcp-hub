/**
 * 测试覆盖率配置
 * 定义各个包的覆盖率阈值和报告设置
 */

module.exports = {
  // 全局覆盖率设置
  global: {
    // 最低覆盖率阈值
    minThreshold: 80,
    // 推荐覆盖率阈值
    recommendedThreshold: 85,
  },
  
  // 各包的覆盖率配置
  packages: {
    backend: {
      name: '@mcp-core/mcp-hub-api',
      path: './backend',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      // 排除的文件模式
      exclude: [
        'src/e2e/**',
        'src/test-app.ts',
        'src/index.ts',
        'scripts/**',
      ],
    },
    
    core: {
      name: '@mcp-core/mcp-hub-core',
      path: './packages/core',
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
      exclude: [],
    },
    
    cli: {
      name: '@mcp-core/mcp-hub-cli',
      path: './packages/cli',
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
      exclude: [
        'bin/**',
      ],
    },
  },
  
  // 报告设置
  reports: {
    // 输出格式
    formats: ['text', 'json', 'html', 'lcov'],
    // 输出目录
    directory: 'coverage',
    // 是否生成详细报告
    detailed: true,
    // 是否在控制台显示
    console: true,
  },
  
  // CI/CD 集成设置
  ci: {
    // 是否在覆盖率不达标时失败
    failOnThreshold: true,
    // 是否上传到外部服务
    uploadToCodecov: true,
    // 是否生成 PR 评论
    commentOnPR: true,
  },
}