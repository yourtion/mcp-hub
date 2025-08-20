/**
 * 配置模板生成器
 * 提供配置文件示例和模板生成功能
 */

import type { ApiToolsConfig } from '../types/api-config.js';

/**
 * 模板类型
 */
export enum TemplateType {
  /** 基础REST API */
  BASIC_REST = 'basic-rest',
  /** 带认证的API */
  AUTHENTICATED_API = 'authenticated-api',
  /** 复杂数据处理API */
  COMPLEX_DATA_API = 'complex-data-api',
  /** 天气API示例 */
  WEATHER_API = 'weather-api',
  /** 翻译API示例 */
  TRANSLATION_API = 'translation-api',
  /** 数据库查询API */
  DATABASE_API = 'database-api',
}

/**
 * 模板信息
 */
export interface TemplateInfo {
  /** 模板类型 */
  type: TemplateType;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 使用场景 */
  useCase: string;
  /** 所需环境变量 */
  requiredEnvVars: string[];
}

/**
 * 模板生成器接口
 */
export interface TemplateGenerator {
  /**
   * 获取所有可用的模板信息
   */
  getAvailableTemplates(): TemplateInfo[];

  /**
   * 生成指定类型的配置模板
   * @param type 模板类型
   */
  generateTemplate(type: TemplateType): ApiToolsConfig;

  /**
   * 生成基础配置模板
   */
  generateBasicTemplate(): ApiToolsConfig;

  /**
   * 生成完整的示例配置
   */
  generateFullExample(): ApiToolsConfig;

  /**
   * 生成JSON Schema文件
   */
  generateJsonSchema(): Record<string, unknown>;

  /**
   * 生成配置文件注释版本
   * @param config 配置对象
   */
  generateCommentedConfig(config: ApiToolsConfig): string;
}

/**
 * 模板生成器实现类
 */
export class TemplateGeneratorImpl implements TemplateGenerator {
  private readonly templates: Record<TemplateType, TemplateInfo> = {
    [TemplateType.BASIC_REST]: {
      type: TemplateType.BASIC_REST,
      name: '基础REST API',
      description: '简单的GET请求API配置',
      useCase: '适用于无需认证的公开API',
      requiredEnvVars: [],
    },
    [TemplateType.AUTHENTICATED_API]: {
      type: TemplateType.AUTHENTICATED_API,
      name: '认证API',
      description: '需要API密钥或Token认证的API',
      useCase: '适用于需要认证的第三方API服务',
      requiredEnvVars: ['API_KEY', 'API_TOKEN'],
    },
    [TemplateType.COMPLEX_DATA_API]: {
      type: TemplateType.COMPLEX_DATA_API,
      name: '复杂数据处理API',
      description: '使用JSONata进行复杂数据转换的API',
      useCase: '适用于需要复杂数据处理和转换的API',
      requiredEnvVars: ['API_ENDPOINT'],
    },
    [TemplateType.WEATHER_API]: {
      type: TemplateType.WEATHER_API,
      name: '天气API示例',
      description: '获取天气信息的API配置示例',
      useCase: '演示如何配置天气查询API',
      requiredEnvVars: ['WEATHER_API_KEY'],
    },
    [TemplateType.TRANSLATION_API]: {
      type: TemplateType.TRANSLATION_API,
      name: '翻译API示例',
      description: '文本翻译API配置示例',
      useCase: '演示如何配置翻译服务API',
      requiredEnvVars: ['TRANSLATE_API_KEY'],
    },
    [TemplateType.DATABASE_API]: {
      type: TemplateType.DATABASE_API,
      name: '数据库查询API',
      description: '数据库查询API配置示例',
      useCase: '演示如何配置数据库查询接口',
      requiredEnvVars: ['DB_API_URL', 'DB_API_KEY'],
    },
  };

  getAvailableTemplates(): TemplateInfo[] {
    return Object.values(this.templates);
  }

  generateTemplate(type: TemplateType): ApiToolsConfig {
    switch (type) {
      case TemplateType.BASIC_REST:
        return this.generateBasicRestTemplate();
      case TemplateType.AUTHENTICATED_API:
        return this.generateAuthenticatedApiTemplate();
      case TemplateType.COMPLEX_DATA_API:
        return this.generateComplexDataApiTemplate();
      case TemplateType.WEATHER_API:
        return this.generateWeatherApiTemplate();
      case TemplateType.TRANSLATION_API:
        return this.generateTranslationApiTemplate();
      case TemplateType.DATABASE_API:
        return this.generateDatabaseApiTemplate();
      default:
        return this.generateBasicTemplate();
    }
  }

  generateBasicTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'example-api',
          name: '示例API工具',
          description: '这是一个示例API工具配置',
          api: {
            url: 'https://api.example.com/data',
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
            jsonata: '$.data',
          },
        },
      ],
    };
  }

  generateFullExample(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        ...this.generateWeatherApiTemplate().tools,
        ...this.generateTranslationApiTemplate().tools,
        ...this.generateAuthenticatedApiTemplate().tools,
      ],
    };
  }

  private generateBasicRestTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'basic-get-api',
          name: '基础GET API',
          description: '简单的GET请求API示例',
          api: {
            url: 'https://jsonplaceholder.typicode.com/posts/{{data.postId}}',
            method: 'GET',
            timeout: 5000,
          },
          parameters: {
            type: 'object',
            properties: {
              postId: {
                type: 'number',
                description: '文章ID',
                minimum: 1,
              },
            },
            required: ['postId'],
          },
          response: {
            jsonata: '{ "title": title, "content": body, "author": userId }',
          },
        },
      ],
    };
  }

  private generateAuthenticatedApiTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'authenticated-api',
          name: '认证API示例',
          description: '需要API密钥认证的API示例',
          api: {
            url: 'https://api.example.com/secure/data',
            method: 'GET',
            headers: {
              Authorization: 'Bearer {{env.API_TOKEN}}',
              'X-API-Key': '{{env.API_KEY}}',
              'Content-Type': 'application/json',
            },
            queryParams: {
              format: 'json',
              limit: '{{data.limit}}',
            },
            timeout: 10000,
            retries: 3,
          },
          parameters: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: '返回结果数量限制',
                minimum: 1,
                maximum: 100,
                default: 10,
              },
              category: {
                type: 'string',
                description: '数据分类',
                enum: ['news', 'articles', 'posts'],
              },
            },
            required: ['limit'],
          },
          response: {
            jsonata:
              '{ "items": data.items, "total": data.total, "hasMore": data.hasMore }',
            errorPath: 'error.message',
          },
          security: {
            authentication: {
              type: 'bearer',
              token: '{{env.API_TOKEN}}',
            },
            allowedDomains: ['api.example.com'],
            rateLimiting: {
              windowSeconds: 60,
              maxRequests: 100,
              enabled: true,
            },
          },
          cache: {
            enabled: true,
            ttl: 300,
            maxSize: 1000,
          },
        },
      ],
    };
  }

  private generateComplexDataApiTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'complex-data-api',
          name: '复杂数据处理API',
          description: '演示复杂数据转换和处理的API',
          api: {
            url: '{{env.API_ENDPOINT}}/analytics',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer {{env.API_TOKEN}}',
            },
            body: {
              query: '{{data.query}}',
              filters: '{{data.filters}}',
              aggregations: ['sum', 'avg', 'count'],
            },
            timeout: 30000,
          },
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '查询条件',
                minLength: 1,
              },
              filters: {
                type: 'object',
                description: '过滤条件',
                properties: {
                  dateRange: {
                    type: 'object',
                    properties: {
                      start: { type: 'string', format: 'date' },
                      end: { type: 'string', format: 'date' },
                    },
                  },
                  category: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
            required: ['query'],
          },
          response: {
            jsonata: `{
              "summary": {
                "total": results.total,
                "processed": results.processed,
                "duration": results.executionTime
              },
              "data": results.data[].{
                "id": id,
                "value": value,
                "category": category,
                "score": $round(score, 2),
                "tags": tags[type="important"].name
              },
              "aggregations": {
                "sum": $sum(results.data.value),
                "average": $round($average(results.data.value), 2),
                "count": $count(results.data)
              }
            }`,
            errorPath: 'error.details.message',
            successCondition: 'status = "success"',
          },
        },
      ],
    };
  }

  private generateWeatherApiTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'weather-api',
          name: '天气查询',
          description: '根据城市名称获取当前天气信息',
          api: {
            url: 'https://api.openweathermap.org/data/2.5/weather',
            method: 'GET',
            queryParams: {
              q: '{{data.city}}',
              appid: '{{env.WEATHER_API_KEY}}',
              units: 'metric',
              lang: 'zh_cn',
            },
            timeout: 5000,
          },
          parameters: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: '城市名称（中文或英文）',
                minLength: 1,
              },
            },
            required: ['city'],
          },
          response: {
            jsonata: `{
              "city": name,
              "country": sys.country,
              "temperature": $round(main.temp, 1),
              "feelsLike": $round(main.feels_like, 1),
              "humidity": main.humidity,
              "pressure": main.pressure,
              "description": weather[0].description,
              "windSpeed": wind.speed,
              "visibility": visibility / 1000
            }`,
            errorPath: 'message',
          },
        },
      ],
    };
  }

  private generateTranslationApiTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'translation-api',
          name: '文本翻译',
          description: '将文本从一种语言翻译为另一种语言',
          api: {
            url: 'https://api.mymemory.translated.net/get',
            method: 'GET',
            queryParams: {
              q: '{{data.text}}',
              langpair: '{{data.from}}|{{data.to}}',
              de: '{{env.TRANSLATE_API_KEY}}',
            },
            timeout: 10000,
          },
          parameters: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: '要翻译的文本',
                minLength: 1,
                maxLength: 500,
              },
              from: {
                type: 'string',
                description: '源语言代码',
                enum: ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es'],
                default: 'zh',
              },
              to: {
                type: 'string',
                description: '目标语言代码',
                enum: ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es'],
                default: 'en',
              },
            },
            required: ['text', 'from', 'to'],
          },
          response: {
            jsonata: `{
              "translatedText": responseData.translatedText,
              "sourceText": quotaFinished ? null : responseData.match,
              "confidence": responseData.match,
              "language": {
                "from": $substring(responseData.match, 0, 2),
                "to": $substring(responseData.match, 3, 2)
              }
            }`,
            errorPath: 'responseDetails',
          },
        },
      ],
    };
  }

  private generateDatabaseApiTemplate(): ApiToolsConfig {
    return {
      version: '1.0',
      tools: [
        {
          id: 'database-query',
          name: '数据库查询',
          description: '执行数据库查询并返回结果',
          api: {
            url: '{{env.DB_API_URL}}/query',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer {{env.DB_API_KEY}}',
            },
            body: {
              table: '{{data.table}}',
              fields: '{{data.fields}}',
              where: '{{data.conditions}}',
              limit: '{{data.limit}}',
              orderBy: '{{data.orderBy}}',
            },
            timeout: 15000,
          },
          parameters: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: '表名',
                minLength: 1,
              },
              fields: {
                type: 'array',
                description: '要查询的字段列表',
                items: { type: 'string' },
                minItems: 1,
              },
              conditions: {
                type: 'object',
                description: '查询条件',
                additionalProperties: true,
              },
              limit: {
                type: 'number',
                description: '返回记录数限制',
                minimum: 1,
                maximum: 1000,
                default: 100,
              },
              orderBy: {
                type: 'string',
                description: '排序字段',
              },
            },
            required: ['table', 'fields'],
          },
          response: {
            jsonata: `{
              "records": data.rows,
              "total": data.total,
              "fields": data.fields,
              "executionTime": metadata.executionTime,
              "hasMore": data.total > $count(data.rows)
            }`,
            errorPath: 'error.message',
          },
          security: {
            allowedDomains: ['your-db-api.com'],
            rateLimiting: {
              windowSeconds: 60,
              maxRequests: 50,
              enabled: true,
            },
          },
        },
      ],
    };
  }

  generateJsonSchema(): Record<string, unknown> {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'API转MCP工具配置',
      description: 'API转MCP服务的配置文件格式定义',
      type: 'object',
      properties: {
        version: {
          type: 'string',
          description: '配置文件版本',
          pattern: '^\\d+\\.\\d+$',
        },
        tools: {
          type: 'array',
          description: 'API工具配置列表',
          items: {
            $ref: '#/definitions/ApiToolConfig',
          },
        },
      },
      required: ['version', 'tools'],
      definitions: {
        ApiToolConfig: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '工具唯一标识',
              minLength: 1,
            },
            name: {
              type: 'string',
              description: '工具显示名称',
              minLength: 1,
            },
            description: {
              type: 'string',
              description: '工具描述',
              minLength: 1,
            },
            api: {
              $ref: '#/definitions/ApiEndpointConfig',
            },
            parameters: {
              $ref: '#/definitions/JsonSchema',
            },
            response: {
              $ref: '#/definitions/ResponseConfig',
            },
            security: {
              $ref: '#/definitions/SecurityConfig',
            },
            cache: {
              $ref: '#/definitions/CacheConfig',
            },
          },
          required: [
            'id',
            'name',
            'description',
            'api',
            'parameters',
            'response',
          ],
        },
        // 其他定义...
      },
    };
  }

  generateCommentedConfig(config: ApiToolsConfig): string {
    const lines: string[] = [];

    lines.push('// API转MCP工具配置文件');
    lines.push('// 此文件定义了如何将REST API转换为MCP工具');
    lines.push('//');
    lines.push('// 环境变量引用格式: {{env.VARIABLE_NAME}}');
    lines.push('// 参数引用格式: {{data.parameterName}}');
    lines.push('//');
    lines.push('// 更多信息请参考文档: https://github.com/your-org/mcp-hub');
    lines.push('');

    lines.push(JSON.stringify(config, null, 2));

    return lines.join('\n');
  }
}
