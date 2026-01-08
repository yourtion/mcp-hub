/**
 * API工具生成器测试
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiToolConfig } from '../types/api-config.js';
import { ApiToolGenerator } from './api-tool-generator.js';

describe('ApiToolGenerator', () => {
  let generator: ApiToolGenerator;

  beforeEach(() => {
    generator = new ApiToolGenerator();
  });

  describe('generateMcpTool', () => {
    it('应该从简单API配置生成MCP工具定义', () => {
      const apiConfig: ApiToolConfig = {
        id: 'test-api',
        name: '测试API',
        description: '这是一个测试API工具',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET',
          timeout: 5000,
        },
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '查询参数',
              minLength: 1,
            },
          },
          required: ['query'],
        },
        response: {
          jsonata: '{ "result": data }',
        },
      };

      const mcpTool = generator.generateMcpTool(apiConfig);

      expect(mcpTool.name).toBe('test-api');
      expect(mcpTool.description).toContain('这是一个测试API工具');
      expect(mcpTool.description).toContain(
        'API端点: GET https://api.example.com/test',
      );
      expect(mcpTool.inputSchema.type).toBe('object');
      expect(mcpTool.inputSchema.properties).toBeDefined();
      expect(mcpTool.inputSchema.properties?.query).toEqual({
        type: 'string',
        description: '查询参数',
        minLength: 1,
      });
      expect(mcpTool.inputSchema.required).toEqual(['query']);
    });

    it('应该处理复杂的参数schema', () => {
      const apiConfig: ApiToolConfig = {
        id: 'complex-api',
        name: '复杂API',
        description: '复杂参数的API',
        api: {
          url: 'https://api.example.com/complex',
          method: 'POST',
        },
        parameters: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: '用户名',
                },
                age: {
                  type: 'number',
                  minimum: 0,
                  maximum: 150,
                },
              },
              required: ['name'],
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              minItems: 1,
            },
          },
          required: ['user'],
        },
        response: {},
      };

      const mcpTool = generator.generateMcpTool(apiConfig);

      expect(mcpTool.inputSchema.properties?.user).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '用户名',
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 150,
          },
        },
        required: ['name'],
      });
      expect(mcpTool.inputSchema.properties?.tags).toEqual({
        type: 'array',
        items: {
          type: 'string',
        },
        minItems: 1,
      });
    });

    it('应该在描述中包含认证信息', () => {
      const apiConfig: ApiToolConfig = {
        id: 'auth-api',
        name: '认证API',
        description: '需要认证的API',
        api: {
          url: 'https://api.example.com/auth',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
        security: {
          authentication: {
            type: 'bearer',
            token: 'test-token',
          },
        },
      };

      const mcpTool = generator.generateMcpTool(apiConfig);

      expect(mcpTool.description).toContain('认证方式: BEARER');
    });

    it('应该在描述中包含缓存信息', () => {
      const apiConfig: ApiToolConfig = {
        id: 'cached-api',
        name: '缓存API',
        description: '启用缓存的API',
        api: {
          url: 'https://api.example.com/cached',
          method: 'GET',
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        response: {},
        cache: {
          enabled: true,
          ttl: 300,
        },
      };

      const mcpTool = generator.generateMcpTool(apiConfig);

      expect(mcpTool.description).toContain('缓存: 启用 (TTL: 300秒)');
    });

    it('应该处理生成错误', () => {
      const invalidConfig = {
        id: '',
        name: '',
        description: '',
        api: {
          url: 'invalid-url',
          method: 'INVALID' as 'GET',
        },
        parameters: {
          type: 'object' as const,
          properties: {},
        },
        response: {},
      };

      // 生成工具不会抛出错误，但生成的工具会在验证时失败
      const tool = generator.generateMcpTool(invalidConfig);
      const validation = generator.validateGeneratedTool(tool);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateGeneratedTool', () => {
    it('应该验证有效的工具定义', () => {
      const validTool = {
        name: 'valid-tool',
        description: '有效的工具',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'string' as const,
              description: '参数1',
            },
          },
          required: ['param1'],
        },
      };

      const result = generator.validateGeneratedTool(validTool);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的工具名称', () => {
      const invalidTool = {
        name: '',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'name',
        message: '工具名称不能为空',
        code: 'INVALID_TOOL_NAME',
      });
    });

    it('应该检测无效的工具名称格式', () => {
      const invalidTool = {
        name: 'invalid tool name!',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'name',
        message: '工具名称只能包含字母、数字、下划线和连字符',
        code: 'INVALID_TOOL_NAME_FORMAT',
      });
    });

    it('应该检测缺失的工具描述', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'description',
        message: '工具描述不能为空',
        code: 'INVALID_TOOL_DESCRIPTION',
      });
    });

    it('应该检测无效的输入schema类型', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'string' as 'object',
          properties: {},
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.type',
        message: 'MCP工具输入schema类型必须为object',
        code: 'INVALID_SCHEMA_TYPE',
      });
    });

    it('应该检测必需字段在properties中未定义', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'string' as const,
            },
          },
          required: ['param1', 'param2'], // param2未在properties中定义
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.required',
        message: "必需字段 'param2' 在properties中未定义",
        code: 'MISSING_REQUIRED_PROPERTY',
      });
    });

    it('应该检测无效的属性类型', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'invalid' as 'string',
            },
          },
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.properties.param1',
        message: '无效的属性类型: invalid',
        code: 'INVALID_PROPERTY_TYPE',
      });
    });

    it('应该检测无效的数值范围', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'number' as const,
              minimum: 10,
              maximum: 5, // 最小值大于最大值
            },
          },
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.properties.param1',
        message: '最小值不能大于最大值',
        code: 'INVALID_NUMBER_RANGE',
      });
    });

    it('应该检测无效的字符串长度范围', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'string' as const,
              minLength: 10,
              maxLength: 5, // 最小长度大于最大长度
            },
          },
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.properties.param1',
        message: '最小长度不能大于最大长度',
        code: 'INVALID_STRING_LENGTH_RANGE',
      });
    });

    it('应该检测无效的数组大小范围', () => {
      const invalidTool = {
        name: 'valid-name',
        description: '工具描述',
        inputSchema: {
          type: 'object' as const,
          properties: {
            param1: {
              type: 'array' as const,
              minItems: 10,
              maxItems: 5, // 最小项目数大于最大项目数
              items: {
                type: 'string' as const,
              },
            },
          },
        },
      };

      const result = generator.validateGeneratedTool(invalidTool);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        path: 'inputSchema.properties.param1',
        message: '最小项目数不能大于最大项目数',
        code: 'INVALID_ARRAY_SIZE_RANGE',
      });
    });
  });

  describe('generateAllTools', () => {
    it('应该批量生成有效的工具', () => {
      const configs: ApiToolConfig[] = [
        {
          id: 'tool1',
          name: '工具1',
          description: '第一个工具',
          api: {
            url: 'https://api.example.com/tool1',
            method: 'GET',
          },
          parameters: {
            type: 'object',
            properties: {
              param1: {
                type: 'string',
              },
            },
          },
          response: {},
        },
        {
          id: 'tool2',
          name: '工具2',
          description: '第二个工具',
          api: {
            url: 'https://api.example.com/tool2',
            method: 'POST',
          },
          parameters: {
            type: 'object',
            properties: {
              param2: {
                type: 'number',
              },
            },
          },
          response: {},
        },
      ];

      const tools = generator.generateAllTools(configs);

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('应该跳过无效的配置', () => {
      const configs: ApiToolConfig[] = [
        {
          id: 'valid-tool',
          name: '有效工具',
          description: '这是有效的工具',
          api: {
            url: 'https://api.example.com/valid',
            method: 'GET',
          },
          parameters: {
            type: 'object',
            properties: {},
          },
          response: {},
        },
        {
          id: '', // 无效的ID
          name: '无效工具',
          description: '这是无效的工具',
          api: {
            url: 'https://api.example.com/invalid',
            method: 'GET',
          },
          parameters: {
            type: 'object',
            properties: {},
          },
          response: {},
        },
      ];

      const tools = generator.generateAllTools(configs);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('valid-tool');
    });

    it('应该处理空配置数组', () => {
      const tools = generator.generateAllTools([]);

      expect(tools).toHaveLength(0);
    });
  });
});
