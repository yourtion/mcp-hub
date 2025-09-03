# MCP Hub API 参考

本文档提供 MCP Hub API 的完整参考，包括所有端点、请求/响应格式和使用示例。

## 基础信息

- **基础 URL**: `http://localhost:3000`
- **API 版本**: v1
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证

MCP Hub 支持两种认证方式：

### 1. JWT 认证（推荐）

用于Web界面和需要用户身份验证的API端点：

```http
Authorization: Bearer <access-token>
```

### 2. 验证密钥认证

用于组级别的工具访问控制：

```http
X-Validation-Key: your-validation-key
```

## 认证 API

### 用户登录

用户登录获取访问令牌。

```http
POST /api/auth/login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "admin",
      "username": "admin",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 刷新访问令牌

使用刷新令牌获取新的访问令牌。

```http
POST /api/auth/refresh
```

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 用户登出

撤销当前访问令牌。

```http
POST /api/auth/logout
```

**请求头**:
```http
Authorization: Bearer <access-token>
```

**响应**:
```json
{
  "success": true,
  "message": "登出成功",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 获取当前用户信息

获取当前登录用户的详细信息。

```http
GET /api/auth/me
```

**请求头**:
```http
Authorization: Bearer <access-token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "admin",
      "username": "admin",
      "role": "admin",
      "groups": ["admin-group"],
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-01-15T10:30:00Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 全局 MCP 端点

### 列出所有工具

获取所有可用的 MCP 工具列表。

```http
GET /mcp/list_tools
```

**响应**:
```json
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
    }
  ]
}
```

### 调用工具

执行指定的 MCP 工具。

```http
POST /mcp/call_tool
```

**请求体**:
```json
{
  "name": "read_file",
  "arguments": {
    "path": "/path/to/file.txt"
  }
}
```

**响应**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "文件内容..."
    }
  ]
}
```

## 组路由端点

### 列出组的工具

获取指定组的可用工具列表。

```http
GET /:group/mcp/list_tools
```

**路径参数**:
- `group` (string): 组标识符

**响应**:
```json
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
    }
  ],
  "group": "development",
  "serverCount": 2,
  "toolCount": 5
}
```

### 调用组内工具

在指定组内执行工具。

```http
POST /:group/mcp/call_tool
```

**路径参数**:
- `group` (string): 组标识符

**请求头**:
```http
Content-Type: application/json
X-Validation-Key: group-validation-key  # 如果组需要验证
```

**请求体**:
```json
{
  "name": "read_file",
  "arguments": {
    "path": "/workspace/README.md"
  }
}
```

**响应**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "# My Project\n\nThis is a README file..."
    }
  ],
  "metadata": {
    "group": "development",
    "server": "filesystem",
    "executionTime": 45
  }
}
```

## 组管理 API

### 列出所有组

获取所有配置的组列表。

```http
GET /api/groups
```

**响应**:
```json
{
  "groups": [
    {
      "id": "development",
      "name": "开发工具组",
      "description": "软件开发相关工具",
      "enabled": true,
      "toolCount": 6,
      "serverCount": 3,
      "requireAuth": false
    },
    {
      "id": "research",
      "name": "研究工具组", 
      "description": "信息收集和研究工具",
      "enabled": true,
      "toolCount": 4,
      "serverCount": 2,
      "requireAuth": false
    }
  ],
  "total": 2
}
```

### 获取组详情

获取指定组的详细信息。

```http
GET /api/groups/:group
```

**路径参数**:
- `group` (string): 组标识符

**响应**:
```json
{
  "id": "development",
  "name": "开发工具组",
  "description": "软件开发相关工具",
  "servers": ["filesystem", "git", "npm"],
  "allowedTools": [
    "read_file",
    "write_file",
    "list_directory",
    "git_status",
    "git_commit"
  ],
  "enabled": true,
  "requireAuth": false,
  "stats": {
    "toolCount": 5,
    "serverCount": 3,
    "lastUsed": "2024-01-15T10:30:00Z",
    "totalRequests": 156,
    "successRate": 0.95
  }
}
```

### 检查组健康状态

检查指定组及其服务器的健康状态。

```http
GET /api/groups/:group/health
```

**路径参数**:
- `group` (string): 组标识符

**响应**:
```json
{
  "group": "development",
  "status": "healthy",
  "servers": {
    "filesystem": {
      "status": "connected",
      "responseTime": 45,
      "lastCheck": "2024-01-15T10:30:00Z"
    },
    "git": {
      "status": "connected",
      "responseTime": 32,
      "lastCheck": "2024-01-15T10:30:00Z"
    },
    "npm": {
      "status": "error",
      "error": "Connection timeout",
      "lastCheck": "2024-01-15T10:29:45Z"
    }
  },
  "overallHealth": "degraded",
  "availableTools": 4,
  "totalTools": 6
}
```

### 获取组统计信息

获取指定组的使用统计信息。

```http
GET /api/groups/:group/stats
```

**查询参数**:
- `period` (string, 可选): 统计周期 (`1h`, `24h`, `7d`, `30d`)，默认 `24h`

**响应**:
```json
{
  "group": "development",
  "period": "24h",
  "stats": {
    "totalRequests": 156,
    "successfulRequests": 148,
    "failedRequests": 8,
    "averageResponseTime": 234,
    "topTools": [
      {
        "name": "read_file",
        "count": 89,
        "successRate": 0.98
      },
      {
        "name": "write_file",
        "count": 34,
        "successRate": 0.94
      },
      {
        "name": "git_status",
        "count": 19,
        "successRate": 1.0
      }
    ],
    "errorBreakdown": {
      "TOOL_NOT_FOUND": 3,
      "INVALID_ARGUMENTS": 2,
      "SERVER_ERROR": 3
    }
  }
}
```

### 获取组活动日志

获取指定组的活动日志。

```http
GET /api/groups/:group/logs
```

**查询参数**:
- `limit` (number, 可选): 返回的日志条数，默认 50，最大 1000
- `offset` (number, 可选): 偏移量，默认 0
- `level` (string, 可选): 日志级别过滤 (`debug`, `info`, `warn`, `error`)
- `since` (string, 可选): 起始时间 (ISO 8601 格式)

**响应**:
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:15Z",
      "level": "info",
      "message": "工具调用成功",
      "tool": "read_file",
      "duration": 45,
      "success": true,
      "metadata": {
        "server": "filesystem",
        "arguments": {
          "path": "/workspace/README.md"
        }
      }
    },
    {
      "timestamp": "2024-01-15T10:29:32Z",
      "level": "error", 
      "message": "工具调用失败",
      "tool": "write_file",
      "error": "权限被拒绝",
      "success": false,
      "metadata": {
        "server": "filesystem",
        "errorCode": "PERMISSION_DENIED"
      }
    }
  ],
  "total": 156,
  "hasMore": true
}
```

## 系统管理 API

### 系统健康检查

检查整个系统的健康状态。

```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "api": "healthy",
    "mcp": "healthy",
    "database": "healthy"
  },
  "metrics": {
    "totalRequests": 1234,
    "activeConnections": 5,
    "memoryUsage": "45.2MB",
    "cpuUsage": "12.5%"
  }
}
```

### 系统信息

获取系统信息和配置。

```http
GET /api/system/info
```

**响应**:
```json
{
  "version": "1.0.0",
  "nodeVersion": "18.17.0",
  "platform": "darwin",
  "architecture": "x64",
  "uptime": 86400,
  "environment": "production",
  "features": {
    "groupRouting": true,
    "cliSupport": true,
    "metricsCollection": true
  },
  "limits": {
    "maxConnections": 100,
    "requestTimeout": 30000,
    "maxRequestSize": "10MB"
  }
}
```

### 系统指标

获取系统性能指标。

```http
GET /api/system/metrics
```

**查询参数**:
- `period` (string, 可选): 指标周期 (`1m`, `5m`, `1h`, `24h`)，默认 `5m`

**响应**:
```json
{
  "period": "5m",
  "timestamp": "2024-01-15T10:30:00Z",
  "metrics": {
    "requests": {
      "total": 1234,
      "rate": 4.1,
      "successRate": 0.95
    },
    "response": {
      "averageTime": 234,
      "p50": 180,
      "p95": 450,
      "p99": 800
    },
    "system": {
      "memoryUsage": 47185920,
      "cpuUsage": 12.5,
      "activeConnections": 5,
      "openFiles": 23
    },
    "mcp": {
      "activeServers": 8,
      "totalTools": 45,
      "connectionPool": {
        "active": 5,
        "idle": 3,
        "pending": 0
      }
    }
  }
}
```

## 错误响应

所有 API 端点在出错时返回标准错误格式：

```json
{
  "error": "ERROR_CODE",
  "message": "人类可读的错误信息",
  "code": 400,
  "details": {
    "field": "具体的错误详情"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### 常见错误代码

| 错误代码 | HTTP 状态码 | 描述 |
|----------|-------------|------|
| `AUTH_LOGIN_FAILED` | 401 | 登录失败 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `AUTH_ACCOUNT_LOCKED` | 423 | 账户被锁定 |
| `AUTH_MISSING_TOKEN` | 401 | 缺少认证令牌 |
| `AUTH_INVALID_TOKEN` | 401 | 无效的认证令牌 |
| `AUTH_TOKEN_EXPIRED` | 401 | 认证令牌已过期 |
| `AUTH_TOKEN_REVOKED` | 401 | 认证令牌已被撤销 |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | 无效的刷新令牌 |
| `AUTH_USER_NOT_FOUND` | 404 | 用户不存在 |
| `GROUP_NOT_FOUND` | 404 | 指定的组不存在 |
| `TOOL_NOT_FOUND` | 404 | 指定的工具不存在 |
| `TOOL_NOT_ALLOWED` | 403 | 工具不在组的允许列表中 |
| `INVALID_VALIDATION_KEY` | 401 | 验证密钥无效或缺失 |
| `INVALID_ARGUMENTS` | 400 | 工具参数无效 |
| `SERVER_ERROR` | 500 | MCP 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |
| `TIMEOUT` | 408 | 请求超时 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |

## 速率限制

API 实施速率限制以防止滥用：

- **全局限制**: 每分钟 1000 请求
- **组限制**: 每个组每分钟 100 请求
- **工具调用限制**: 每个工具每分钟 50 次调用

速率限制信息在响应头中返回：

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

## 分页

支持分页的端点使用以下参数：

- `limit` (number): 每页项目数，默认 50，最大 1000
- `offset` (number): 偏移量，默认 0

分页信息在响应中返回：

```json
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 156,
    "hasMore": true
  }
}
```

## WebSocket 支持

某些端点支持 WebSocket 连接以获取实时更新：

### 实时日志流

```javascript
const ws = new WebSocket('ws://localhost:3000/api/groups/development/logs/stream');

ws.onmessage = function(event) {
  const log = JSON.parse(event.data);
  console.log('新日志:', log);
};
```

### 实时指标流

```javascript
const ws = new WebSocket('ws://localhost:3000/api/system/metrics/stream');

ws.onmessage = function(event) {
  const metrics = JSON.parse(event.data);
  console.log('系统指标:', metrics);
};
```

## SDK 和客户端库

### JavaScript/TypeScript

```bash
npm install @mcp-core/mcp-hub-client
```

```typescript
import { McpHubClient } from '@mcp-core/mcp-hub-client';

const client = new McpHubClient('http://localhost:3000');

// 列出工具
const tools = await client.listTools('development');

// 调用工具
const result = await client.callTool('development', 'read_file', {
  path: '/workspace/README.md'
});
```

### Python

```bash
pip install mcp-hub-client
```

```python
from mcp_hub_client import McpHubClient

client = McpHubClient('http://localhost:3000')

# 列出工具
tools = client.list_tools('development')

# 调用工具
result = client.call_tool('development', 'read_file', {
    'path': '/workspace/README.md'
})
```

## 示例用法

### 基本工具调用

```bash
# 列出所有工具
curl http://localhost:3000/mcp/list_tools

# 调用文件读取工具
curl -X POST http://localhost:3000/mcp/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "read_file",
    "arguments": {
      "path": "/workspace/package.json"
    }
  }'
```

### 组路由使用

```bash
# 列出开发组的工具
curl http://localhost:3000/development/mcp/list_tools

# 在研究组中搜索
curl -X POST http://localhost:3000/research/mcp/call_tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search",
    "arguments": {
      "query": "MCP protocol documentation"
    }
  }'
```

### 管理和监控

```bash
# 检查系统健康
curl http://localhost:3000/health

# 获取组统计
curl http://localhost:3000/api/groups/development/stats

# 查看组日志
curl "http://localhost:3000/api/groups/development/logs?limit=10&level=error"
```

## 相关文档

- [CLI 使用指南](CLI_USAGE.md)
- [组路由指南](GROUP_ROUTING.md)
- [迁移指南](MIGRATION.md)
- [故障排除指南](TROUBLESHOOTING.md)