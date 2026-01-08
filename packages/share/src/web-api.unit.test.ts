/**
 * Web API 类型单元测试
 * 测试 API 相关类型定义的结构和正确性
 */

import { describe, expect, it } from 'vitest';
import {
  type LoginRequest,
  type LoginResponse,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
  type User,
  ServerStatus,
  type WebServerConfig,
  type ServerInfo,
  type CreateServerRequest,
  type UpdateServerRequest,
  type ServerListResponse,
  type JsonSchemaProperty,
  type JsonSchema,
  type ToolInfo,
  type ToolExecuteRequest,
  type ToolResultContent,
  type ToolResult,
  type ToolExecuteResponse,
  type ToolListResponse,
  type ToolExecution,
  type ToolComplexityEstimation,
} from './web-api.js';

describe('Web API Types - Authentication', () => {
  describe('User', () => {
    it('应该创建有效的用户信息', () => {
      const user: User = {
        id: '123',
        username: 'testuser',
        role: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-02T00:00:00Z',
      };

      expect(user.id).toBe('123');
      expect(user.username).toBe('testuser');
      expect(user.role).toBe('admin');
      expect(user.createdAt).toBeDefined();
      expect(user.lastLogin).toBeDefined();
    });

    it('应该支持不包含 lastLogin', () => {
      const user: User = {
        id: '123',
        username: 'testuser',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(user.lastLogin).toBeUndefined();
    });
  });

  describe('LoginRequest', () => {
    it('应该创建有效的登录请求', () => {
      const request: LoginRequest = {
        username: 'testuser',
        password: 'password123',
      };

      expect(request.username).toBe('testuser');
      expect(request.password).toBe('password123');
    });
  });

  describe('LoginResponse', () => {
    it('应该创建有效的登录响应', () => {
      const user: User = {
        id: '123',
        username: 'testuser',
        role: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const response: LoginResponse = {
        token: 'access-token',
        refreshToken: 'refresh-token',
        user,
      };

      expect(response.token).toBe('access-token');
      expect(response.refreshToken).toBe('refresh-token');
      expect(response.user).toEqual(user);
    });
  });

  describe('RefreshTokenRequest', () => {
    it('应该创建有效的 token 刷新请求', () => {
      const request: RefreshTokenRequest = {
        refreshToken: 'refresh-token',
      };

      expect(request.refreshToken).toBe('refresh-token');
    });
  });

  describe('RefreshTokenResponse', () => {
    it('应该创建有效的 token 刷新响应', () => {
      const response: RefreshTokenResponse = {
        token: 'new-access-token',
      };

      expect(response.token).toBe('new-access-token');
    });
  });
});

describe('Web API Types - Server Management', () => {
  describe('ServerStatus', () => {
    it('应该有正确的状态枚举值', () => {
      expect(ServerStatus.CONNECTING).toBe('connecting');
      expect(ServerStatus.CONNECTED).toBe('connected');
      expect(ServerStatus.DISCONNECTED).toBe('disconnected');
      expect(ServerStatus.ERROR).toBe('error');
    });
  });

  describe('WebServerConfig', () => {
    it('应该创建 stdio 类型配置', () => {
      const config: WebServerConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'production' },
        cwd: '/app',
        timeout: 5000,
      };

      expect(config.type).toBe('stdio');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js']);
      expect(config.env).toBeDefined();
      expect(config.cwd).toBe('/app');
      expect(config.timeout).toBe(5000);
    });

    it('应该创建 sse 类型配置', () => {
      const config: WebServerConfig = {
        type: 'sse',
        command: 'python',
        args: ['-m', 'server'],
      };

      expect(config.type).toBe('sse');
    });

    it('应该创建 websocket 类型配置', () => {
      const config: WebServerConfig = {
        type: 'websocket',
        command: 'server',
        args: [],
      };

      expect(config.type).toBe('websocket');
    });

    it('应该支持最小配置', () => {
      const config: WebServerConfig = {
        type: 'stdio',
        command: 'server',
        args: [],
      };

      expect(config.command).toBe('server');
      expect(config.env).toBeUndefined();
      expect(config.cwd).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });
  });

  describe('ServerInfo', () => {
    it('应该创建完整的服务器信息', () => {
      const config: WebServerConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      const tools: ToolInfo[] = [
        {
          name: 'tool1',
          description: 'Test tool 1',
          serverId: 'server1',
          serverName: 'Server 1',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          status: 'available',
        },
      ];

      const server: ServerInfo = {
        id: 'server1',
        name: 'Test Server',
        type: 'stdio',
        status: ServerStatus.CONNECTED,
        config,
        tools,
        lastConnected: '2024-01-01T00:00:00Z',
        lastError: undefined,
        reconnectAttempts: 0,
      };

      expect(server.id).toBe('server1');
      expect(server.name).toBe('Test Server');
      expect(server.status).toBe(ServerStatus.CONNECTED);
      expect(server.tools).toHaveLength(1);
      expect(server.reconnectAttempts).toBe(0);
    });

    it('应该支持错误状态', () => {
      const config: WebServerConfig = {
        type: 'sse',
        command: 'node',
        args: [],
      };

      const server: ServerInfo = {
        id: 'server2',
        name: 'Failed Server',
        type: 'sse',
        status: ServerStatus.ERROR,
        config,
        tools: [],
        lastError: 'Connection timeout',
        reconnectAttempts: 3,
      };

      expect(server.status).toBe(ServerStatus.ERROR);
      expect(server.lastError).toBe('Connection timeout');
      expect(server.reconnectAttempts).toBe(3);
    });
  });

  describe('CreateServerRequest', () => {
    it('应该创建有效的服务器创建请求', () => {
      const config: WebServerConfig = {
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      const request: CreateServerRequest = {
        id: 'new-server',
        name: 'New Server',
        config,
      };

      expect(request.id).toBe('new-server');
      expect(request.name).toBe('New Server');
      expect(request.config).toEqual(config);
    });
  });

  describe('UpdateServerRequest', () => {
    it('应该创建仅包含配置的更新请求', () => {
      const config: WebServerConfig = {
        type: 'stdio',
        command: 'node',
        args: [],
      };

      const request: UpdateServerRequest = {
        config,
      };

      expect(request.name).toBeUndefined();
      expect(request.config).toEqual(config);
    });

    it('应该创建包含名称的更新请求', () => {
      const config: WebServerConfig = {
        type: 'sse',
        command: 'node',
        args: [],
      };

      const request: UpdateServerRequest = {
        name: 'Updated Name',
        config,
      };

      expect(request.name).toBe('Updated Name');
      expect(request.config).toEqual(config);
    });
  });

  describe('ServerListResponse', () => {
    it('应该创建服务器列表响应', () => {
      const servers: ServerInfo[] = [
        {
          id: 's1',
          name: 'Server 1',
          type: 'stdio',
          status: ServerStatus.CONNECTED,
          config: { type: 'stdio', command: 'node', args: [] },
          tools: [],
          reconnectAttempts: 0,
        },
        {
          id: 's2',
          name: 'Server 2',
          type: 'sse',
          status: ServerStatus.DISCONNECTED,
          config: { type: 'sse', command: 'node', args: [] },
          tools: [],
          reconnectAttempts: 0,
        },
      ];

      const response: ServerListResponse = {
        servers,
      };

      expect(response.servers).toHaveLength(2);
      expect(response.servers[0].status).toBe(ServerStatus.CONNECTED);
      expect(response.servers[1].status).toBe(ServerStatus.DISCONNECTED);
    });
  });
});

describe('Web API Types - Tool Management', () => {
  describe('JsonSchemaProperty', () => {
    it('应该创建字符串属性', () => {
      const prop: JsonSchemaProperty = {
        type: 'string',
        description: 'A string property',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-zA-Z]+$',
      };

      expect(prop.type).toBe('string');
      expect(prop.description).toBeDefined();
      expect(prop.minLength).toBe(1);
      expect(prop.maxLength).toBe(100);
      expect(prop.pattern).toBe('^[a-zA-Z]+$');
    });

    it('应该创建数字属性', () => {
      const prop: JsonSchemaProperty = {
        type: 'number',
        description: 'A number property',
        minimum: 0,
        maximum: 100,
        default: 50,
      };

      expect(prop.type).toBe('number');
      expect(prop.minimum).toBe(0);
      expect(prop.maximum).toBe(100);
      expect(prop.default).toBe(50);
    });

    it('应该创建对象属性', () => {
      const prop: JsonSchemaProperty = {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
          age: { type: 'number', description: 'Age' },
        },
        required: ['name'],
      };

      expect(prop.type).toBe('object');
      expect(prop.properties).toBeDefined();
      expect(prop.required).toContain('name');
    });

    it('应该创建数组属性', () => {
      const prop: JsonSchemaProperty = {
        type: 'array',
        items: {
          type: 'string',
          description: 'Item',
        },
      };

      expect(prop.type).toBe('array');
      expect(prop.items).toBeDefined();
    });

    it('应该支持枚举', () => {
      const prop: JsonSchemaProperty = {
        type: 'string',
        enum: ['option1', 'option2', 'option3'],
      };

      expect(prop.enum).toEqual(['option1', 'option2', 'option3']);
    });
  });

  describe('JsonSchema', () => {
    it('应该创建有效的 JSON Schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name',
            minLength: 1,
            maxLength: 50,
          },
          age: {
            type: 'number',
            description: 'Age',
            minimum: 0,
            maximum: 150,
          },
          email: {
            type: 'string',
            description: 'Email address',
            format: 'email',
          },
        },
        required: ['name', 'email'],
        additionalProperties: false,
        description: 'User information schema',
      };

      expect(schema.type).toBe('object');
      expect(Object.keys(schema.properties)).toHaveLength(3);
      expect(schema.required).toEqual(['name', 'email']);
      expect(schema.additionalProperties).toBe(false);
      expect(schema.description).toBeDefined();
    });

    it('应该支持嵌套对象', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name' },
              address: {
                type: 'object',
                properties: {
                  street: { type: 'string', description: 'Street' },
                  city: { type: 'string', description: 'City' },
                },
              },
            },
          },
        },
      };

      const userProp = schema.properties.user;
      expect(userProp?.type).toBe('object');
      expect(userProp?.properties?.address).toBeDefined();
    });
  });

  describe('ToolInfo', () => {
    it('应该创建可用的工具信息', () => {
      const tool: ToolInfo = {
        name: 'calculate',
        description: 'Performs calculations',
        serverId: 'server1',
        serverName: 'Math Server',
        inputSchema: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Math expression',
            },
          },
          required: ['expression'],
        },
        status: 'available',
      };

      expect(tool.name).toBe('calculate');
      expect(tool.serverId).toBe('server1');
      expect(tool.status).toBe('available');
      expect(tool.inputSchema.properties.expression).toBeDefined();
    });

    it('应该创建不可用的工具信息', () => {
      const tool: ToolInfo = {
        name: 'unavailable_tool',
        description: 'This tool is unavailable',
        serverId: 'server2',
        serverName: 'Server 2',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        status: 'unavailable',
      };

      expect(tool.status).toBe('unavailable');
    });
  });

  describe('ToolExecuteRequest', () => {
    it('应该创建带服务器ID的执行请求', () => {
      const request: ToolExecuteRequest = {
        serverId: 'server1',
        arguments: {
          param1: 'value1',
          param2: 42,
        },
      };

      expect(request.serverId).toBe('server1');
      expect(request.groupId).toBeUndefined();
      expect(request.arguments.param1).toBe('value1');
    });

    it('应该创建带组ID的执行请求', () => {
      const request: ToolExecuteRequest = {
        groupId: 'group1',
        arguments: {
          tool: 'test',
        },
      };

      expect(request.groupId).toBe('group1');
      expect(request.serverId).toBeUndefined();
    });

    it('应该创建不带服务器或组ID的执行请求', () => {
      const request: ToolExecuteRequest = {
        arguments: {
          data: 'test',
        },
      };

      expect(request.serverId).toBeUndefined();
      expect(request.groupId).toBeUndefined();
    });
  });

  describe('ToolResult', () => {
    it('应该创建成功的结果', () => {
      const content: ToolResultContent = {
        type: 'text',
        text: 'Operation completed successfully',
      };

      const result: ToolResult = {
        content: [content],
        isError: false,
      };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('successfully');
      expect(result.isError).toBe(false);
    });

    it('应该创建错误结果', () => {
      const content: ToolResultContent = {
        type: 'text',
        text: 'Operation failed',
      };

      const result: ToolResult = {
        content: [content],
        isError: true,
      };

      expect(result.isError).toBe(true);
    });

    it('应该支持多个内容项', () => {
      const result: ToolResult = {
        content: [
          { type: 'text', text: 'First line' },
          { type: 'text', text: 'Second line' },
          { type: 'text', text: 'Third line' },
        ],
      };

      expect(result.content).toHaveLength(3);
    });
  });

  describe('ToolExecuteResponse', () => {
    it('应该创建成功的执行响应', () => {
      const response: ToolExecuteResponse = {
        success: true,
        result: {
          content: [{ type: 'text', text: 'Success' }],
          isError: false,
        },
        executionTime: 150,
      };

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
      expect(response.executionTime).toBe(150);
      expect(response.error).toBeUndefined();
    });

    it('应该创建失败的执行响应', () => {
      const response: ToolExecuteResponse = {
        success: false,
        error: 'Tool not found',
        executionTime: 10,
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Tool not found');
      expect(response.result).toBeUndefined();
    });
  });

  describe('ToolListResponse', () => {
    it('应该创建工具列表响应', () => {
      const tools: ToolInfo[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          serverId: 's1',
          serverName: 'Server 1',
          inputSchema: { type: 'object', properties: {} },
          status: 'available',
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          serverId: 's1',
          serverName: 'Server 1',
          inputSchema: { type: 'object', properties: {} },
          status: 'available',
        },
      ];

      const response: ToolListResponse = {
        tools,
      };

      expect(response.tools).toHaveLength(2);
    });
  });

  describe('ToolExecution', () => {
    it('应该创建工具执行记录', () => {
      const execution: ToolExecution = {
        id: 'exec-123',
        toolName: 'calculate',
        serverId: 'server1',
        arguments: { expression: '2+2' },
        result: {
          content: [{ type: 'text', text: '4' }],
          isError: false,
        },
        timestamp: '2024-01-01T12:00:00Z',
        executionTime: 50,
      };

      expect(execution.id).toBe('exec-123');
      expect(execution.toolName).toBe('calculate');
      expect(execution.executionTime).toBe(50);
    });
  });

  describe('ToolComplexityEstimation', () => {
    it('应该创建简单工具估算', () => {
      const estimation: ToolComplexityEstimation = {
        complexity: 'simple',
        parameterCount: 1,
        requiredParameterCount: 0,
        estimatedExecutionTime: 'fast',
      };

      expect(estimation.complexity).toBe('simple');
      expect(estimation.estimatedExecutionTime).toBe('fast');
    });

    it('应该创建复杂工具估算', () => {
      const estimation: ToolComplexityEstimation = {
        complexity: 'complex',
        parameterCount: 10,
        requiredParameterCount: 7,
        estimatedExecutionTime: 'slow',
      };

      expect(estimation.complexity).toBe('complex');
      expect(estimation.parameterCount).toBe(10);
      expect(estimation.requiredParameterCount).toBe(7);
    });

    it('应该创建中等复杂度估算', () => {
      const estimation: ToolComplexityEstimation = {
        complexity: 'medium',
        parameterCount: 5,
        requiredParameterCount: 3,
        estimatedExecutionTime: 'medium',
      };

      expect(estimation.complexity).toBe('medium');
    });
  });
});
