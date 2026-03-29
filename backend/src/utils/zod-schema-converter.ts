/**
 * Zod Schema 转换工具
 * 将 JSON Schema 转换为类型安全的 Zod Schema
 */

import { z } from 'zod/v4';

/**
 * JSON Schema 属性定义
 */
interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: unknown[];
}

/**
 * JSON Schema 定义
 */
interface JsonSchema {
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * 转换 JSON Schema 为 Zod Schema
 * 使用泛型确保类型安全
 */
export function convertToZodSchema(
  inputSchema: JsonSchema | unknown,
): Record<string, z.ZodType> {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return {};
  }

  const schema = inputSchema as JsonSchema;
  if (!schema.properties) {
    return {};
  }

  const zodSchema: Record<string, z.ZodType> = {};

  for (const [propName, propDef] of Object.entries(schema.properties)) {
    let zodType: z.ZodType;

    // 基本类型转换
    switch (propDef.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'object':
        zodType = z.record(z.string(), z.unknown());
        break;
      case 'array':
        zodType = z.array(z.unknown());
        break;
      default:
        zodType = z.unknown();
    }

    // 添加描述
    if (propDef.description) {
      zodType = zodType.describe(propDef.description);
    }

    // 处理枚举
    if (propDef.enum && propDef.enum.length > 0) {
      zodType = z.enum(propDef.enum as [string, ...string[]]);
    }

    // 处理可选属性
    if (!schema.required || !schema.required.includes(propName)) {
      zodType = zodType.optional();
    }

    zodSchema[propName] = zodType;
  }

  return zodSchema;
}
