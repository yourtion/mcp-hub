# MCP Hub 迁移指南

本指南帮助您从旧版本的 MCP Hub 升级到新的模块化架构版本。

## 概述

新版本的 MCP Hub 引入了以下重大变化：

- **模块化架构**: 代码重构为多个独立的包
- **组路由功能**: 新增基于组的 MCP 服务路由
- **CLI 包**: 独立的命令行 MCP 服务器
- **改进的配置系统**: 更灵活的配置管理
- **增强的错误处理**: 更好的错误处理和日志记录

## 版本兼容性

### 支持的升级路径

| 从版本 | 到版本 | 兼容性 | 说明 |
|--------|--------|--------|------|
| 0.x.x | 1.0.0+ | 🟡 部分兼容 | 需要配置迁移 |
| 无 | 1.0.0+ | ✅ 全新安装 | 按照安装指南操作 |

### 不兼容的变化

1. **包结构变化**: 代码重新组织为多个包
2. **配置文件格式**: 部分配置选项有变化
3. **API 端点**: 新增组路由端点
4. **依赖关系**: 新的包依赖结构

## 迁移步骤

### 1. 备份现有配置

在开始迁移之前，请备份您的现有配置：

```bash
# 备份配置文件
cp backend/config/mcp_service.json backend/config/mcp_service.json.backup
cp backend/config/system.json backend/config/system.json.backup

# 如果存在组配置
cp backend/config/group.json backend/config/group.json.backup 2>/dev/null || true
```

### 2. 更新代码库

#### 从 Git 更新

```bash
# 拉取最新代码
git pull origin main

# 安装新依赖
pnpm install

# 构建所有包
pnpm build
```

#### 全新克隆

```bash
# 克隆新版本
git clone <repository-url> mcp-hub-new
cd mcp-hub-new

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 3. 配置迁移

#### MCP 服务器配置

旧版本的 `mcp_service.json` 格式基本保持兼容，但建议检查以下项：

**旧格式 (0.x.x)**:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    }
  }
}
```

**新格式 (1.0.0+)** - 保持兼容:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {},
      "timeout": 30000,
      "retries": 3
    }
  }
}
```

#### 组配置（新功能）

如果您想使用新的组路由功能，需要创建 `group.json`：

```json
{
  "groups": {
    "default": {
      "name": "默认组",
      "description": "包含所有现有服务器的默认组",
      "servers": ["filesystem", "brave-search"],
      "allowedTools": ["*"],
      "enabled": true
    }
  }
}
```

#### 系统配置更新

检查 `system.json` 配置，新增了一些选项：

```json
{
  "port": 3000,
  "host": "localhost",
  "cors": {
    "enabled": true,
    "origins": ["*"]
  },
  "logging": {
    "level": "info",
    "format": "json"
  },
  "performance": {
    "enableMetrics": true,
    "metricsInterval": 60000
  }
}
```

### 4. 数据库迁移（如果适用）

如果您使用了持久化存储，可能需要迁移数据：

```bash
# 运行迁移脚本（如果存在）
pnpm migrate

# 或手动迁移数据
node scripts/migrate-data.js
```

### 5. 测试迁移结果

#### 验证 API 服务器

```bash
# 启动 API 服务器
pnpm dev:api

# 测试现有端点
curl http://localhost:3000/mcp/list_tools

# 测试新的组端点（如果配置了组）
curl http://localhost:3000/default/mcp/list_tools
```

#### 验证 CLI 功能

```bash
# 测试 CLI 包
cd packages/cli
pnpm build
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/cli.js
```

### 6. 更新部署配置

#### Docker 部署

如果您使用 Docker 部署，需要更新配置：

**旧版本**:
```yaml
# 单一容器部署
services:
  mcp-hub:
    build: .
    ports:
      - "3000:3000"
```

**新版本**:
```yaml
# 使用新的 docker-compose.yml
services:
  mcp-hub-api:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3000:3000"
  
  mcp-hub-cli:
    build:
      context: .
      dockerfile: packages/cli/Dockerfile
```

#### 环境变量更新

检查并更新环境变量：

```bash
# 新增的环境变量
export MCP_HUB_LOG_LEVEL=info
export MCP_HUB_ENABLE_METRICS=true
export MCP_HUB_CONFIG_DIR=/app/config
```

## 配置迁移示例

### 示例 1: 基本配置迁移

**迁移前** (`mcp_service.json`):
```json
{
  "servers": {
    "fs": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    }
  }
}
```

**迁移后**:

1. 保持 `mcp_service.json` 不变
2. 创建 `group.json`:
```json
{
  "groups": {
    "development": {
      "name": "开发环境",
      "servers": ["fs"],
      "allowedTools": ["*"]
    }
  }
}
```

### 示例 2: 复杂配置迁移

**迁移前**:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "search": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key"
      }
    }
  }
}
```

**迁移后**:

1. 更新 `mcp_service.json`:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "env": {},
      "timeout": 30000
    },
    "search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key"
      },
      "timeout": 60000
    }
  }
}
```

2. 创建 `group.json`:
```json
{
  "groups": {
    "development": {
      "name": "开发工具",
      "servers": ["filesystem"],
      "allowedTools": ["read_file", "write_file", "list_directory"]
    },
    "research": {
      "name": "研究工具",
      "servers": ["search"],
      "allowedTools": ["search"]
    },
    "admin": {
      "name": "管理工具",
      "servers": ["filesystem", "search"],
      "allowedTools": ["*"],
      "validationKey": "admin-secret"
    }
  }
}
```

## 故障排除

### 常见问题

#### 1. 包依赖错误

```bash
错误: Cannot find module '@mcp-core/mcp-hub-core'

解决方案:
pnpm install
pnpm build:core
```

#### 2. 配置文件格式错误

```bash
错误: Invalid configuration format

解决方案:
# 验证 JSON 格式
cat backend/config/mcp_service.json | jq .

# 使用配置验证工具
pnpm --filter @mcp-core/mcp-hub-api run validate-config
```

#### 3. 端口冲突

```bash
错误: Port 3000 is already in use

解决方案:
# 更改端口
export PORT=3001
# 或在 system.json 中修改
```

#### 4. 组路由不工作

```bash
错误: 404 Not Found for /:group/mcp

解决方案:
# 检查组配置
cat backend/config/group.json

# 确保组已启用
curl http://localhost:3000/api/groups
```

### 回滚步骤

如果迁移出现问题，可以回滚到旧版本：

```bash
# 1. 停止新版本服务
docker-compose down

# 2. 恢复配置文件
cp backend/config/mcp_service.json.backup backend/config/mcp_service.json

# 3. 切换到旧版本分支
git checkout old-version

# 4. 重新构建和启动
pnpm install
pnpm build
pnpm dev:api
```

## 性能优化建议

### 1. 连接池配置

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "pool": {
        "min": 1,
        "max": 5,
        "idleTimeout": 300000
      }
    }
  }
}
```

### 2. 缓存配置

```json
{
  "cache": {
    "enabled": true,
    "ttl": 300,
    "maxSize": 1000
  }
}
```

### 3. 日志优化

```json
{
  "logging": {
    "level": "warn",
    "format": "json",
    "rotation": {
      "enabled": true,
      "maxSize": "10MB",
      "maxFiles": 5
    }
  }
}
```

## 验证迁移成功

### 功能检查清单

- [ ] API 服务器正常启动
- [ ] 现有 `/mcp` 端点工作正常
- [ ] 新的组路由端点可访问（如果配置了组）
- [ ] CLI 包可以独立运行
- [ ] 所有配置的 MCP 服务器连接正常
- [ ] 工具调用功能正常
- [ ] 日志记录工作正常
- [ ] 性能指标收集正常（如果启用）

### 自动化验证脚本

```bash
#!/bin/bash
# 验证迁移成功的脚本

echo "🔍 验证 MCP Hub 迁移..."

# 检查 API 服务器
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API 服务器健康"
else
    echo "❌ API 服务器不健康"
    exit 1
fi

# 检查 MCP 端点
if curl -f http://localhost:3000/mcp/list_tools > /dev/null 2>&1; then
    echo "✅ MCP 端点工作正常"
else
    echo "❌ MCP 端点不工作"
    exit 1
fi

# 检查组端点（如果存在）
if [ -f "backend/config/group.json" ]; then
    FIRST_GROUP=$(cat backend/config/group.json | jq -r '.groups | keys[0]')
    if curl -f "http://localhost:3000/$FIRST_GROUP/mcp/list_tools" > /dev/null 2>&1; then
        echo "✅ 组路由工作正常"
    else
        echo "❌ 组路由不工作"
        exit 1
    fi
fi

echo "✅ 迁移验证成功！"
```

## 获取帮助

如果在迁移过程中遇到问题，可以通过以下方式获取帮助：

1. **查看日志**: 检查应用程序日志获取详细错误信息
2. **GitHub Issues**: 在项目仓库中创建 issue
3. **文档**: 查看其他文档文件获取更多信息
4. **社区**: 加入社区讨论获取帮助

## 相关文档

- [CLI 使用指南](CLI_USAGE.md)
- [组路由指南](GROUP_ROUTING.md)
- [API 参考](API_REFERENCE.md)
- [故障排除指南](TROUBLESHOOTING.md)