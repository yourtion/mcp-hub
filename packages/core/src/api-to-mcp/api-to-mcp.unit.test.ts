/**
 * API转MCP服务模块的基础测试
 */

import { describe, expect, it } from 'vitest';
import { ConfigValidatorImpl } from './config/config-validator.js';
import { ApiConfigManagerImpl } from './services/api-config-manager.js';
import { ApiToMcpServiceManagerImpl } from './services/api-to-mcp-service-manager.js';
import { ApiToolGenerator } from './services/api-tool-generator.js';
import { EnvironmentResolverImpl } from './utils/environment-resolver.js';
import { TemplateEngineImpl } from './utils/template-engine.js';

describe('API转MCP服务模块', () => {
  describe('ApiToMcpServiceManager', () => {
    it('应该能够创建服务管理器实例', () => {
      const manager = new ApiToMcpServiceManagerImpl();
      expect(manager).toBeDefined();
    });

    it('应该在未初始化时抛出错误', async () => {
      const manager = new ApiToMcpServiceManagerImpl();
      await expect(manager.getApiTools()).rejects.toThrow(
        '服务管理器未运行，当前状态: not_initialized',
      );
    });
  });

  describe('ApiConfigManager', () => {
    it('应该能够创建配置管理器实例', () => {
      const manager = new ApiConfigManagerImpl();
      expect(manager).toBeDefined();
    });
  });

  describe('ApiToolGenerator', () => {
    it('应该能够创建工具生成器实例', () => {
      const generator = new ApiToolGenerator();
      expect(generator).toBeDefined();
    });

    it('应该能够生成基本的MCP工具定义', () => {
      const generator = new ApiToolGenerator();
      const apiConfig = {
        id: 'test-tool',
        name: '测试工具',
        description: '这是一个测试工具',
        api: {
          url: 'https://api.example.com/test',
          method: 'GET' as const,
        },
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
        },
        response: {},
      };

      const tool = generator.generateMcpTool(apiConfig);
      expect(tool.name).toBe('test-tool');
      expect(tool.description).toContain('这是一个测试工具');
      expect(tool.description).toContain(
        'API端点: GET https://api.example.com/test',
      );
    });
  });

  describe('TemplateEngine', () => {
    it('应该能够创建模板引擎实例', () => {
      const engine = new TemplateEngineImpl();
      expect(engine).toBeDefined();
    });

    it('应该能够渲染简单的模板', () => {
      const engine = new TemplateEngineImpl();
      const template = 'Hello {{data.name}}!';
      const context = {
        data: { name: 'World' },
        env: {},
      };

      const result = engine.render(template, context);
      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello World!');
    });

    it('应该能够处理环境变量模板', () => {
      const engine = new TemplateEngineImpl();
      const template = 'API Key: {{env.API_KEY}}';
      const context = {
        data: {},
        env: { API_KEY: 'secret-key' },
      };

      const result = engine.render(template, context);
      expect(result.success).toBe(true);
      expect(result.result).toBe('API Key: secret-key');
    });

    it('应该能够验证模板语法', () => {
      const engine = new TemplateEngineImpl();
      const validTemplate = '{{data.user.name}}';
      const invalidTemplate = '{{invalid}}';

      const validResult = engine.validateTemplate(validTemplate);
      const invalidResult = engine.validateTemplate(invalidTemplate);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('EnvironmentResolver', () => {
    it('应该能够创建环境变量解析器实例', () => {
      const resolver = new EnvironmentResolverImpl();
      expect(resolver).toBeDefined();
    });

    it('应该能够解析环境变量引用', () => {
      const resolver = new EnvironmentResolverImpl();
      // 设置测试环境变量
      process.env.TEST_VAR = 'test-value';

      const result = resolver.resolve('Value: {{env.TEST_VAR}}');
      expect(result).toBe('Value: test-value');

      // 清理
      delete process.env.TEST_VAR;
    });

    it('应该能够提取环境变量引用', () => {
      const resolver = new EnvironmentResolverImpl();
      const text = 'API: {{env.API_URL}}, Key: {{env.API_KEY}}';

      const variables = resolver.extractEnvironmentVariables(text);
      expect(variables).toEqual(['API_URL', 'API_KEY']);
    });
  });

  describe('ConfigValidator', () => {
    it('应该能够创建配置验证器实例', () => {
      const validator = new ConfigValidatorImpl();
      expect(validator).toBeDefined();
    });

    it('应该能够验证有效的URL', () => {
      const validator = new ConfigValidatorImpl();
      const result = validator.validateUrl('https://api.example.com');
      expect(result.valid).toBe(true);
    });

    it('应该能够检测无效的URL', () => {
      const validator = new ConfigValidatorImpl();
      const result = validator.validateUrl('invalid-url');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该能够验证JSONata表达式', () => {
      const validator = new ConfigValidatorImpl();
      const validExpression = 'data.result';
      const invalidExpression = '';

      const validResult = validator.validateJsonataExpression(validExpression);
      const invalidResult =
        validator.validateJsonataExpression(invalidExpression);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });
  });
});
