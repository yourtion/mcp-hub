# 端到端测试文档

## 概述

端到端测试套件用于验证MCP Hub系统的完整功能流程，确保所有组件能够正确协同工作。测试覆盖了用户场景、向后兼容性和错误恢复等关键方面。

## 测试结构

```
backend/src/e2e/
├── scenarios/                    # 测试场景
│   ├── user-scenarios.test.ts    # 用户使用场景测试
│   ├── backward-compatibility.test.ts  # 向后兼容性测试
│   └── error-recovery.test.ts    # 错误处理和恢复测试
├── test-utils.ts                 # 端到端测试工具函数
├── e2e.config.ts                 # 端到端测试配置
├── index.test.ts                 # 主测试入口
└── README.md                     # 本文档
```

## 测试类型

### 1. 用户场景测试 (`user-scenarios.test.ts`)

测试完整的用户使用流程：

- **新用户首次使用场景**: 从系统发现到工具使用的完整流程
- **高级用户工作流场景**: 复杂的多步骤操作和批量处理
- **管理员场景**: 系统监控、诊断和维护操作
- **错误恢复场景**: 临时错误的处理和恢复
- **性能和负载场景**: 并发访问和高频请求处理

### 2. 向后兼容性测试 (`backward-compatibility.test.ts`)

确保新功能不会破坏现有API：

- **原有MCP端点兼容性**: 验证现有端点仍然可用
- **配置文件兼容性**: 支持旧版本配置格式
- **API响应格式兼容性**: 保持响应结构一致
- **HTTP状态码兼容性**: 状态码行为保持一致
- **错误处理兼容性**: 错误响应格式保持一致
- **性能兼容性**: 响应时间和并发处理能力
- **功能兼容性**: 现有功能完整性验证

### 3. 错误处理和恢复测试 (`error-recovery.test.ts`)

测试系统在各种错误情况下的处理能力：

- **网络错误处理**: 超时、连接中断等网络问题
- **服务器错误处理**: 内部错误、服务不可用等情况
- **数据错误处理**: 无效参数、恶意请求等数据问题
- **资源限制处理**: 高并发、内存压力等资源问题
- **恢复机制测试**: 自动恢复、故障转移等机制
- **错误日志和监控**: 错误记录和系统健康监控

## 运行测试

### 基本命令

```bash
# 运行所有端到端测试
npm run test:e2e

# 运行特定场景测试
npm run test:scenarios

# 运行所有测试（包括单元测试和端到端测试）
npm run test:all

# 详细输出模式
npm run test:e2e:verbose

# 生成覆盖率报告
npm run test:e2e:coverage
```

### 高级用法

```bash
# 使用自定义脚本运行
tsx scripts/run-e2e-tests.ts

# 运行特定模式的测试
tsx scripts/run-e2e-tests.ts --pattern "**/*user*.test.ts"

# 设置超时时间
tsx scripts/run-e2e-tests.ts --timeout 60000

# 详细输出并生成覆盖率
tsx scripts/run-e2e-tests.ts --verbose --coverage

# 快速失败模式
tsx scripts/run-e2e-tests.ts --bail
```

## 测试配置

### 环境变量

- `NODE_ENV=test`: 设置为测试环境
- `TEST_ENV=e2e`: 标识为端到端测试
- `LOG_LEVEL=ERROR`: 减少日志输出

### 超时设置

- 默认测试超时: 30秒
- Hook超时: 15秒
- 清理超时: 10秒

### 性能基准

- 最大响应时间: 5秒
- 最大内存增长: 100MB
- 并发请求限制: 10个

## 测试工具

### 测试工具函数 (`test-utils.ts`)

- `safeJsonParse()`: 安全的JSON解析
- `sleep()`: 延迟函数
- `retry()`: 重试机制
- `createTestScenario()`: 创建测试场景
- `executeScenarioStep()`: 执行测试步骤
- `generateTestReport()`: 生成测试报告
- `createPerformanceBenchmark()`: 性能基准测试

### 测试配置 (`e2e.config.ts`)

- 超时和重试配置
- 性能基准设置
- 测试数据生成器
- 测试结果收集器

## 最佳实践

### 1. 测试隔离

- 每个测试都应该独立运行
- 使用 `beforeEach` 和 `afterEach` 进行清理
- 避免测试之间的状态共享

### 2. 错误处理

- 使用 `try-catch` 处理异步操作
- 提供有意义的错误信息
- 验证错误响应的格式和内容

### 3. 性能考虑

- 设置合理的超时时间
- 监控内存使用情况
- 限制并发请求数量

### 4. 数据管理

- 使用模拟数据而不是真实数据
- 清理测试产生的临时数据
- 避免硬编码的测试数据

## 故障排除

### 常见问题

1. **测试超时**
   - 检查网络连接
   - 增加超时时间
   - 验证服务是否正常启动

2. **内存泄漏**
   - 检查是否正确清理资源
   - 验证事件监听器是否被移除
   - 使用内存分析工具

3. **并发问题**
   - 使用单线程模式运行测试
   - 添加适当的延迟
   - 检查共享资源的访问

### 调试技巧

1. **启用详细输出**
   ```bash
   npm run test:e2e:verbose
   ```

2. **运行单个测试文件**
   ```bash
   npx vitest src/e2e/scenarios/user-scenarios.test.ts
   ```

3. **使用调试器**
   ```bash
   node --inspect-brk node_modules/.bin/vitest
   ```

## 持续集成

### CI配置建议

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:e2e
        env:
          NODE_ENV: test
          TEST_ENV: ci
```

### 报告和监控

- 生成测试报告
- 监控测试执行时间
- 跟踪测试覆盖率
- 设置失败通知

## 贡献指南

### 添加新测试

1. 确定测试类型（用户场景、兼容性、错误处理）
2. 选择合适的测试文件
3. 使用现有的测试工具函数
4. 添加适当的断言和验证
5. 更新文档

### 测试命名规范

- 使用描述性的测试名称
- 遵循 "应该能够..." 的格式
- 包含测试的具体场景

### 代码风格

- 使用TypeScript类型注解
- 添加适当的注释
- 遵循项目的代码规范
- 使用async/await处理异步操作