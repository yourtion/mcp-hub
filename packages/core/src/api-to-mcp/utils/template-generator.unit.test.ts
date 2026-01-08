/**
 * 模板生成器测试
 */

import { describe, expect, it } from 'vitest';
import { TemplateGeneratorImpl, TemplateType } from './template-generator.js';

describe('TemplateGeneratorImpl', () => {
  let templateGenerator: TemplateGeneratorImpl;

  beforeEach(() => {
    templateGenerator = new TemplateGeneratorImpl();
  });

  describe('getAvailableTemplates', () => {
    it('应该返回所有可用的模板信息', () => {
      const templates = templateGenerator.getAvailableTemplates();

      expect(templates).toHaveLength(6);
      expect(templates.map((t) => t.type)).toContain(TemplateType.BASIC_REST);
      expect(templates.map((t) => t.type)).toContain(TemplateType.WEATHER_API);
      expect(templates.map((t) => t.type)).toContain(
        TemplateType.TRANSLATION_API,
      );
    });

    it('应该包含完整的模板信息', () => {
      const templates = templateGenerator.getAvailableTemplates();
      const basicTemplate = templates.find(
        (t) => t.type === TemplateType.BASIC_REST,
      );

      expect(basicTemplate).toBeDefined();
      if (basicTemplate) {
        expect(basicTemplate.name).toBe('基础REST API');
        expect(basicTemplate.description).toBeTruthy();
        expect(basicTemplate.useCase).toBeTruthy();
        expect(Array.isArray(basicTemplate.requiredEnvVars)).toBe(true);
      }
    });
  });

  describe('generateBasicTemplate', () => {
    it('应该生成基础配置模板', () => {
      const template = templateGenerator.generateBasicTemplate();

      expect(template.version).toBe('1.0');
      expect(template.tools).toHaveLength(1);

      const tool = template.tools[0];
      expect(tool.id).toBe('example-api');
      expect(tool.name).toBe('示例API工具');
      expect(tool.api.method).toBe('GET');
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
    });
  });

  describe('generateTemplate', () => {
    it('应该生成基础REST API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.BASIC_REST,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('basic-get-api');
      expect(tool.api.method).toBe('GET');
      expect(tool.api.url).toContain('{{data.postId}}');
    });

    it('应该生成认证API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.AUTHENTICATED_API,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('authenticated-api');
      expect(tool.api.headers?.Authorization).toContain('{{env.API_TOKEN}}');
      expect(tool.security).toBeDefined();
      expect(tool.cache).toBeDefined();
    });

    it('应该生成复杂数据API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.COMPLEX_DATA_API,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('complex-data-api');
      expect(tool.api.method).toBe('POST');
      expect(tool.response.jsonata).toBeTruthy();
      expect(tool.response.jsonata?.length).toBeGreaterThan(100); // 复杂的JSONata表达式
    });

    it('应该生成天气API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.WEATHER_API,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('weather-api');
      expect(tool.name).toBe('天气查询');
      expect(tool.api.url).toContain('openweathermap.org');
      expect(tool.api.queryParams?.appid).toBe('{{env.WEATHER_API_KEY}}');
    });

    it('应该生成翻译API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.TRANSLATION_API,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('translation-api');
      expect(tool.name).toBe('文本翻译');
      expect(tool.parameters.properties?.from).toBeDefined();
      expect(tool.parameters.properties?.to).toBeDefined();
    });

    it('应该生成数据库API模板', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.DATABASE_API,
      );

      expect(template.tools).toHaveLength(1);
      const tool = template.tools[0];
      expect(tool.id).toBe('database-query');
      expect(tool.api.method).toBe('POST');
      expect(tool.api.url).toContain('{{env.DB_API_URL}}');
      expect(tool.security?.rateLimiting).toBeDefined();
    });

    it('应该为未知类型返回基础模板', () => {
      const template = templateGenerator.generateTemplate(
        'unknown' as TemplateType,
      );

      expect(template.tools).toHaveLength(1);
      expect(template.tools[0].id).toBe('example-api');
    });
  });

  describe('generateFullExample', () => {
    it('应该生成包含多个工具的完整示例', () => {
      const template = templateGenerator.generateFullExample();

      expect(template.tools.length).toBeGreaterThan(1);

      const toolIds = template.tools.map((t) => t.id);
      expect(toolIds).toContain('weather-api');
      expect(toolIds).toContain('translation-api');
      expect(toolIds).toContain('authenticated-api');
    });
  });

  describe('generateJsonSchema', () => {
    it('应该生成有效的JSON Schema', () => {
      const schema = templateGenerator.generateJsonSchema();

      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.title).toBeTruthy();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('version');
      expect(schema.required).toContain('tools');
      expect(schema.definitions).toBeDefined();
    });
  });

  describe('generateCommentedConfig', () => {
    it('应该生成带注释的配置文件', () => {
      const config = templateGenerator.generateBasicTemplate();
      const commented = templateGenerator.generateCommentedConfig(config);

      expect(commented).toContain('// API转MCP工具配置文件');
      expect(commented).toContain('// 环境变量引用格式: {{env.VARIABLE_NAME}}');
      expect(commented).toContain('// 参数引用格式: {{data.parameterName}}');
      expect(commented).toContain(JSON.stringify(config, null, 2));
    });
  });

  describe('模板内容验证', () => {
    it('所有模板都应该有有效的配置结构', () => {
      const templateTypes = Object.values(TemplateType);

      for (const type of templateTypes) {
        const template = templateGenerator.generateTemplate(type);

        expect(template.version).toBeTruthy();
        expect(Array.isArray(template.tools)).toBe(true);
        expect(template.tools.length).toBeGreaterThan(0);

        for (const tool of template.tools) {
          expect(tool.id).toBeTruthy();
          expect(tool.name).toBeTruthy();
          expect(tool.description).toBeTruthy();
          expect(tool.api).toBeDefined();
          expect(tool.api.url).toBeTruthy();
          expect(tool.api.method).toBeTruthy();
          expect(tool.parameters).toBeDefined();
          expect(tool.parameters.type).toBe('object');
          expect(tool.response).toBeDefined();
        }
      }
    });

    it('认证模板应该包含安全配置', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.AUTHENTICATED_API,
      );
      const tool = template.tools[0];

      expect(tool.security).toBeDefined();
      if (tool.security) {
        expect(tool.security.authentication).toBeDefined();
        expect(tool.security.allowedDomains).toBeDefined();
        expect(tool.security.rateLimiting).toBeDefined();
      }
    });

    it('复杂数据模板应该包含JSONata表达式', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.COMPLEX_DATA_API,
      );
      const tool = template.tools[0];

      expect(tool.response.jsonata).toBeTruthy();
      expect(tool.response.jsonata?.includes('$')).toBe(true); // JSONata函数标识
    });

    it('天气API模板应该包含正确的参数', () => {
      const template = templateGenerator.generateTemplate(
        TemplateType.WEATHER_API,
      );
      const tool = template.tools[0];

      expect(tool.parameters.properties?.city).toBeDefined();
      expect(tool.parameters.required).toContain('city');
      expect(tool.api.queryParams?.appid).toBe('{{env.WEATHER_API_KEY}}');
    });
  });
});
