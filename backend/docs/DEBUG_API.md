# 调试工具API文档

本文档描述了MCP Hub的调试工具API端点，提供了MCP协议监控、工具测试、性能分析和错误诊断功能。

## 基础信息

- **基础URL**: `/api/debug`
- **认证**: 需要JWT认证
- **内容类型**: `application/json`

## API端点

### 1. 获取MCP协议消息

**GET** `/api/debug/mcp-messages`

获取跟踪的MCP协议消息列表，用于调试和监控MCP协议交互。

**查询参数:**
- `limit` (可选, 数字): 返回消息的最大数量，默认为50
- `serverId` (可选, 字符串): 按服务器ID过滤消息
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

### 2. 测试工具执行

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

### 3. 获取性能统计

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

### 4. 错误分析

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