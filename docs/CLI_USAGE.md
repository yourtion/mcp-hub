# CLI 使用指南

MCP Hub CLI 包 (`@mcp-core/mcp-hub-cli`) 提供了一个独立的命令行 MCP 服务器，可以聚合多个 MCP 服务并通过标准 MCP 协议提供访问。

## 安装

### 从工作区安装

```bash
# 构建 CLI 包
cd packages/cli
pnpm build

# 直接运行
node dist/cli.js
```

### 全局安装（推荐）

```bash
# 从 npm 安装（发布后）
npm install -g @mcp-core/mcp-hub-cli

# 或从本地构建安装
cd packages/cli
npm pack
npm install -g mcp-core-mcp-hub-cli-1.0.0.tgz
```

## 基本使用

### 启动 CLI MCP 服务器

```bash
# 使用默认配置
mcp-hub

# 指定配置文件
mcp-hub --config /path/to/mcp_service.json

# 启用调试模式
mcp-hub --debug

# 指定日志级别
mcp-hub --log-level debug
```

### 命令行选项

```bash
mcp-hub [options]

选项:
  --config, -c <path>     指定配置文件路径 (默认: ./mcp_service.json)
  --log-level, -l <level> 设置日志级别 (debug|info|warn|error, 默认: info)
  --debug, -d             启用调试模式
  --help, -h              显示帮助信息
  --version, -v           显示版本信息
```

## 配置

### 配置文件格式

CLI 使用与 API 服务器相同的 `mcp_service.json` 配置格式：

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"],
      "env": {}
    },
    "brave-search": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "/path/to/git/repo"],
      "env": {}
    }
  }
}
```

### 配置文件位置

CLI 按以下顺序查找配置文件：

1. 命令行指定的路径 (`--config`)
2. 当前目录的 `mcp_service.json`
3. 用户主目录的 `.mcp_service.json`
4. 系统配置目录的 `mcp_service.json`

### 环境变量配置

```bash
# 设置默认配置文件路径
export MCP_HUB_CONFIG=/path/to/config.json

# 设置日志级别
export MCP_HUB_LOG_LEVEL=debug

# 启用调试模式
export MCP_HUB_DEBUG=true
```

## MCP 客户端集成

### Claude Desktop 集成

在 Claude Desktop 的配置文件中添加 MCP Hub CLI：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-hub": {
      "command": "mcp-hub",
      "args": ["--config", "/path/to/your/mcp_service.json"]
    }
  }
}
```

### 其他 MCP 客户端

CLI 服务器通过 stdin/stdout 实现标准 MCP 协议，可以与任何支持 MCP 的客户端集成：

```bash
# 直接与 CLI 服务器交互
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | mcp-hub
```

## 使用示例

### 基本工具列表

```bash
# 启动 CLI 服务器
mcp-hub --config examples/config.json

# 在另一个终端中测试
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | mcp-hub --config examples/config.json
```

### 调用工具

```bash
# 调用文件系统工具
echo '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/path/to/file.txt"
    }
  }
}' | mcp-hub
```

### 调试模式

```bash
# 启用详细日志
mcp-hub --debug --log-level debug

# 查看连接状态
mcp-hub --debug 2>&1 | grep "连接状态"
```

## 故障排除

### 常见问题

#### 1. 配置文件未找到

```bash
错误: 配置文件未找到: mcp_service.json

解决方案:
- 确保配置文件存在于当前目录
- 使用 --config 指定正确路径
- 检查文件权限
```

#### 2. MCP 服务器连接失败

```bash
错误: 无法连接到 MCP 服务器 'filesystem'

解决方案:
- 检查服务器命令和参数是否正确
- 确保所需的 npm 包已安装
- 验证环境变量设置
- 使用 --debug 查看详细错误信息
```

#### 3. 工具调用失败

```bash
错误: 工具调用失败: read_file

解决方案:
- 确保工具名称正确
- 检查工具参数格式
- 验证文件路径和权限
- 查看服务器日志
```

### 调试技巧

#### 启用详细日志

```bash
# 最详细的日志输出
mcp-hub --debug --log-level debug

# 只显示错误
mcp-hub --log-level error
```

#### 检查服务器状态

```bash
# 查看所有连接的服务器
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | mcp-hub --debug
```

#### 测试单个服务器

```bash
# 创建只包含一个服务器的测试配置
{
  "servers": {
    "test-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    }
  }
}
```

## 高级用法

### 自定义日志配置

```bash
# 将日志输出到文件
mcp-hub --log-level debug 2> mcp-hub.log

# 使用 systemd 运行（Linux）
sudo systemctl edit --force --full mcp-hub.service
```

### 性能优化

```bash
# 限制并发连接数
export MCP_HUB_MAX_CONNECTIONS=10

# 设置连接超时
export MCP_HUB_TIMEOUT=30000
```

### 安全配置

```bash
# 限制可执行的命令
export MCP_HUB_ALLOWED_COMMANDS="npx,node"

# 设置工作目录
export MCP_HUB_WORK_DIR=/safe/directory
```

## 开发和测试

### 本地开发

```bash
# 克隆仓库
git clone <repository-url>
cd mcp-hub

# 安装依赖
pnpm install

# 构建 CLI 包
cd packages/cli
pnpm build

# 运行测试
pnpm test

# 端到端测试
pnpm test:e2e
```

### 创建测试配置

```bash
# 创建测试配置文件
cat > test-config.json << EOF
{
  "servers": {
    "echo": {
      "command": "node",
      "args": ["-e", "console.log(JSON.stringify({result: 'Hello from echo server'}))"],
      "env": {}
    }
  }
}
EOF

# 测试配置
mcp-hub --config test-config.json --debug
```

## 最佳实践

### 配置管理

1. **使用版本控制**: 将配置文件纳入版本控制
2. **环境分离**: 为不同环境使用不同配置
3. **敏感信息**: 使用环境变量存储 API 密钥
4. **配置验证**: 定期验证配置文件格式

### 监控和日志

1. **结构化日志**: 使用 JSON 格式的日志
2. **日志轮转**: 配置日志文件轮转
3. **监控指标**: 监控连接状态和响应时间
4. **告警设置**: 为关键错误设置告警

### 安全考虑

1. **最小权限**: 只授予必要的文件系统权限
2. **网络隔离**: 在受限网络环境中运行
3. **输入验证**: 验证所有输入参数
4. **定期更新**: 保持依赖包更新

## 参考资料

- [MCP 协议规范](https://modelcontextprotocol.io/docs)
- [MCP SDK 文档](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Desktop MCP 配置](https://docs.anthropic.com/claude/docs/mcp)
- [项目 GitHub 仓库](https://github.com/your-org/mcp-hub)