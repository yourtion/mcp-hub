# @mcp-core/mcp-hub-cli

MCP Hub CLI包 - 提供命令行界面的MCP服务聚合器

## 功能特性

- 通过命令行界面聚合多个MCP服务
- 支持标准MCP协议通信
- 使用StdioServerTransport进行通信
- 支持配置文件管理和验证

## 安装

```bash
pnpm install @mcp-core/mcp-hub-cli
```

## 使用方法

### 基本使用

```bash
# 使用默认配置文件 (./mcp_service.json)
mcp-hub

# 指定配置文件路径
mcp-hub /path/to/config.json
```

### 配置文件格式

```json
{
  "servers": {
    "server1": {
      "command": "node",
      "args": ["server1.js"],
      "env": {}
    }
  },
  "logging": {
    "level": "info",
    "file": "./mcp-hub.log"
  },
  "transport": {
    "type": "stdio"
  }
}
```

## 开发

```bash
# 构建
pnpm build

# 开发模式
pnpm dev

# 运行测试
pnpm test

# 代码检查
pnpm check
```

## 架构

CLI包使用核心包 (`@mcp-core/mcp-hub-core`) 提供的MCP服务管理功能，通过StdioServerTransport实现MCP协议通信。

## 许可证

ISC