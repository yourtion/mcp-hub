# 测试调试模式使用指南

本文档介绍如何在测试过程中启用调试模式来查看日志输出。

## 概述

默认情况下，为了保持测试输出的清洁，我们会静默大部分的 console 输出（如 `console.log`、`console.info`、`console.debug`、`console.warn`）。但在调试测试时，这些日志信息可能非常有用。

## 启用调试模式

### 方法 1: 使用预定义的调试脚本

```bash
# 运行所有包的调试模式测试
pnpm test:debug

# 运行所有包的调试模式覆盖率测试
pnpm test:coverage:debug

# 运行单个包的调试模式测试
pnpm --filter @mcp-core/mcp-hub-cli test:debug
pnpm --filter @mcp-core/mcp-hub-core test:debug
pnpm --filter @mcp-core/mcp-hub-api test:debug

# 运行单个包的调试模式覆盖率测试
pnpm --filter @mcp-core/mcp-hub-cli test:coverage:debug
```

### 方法 2: 使用环境变量

```bash
# 使用 VITEST_DEBUG 环境变量
VITEST_DEBUG=true pnpm test

# 使用 DEBUG 环境变量
DEBUG=true pnpm test

# 运行特定测试文件
VITEST_DEBUG=true pnpm --filter @mcp-core/mcp-hub-cli vitest --run src/config/cli-config-manager.test.ts
```

## 调试模式 vs 正常模式对比

### 正常模式（完全静默）
- 只显示测试结果
- 所有 console 输出都被静默（包括 console.log、console.info、console.debug、console.warn、console.error）
- 输出非常清洁，专注于测试结果

### 调试模式（完全详细）
- 显示所有 console 输出
- 包括配置加载、缓存操作、服务初始化、错误信息等所有日志
- 便于调试测试逻辑和排查问题

## 示例对比

### 正常模式输出（完全静默）
```
✓ src/config/cli-config-manager.test.ts (15)
  ✓ CliConfigManager (15)
    ✓ loadConfig (6)
      ✓ 应该成功加载有效的配置文件
      ✓ 应该使用默认值填充缺失的配置项
      ...

Test Files  1 passed (1)
Tests  15 passed (15)
Duration  248ms
```

### 调试模式输出（完全详细）
```
🐛 CLI 测试调试模式已启用 - 将显示所有日志输出

stdout | 加载配置文件 {
  configPath: '/path/to/test-config.json'
}
stdout | 配置文件加载成功 {
  configPath: '/path/to/test-config.json',
  serverCount: 1,
  loggingLevel: 'debug'
}
stdout | 配置缓存已清除

stderr | 配置验证失败: ZodError: [
  {
    "code": "too_small",
    "message": "命令不能为空"
  }
]

✓ src/config/cli-config-manager.test.ts (15)
  ✓ CliConfigManager (15)
    ✓ loadConfig (6)
      ✓ 应该成功加载有效的配置文件
      ✓ 应该使用默认值填充缺失的配置项
      ...
```

## 支持的环境变量

- `VITEST_DEBUG=true` - 启用 Vitest 测试调试模式
- `DEBUG=true` - 通用调试模式标志

## 注意事项

1. **性能影响**: 调试模式会显示大量日志，可能会稍微影响测试运行速度
2. **输出量**: 在调试模式下，输出会非常详细，建议只在需要时使用
3. **CI/CD**: 在 CI/CD 环境中通常不需要启用调试模式，除非在排查特定问题

## 自定义调试输出

如果需要在测试中添加自定义的调试输出，可以使用原始的 console 对象：

```typescript
import { originalConsole } from './vitest.setup'

// 在测试中使用原始 console
originalConsole.log('这条日志总是会显示')
```

## 故障排除

### 调试模式不生效
1. 确保环境变量设置正确：`VITEST_DEBUG=true`
2. 检查是否在正确的包目录下运行命令
3. 确认 vitest.setup.ts 文件存在且配置正确

### 输出过多
1. 考虑只运行特定的测试文件而不是整个测试套件
2. 使用 vitest 的过滤选项来限制测试范围

### 某些日志仍然被过滤
1. 检查 vitest.setup.ts 中的错误过滤逻辑
2. 确认日志消息没有被错误过滤规则匹配
## CLI
 包的特殊处理

CLI 包使用自定义的 logger 系统，不能简单地通过 mock console 来控制日志输出。我们通过以下方式解决：

1. **自动检测测试环境**: CLI logger 会自动检测是否在测试环境中运行
2. **智能静默模式**: 在测试环境中自动启用静默模式，只显示警告和错误
3. **调试模式支持**: 通过 `VITEST_DEBUG=true` 可以在测试中显示所有日志
4. **测试友好的方法**: 特殊的显示方法（如 `showBanner`、`showHelp` 等）在测试环境中会被静默

### CLI 包测试日志控制的实现

- **环境检测**: 通过 `process.env.NODE_ENV === 'test'` 或 `process.env.VITEST` 检测测试环境
- **自动配置**: 测试环境中自动设置 `quiet: true` 和 `enableConsole: false`
- **调试模式**: `VITEST_DEBUG=true` 或 `DEBUG=true` 时恢复完整日志输出

### CLI 包调试模式示例

```bash
# 正常模式（静默）
pnpm --filter @mcp-core/mcp-hub-cli test

# 调试模式（显示所有日志）
pnpm --filter @mcp-core/mcp-hub-cli test:debug
```
##
 🎯 统一的 Logger 层面控制（推荐方式）

我们已经将所有模块从 mock console 的方式改为统一的 logger 层面控制，这样更加优雅且不会影响各模块的正常工作。

### 实现原理

所有模块的 logger 系统都会自动检测测试环境并调整行为：

1. **自动环境检测**: 通过 `process.env.NODE_ENV === 'test'` 或 `process.env.VITEST` 检测测试环境
2. **智能静默模式**: 测试环境中自动提升日志级别到 WARN，只显示警告和错误
3. **调试模式支持**: 通过 `VITEST_DEBUG=true` 或 `DEBUG=true` 恢复完整日志输出
4. **控制台输出控制**: 测试环境中可选择性禁用控制台输出

### 各模块实现

#### Core 包 (`@mcp-core/mcp-hub-core`)
- 使用 `StructuredLogger` 系统
- 默认配置自动检测测试环境
- 支持 JSON 和文本格式输出

#### Backend 包 (`@mcp-core/mcp-hub-api`)
- 使用 `ConsoleLogger` 系统
- 专门针对 MCP 操作的日志方法
- 支持服务器连接、工具发现等专用日志

#### CLI 包 (`@mcp-core/mcp-hub-cli`)
- 使用 `CliLogger` 系统
- 支持彩色输出和特殊显示方法
- 配置管理器也使用统一的 logger

### 使用方法

```bash
# 正常模式（静默）- 所有包
pnpm --filter @mcp-core/mcp-hub-core test
pnpm --filter @mcp-core/mcp-hub-api test
pnpm --filter @mcp-core/mcp-hub-cli test

# 调试模式（显示所有日志）- 所有包
pnpm --filter @mcp-core/mcp-hub-core test:debug
pnpm --filter @mcp-core/mcp-hub-api test:debug
pnpm --filter @mcp-core/mcp-hub-cli test:debug
```

### 优势

1. **不影响正常功能**: 不 mock console，各模块可正常使用 console 输出
2. **统一控制**: 所有模块使用相同的环境检测逻辑
3. **灵活调试**: 需要时可以轻松启用详细日志
4. **性能优化**: 测试时减少不必要的日志输出
5. **更加优雅**: 通过 logger 层面控制，而不是全局 mock