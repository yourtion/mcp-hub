/**
 * 工具参数校验逻辑
 *
 * 从 tool_manager.ts 提取的纯函数，负责根据工具的 inputSchema
 * 校验调用参数的类型和必填性。
 */

import { logger } from '../utils/logger.js';

import type { Tool } from '../types/mcp-hub.js';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 校验单个参数的类型是否符合 schema 声明
 */
export function validateArgumentType(
  argName: string,
  argValue: unknown,
  propSchema: Record<string, unknown>,
): ValidationResult {
  if (!propSchema.type) {
    return { isValid: true }; // No type specified, allow any
  }

  const expectedType = propSchema.type;
  const actualType = typeof argValue;

  switch (expectedType) {
    case 'string':
      if (actualType !== 'string') {
        return {
          isValid: false,
          error: `Argument '${argName}' must be a string, got ${actualType}`,
        };
      }
      break;

    case 'number':
      if (actualType !== 'number' || Number.isNaN(argValue as number)) {
        return {
          isValid: false,
          error: `Argument '${argName}' must be a number, got ${actualType}`,
        };
      }
      break;

    case 'integer':
      if (actualType !== 'number' || !Number.isInteger(argValue as number)) {
        return {
          isValid: false,
          error: `Argument '${argName}' must be an integer, got ${actualType}`,
        };
      }
      break;

    case 'boolean':
      if (actualType !== 'boolean') {
        return {
          isValid: false,
          error: `Argument '${argName}' must be a boolean, got ${actualType}`,
        };
      }
      break;

    case 'array':
      if (!Array.isArray(argValue)) {
        return {
          isValid: false,
          error: `Argument '${argName}' must be an array, got ${actualType}`,
        };
      }
      break;

    case 'object':
      if (actualType !== 'object' || argValue === null || Array.isArray(argValue)) {
        return {
          isValid: false,
          error: `Argument '${argName}' must be an object, got ${actualType}`,
        };
      }
      break;

    default:
      // Unknown type, allow it
      logger.debug('Unknown type in schema, allowing', {
        argName,
        expectedType,
      });
      break;
  }

  return { isValid: true };
}

/**
 * 根据工具的 inputSchema 校验参数
 */
export function validateToolArgsWithSchema(
  tool: Tool,
  args: Record<string, unknown>,
): ValidationResult {
  logger.debug('Validating tool arguments with schema', {
    toolName: tool.name,
    args,
    schema: tool.inputSchema,
  });

  try {
    // If no schema provided, allow all arguments
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      logger.debug('No schema provided, allowing all arguments', {
        toolName: tool.name,
      });
      return { isValid: true };
    }

    const schema = tool.inputSchema as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };

    // Validate required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in args)) {
          const error = `Missing required argument: ${requiredField}`;
          logger.warn('Missing required argument', {
            toolName: tool.name,
            requiredField,
            providedArgs: Object.keys(args),
          });
          return { isValid: false, error };
        }

        // Check for null/undefined values in required fields
        if (args[requiredField] === null || args[requiredField] === undefined) {
          const error = `Required argument '${requiredField}' cannot be null or undefined`;
          logger.warn('Required argument is null/undefined', {
            toolName: tool.name,
            requiredField,
          });
          return { isValid: false, error };
        }
      }
    }

    // Validate property types if schema properties are defined
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [argName, argValue] of Object.entries(args)) {
        const propSchema = (schema.properties as Record<string, Record<string, unknown>>)[argName];
        if (propSchema && typeof propSchema === 'object') {
          const typeValidation = validateArgumentType(argName, argValue, propSchema);
          if (!typeValidation.isValid) {
            logger.warn('Argument type validation failed', {
              toolName: tool.name,
              argName,
              argValue,
              expectedType: propSchema.type,
              error: typeValidation.error,
            });
            return typeValidation;
          }
        }
      }
    }

    // Check for additional properties if not allowed
    if (
      schema.additionalProperties === false &&
      schema.properties &&
      typeof schema.properties === 'object'
    ) {
      const allowedProps = Object.keys(schema.properties);
      const providedProps = Object.keys(args);
      const extraProps = providedProps.filter((prop) => !allowedProps.includes(prop));

      if (extraProps.length > 0) {
        const error = `Additional properties not allowed: ${extraProps.join(', ')}`;
        logger.warn('Additional properties provided', {
          toolName: tool.name,
          extraProps,
          allowedProps,
        });
        return { isValid: false, error };
      }
    }

    logger.debug('Tool arguments validation passed', {
      toolName: tool.name,
    });
    return { isValid: true };
  } catch (error) {
    logger.error('Error during schema validation', error as Error, {
      toolName: tool.name,
      args,
    });
    // On validation error, allow execution and let server handle it
    return { isValid: true };
  }
}
