/**
 * 响应处理器
 * 负责使用JSONata处理API响应数据
 */

import jsonata from 'jsonata';
import type { ValidationResult } from '../types/api-tool.js';
import type { HttpResponse } from '../types/http-client.js';

/**
 * MCP错误代码枚举
 */
export enum McpErrorCode {
  // 通用错误
  INTERNAL_ERROR = -32603,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  PARSE_ERROR = -32700,

  // API调用相关错误
  API_REQUEST_FAILED = -32001,
  API_TIMEOUT = -32002,
  API_AUTHENTICATION_FAILED = -32003,
  API_RATE_LIMITED = -32004,
  API_NOT_FOUND = -32005,
  API_FORBIDDEN = -32006,
  API_SERVER_ERROR = -32007,

  // 响应处理错误
  RESPONSE_PROCESSING_FAILED = -32101,
  JSONATA_EXECUTION_ERROR = -32102,
  RESPONSE_VALIDATION_FAILED = -32103,
}

/**
 * MCP错误类
 */
export class McpError extends Error {
  public readonly code: McpErrorCode;
  public readonly data?: unknown;

  constructor(code: McpErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
  }

  /**
   * 转换为MCP错误响应格式
   */
  toMcpErrorResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        data: this.data,
      },
    };
  }

  /**
   * 从HTTP状态码创建MCP错误
   */
  static fromHttpStatus(
    status: number,
    message?: string,
    data?: unknown,
  ): McpError {
    let code: McpErrorCode;
    let defaultMessage: string;

    switch (Math.floor(status / 100)) {
      case 4:
        switch (status) {
          case 400:
            code = McpErrorCode.INVALID_PARAMS;
            defaultMessage = '请求参数无效';
            break;
          case 401:
            code = McpErrorCode.API_AUTHENTICATION_FAILED;
            defaultMessage = 'API认证失败';
            break;
          case 403:
            code = McpErrorCode.API_FORBIDDEN;
            defaultMessage = 'API访问被禁止';
            break;
          case 404:
            code = McpErrorCode.API_NOT_FOUND;
            defaultMessage = 'API端点未找到';
            break;
          case 429:
            code = McpErrorCode.API_RATE_LIMITED;
            defaultMessage = 'API调用频率超限';
            break;
          default:
            code = McpErrorCode.API_REQUEST_FAILED;
            defaultMessage = 'API请求失败';
        }
        break;
      case 5:
        code = McpErrorCode.API_SERVER_ERROR;
        defaultMessage = 'API服务器错误';
        break;
      default:
        code = McpErrorCode.API_REQUEST_FAILED;
        defaultMessage = 'API请求失败';
    }

    return new McpError(code, message || defaultMessage, data);
  }
}

/**
 * 响应处理器接口
 */
export interface ResponseProcessor {
  /**
   * 使用JSONata处理响应
   * @param response HTTP响应
   * @param jsonataExpression JSONata表达式
   */
  processWithJsonata(
    response: unknown,
    jsonataExpression: string,
  ): Promise<unknown>;

  /**
   * 使用JSONata处理响应数据（带错误处理）
   * @param response HTTP响应
   * @param jsonataExpression JSONata表达式
   */
  processWithJsonataSafe(
    response: unknown,
    jsonataExpression: string,
  ): Promise<unknown>;

  /**
   * 处理错误响应
   * @param response HTTP响应
   * @param errorPath 错误信息提取路径
   */
  processErrorResponse(response: HttpResponse, errorPath?: string): Error;

  /**
   * 处理错误响应并转换为MCP错误
   * @param response HTTP响应
   * @param errorPath 错误信息提取路径
   */
  processErrorResponseAsMcp(
    response: HttpResponse,
    errorPath?: string,
  ): McpError;

  /**
   * 验证JSONata表达式
   * @param expression JSONata表达式
   */
  validateJsonataExpression(expression: string): ValidationResult;

  /**
   * 处理响应数据（包含JSON和非JSON响应）
   * @param response HTTP响应
   * @param jsonataExpression 可选的JSONata表达式
   */
  processResponse(
    response: HttpResponse,
    jsonataExpression?: string,
  ): Promise<unknown>;

  /**
   * 处理复杂数据转换，包含降级机制
   * @param response HTTP响应
   * @param jsonataExpression 主要JSONata表达式
   * @param fallbackExpression 降级JSONata表达式
   */
  processWithFallback(
    response: HttpResponse,
    jsonataExpression?: string,
    fallbackExpression?: string,
  ): Promise<unknown>;
}

/**
 * 响应处理器实现类
 */
export class ResponseProcessorImpl implements ResponseProcessor {
  /**
   * 使用JSONata处理响应数据
   */
  async processWithJsonata(
    response: unknown,
    jsonataExpression: string,
  ): Promise<unknown> {
    try {
      // 验证JSONata表达式
      const validation = this.validateJsonataExpression(jsonataExpression);
      if (!validation.valid) {
        throw new Error(
          `JSONata表达式无效: ${validation.errors.map((e) => e.message).join(', ')}`,
        );
      }

      // 编译JSONata表达式
      const expression = jsonata(jsonataExpression);

      // 执行表达式
      const result = await expression.evaluate(response);
      return result;
    } catch (error) {
      // 如果JSONata处理失败，抛出异常而不是返回错误对象
      console.error('JSONata处理失败:', error);
      throw error;
    }
  }

  /**
   * 使用JSONata处理响应数据（带错误处理）
   */
  async processWithJsonataSafe(
    response: unknown,
    jsonataExpression: string,
  ): Promise<unknown> {
    try {
      return await this.processWithJsonata(response, jsonataExpression);
    } catch (error) {
      // 返回错误对象而不是抛出异常
      return {
        _original: response,
        _error: error instanceof Error ? error.message : String(error),
        _jsonataExpression: jsonataExpression,
      };
    }
  }

  /**
   * 处理错误响应
   */
  processErrorResponse(response: HttpResponse, errorPath?: string): Error {
    const mcpError = this.processErrorResponseAsMcp(response, errorPath);

    const error = new Error(mcpError.message);
    // 添加额外的错误信息
    (error as any).status = response.status;
    (error as any).statusText = response.statusText;
    (error as any).response = response;
    (error as any).mcpCode = mcpError.code;
    (error as any).mcpData = mcpError.data;

    return error;
  }

  /**
   * 处理错误响应并转换为MCP错误
   */
  processErrorResponseAsMcp(
    response: HttpResponse,
    errorPath?: string,
  ): McpError {
    let errorMessage = `API调用失败: ${response.status} ${response.statusText}`;
    let extractedData: unknown;

    // 如果指定了错误路径，尝试从响应中提取错误信息
    if (errorPath && response.data) {
      try {
        const expression = jsonata(errorPath);
        const extractedError = expression.evaluate(response.data);

        // JSONata返回Promise，但在错误处理中我们需要同步处理
        // 这里我们使用一个简化的同步提取逻辑作为后备
        if (extractedError instanceof Promise) {
          // 对于Promise，我们跳过JSONata处理，使用简单的路径访问
          const pathParts = errorPath.split('.');
          let current: unknown = response.data;
          for (const part of pathParts) {
            if (current && typeof current === 'object' && part in current) {
              current = (current as Record<string, unknown>)[part];
            } else {
              current = undefined;
              break;
            }
          }
          if (current && typeof current === 'string') {
            errorMessage = current;
          }
          extractedData = current;
        } else {
          // 如果不是Promise（理论上不会发生，但作为后备）
          if (extractedError) {
            errorMessage = String(extractedError);
            extractedData = extractedError;
          }
        }
      } catch (error) {
        console.warn('无法从响应中提取错误信息:', error);
        // 如果错误路径无效，继续使用默认逻辑
      }
    }

    // 如果没有通过错误路径提取到错误信息，且响应数据是对象，尝试从常见字段提取
    if (
      errorMessage ===
        `API调用失败: ${response.status} ${response.statusText}` &&
      response.data &&
      typeof response.data === 'object'
    ) {
      const data = response.data as Record<string, unknown>;

      // 尝试从顶级字段提取错误信息
      const commonErrorFields = [
        'error',
        'message',
        'msg',
        'detail',
        'description',
      ];

      for (const field of commonErrorFields) {
        if (data[field]) {
          if (typeof data[field] === 'string') {
            errorMessage = data[field] as string;
            extractedData = data[field];
            break;
          } else if (typeof data[field] === 'object' && data[field] !== null) {
            // 如果字段是对象，尝试从对象中提取message
            const errorObj = data[field] as Record<string, unknown>;
            for (const subField of [
              'message',
              'msg',
              'description',
              'detail',
            ]) {
              if (
                errorObj[subField] &&
                typeof errorObj[subField] === 'string'
              ) {
                errorMessage = errorObj[subField] as string;
                extractedData = errorObj[subField];
                break;
              }
            }
            if (
              errorMessage !==
              `API调用失败: ${response.status} ${response.statusText}`
            ) {
              break;
            }
          }
        }
      }

      // 如果没有找到字符串错误信息，但有错误对象，使用整个对象作为数据
      if (extractedData === undefined) {
        extractedData = response.data;
      }
    }

    // 创建MCP错误，包含原始响应数据
    const mcpData = {
      httpStatus: response.status,
      httpStatusText: response.statusText,
      originalData: response.data,
      extractedData,
    };

    return McpError.fromHttpStatus(response.status, errorMessage, mcpData);
  }

  /**
   * 验证JSONata表达式
   */
  validateJsonataExpression(expression: string): ValidationResult {
    try {
      // 空表达式被认为是无效的
      if (!expression.trim()) {
        return {
          valid: false,
          errors: [
            {
              path: 'jsonata',
              message: 'JSONata表达式不能为空',
              code: 'EMPTY_JSONATA_EXPRESSION',
            },
          ],
        };
      }

      // 尝试编译表达式来验证语法
      jsonata(expression);
      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: 'jsonata',
            message: error instanceof Error ? error.message : String(error),
            code: 'INVALID_JSONATA_SYNTAX',
          },
        ],
      };
    }
  }

  /**
   * 处理响应数据（统一入口）
   */
  async processResponse(
    response: HttpResponse,
    jsonataExpression?: string,
  ): Promise<unknown> {
    // 如果响应不成功，处理错误
    if (response.status >= 400) {
      throw this.processErrorResponseAsMcp(response);
    }

    let responseData = response.data;

    // 处理不同类型的响应数据
    responseData = this.normalizeResponseData(responseData);

    // 如果没有JSONata表达式，直接返回响应数据
    if (!jsonataExpression) {
      return responseData;
    }

    // 使用JSONata处理响应
    try {
      return await this.processWithJsonata(responseData, jsonataExpression);
    } catch (error) {
      // 将JSONata处理错误转换为MCP错误
      throw new McpError(
        McpErrorCode.JSONATA_EXECUTION_ERROR,
        `响应处理失败: ${error instanceof Error ? error.message : String(error)}`,
        {
          originalError: error instanceof Error ? error.message : String(error),
          jsonataExpression,
          responseData,
        },
      );
    }
  }

  /**
   * 标准化响应数据，处理各种数据类型
   */
  private normalizeResponseData(data: unknown): unknown {
    // 处理字符串响应
    if (typeof data === 'string') {
      // 尝试解析为JSON
      try {
        return JSON.parse(data);
      } catch {
        // 如果不是JSON，检查是否是其他格式
        return this.parseNonJsonString(data);
      }
    }

    // 处理Buffer或ArrayBuffer
    if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
      const text =
        data instanceof ArrayBuffer
          ? Buffer.from(data).toString('utf-8')
          : (data as Buffer).toString('utf-8');
      return this.normalizeResponseData(text);
    }

    // 处理其他类型的数据
    return data;
  }

  /**
   * 解析非JSON字符串数据
   */
  private parseNonJsonString(data: string): unknown {
    const trimmed = data.trim();

    // 检查是否是XML
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return {
        _type: 'xml',
        _raw: data,
        content: trimmed,
      };
    }

    // 检查是否是CSV
    if (this.looksLikeCsv(trimmed)) {
      return {
        _type: 'csv',
        _raw: data,
        content: trimmed,
        rows: this.parseCsvBasic(trimmed),
      };
    }

    // 检查是否是键值对格式
    if (this.looksLikeKeyValue(trimmed)) {
      return {
        _type: 'key-value',
        _raw: data,
        content: trimmed,
        parsed: this.parseKeyValue(trimmed),
      };
    }

    // 默认返回字符串
    return {
      _type: 'text',
      _raw: data,
      content: trimmed,
    };
  }

  /**
   * 检查字符串是否看起来像CSV
   */
  private looksLikeCsv(data: string): boolean {
    const lines = data.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return false;

    // 检查是否有一致的分隔符
    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    const secondLineCommas = (lines[1].match(/,/g) || []).length;

    return firstLineCommas > 0 && firstLineCommas === secondLineCommas;
  }

  /**
   * 基本的CSV解析
   */
  private parseCsvBasic(data: string): string[][] {
    return data
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.split(',').map((cell) => cell.trim()));
  }

  /**
   * 检查字符串是否看起来像键值对
   */
  private looksLikeKeyValue(data: string): boolean {
    const lines = data.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return false;

    // 检查是否大部分行都包含 = 或 :
    const kvLines = lines.filter(
      (line) => line.includes('=') || line.includes(':'),
    );

    return kvLines.length / lines.length > 0.5;
  }

  /**
   * 解析键值对格式
   */
  private parseKeyValue(data: string): Record<string, string> {
    const result: Record<string, string> = {};

    data
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line) => {
        // 尝试 = 分隔符
        let separator = '=';
        let parts = line.split(separator);

        // 如果没有 =，尝试 :
        if (parts.length === 1) {
          separator = ':';
          parts = line.split(separator);
        }

        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(separator).trim();
          result[key] = value;
        }
      });

    return result;
  }

  /**
   * 处理复杂数据转换，包含降级机制
   */
  async processWithFallback(
    response: HttpResponse,
    jsonataExpression?: string,
    fallbackExpression?: string,
  ): Promise<unknown> {
    // 如果没有主要表达式，直接处理响应
    if (!jsonataExpression) {
      return this.processResponse(response);
    }

    try {
      return await this.processResponse(response, jsonataExpression);
    } catch (error) {
      console.warn('主要响应处理失败，尝试降级处理:', error);

      // 如果有降级表达式，尝试使用它
      if (fallbackExpression) {
        try {
          return await this.processResponse(response, fallbackExpression);
        } catch (fallbackError) {
          console.warn('降级处理也失败:', fallbackError);
        }
      }

      // 最终降级：返回原始响应数据
      return {
        _fallback: true,
        _originalError: error instanceof Error ? error.message : String(error),
        _data: this.normalizeResponseData(response.data),
      };
    }
  }
}
