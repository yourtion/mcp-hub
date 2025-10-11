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

## 服务器管理 API

服务器管理 API 提供了 MCP 服务器的完整 CRUD 操作和连接控制功能。

### 获取服务器列表

**GET** `/api/servers`

获取所有已配置的 MCP 服务器列表。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "filesystem",
        "name": "文件系统服务器",
        "type": "stdio",
        "status": "connected",
        "config": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        },
        "tools": ["read_file", "write_file", "list_directory"],
        "lastConnected": "2024-01-15T10:30:00Z"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 创建服务器

**POST** `/api/servers`

创建新的 MCP 服务器配置。

**请求体:**
```json
{
  "id": "git-server",
  "name": "Git 服务器",
  "type": "stdio",
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-git"],
    "env": {}
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "server": {
      "id": "git-server",
      "name": "Git 服务器",
      "type": "stdio",
      "status": "disconnected",
      "config": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git"]
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 更新服务器

**PUT** `/api/servers/:id`

更新现有服务器的配置。

**路径参数:**
- `id` (字符串): 服务器 ID

**请求体:**
```json
{
  "name": "Git 服务器（更新）",
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-git", "--verbose"]
  }
}
```

### 删除服务器

**DELETE** `/api/servers/:id`

删除服务器配置。

**路径参数:**
- `id` (字符串): 服务器 ID

**响应示例:**
```json
{
  "success": true,
  "message": "服务器已删除",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 连接服务器

**POST** `/api/servers/:id/connect`

连接到指定的 MCP 服务器。

**路径参数:**
- `id` (字符串): 服务器 ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "tools": ["read_file", "write_file", "list_directory"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 断开服务器

**POST** `/api/servers/:id/disconnect`

断开与 MCP 服务器的连接。

**路径参数:**
- `id` (字符串): 服务器 ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "status": "disconnected"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 测试服务器连接

**POST** `/api/servers/test`

测试服务器配置是否有效。

**请求体:**
```json
{
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "tools": ["read_file", "write_file"],
    "testDuration": 1234
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 工具管理 API

工具管理 API 提供了工具查询、执行和监控功能。

### 获取工具列表

**GET** `/api/tools`

获取所有可用的 MCP 工具列表。

**查询参数:**
- `serverId` (可选, 字符串): 按服务器 ID 过滤
- `groupId` (可选, 字符串): 按组 ID 过滤

**响应示例:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "read_file",
        "description": "读取文件内容",
        "serverId": "filesystem",
        "serverName": "文件系统服务器",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "文件路径"
            }
          },
          "required": ["path"]
        },
        "status": "available"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 获取工具详情

**GET** `/api/tools/:toolName`

获取指定工具的详细信息。

**路径参数:**
- `toolName` (字符串): 工具名称

**响应示例:**
```json
{
  "success": true,
  "data": {
    "tool": {
      "name": "read_file",
      "description": "读取文件内容",
      "serverId": "filesystem",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "文件路径"
          }
        },
        "required": ["path"]
      },
      "examples": [
        {
          "description": "读取 README 文件",
          "arguments": {
            "path": "/workspace/README.md"
          }
        }
      ]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 执行工具

**POST** `/api/tools/:toolName/execute`

执行指定的 MCP 工具。

**路径参数:**
- `toolName` (字符串): 工具名称

**请求体:**
```json
{
  "serverId": "filesystem",
  "arguments": {
    "path": "/workspace/README.md"
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "result": {
      "content": [
        {
          "type": "text",
          "text": "# MCP Hub\n\n..."
        }
      ],
      "isError": false
    },
    "executionTime": 45
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 配置管理 API

配置管理 API 提供了系统配置的查询、更新、验证和备份功能。

### 获取配置

**GET** `/api/config`

获取当前系统配置。

**查询参数:**
- `category` (可选, 字符串): 配置分类 (`system`, `servers`, `groups`, `auth`)

**响应示例:**
```json
{
  "success": true,
  "data": {
    "config": {
      "system": {
        "server": {
          "port": 3000,
          "host": "0.0.0.0"
        },
        "logging": {
          "level": "info"
        }
      }
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 更新配置

**PUT** `/api/config`

更新系统配置。

**请求体:**
```json
{
  "category": "system",
  "config": {
    "logging": {
      "level": "debug"
    }
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "配置已更新",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 验证配置

**POST** `/api/config/validate`

验证配置的有效性。

**请求体:**
```json
{
  "category": "servers",
  "config": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 获取配置历史

**GET** `/api/config/history`

获取配置变更历史。

**查询参数:**
- `limit` (可选, 数字): 返回的历史记录数量，默认 50

**响应示例:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "hist_123",
        "timestamp": "2024-01-15T10:30:00Z",
        "user": "admin",
        "category": "system",
        "action": "update",
        "changes": {
          "logging.level": {
            "from": "info",
            "to": "debug"
          }
        }
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 创建配置备份

**POST** `/api/config/backup`

创建配置备份。

**请求体:**
```json
{
  "description": "部署前备份"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "backup": {
      "id": "backup_123",
      "timestamp": "2024-01-15T10:30:00Z",
      "description": "部署前备份",
      "path": "/config/.backups/backup_20240115_103000.json"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 恢复配置

**POST** `/api/config/restore`

从备份恢复配置。

**请求体:**
```json
{
  "backupId": "backup_123"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "配置已恢复",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 仪表板 API

仪表板 API 提供系统概览、统计信息和实时监控功能。

### 获取仪表板统计

**GET** `/api/dashboard/stats`

获取系统概览统计信息。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalServers": 5,
      "connectedServers": 4,
      "totalTools": 23,
      "totalGroups": 3
    },
    "recentActivity": [
      {
        "id": "act_123",
        "type": "server_connected",
        "message": "服务器 filesystem 已连接",
        "timestamp": "2024-01-15T10:30:00Z",
        "severity": "info"
      }
    ],
    "systemHealth": {
      "status": "healthy",
      "issues": []
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### SSE 事件流

**GET** `/api/events`

建立 Server-Sent Events 连接以接收实时事件。

**事件类型:**
- `server_status`: 服务器状态变更
- `tool_execution`: 工具执行事件
- `system_alert`: 系统告警

**事件示例:**
```
event: server_status
data: {"serverId":"filesystem","status":"connected","timestamp":"2024-01-15T10:30:00Z"}

event: tool_execution
data: {"toolName":"read_file","serverId":"filesystem","success":true,"executionTime":45}
```

### 获取系统日志

**GET** `/api/dashboard/logs`

获取系统日志。

**查询参数:**
- `limit` (可选, 数字): 返回的日志条数，默认 100
- `level` (可选, 字符串): 日志级别过滤 (`debug`, `info`, `warn`, `error`)
- `since` (可选, 字符串): 起始时间 (ISO 8601 格式)

**响应示例:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-01-15T10:30:00Z",
        "level": "info",
        "message": "服务器已连接",
        "serverId": "filesystem",
        "metadata": {}
      }
    ],
    "total": 1234,
    "hasMore": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 调试工具 API

调试工具 API 提供了 MCP 协议监控、工具测试、性能分析和错误诊断功能，帮助开发者和系统管理员调试和优化 MCP 服务。

### 获取 MCP 协议消息

**GET** `/api/debug/mcp-messages`

获取跟踪的 MCP 协议消息列表，用于调试和监控 MCP 协议交互。

**查询参数:**
- `limit` (可选, 数字): 返回消息的最大数量，默认为 50
- `serverId` (可选, 字符串): 按服务器 ID 过滤消息
- `type` (可选, 字符串): 按消息类型过滤 ('request', 'response', 'notification')

**响应示例:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "1640995200000-abc123",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "serverId": "time-mcp",
        "type": "request",
        "method": "callTool",
        "content": {
          "name": "get_current_time",
          "arguments": {}
        }
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 测试工具执行

**POST** `/api/debug/tool-test`

测试工具执行并获取详细的执行结果和性能指标。

**请求体:**
```json
{
  "toolName": "get_current_time",
  "serverId": "time-mcp",     // 可选
  "groupId": "default",       // 可选
  "arguments": {              // 可选
    "format": "ISO"
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "toolName": "get_current_time",
    "serverId": "time-mcp",
    "groupId": "default",
    "arguments": {
      "format": "ISO"
    },
    "result": {
      "content": [
        {
          "type": "text",
          "text": "2024-01-01T00:00:00.000Z"
        }
      ],
      "isError": false
    },
    "executionTime": 45
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 获取性能统计

**GET** `/api/debug/performance-stats`

获取系统性能统计信息，包括请求量、响应时间和错误率。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalRequests": 127,
      "averageResponseTime": 52,
      "errorRate": 2.3,
      "topTools": [
        {
          "name": "get_current_time",
          "calls": 45,
          "avgTime": 48
        },
        {
          "name": "calculate_sum",
          "calls": 32,
          "avgTime": 65
        }
      ]
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误分析

**GET** `/api/debug/error-analysis`

分析系统中的错误模式，识别常见的错误类型和问题。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "id": "1640995200000-def456",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "serverId": "calculator-mcp",
        "type": "response",
        "method": "callTool",
        "content": {
          "isError": true,
          "error": "Invalid input: expected number, got string"
        }
      }
    ],
    "analysis": {
      "totalErrors": 3,
      "errorRate": 2.3,
      "mostCommonErrors": {
        "Invalid input: expected number, got string": 2,
        "Server timeout": 1
      },
      "recentErrors": [
        // 最近的错误消息数组
      ]
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
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