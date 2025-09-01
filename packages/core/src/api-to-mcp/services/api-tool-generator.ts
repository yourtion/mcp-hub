/**
 * API工具生成器 - 从API配置生成MCP工具定义
 */

import { createLogger } from '../../utils/logger.js';
import type {
  ApiToolConfig,
  JsonSchema,
  JsonSchemaProperty,
} from '../types/api-config.js';
import type {
  McpTool,
  McpToolInputSchema,
  ValidationError,
  ValidationResult,
} from '../types/api-tool.js';

const logger = createLogger({ component: 'ApiToolGenerator' });

/**
 * API工具生成器类
 * 负责将API配置转换为符合MCP协议的工具定义
 */
export class ApiToolGenerator {
  /**
   * 从API配置生成MCP工具定义
   * @param apiConfig API配置
   * @returns MCP工具定义
   */
  generateMcpTool(apiConfig: ApiToolConfig): McpTool {
    logger.debug('生成MCP工具定义', { context: { toolId: apiConfig.id } });

    try {
      // 转换参数schema为MCP格式
      const inputSchema = this.convertToMcpInputSchema(apiConfig.parameters);

      // 创建MCP工具定义
      const mcpTool: McpTool = {
        name: apiConfig.id,
        description: this.buildToolDescription(apiConfig),
        inputSchema,
      };

      logger.debug('MCP工具定义生成成功', {
        context: {
          toolId: apiConfig.id,
          toolName: mcpTool.name,
          hasParameters: Object.keys(inputSchema.properties || {}).length > 0,
        },
      });

      return mcpTool;
    } catch (error) {
      logger.error('生成MCP工具定义失败', error as Error, {
        context: { toolId: apiConfig.id },
      });
      throw new Error(
        `生成工具 '${apiConfig.id}' 的MCP定义失败: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 验证生成的工具定义
   * @param tool MCP工具定义
   * @returns 验证结果
   */
  validateGeneratedTool(tool: McpTool): ValidationResult {
    const errors: ValidationError[] = [];

    // 验证工具名称
    if (
      !tool.name ||
      typeof tool.name !== 'string' ||
      tool.name.trim() === ''
    ) {
      errors.push({
        path: 'name',
        message: '工具名称不能为空',
        code: 'INVALID_TOOL_NAME',
      });
    }

    // 验证工具名称格式（只允许字母、数字、下划线和连字符）
    if (tool.name && !/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
      errors.push({
        path: 'name',
        message: '工具名称只能包含字母、数字、下划线和连字符',
        code: 'INVALID_TOOL_NAME_FORMAT',
      });
    }

    // 验证工具描述
    if (!tool.description || typeof tool.description !== 'string') {
      errors.push({
        path: 'description',
        message: '工具描述不能为空',
        code: 'INVALID_TOOL_DESCRIPTION',
      });
    }

    // 验证输入schema
    const schemaValidation = this.validateInputSchema(tool.inputSchema);
    errors.push(...schemaValidation.errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 批量生成工具
   * @param configs API配置数组
   * @returns MCP工具定义数组
   */
  generateAllTools(configs: ApiToolConfig[]): McpTool[] {
    logger.info('批量生成MCP工具', {
      context: { configCount: configs.length },
    });

    const tools: McpTool[] = [];
    const errors: Array<{ configId: string; error: string }> = [];

    for (const config of configs) {
      try {
        const tool = this.generateMcpTool(config);
        const validation = this.validateGeneratedTool(tool);

        if (!validation.valid) {
          const errorMessages = validation.errors
            .map((e) => e.message)
            .join(', ');
          errors.push({
            configId: config.id,
            error: `工具验证失败: ${errorMessages}`,
          });
          continue;
        }

        tools.push(tool);
      } catch (error) {
        errors.push({
          configId: config.id,
          error: (error as Error).message,
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('部分工具生成失败', { context: { errors } });
    }

    logger.info('批量工具生成完成', {
      context: {
        successCount: tools.length,
        errorCount: errors.length,
        totalCount: configs.length,
      },
    });

    return tools;
  }

  /**
   * 将JSON Schema转换为MCP输入schema格式
   * @param jsonSchema JSON Schema定义
   * @returns MCP输入schema
   */
  private convertToMcpInputSchema(jsonSchema: JsonSchema): McpToolInputSchema {
    const inputSchema: McpToolInputSchema = {
      type: 'object',
      properties: {},
      additionalProperties: jsonSchema.additionalProperties ?? false,
    };

    // 转换属性定义
    if (jsonSchema.properties) {
      inputSchema.properties = this.convertProperties(jsonSchema.properties);
    }

    // 设置必需字段
    if (jsonSchema.required && jsonSchema.required.length > 0) {
      inputSchema.required = [...jsonSchema.required];
    }

    return inputSchema;
  }

  /**
   * 转换属性定义
   * @param properties JSON Schema属性定义
   * @returns 转换后的属性定义
   */
  private convertProperties(
    properties: Record<string, JsonSchemaProperty>,
  ): Record<string, JsonSchemaProperty> {
    const converted: Record<string, JsonSchemaProperty> = {};

    for (const [key, property] of Object.entries(properties)) {
      converted[key] = this.convertProperty(property);
    }

    return converted;
  }

  /**
   * 转换单个属性定义
   * @param property JSON Schema属性
   * @returns 转换后的属性
   */
  private convertProperty(property: JsonSchemaProperty): JsonSchemaProperty {
    const converted: JsonSchemaProperty = {
      type: property.type,
    };

    // 复制基本属性
    if (property.description) converted.description = property.description;
    if (property.default !== undefined) converted.default = property.default;
    if (property.enum) converted.enum = [...property.enum];
    if (property.format) converted.format = property.format;

    // 复制数值约束
    if (property.minimum !== undefined) converted.minimum = property.minimum;
    if (property.maximum !== undefined) converted.maximum = property.maximum;
    if (property.minLength !== undefined)
      converted.minLength = property.minLength;
    if (property.maxLength !== undefined)
      converted.maxLength = property.maxLength;
    if (property.minItems !== undefined) converted.minItems = property.minItems;
    if (property.maxItems !== undefined) converted.maxItems = property.maxItems;
    if (property.pattern) converted.pattern = property.pattern;

    // 处理数组类型
    if (property.type === 'array' && property.items) {
      converted.items = this.convertProperty(property.items);
    }

    // 处理对象类型
    if (property.type === 'object') {
      if (property.properties) {
        converted.properties = this.convertProperties(property.properties);
      }
      if (property.required) {
        converted.required = [...property.required];
      }
      if (property.additionalProperties !== undefined) {
        converted.additionalProperties = property.additionalProperties;
      }
    }

    return converted;
  }

  /**
   * 构建工具描述
   * @param apiConfig API配置
   * @returns 工具描述
   */
  private buildToolDescription(apiConfig: ApiToolConfig): string {
    let description = apiConfig.description;

    // 添加API信息到描述中
    const apiInfo = [`API端点: ${apiConfig.api.method} ${apiConfig.api.url}`];

    // 添加认证信息（如果有）
    if (apiConfig.security?.authentication) {
      const authType = apiConfig.security.authentication.type;
      apiInfo.push(`认证方式: ${authType.toUpperCase()}`);
    }

    // 添加缓存信息（如果启用）
    if (apiConfig.cache?.enabled) {
      apiInfo.push(`缓存: 启用 (TTL: ${apiConfig.cache.ttl}秒)`);
    }

    // 将API信息添加到描述末尾
    description += `\n\n${apiInfo.join('\n')}`;

    return description;
  }

  /**
   * 验证输入schema
   * @param inputSchema MCP输入schema
   * @returns 验证结果
   */
  private validateInputSchema(
    inputSchema: McpToolInputSchema,
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // 验证schema类型
    if (inputSchema.type !== 'object') {
      errors.push({
        path: 'inputSchema.type',
        message: 'MCP工具输入schema类型必须为object',
        code: 'INVALID_SCHEMA_TYPE',
      });
    }

    // 验证属性定义
    if (inputSchema.properties) {
      for (const [propName, propDef] of Object.entries(
        inputSchema.properties,
      )) {
        const propErrors = this.validateProperty(
          propDef,
          `inputSchema.properties.${propName}`,
        );
        errors.push(...propErrors);
      }
    }

    // 验证必需字段
    if (inputSchema.required) {
      for (const requiredField of inputSchema.required) {
        if (!inputSchema.properties?.[requiredField]) {
          errors.push({
            path: `inputSchema.required`,
            message: `必需字段 '${requiredField}' 在properties中未定义`,
            code: 'MISSING_REQUIRED_PROPERTY',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证属性定义
   * @param property 属性定义
   * @param path 属性路径
   * @returns 验证错误数组
   */
  private validateProperty(
    property: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // 验证属性类型
    const validTypes = [
      'string',
      'number',
      'boolean',
      'object',
      'array',
      'null',
    ];
    if (!validTypes.includes(property.type)) {
      errors.push({
        path,
        message: `无效的属性类型: ${property.type}`,
        code: 'INVALID_PROPERTY_TYPE',
      });
    }

    // 验证数值约束
    if (property.type === 'number') {
      if (property.minimum !== undefined && property.maximum !== undefined) {
        if (property.minimum > property.maximum) {
          errors.push({
            path,
            message: '最小值不能大于最大值',
            code: 'INVALID_NUMBER_RANGE',
          });
        }
      }
    }

    // 验证字符串约束
    if (property.type === 'string') {
      if (
        property.minLength !== undefined &&
        property.maxLength !== undefined
      ) {
        if (property.minLength > property.maxLength) {
          errors.push({
            path,
            message: '最小长度不能大于最大长度',
            code: 'INVALID_STRING_LENGTH_RANGE',
          });
        }
      }
    }

    // 验证数组约束
    if (property.type === 'array') {
      if (property.minItems !== undefined && property.maxItems !== undefined) {
        if (property.minItems > property.maxItems) {
          errors.push({
            path,
            message: '最小项目数不能大于最大项目数',
            code: 'INVALID_ARRAY_SIZE_RANGE',
          });
        }
      }

      // 递归验证数组项目类型
      if (property.items) {
        const itemErrors = this.validateProperty(
          property.items,
          `${path}.items`,
        );
        errors.push(...itemErrors);
      }
    }

    // 递归验证对象属性
    if (property.type === 'object' && property.properties) {
      for (const [propName, propDef] of Object.entries(property.properties)) {
        const propErrors = this.validateProperty(
          propDef,
          `${path}.properties.${propName}`,
        );
        errors.push(...propErrors);
      }
    }

    return errors;
  }
}
