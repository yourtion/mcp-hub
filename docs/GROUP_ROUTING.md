# 组路由功能使用指南

MCP Hub 的组路由功能允许您通过特定的组路径 (`/:group/mcp`) 访问不同组的 MCP 工具，实现更好的工具组织和访问控制。

## 概述

组路由功能提供以下核心能力：

- **组隔离**: 不同组之间的工具访问完全隔离
- **工具过滤**: 每个组可以配置允许的工具列表
- **访问控制**: 支持组级别的验证密钥
- **灵活配置**: 每个组可以使用不同的 MCP 服务器组合

## 配置

### 组配置文件

在 `backend/config/group.json` 中定义组配置：

```json
{
  "groups": {
    "development": {
      "name": "开发工具组",
      "description": "软件开发相关的工具集合",
      "servers": ["filesystem", "git", "npm"],
      "allowedTools": [
        "read_file",
        "write_file", 
        "list_directory",
        "git_status",
        "git_commit",
        "npm_install"
      ],
      "validationKey": "dev-secret-key-123",
      "enabled": true
    },
    "research": {
      "name": "研究工具组",
      "description": "信息收集和研究工具",
      "servers": ["brave-search", "wikipedia", "arxiv"],
      "allowedTools": [
        "search",
        "lookup",
        "get_article",
        "search_papers"
      ],
      "validationKey": "research-secret-key-456",
      "enabled": true
    },
    "admin": {
      "name": "管理工具组", 
      "description": "系统管理和监控工具",
      "servers": ["system-monitor", "log-analyzer"],
      "allowedTools": ["*"],
      "validationKey": "admin-secret-key-789",
      "enabled": true,
      "requireAuth": true
    }
  }
}
```

### 配置字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 组的显示名称 |
| `description` | string | 否 | 组的描述信息 |
| `servers` | string[] | 是 | 该组使用的 MCP 服务器列表 |
| `allowedTools` | string[] | 否 | 允许的工具列表，`["*"]` 表示允许所有工具 |
| `validationKey` | string | 否 | 组的验证密钥 |
| `enabled` | boolean | 否 | 是否启用该组（默认 true） |
| `requireAuth` | boolean | 否 | 是否需要身份验证（默认 false） |

### MCP 服务器配置

确保在 `backend/config/mcp_service.json` 中配置了组所需的 MCP 服务器：

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
      "env": {}
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git", "/workspace"],
      "env": {}
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

## API 使用

### 基本端点

组路由提供以下端点：

```
GET    /:group/mcp/list_tools    # 列出组的可用工具
POST   /:group/mcp/call_tool     # 调用组内的工具
GET    /api/groups               # 列出所有组
GET    /api/groups/:group        # 获取特定组信息
GET    /api/groups/:group/health # 检查组健康状态
```

### 列出组的工具

```bash
# 获取开发组的所有工具
curl http://localhost:3000/development/mcp/list_tools

# 响应示例
{
  "tools": [
    {
      "name": "read_file",
      "description": "读取文件内容",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "文件路径"
          }
        },
        "required": ["path"]
      }
    },
    {
      "name": "write_file", 
      "description": "写入文件内容",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {"type": "string"},
          "content": {"type": "string"}
        },
        "required": ["path", "content"]
      }
    }
  ]
}
```

### 调用组内工具

```bash
# 在开发组中调用文件读取工具
curl -X POST http://localhost:3000/development/mcp/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "read_file",
    "arguments": {
      "path": "/workspace/README.md"
    }
  }'

# 响应示例
{
  "content": [
    {
      "type": "text",
      "text": "# My Project\n\nThis is a sample README file..."
    }
  ]
}
```

### 使用验证密钥

如果组配置了验证密钥，需要在请求头中提供：

```bash
# 使用验证密钥访问
curl -X POST http://localhost:3000/admin/mcp/call_tool \
  -H "Content-Type: application/json" \
  -H "X-Validation-Key: admin-secret-key-789" \
  -d '{
    "name": "system_status",
    "arguments": {}
  }'
```

## 组管理 API

### 列出所有组

```bash
curl http://localhost:3000/api/groups

# 响应
{
  "groups": [
    {
      "id": "development",
      "name": "开发工具组",
      "description": "软件开发相关的工具集合",
      "enabled": true,
      "toolCount": 6,
      "serverCount": 3
    },
    {
      "id": "research", 
      "name": "研究工具组",
      "description": "信息收集和研究工具",
      "enabled": true,
      "toolCount": 4,
      "serverCount": 3
    }
  ]
}
```

### 获取组详细信息

```bash
curl http://localhost:3000/api/groups/development

# 响应
{
  "id": "development",
  "name": "开发工具组",
  "description": "软件开发相关的工具集合",
  "servers": ["filesystem", "git", "npm"],
  "allowedTools": ["read_file", "write_file", "list_directory"],
  "enabled": true,
  "requireAuth": false,
  "stats": {
    "toolCount": 6,
    "serverCount": 3,
    "lastUsed": "2024-01-15T10:30:00Z"
  }
}
```

### 检查组健康状态

```bash
curl http://localhost:3000/api/groups/development/health

# 响应
{
  "group": "development",
  "status": "healthy",
  "servers": {
    "filesystem": {
      "status": "connected",
      "responseTime": 45
    },
    "git": {
      "status": "connected", 
      "responseTime": 32
    },
    "npm": {
      "status": "error",
      "error": "Connection timeout"
    }
  },
  "overallHealth": "degraded"
}
```

## 错误处理

### 常见错误响应

#### 组不存在

```bash
curl http://localhost:3000/nonexistent/mcp/list_tools

# 响应 (404)
{
  "error": "GROUP_NOT_FOUND",
  "message": "组 'nonexistent' 不存在",
  "code": 404
}
```

#### 工具不在允许列表中

```bash
# 响应 (403)
{
  "error": "TOOL_NOT_ALLOWED",
  "message": "工具 'system_reboot' 不在组 'development' 的允许列表中",
  "code": 403,
  "allowedTools": ["read_file", "write_file", "list_directory"]
}
```

#### 验证密钥错误

```bash
# 响应 (401)
{
  "error": "INVALID_VALIDATION_KEY",
  "message": "无效的验证密钥",
  "code": 401
}
```

#### 服务器连接失败

```bash
# 响应 (503)
{
  "error": "SERVICE_UNAVAILABLE", 
  "message": "组 'development' 的服务器连接失败",
  "code": 503,
  "details": {
    "failedServers": ["git"],
    "availableServers": ["filesystem"]
  }
}
```

## 高级功能

### 动态工具过滤

可以在运行时动态调整工具过滤规则：

```bash
# 更新组的允许工具列表
curl -X PATCH http://localhost:3000/api/groups/development \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: admin-secret" \
  -d '{
    "allowedTools": ["read_file", "write_file", "git_status"]
  }'
```

### 组级别的工具别名

为工具创建组特定的别名：

```json
{
  "groups": {
    "development": {
      "name": "开发工具组",
      "servers": ["filesystem", "git"],
      "toolAliases": {
        "read": "read_file",
        "write": "write_file",
        "status": "git_status"
      }
    }
  }
}
```

```bash
# 使用别名调用工具
curl -X POST http://localhost:3000/development/mcp/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "read",
    "arguments": {
      "path": "/workspace/package.json"
    }
  }'
```

### 组级别的参数验证

为组配置自定义参数验证规则：

```json
{
  "groups": {
    "development": {
      "name": "开发工具组",
      "servers": ["filesystem"],
      "parameterValidation": {
        "read_file": {
          "path": {
            "pattern": "^/workspace/.*",
            "message": "只能访问 /workspace 目录下的文件"
          }
        }
      }
    }
  }
}
```

## 监控和日志

### 组使用统计

```bash
# 获取组使用统计
curl http://localhost:3000/api/groups/development/stats

# 响应
{
  "group": "development",
  "period": "24h",
  "stats": {
    "totalRequests": 156,
    "successfulRequests": 142,
    "failedRequests": 14,
    "averageResponseTime": 234,
    "topTools": [
      {"name": "read_file", "count": 89},
      {"name": "write_file", "count": 34},
      {"name": "git_status", "count": 19}
    ]
  }
}
```

### 组活动日志

```bash
# 获取组活动日志
curl http://localhost:3000/api/groups/development/logs?limit=10

# 响应
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:15Z",
      "level": "info",
      "message": "工具调用成功",
      "tool": "read_file",
      "duration": 45,
      "success": true
    },
    {
      "timestamp": "2024-01-15T10:29:32Z", 
      "level": "error",
      "message": "工具调用失败",
      "tool": "write_file",
      "error": "权限被拒绝",
      "success": false
    }
  ]
}
```

## 最佳实践

### 组设计原则

1. **按功能分组**: 根据工具的功能和用途创建组
2. **最小权限**: 只授予组必需的工具访问权限
3. **清晰命名**: 使用描述性的组名和描述
4. **文档化**: 为每个组提供详细的使用文档

### 安全考虑

1. **验证密钥**: 为敏感组设置强验证密钥
2. **工具过滤**: 严格控制每个组可访问的工具
3. **参数验证**: 对工具参数进行严格验证
4. **访问日志**: 记录所有组访问和工具调用

### 性能优化

1. **连接复用**: 多个组共享底层 MCP 服务器连接
2. **缓存策略**: 缓存工具列表和组配置
3. **负载均衡**: 在多个服务器实例间分配请求
4. **监控告警**: 监控组性能和可用性

### 故障处理

1. **优雅降级**: 部分服务器失败时继续提供可用工具
2. **重试机制**: 对临时失败实施重试
3. **故障隔离**: 一个组的故障不影响其他组
4. **快速恢复**: 提供快速的故障恢复机制

## 示例场景

### 开发团队使用场景

```bash
# 开发组 - 代码相关工具
curl http://localhost:3000/development/mcp/list_tools
curl -X POST http://localhost:3000/development/mcp/call_tool \
  -d '{"name": "read_file", "arguments": {"path": "/src/main.ts"}}'

# 测试组 - 测试相关工具  
curl http://localhost:3000/testing/mcp/call_tool \
  -d '{"name": "run_tests", "arguments": {"suite": "unit"}}'

# 部署组 - 部署相关工具
curl http://localhost:3000/deployment/mcp/call_tool \
  -H "X-Validation-Key: deploy-key" \
  -d '{"name": "deploy", "arguments": {"environment": "staging"}}'
```

### 研究团队使用场景

```bash
# 文献研究组
curl -X POST http://localhost:3000/research/mcp/call_tool \
  -d '{"name": "search_papers", "arguments": {"query": "machine learning"}}'

# 数据分析组
curl -X POST http://localhost:3000/analysis/mcp/call_tool \
  -d '{"name": "analyze_data", "arguments": {"dataset": "experiment_results.csv"}}'
```

## 参考资料

- [MCP Hub API 参考](API_REFERENCE.md)
- [配置文件格式](CONFIGURATION.md)
- [故障排除指南](TROUBLESHOOTING.md)
- [安全最佳实践](SECURITY.md)