/**
 * 测试专用的应用实例
 * 避免在测试中初始化MCP服务
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';

// 创建测试专用的应用实例
export const testApp = new Hono();

// 添加中间件
testApp.use('*', cors());
testApp.use('*', logger());
testApp.use('*', timing());
testApp.use('*', prettyJSON());

// 基础路由
testApp.get('/api/ping', (c) => {
  return c.json({
    success: true,
    message: 'Hub API is running',
    timestamp: new Date().toISOString(),
  });
});

// 组路由 - 简化版本
testApp.get('/api/groups', (c) => {
  return c.json({
    groups: [
      {
        id: 'test-group-1',
        name: '测试组1',
        description: '测试用组',
        enabled: true,
      },
      {
        id: 'test-group-2',
        name: '测试组2',
        description: '另一个测试用组',
        enabled: true,
      },
    ],
    totalGroups: 2,
  });
});

testApp.get('/api/groups/:id', (c) => {
  const id = c.req.param('id');

  if (id === 'test-group-1' || id === 'test-group-2') {
    return c.json({
      id,
      name: `测试组${id.slice(-1)}`,
      description: '测试用组',
      enabled: true,
      toolCount: 2,
      serverCount: 1,
    });
  }

  return c.json(
    { error: { code: 'GROUP_NOT_FOUND', message: '组不存在' } },
    404,
  );
});

testApp.get('/api/groups/:id/tools', (c) => {
  const id = c.req.param('id');

  if (id === 'test-group-1' || id === 'test-group-2') {
    return c.json({
      tools: [
        {
          name: `${id}-tool-1`,
          description: '测试工具1',
          serverId: `${id}-server`,
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
        },
        {
          name: `${id}-tool-2`,
          description: '测试工具2',
          serverId: `${id}-server`,
          parameters: {
            type: 'object',
            properties: {
              data: { type: 'string' },
            },
          },
        },
      ],
      totalTools: 2,
    });
  }

  return c.json(
    { error: { code: 'GROUP_NOT_FOUND', message: '组不存在' } },
    404,
  );
});

testApp.get('/api/groups/:id/servers', (c) => {
  const id = c.req.param('id');

  if (id === 'test-group-1' || id === 'test-group-2') {
    return c.json({
      servers: [
        {
          id: `${id}-server`,
          name: `${id}服务器`,
          status: 'connected',
          toolCount: 2,
          lastConnected: new Date().toISOString(),
        },
      ],
      totalServers: 1,
    });
  }

  return c.json(
    { error: { code: 'GROUP_NOT_FOUND', message: '组不存在' } },
    404,
  );
});

testApp.get('/api/groups/:id/health', (c) => {
  const id = c.req.param('id');

  if (id === 'test-group-1' || id === 'test-group-2') {
    return c.json({
      groupId: id,
      status: 'healthy',
      connectedServers: 1,
      totalServers: 1,
      availableTools: 2,
      lastCheck: new Date().toISOString(),
    });
  }

  return c.json(
    {
      error: { code: 'GROUP_NOT_FOUND', message: '组不存在' },
      groupId: id,
      status: 'not_found',
    },
    404,
  );
});

// MCP路由 - 简化版本
testApp.get('/mcp/status', (c) => {
  return c.json({
    service: {
      status: 'running',
      version: '1.0.0',
      uptime: 1000,
    },
    servers: {
      total: 2,
      connected: 2,
      details: [
        {
          id: 'test-server-1',
          status: 'connected',
          toolCount: 2,
        },
        {
          id: 'test-server-2',
          status: 'connected',
          toolCount: 2,
        },
      ],
    },
    compatibility: {
      mcpVersion: '2024-11-05',
      features: ['tools', 'resources'],
    },
  });
});

testApp.get('/mcp/tools', (c) => {
  return c.json({
    totalTools: 4,
    allTools: [
      {
        name: 'test-tool-1',
        description: '测试工具1',
        serverId: 'test-server-1',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
      },
      {
        name: 'test-tool-2',
        description: '测试工具2',
        serverId: 'test-server-1',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'string' },
          },
        },
      },
      {
        name: 'test-tool-3',
        description: '测试工具3',
        serverId: 'test-server-2',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
      },
      {
        name: 'test-tool-4',
        description: '测试工具4',
        serverId: 'test-server-2',
        parameters: {
          type: 'object',
          properties: {
            config: { type: 'object' },
          },
        },
      },
    ],
  });
});

testApp.get('/mcp/health', (c) => {
  return c.json({
    healthy: true,
    service: {
      status: 'running',
      initialized: true,
    },
    servers: {
      total: 2,
      connected: 2,
      healthy: 2,
    },
    lastCheck: new Date().toISOString(),
  });
});

testApp.post('/mcp/execute', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (!body.toolName) {
    return c.json(
      {
        error: {
          code: 'MISSING_TOOL_NAME',
          message: '缺少工具名称',
        },
      },
      400,
    );
  }

  const validTools = [
    'test-tool-1',
    'test-tool-2',
    'test-tool-3',
    'test-tool-4',
    'hub_status',
  ];

  if (!validTools.includes(body.toolName)) {
    return c.json(
      {
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `工具 '${body.toolName}' 未找到`,
        },
      },
      500,
    );
  }

  return c.json({
    toolName: body.toolName,
    result: {
      success: true,
      data: `执行工具 ${body.toolName} 成功`,
      timestamp: new Date().toISOString(),
    },
    executionTime: 150,
  });
});

testApp.post('/mcp', async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (body.method === 'initialize') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: {
          name: 'mcp-hub-test',
          version: '1.0.0',
        },
      },
    });
  }

  return c.json(
    {
      jsonrpc: '2.0',
      id: body.id || 1,
      error: {
        code: -32601,
        message: 'Method not found',
      },
    },
    406,
  );
});

// SSE路由 - 简化版本
testApp.get('/sse', (c) => {
  return c.text('data: {"type":"connection","status":"connected"}\n\n', 200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
});

testApp.post('/messages', async (c) => {
  return c.text('No transport found for session', 400);
});

// 404处理
testApp.notFound((c) => {
  return c.json(
    { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404,
  );
});

// 错误处理
testApp.onError((err, c) => {
  console.error('Test app error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    500,
  );
});
