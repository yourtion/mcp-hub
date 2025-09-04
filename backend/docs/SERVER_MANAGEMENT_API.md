# 服务器管理API文档

本文档描述了MCP Hub的服务器管理API端点，用于管理MCP服务器的配置、连接状态和验证。

## 基础信息

- **基础URL**: `/api/servers`
- **认证**: 需要JWT认证（除了测试和验证端点）
- **内容类型**: `application/json`

## API端点

### 1. 获取服务器列表

**GET** `/api/servers`

获取所有已配置的MCP服务器列表及其状态信息。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "time-mcp",
        "name": "time-mcp",
        "type": "stdio",
        "status": "connected",
        "config": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "time-mcp"],
          "enabled": true
        },
        "tools": [
          {
            "name": "get_current_time",
            "description": "获取当前时间"
          }
        ],
        "lastConnected": "2024-01-01T12:00:00.000Z",
        "toolCount": 1
      }
    ],
    "total": 1,
    "summary": {
      "total": 1,
      "connected": 1,
      "connecting": 0,
      "disconnected": 0,
      "error": 0
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. 获取特定服务器信息

**GET** `/api/servers/:id`

获取指定服务器的详细信息。

**参数:**
- `id` (路径参数): 服务器ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "time-mcp",
    "name": "time-mcp",
    "type": "stdio",
    "status": "connected",
    "config": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "time-mcp"],
      "enabled": true
    },
    "tools": [
      {
        "name": "get_current_time",
        "description": "获取当前时间",
        "inputSchema": {},
        "serverId": "time-mcp"
      }
    ],
    "lastConnected": "2024-01-01T12:00:00.000Z",
    "reconnectAttempts": 0,
    "toolCount": 1
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. 创建新服务器

**POST** `/api/servers`

创建新的MCP服务器配置。

**请求体:**
```json
{
  "id": "new-server",
  "config": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "new-mcp-server"],
    "enabled": true,
    "env": {
      "API_KEY": "your-api-key"
    }
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "new-server",
    "config": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "new-mcp-server"],
      "enabled": true,
      "env": {
        "API_KEY": "your-api-key"
      }
    },
    "message": "服务器 'new-server' 创建成功"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 4. 更新服务器配置

**PUT** `/api/servers/:id`

更新现有服务器的配置。

**参数:**
- `id` (路径参数): 服务器ID

**请求体:**
```json
{
  "config": {
    "type": "stdio",
    "command": "uvx",
    "args": ["updated-mcp-server"],
    "enabled": true
  }
}
```

### 5. 删除服务器

**DELETE** `/api/servers/:id`

删除指定的服务器配置。

**参数:**
- `id` (路径参数): 服务器ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "server-id",
    "message": "服务器 'server-id' 删除成功"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 6. 获取服务器连接状态

**GET** `/api/servers/:id/status`

获取指定服务器的连接状态信息。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "time-mcp",
    "status": "connected",
    "lastConnected": "2024-01-01T12:00:00.000Z",
    "reconnectAttempts": 0,
    "toolCount": 1,
    "isConnected": true,
    "isConnecting": false,
    "hasError": false
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 7. 连接服务器

**POST** `/api/servers/:id/connect`

手动触发服务器连接。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "server-id",
    "message": "服务器 'server-id' 连接请求已发送",
    "status": "connecting"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 8. 断开服务器连接

**POST** `/api/servers/:id/disconnect`

手动断开服务器连接。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "server-id",
    "message": "服务器 'server-id' 已断开连接",
    "status": "disconnected"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 9. 测试服务器连接

**POST** `/api/servers/test`

测试服务器配置的连接性，不保存配置。

**请求体:**
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "test-mcp"],
  "enabled": true
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "服务器连接测试成功",
    "details": {
      "status": "connected",
      "toolCount": 2,
      "tools": [
        {
          "name": "test-tool",
          "description": "测试工具"
        }
      ],
      "lastConnected": "2024-01-01T12:00:00.000Z"
    },
    "executionTime": 1500
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 10. 验证服务器配置

**POST** `/api/servers/validate`

验证服务器配置的有效性，提供详细的验证结果和建议。

**请求体:**
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "test-mcp"],
  "enabled": true
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": [
      {
        "field": "command",
        "message": "命令看起来像是一个可执行文件名，请确保它在系统PATH中",
        "code": "COMMAND_PATH_WARNING"
      }
    ],
    "suggestions": [
      {
        "field": "enabled",
        "message": "建议明确设置enabled字段",
        "suggestedValue": true
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 服务器配置格式

### Stdio服务器配置
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "package-name"],
  "env": {
    "ENV_VAR": "value"
  },
  "enabled": true
}
```

### SSE/HTTP服务器配置
```json
{
  "type": "sse",
  "url": "https://example.com/mcp",
  "headers": {
    "Authorization": "Bearer token"
  },
  "env": {
    "ENV_VAR": "value"
  },
  "enabled": true
}
```

## 错误响应

所有API端点在发生错误时都会返回标准化的错误响应：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 常见错误代码

- `SERVER_NOT_FOUND`: 服务器未找到
- `SERVER_EXISTS`: 服务器已存在
- `VALIDATION_ERROR`: 请求数据验证失败
- `SERVER_ALREADY_CONNECTED`: 服务器已连接
- `SERVER_ALREADY_DISCONNECTED`: 服务器已断开连接
- `SERVER_CONNECTING`: 服务器正在连接中
- `SERVER_API_ERROR`: 服务器管理API内部错误

## 状态码

- `200`: 成功
- `201`: 创建成功
- `400`: 请求错误或验证失败
- `404`: 资源未找到
- `409`: 资源冲突
- `500`: 服务器内部错误