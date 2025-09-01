/**
 * 响应处理器测试
 */

import { describe, expect, it } from 'vitest';
import type { HttpResponse } from '../types/http-client.js';
import {
  McpError,
  McpErrorCode,
  ResponseProcessorImpl,
} from './response-processor.js';

describe('ResponseProcessorImpl', () => {
  const processor = new ResponseProcessorImpl();

  describe('validateJsonataExpression', () => {
    it('应该验证有效的JSONata表达式', () => {
      const result = processor.validateJsonataExpression('$.name');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证复杂的JSONata表达式', () => {
      const result = processor.validateJsonataExpression(
        '{ "name": $.user.name, "count": $count($.items) }',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的JSONata表达式', () => {
      const result = processor.validateJsonataExpression('$.invalid[');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_JSONATA_SYNTAX');
    });

    it('应该拒绝空表达式', () => {
      const result = processor.validateJsonataExpression('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('EMPTY_JSONATA_EXPRESSION');
    });
  });

  describe('processWithJsonata', () => {
    it('应该使用JSONata处理简单数据', async () => {
      const data = { name: 'John', age: 30 };
      const result = await processor.processWithJsonata(data, 'name');
      expect(result).toBe('John');
    });

    it('应该使用JSONata处理复杂数据转换', async () => {
      const data = {
        users: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      };
      const result = (await processor.processWithJsonata(
        data,
        '{ "names": users.name, "total": $count(users) }',
      )) as any;

      expect(result).toHaveProperty('names');
      expect(result).toHaveProperty('total');
      expect(Array.from(result.names)).toEqual(['John', 'Jane']);
      expect(result.total).toBe(2);
    });

    it('应该处理数组聚合', async () => {
      const data = {
        items: [
          { price: 10, quantity: 2 },
          { price: 20, quantity: 1 },
        ],
      };
      const result = await processor.processWithJsonata(
        data,
        '$sum(items.(price * quantity))',
      );
      expect(result).toBe(40);
    });

    it('应该处理JSONata执行错误', async () => {
      const data = { name: 'John' };
      await expect(
        processor.processWithJsonata(data, 'invalid['),
      ).rejects.toThrow();
    });

    it('应该使用安全模式处理JSONata执行错误', async () => {
      const data = { name: 'John' };
      const result = await processor.processWithJsonataSafe(data, 'invalid[');

      expect(result).toHaveProperty('_original', data);
      expect(result).toHaveProperty('_error');
      expect(result).toHaveProperty('_jsonataExpression', 'invalid[');
    });

    it('应该处理空数据', async () => {
      const result = await processor.processWithJsonata(null, 'name');
      expect(result).toBeUndefined();
    });
  });

  describe('processErrorResponse', () => {
    const createMockResponse = (
      status: number,
      statusText: string,
      data?: unknown,
    ): HttpResponse => ({
      status,
      statusText,
      headers: new Headers(),
      data,
      raw: {} as Response,
      config: {
        url: 'http://example.com',
        method: 'GET',
      },
    });

    it('应该处理基本的HTTP错误', () => {
      const response = createMockResponse(404, 'Not Found');
      const error = processor.processErrorResponse(response);

      expect(error.message).toBe('API调用失败: 404 Not Found');
      expect((error as any).status).toBe(404);
      expect((error as any).statusText).toBe('Not Found');
    });

    it('应该使用错误路径提取错误信息', () => {
      const response = createMockResponse(400, 'Bad Request', {
        error: { message: '参数无效' },
      });
      const error = processor.processErrorResponse(response, 'error.message');

      expect(error.message).toBe('参数无效');
    });

    it('应该从常见错误字段提取错误信息', () => {
      const response = createMockResponse(500, 'Internal Server Error', {
        error: '服务器内部错误',
      });
      const error = processor.processErrorResponse(response);

      expect(error.message).toBe('服务器内部错误');
    });

    it('应该处理多种错误字段格式', () => {
      const testCases = [
        { field: 'message', value: '消息错误' },
        { field: 'msg', value: 'msg错误' },
        { field: 'detail', value: '详细错误' },
        { field: 'description', value: '描述错误' },
      ];

      for (const testCase of testCases) {
        const response = createMockResponse(400, 'Bad Request', {
          [testCase.field]: testCase.value,
        });
        const error = processor.processErrorResponse(response);
        expect(error.message).toBe(testCase.value);
      }
    });

    it('应该处理无效的错误路径', () => {
      const response = createMockResponse(400, 'Bad Request', {
        error: '错误信息',
      });
      const error = processor.processErrorResponse(response, 'invalid[');

      // 应该回退到从常见字段提取错误信息
      expect(error.message).toBe('错误信息');
    });
  });

  describe('processResponse', () => {
    const createMockResponse = (
      status: number,
      data: unknown,
    ): HttpResponse => ({
      status,
      statusText: 'OK',
      headers: new Headers(),
      data,
      raw: {} as Response,
      config: {
        url: 'http://example.com',
        method: 'GET',
      },
    });

    it('应该处理成功的JSON响应', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = await processor.processResponse(response);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('应该处理成功的JSON响应并应用JSONata', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = await processor.processResponse(response, '$.name');

      expect(result).toBe('John');
    });

    it('应该处理字符串响应', async () => {
      const response = createMockResponse(200, 'Hello World');
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('text');
      expect(result.content).toBe('Hello World');
    });

    it('应该处理JSON字符串响应', async () => {
      const response = createMockResponse(200, '{"name": "John", "age": 30}');
      const result = await processor.processResponse(response);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('应该处理JSON字符串响应并应用JSONata', async () => {
      const response = createMockResponse(200, '{"name": "John", "age": 30}');
      const result = await processor.processResponse(response, 'name');

      expect(result).toBe('John');
    });

    it('应该抛出错误响应异常', async () => {
      const response: HttpResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        data: { error: '资源未找到' },
        raw: {} as Response,
        config: {
          url: 'http://example.com',
          method: 'GET',
        },
      };

      await expect(processor.processResponse(response)).rejects.toThrow(
        '资源未找到',
      );
    });

    it('应该处理无效的JSON字符串', async () => {
      const response = createMockResponse(200, 'invalid json {');
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('text');
      expect(result.content).toBe('invalid json {');
    });

    it('应该处理XML响应', async () => {
      const response = createMockResponse(
        200,
        '<root><name>John</name></root>',
      );
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('xml');
      expect(result.content).toBe('<root><name>John</name></root>');
    });

    it('应该处理CSV响应', async () => {
      const csvData = 'name,age\nJohn,30\nJane,25';
      const response = createMockResponse(200, csvData);
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('csv');
      expect(result.rows).toEqual([
        ['name', 'age'],
        ['John', '30'],
        ['Jane', '25'],
      ]);
    });

    it('应该处理键值对响应', async () => {
      const kvData = 'name=John\nage=30\ncity:Beijing';
      const response = createMockResponse(200, kvData);
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('key-value');
      expect(result.parsed).toEqual({
        name: 'John',
        age: '30',
        city: 'Beijing',
      });
    });

    it('应该处理纯文本响应', async () => {
      const response = createMockResponse(200, 'Hello World');
      const result = (await processor.processResponse(response)) as any;

      expect(result._type).toBe('text');
      expect(result.content).toBe('Hello World');
    });
  });

  describe('processWithFallback', () => {
    const createMockResponse = (
      status: number,
      data: unknown,
    ): HttpResponse => ({
      status,
      statusText: 'OK',
      headers: new Headers(),
      data,
      raw: {} as Response,
      config: {
        url: 'http://example.com',
        method: 'GET',
      },
    });

    it('应该使用主要表达式处理成功响应', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = await processor.processWithFallback(
        response,
        'name',
        'age',
      );

      expect(result).toBe('John');
    });

    it('应该在主要表达式失败时使用降级表达式', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = await processor.processWithFallback(
        response,
        'invalid[', // 无效表达式
        'name', // 降级表达式
      );

      expect(result).toBe('John');
    });

    it('应该在所有表达式失败时返回降级数据', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = (await processor.processWithFallback(
        response,
        'invalid[', // 无效表达式
        'alsoinvalid[', // 无效降级表达式
      )) as any;

      expect(result._fallback).toBe(true);
      expect(result._data).toEqual({ name: 'John', age: 30 });
      expect(result._originalError).toBeDefined();
    });

    it('应该处理没有降级表达式的情况', async () => {
      const response = createMockResponse(200, { name: 'John', age: 30 });
      const result = (await processor.processWithFallback(
        response,
        'invalid[', // 无效表达式
      )) as any;

      expect(result._fallback).toBe(true);
      expect(result._data).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('McpError', () => {
    it('应该正确创建MCP错误', () => {
      const error = new McpError(McpErrorCode.API_REQUEST_FAILED, '测试错误', {
        test: 'data',
      });

      expect(error.name).toBe('McpError');
      expect(error.code).toBe(McpErrorCode.API_REQUEST_FAILED);
      expect(error.message).toBe('测试错误');
      expect(error.data).toEqual({ test: 'data' });
    });

    it('应该转换为MCP错误响应格式', () => {
      const error = new McpError(McpErrorCode.API_REQUEST_FAILED, '测试错误', {
        test: 'data',
      });

      const response = error.toMcpErrorResponse();
      expect(response).toEqual({
        error: {
          code: McpErrorCode.API_REQUEST_FAILED,
          message: '测试错误',
          data: { test: 'data' },
        },
      });
    });

    it('应该从HTTP状态码创建MCP错误', () => {
      const testCases = [
        { status: 400, expectedCode: McpErrorCode.INVALID_PARAMS },
        { status: 401, expectedCode: McpErrorCode.API_AUTHENTICATION_FAILED },
        { status: 403, expectedCode: McpErrorCode.API_FORBIDDEN },
        { status: 404, expectedCode: McpErrorCode.API_NOT_FOUND },
        { status: 429, expectedCode: McpErrorCode.API_RATE_LIMITED },
        { status: 500, expectedCode: McpErrorCode.API_SERVER_ERROR },
        { status: 418, expectedCode: McpErrorCode.API_REQUEST_FAILED }, // 其他4xx错误
      ];

      for (const testCase of testCases) {
        const error = McpError.fromHttpStatus(testCase.status, '自定义消息');
        expect(error.code).toBe(testCase.expectedCode);
        expect(error.message).toBe('自定义消息');
      }
    });

    it('应该使用默认消息创建MCP错误', () => {
      const error = McpError.fromHttpStatus(404);
      expect(error.code).toBe(McpErrorCode.API_NOT_FOUND);
      expect(error.message).toBe('API端点未找到');
    });
  });

  describe('processErrorResponseAsMcp', () => {
    const createMockResponse = (
      status: number,
      statusText: string,
      data?: unknown,
    ): HttpResponse => ({
      status,
      statusText,
      headers: new Headers(),
      data,
      raw: {} as Response,
      config: {
        url: 'http://example.com',
        method: 'GET',
      },
    });

    it('应该创建基本的MCP错误', () => {
      const response = createMockResponse(404, 'Not Found');
      const error = processor.processErrorResponseAsMcp(response);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(McpErrorCode.API_NOT_FOUND);
      expect(error.message).toBe('API调用失败: 404 Not Found');
      expect(error.data).toHaveProperty('httpStatus', 404);
      expect(error.data).toHaveProperty('httpStatusText', 'Not Found');
    });

    it('应该使用错误路径提取错误信息', () => {
      const response = createMockResponse(400, 'Bad Request', {
        error: { message: '参数无效' },
      });
      const error = processor.processErrorResponseAsMcp(
        response,
        'error.message',
      );

      expect(error.code).toBe(McpErrorCode.INVALID_PARAMS);
      expect(error.message).toBe('参数无效');
      expect(error.data).toHaveProperty('extractedData', '参数无效');
    });

    it('应该从常见错误字段提取错误信息', () => {
      const response = createMockResponse(500, 'Internal Server Error', {
        error: '服务器内部错误',
      });
      const error = processor.processErrorResponseAsMcp(response);

      expect(error.code).toBe(McpErrorCode.API_SERVER_ERROR);
      expect(error.message).toBe('服务器内部错误');
    });

    it('应该处理复杂的错误数据结构', () => {
      const errorData = {
        error: {
          code: 'VALIDATION_FAILED',
          message: '验证失败',
          details: ['字段A必填', '字段B格式错误'],
        },
      };
      const response = createMockResponse(400, 'Bad Request', errorData);
      const error = processor.processErrorResponseAsMcp(response);

      expect(error.code).toBe(McpErrorCode.INVALID_PARAMS);
      expect(error.message).toBe('验证失败');
      expect(error.data).toHaveProperty('originalData', errorData);
    });
  });

  describe('processResponse with MCP errors', () => {
    const createMockResponse = (
      status: number,
      data: unknown,
    ): HttpResponse => ({
      status,
      statusText: status >= 400 ? 'Error' : 'OK',
      headers: new Headers(),
      data,
      raw: {} as Response,
      config: {
        url: 'http://example.com',
        method: 'GET',
      },
    });

    it('应该抛出MCP错误而不是普通错误', async () => {
      const response = createMockResponse(404, { error: '资源未找到' });

      try {
        await processor.processResponse(response);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(McpErrorCode.API_NOT_FOUND);
      }
    });

    it('应该将JSONata处理错误转换为MCP错误', async () => {
      const response = createMockResponse(200, { name: 'John' });

      try {
        await processor.processResponse(response, 'invalid[');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(
          McpErrorCode.JSONATA_EXECUTION_ERROR,
        );
        expect((error as McpError).data).toHaveProperty(
          'jsonataExpression',
          'invalid[',
        );
      }
    });
  });
});
