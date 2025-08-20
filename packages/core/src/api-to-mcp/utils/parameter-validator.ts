/**
 * 参数验证器
 * 使用JSON Schema验证MCP工具输入参数，并提供参数处理功能
 */

import type { JsonSchema, JsonSchemaProperty } from '../types/api-config.js';
import type { ValidationError, ValidationResult } from '../types/api-tool.js';

/**
 * 参数验证结果（带处理后的数据）
 */
export interface ParameterValidationResult extends ValidationResult {
  /** 处理后的参数数据 */
  data?: Record<string, unknown>;
}

/**
 * 参数处理选项
 */
export interface ParameterProcessingOptions {
  /** 是否应用默认值 */
  applyDefaults?: boolean;
  /** 是否移除额外属性 */
  removeAdditionalProperties?: boolean;
  /** 是否严格模式（不允许额外属性） */
  strict?: boolean;
}

/**
 * 参数验证器接口
 */
export interface ParameterValidator {
  /**
   * 验证参数
   * @param parameters 输入参数
   * @param schema JSON Schema
   * @param options 处理选项
   */
  validate(
    parameters: unknown,
    schema: JsonSchema,
    options?: ParameterProcessingOptions,
  ): ParameterValidationResult;

  /**
   * 应用默认值
   * @param parameters 输入参数
   * @param schema JSON Schema
   */
  applyDefaults(
    parameters: Record<string, unknown>,
    schema: JsonSchema,
  ): Record<string, unknown>;

  /**
   * 检查必需字段
   * @param parameters 输入参数
   * @param schema JSON Schema
   */
  checkRequiredFields(
    parameters: Record<string, unknown>,
    schema: JsonSchema,
  ): ValidationError[];
}

/**
 * 参数验证器实现类
 */
export class ParameterValidatorImpl implements ParameterValidator {
  validate(
    parameters: unknown,
    schema: JsonSchema,
    options: ParameterProcessingOptions = {},
  ): ParameterValidationResult {
    const errors: ValidationError[] = [];

    // 检查参数是否为对象
    if (typeof parameters !== 'object' || parameters === null) {
      return {
        valid: false,
        errors: [
          {
            path: 'root',
            message: '参数必须是一个对象',
            code: 'INVALID_TYPE',
          },
        ],
      };
    }

    const params = parameters as Record<string, unknown>;
    let processedData = { ...params };

    // 应用默认值
    if (options.applyDefaults !== false) {
      processedData = this.applyDefaults(processedData, schema);
    }

    // 检查必需字段
    const requiredErrors = this.checkRequiredFields(processedData, schema);
    errors.push(...requiredErrors);

    // 验证每个属性
    for (const [key, value] of Object.entries(processedData)) {
      const propertySchema = schema.properties[key];

      if (!propertySchema) {
        // 处理额外属性
        if (schema.additionalProperties === false || options.strict) {
          errors.push({
            path: key,
            message: `不允许的额外属性: ${key}`,
            code: 'ADDITIONAL_PROPERTY_NOT_ALLOWED',
          });
        } else if (options.removeAdditionalProperties) {
          delete processedData[key];
        }
        continue;
      }

      // 验证属性值
      const propertyErrors = this.validateProperty(value, propertySchema, key);
      errors.push(...propertyErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      data: processedData,
    };
  }

  applyDefaults(
    parameters: Record<string, unknown>,
    schema: JsonSchema,
  ): Record<string, unknown> {
    const result = { ...parameters };

    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (result[key] === undefined && propertySchema.default !== undefined) {
        result[key] = propertySchema.default;
      }
    }

    return result;
  }

  checkRequiredFields(
    parameters: Record<string, unknown>,
    schema: JsonSchema,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const requiredFields = schema.required || [];

    for (const field of requiredFields) {
      if (parameters[field] === undefined || parameters[field] === null) {
        errors.push({
          path: field,
          message: `必需字段 '${field}' 缺失或为空`,
          code: 'REQUIRED_FIELD_MISSING',
        });
      }
    }

    return errors;
  }

  private validateProperty(
    value: unknown,
    schema: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // 检查null值
    if (value === null) {
      if (schema.type !== 'null') {
        errors.push({
          path,
          message: `字段 '${path}' 不能为null`,
          code: 'NULL_NOT_ALLOWED',
        });
      }
      return errors;
    }

    // 检查undefined值
    if (value === undefined) {
      return errors; // undefined值在必需字段检查中处理
    }

    // 类型验证
    const typeErrors = this.validateType(value, schema.type, path);
    errors.push(...typeErrors);

    if (typeErrors.length > 0) {
      return errors; // 如果类型错误，跳过其他验证
    }

    // 根据类型进行具体验证
    switch (schema.type) {
      case 'string':
        errors.push(...this.validateString(value as string, schema, path));
        break;
      case 'number':
        errors.push(...this.validateNumber(value as number, schema, path));
        break;
      case 'array':
        errors.push(...this.validateArray(value as unknown[], schema, path));
        break;
      case 'object':
        errors.push(
          ...this.validateObject(
            value as Record<string, unknown>,
            schema,
            path,
          ),
        );
        break;
    }

    // 枚举值验证
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `字段 '${path}' 的值必须是以下之一: ${schema.enum.join(', ')}`,
        code: 'ENUM_VALIDATION_FAILED',
      });
    }

    return errors;
  }

  private validateType(
    value: unknown,
    expectedType: JsonSchemaProperty['type'],
    path: string,
  ): ValidationError[] {
    const actualType = this.getValueType(value);

    if (actualType !== expectedType) {
      return [
        {
          path,
          message: `字段 '${path}' 期望类型为 ${expectedType}，实际类型为 ${actualType}`,
          code: 'TYPE_MISMATCH',
        },
      ];
    }

    return [];
  }

  private validateString(
    value: string,
    schema: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // 长度验证
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `字段 '${path}' 长度不能少于 ${schema.minLength} 个字符`,
        code: 'MIN_LENGTH_VIOLATION',
      });
    }

    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `字段 '${path}' 长度不能超过 ${schema.maxLength} 个字符`,
        code: 'MAX_LENGTH_VIOLATION',
      });
    }

    // 正则表达式验证
    if (schema.pattern) {
      try {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({
            path,
            message: `字段 '${path}' 不匹配模式 ${schema.pattern}`,
            code: 'PATTERN_MISMATCH',
          });
        }
      } catch (_err) {
        errors.push({
          path,
          message: `字段 '${path}' 的正则表达式模式无效`,
          code: 'INVALID_PATTERN',
        });
      }
    }

    // 格式验证
    if (schema.format) {
      const formatErrors = this.validateFormat(value, schema.format, path);
      errors.push(...formatErrors);
    }

    return errors;
  }

  private validateNumber(
    value: number,
    schema: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // 最小值验证
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `字段 '${path}' 的值不能小于 ${schema.minimum}`,
        code: 'MINIMUM_VIOLATION',
      });
    }

    // 最大值验证
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `字段 '${path}' 的值不能大于 ${schema.maximum}`,
        code: 'MAXIMUM_VIOLATION',
      });
    }

    return errors;
  }

  private validateArray(
    value: unknown[],
    schema: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // 数组长度验证
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `数组 '${path}' 的元素数量不能少于 ${schema.minItems}`,
        code: 'MIN_ITEMS_VIOLATION',
      });
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `数组 '${path}' 的元素数量不能超过 ${schema.maxItems}`,
        code: 'MAX_ITEMS_VIOLATION',
      });
    }

    // 数组元素验证
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = this.validateProperty(
          value[i],
          schema.items,
          `${path}[${i}]`,
        );
        errors.push(...itemErrors);
      }
    }

    return errors;
  }

  private validateObject(
    value: Record<string, unknown>,
    schema: JsonSchemaProperty,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!schema.properties) {
      return errors;
    }

    // 验证对象属性
    for (const [key, propValue] of Object.entries(value)) {
      const propertySchema = schema.properties[key];

      if (propertySchema) {
        const propErrors = this.validateProperty(
          propValue,
          propertySchema,
          `${path}.${key}`,
        );
        errors.push(...propErrors);
      } else if (schema.additionalProperties === false) {
        errors.push({
          path: `${path}.${key}`,
          message: `对象 '${path}' 不允许额外属性 '${key}'`,
          code: 'ADDITIONAL_PROPERTY_NOT_ALLOWED',
        });
      }
    }

    // 检查必需属性
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (value[requiredProp] === undefined || value[requiredProp] === null) {
          errors.push({
            path: `${path}.${requiredProp}`,
            message: `对象 '${path}' 缺少必需属性 '${requiredProp}'`,
            code: 'REQUIRED_PROPERTY_MISSING',
          });
        }
      }
    }

    return errors;
  }

  private validateFormat(
    value: string,
    format: string,
    path: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (format) {
      case 'email':
        if (!this.isValidEmail(value)) {
          errors.push({
            path,
            message: `字段 '${path}' 不是有效的邮箱地址`,
            code: 'INVALID_EMAIL_FORMAT',
          });
        }
        break;
      case 'uri':
      case 'url':
        if (!this.isValidUrl(value)) {
          errors.push({
            path,
            message: `字段 '${path}' 不是有效的URL`,
            code: 'INVALID_URL_FORMAT',
          });
        }
        break;
      case 'date':
        if (!this.isValidDate(value)) {
          errors.push({
            path,
            message: `字段 '${path}' 不是有效的日期格式 (YYYY-MM-DD)`,
            code: 'INVALID_DATE_FORMAT',
          });
        }
        break;
      case 'date-time':
        if (!this.isValidDateTime(value)) {
          errors.push({
            path,
            message: `字段 '${path}' 不是有效的日期时间格式 (ISO 8601)`,
            code: 'INVALID_DATETIME_FORMAT',
          });
        }
        break;
    }

    return errors;
  }

  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return false;

    // 检查日期是否与输入匹配（避免自动修正，如2023-13-01变成2024-01-01）
    const isoString = parsedDate.toISOString();
    return isoString.startsWith(date);
  }

  private isValidDateTime(dateTime: string): boolean {
    try {
      const parsedDate = new Date(dateTime);
      return (
        !Number.isNaN(parsedDate.getTime()) &&
        dateTime === parsedDate.toISOString()
      );
    } catch {
      return false;
    }
  }
}
