/**
 * HTTP请求构建器测试
 */

import { describe, expect, it } from 'vitest';
import type { ApiEndpointConfig } from '../types/api-config.js';
import type { TemplateContext } from '../types/template.js';
import { HttpRequestBuilderImpl } from './http-request-builder.js';

describe('HttpRequestBuilderImpl', () => {
  const builder = new HttpRequestBuilderImpl();

  describe('buildRequest', () => {
    it('应该构建简单的GET请求', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/users/{{data.userId}}',
        method: 'GET',
        headers: {
          Authorization: 'Bearer {{env.API_TOKEN}}',
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      };

      const context: TemplateContext = {
        data: { userId: '123' },
        env: { API_TOKEN: 'secret-token' },
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request).toEqual({
        url: 'https://api.example.com/users/123',
        method: 'GET',
        headers: {
          Authorization: 'Bearer secret-token',
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        retries: undefined,
      });
      expect(result.usedVariables).toContain('data.userId');
      expect(result.usedVariables).toContain('env.API_TOKEN');
    });

    it('应该构建带查询参数的GET请求', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/search',
        method: 'GET',
        queryParams: {
          q: '{{data.query}}',
          limit: '{{data.limit}}',
          type: 'user',
        },
      };

      const context: TemplateContext = {
        data: { query: 'john', limit: '10' },
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request?.url).toBe(
        'https://api.example.com/search?q=john&limit=10&type=user',
      );
      expect(result.usedVariables).toContain('data.query');
      expect(result.usedVariables).toContain('data.limit');
    });

    it('应该构建带JSON请求体的POST请求', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          name: '{{data.name}}',
          email: '{{data.email}}',
          age: 25,
          active: true,
        },
      };

      const context: TemplateContext = {
        data: { name: 'Alice', email: 'alice@example.com' },
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request?.data).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        age: 25,
        active: true,
      });
      expect(result.usedVariables).toContain('data.name');
      expect(result.usedVariables).toContain('data.email');
    });

    it('应该构建带字符串请求体的POST请求', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'User {{data.name}} has been created with ID {{data.id}}',
      };

      const context: TemplateContext = {
        data: { name: 'Bob', id: '456' },
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request?.data).toBe(
        'User Bob has been created with ID 456',
      );
      expect(result.usedVariables).toContain('data.name');
      expect(result.usedVariables).toContain('data.id');
    });

    it('应该处理嵌套对象的请求体', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        body: {
          user: {
            profile: {
              name: '{{data.user.name}}',
              email: '{{data.user.email}}',
            },
            settings: {
              theme: '{{data.theme}}',
              notifications: true,
            },
          },
          metadata: {
            source: 'api',
            timestamp: '{{data.timestamp}}',
          },
        },
      };

      const context: TemplateContext = {
        data: {
          user: { name: 'Charlie', email: 'charlie@example.com' },
          theme: 'dark',
          timestamp: '2023-12-01T10:00:00Z',
        },
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request?.data).toEqual({
        user: {
          profile: {
            name: 'Charlie',
            email: 'charlie@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        metadata: {
          source: 'api',
          timestamp: '2023-12-01T10:00:00Z',
        },
      });
    });

    it('应该处理数组类型的请求体', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/batch',
        method: 'POST',
        body: {
          items: [
            { name: '{{data.item1}}', type: 'A' },
            { name: '{{data.item2}}', type: 'B' },
            'Static item',
          ],
          metadata: {
            count: 3,
            source: '{{data.source}}',
          },
        },
      };

      const context: TemplateContext = {
        data: { item1: 'First', item2: 'Second', source: 'batch-api' },
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(true);
      expect(result.request?.data).toEqual({
        items: [
          { name: 'First', type: 'A' },
          { name: 'Second', type: 'B' },
          'Static item',
        ],
        metadata: {
          count: 3,
          source: 'batch-api',
        },
      });
    });

    it('应该处理模板渲染错误', () => {
      const config: ApiEndpointConfig = {
        url: 'https://api.example.com/users/{{data.missingId}}',
        method: 'GET',
      };

      const context: TemplateContext = {
        data: {},
        env: {},
      };

      const result = builder.buildRequest(config, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL模板渲染失败');
    });
  });

  describe('buildUrl', () => {
    it('应该构建简单的URL', () => {
      const result = builder.buildUrl(
        'https://api.example.com/users/{{data.id}}',
        undefined,
        { data: { id: '123' }, env: {} },
      );

      expect(result.url).toBe('https://api.example.com/users/123');
      expect(result.usedVariables).toContain('data.id');
    });

    it('应该构建带查询参数的URL', () => {
      const result = builder.buildUrl(
        'https://api.example.com/search',
        {
          q: '{{data.query}}',
          limit: '10',
          active: '{{data.active}}',
        },
        { data: { query: 'test', active: 'true' }, env: {} },
      );

      expect(result.url).toBe(
        'https://api.example.com/search?q=test&limit=10&active=true',
      );
      expect(result.usedVariables).toContain('data.query');
      expect(result.usedVariables).toContain('data.active');
    });

    it('应该处理已有查询参数的URL', () => {
      const result = builder.buildUrl(
        'https://api.example.com/search?existing=value',
        { new: '{{data.param}}' },
        { data: { param: 'test' }, env: {} },
      );

      expect(result.url).toBe(
        'https://api.example.com/search?existing=value&new=test',
      );
    });

    it('应该跳过空的查询参数值', () => {
      const result = builder.buildUrl(
        'https://api.example.com/search',
        {
          q: '{{data.query}}',
          empty: '',
          valid: 'test',
        },
        { data: { query: 'search' }, env: {} },
      );

      expect(result.url).toBe(
        'https://api.example.com/search?q=search&valid=test',
      );
    });
  });

  describe('buildHeaders', () => {
    it('应该构建请求头', () => {
      const result = builder.buildHeaders(
        {
          Authorization: 'Bearer {{env.TOKEN}}',
          'Content-Type': 'application/json',
          'X-User-ID': '{{data.userId}}',
        },
        { data: { userId: '123' }, env: { TOKEN: 'secret' } },
      );

      expect(result.headers).toEqual({
        Authorization: 'Bearer secret',
        'Content-Type': 'application/json',
        'X-User-ID': '123',
      });
      expect(result.usedVariables).toContain('env.TOKEN');
      expect(result.usedVariables).toContain('data.userId');
    });

    it('应该处理空的请求头', () => {
      const result = builder.buildHeaders(undefined, { data: {}, env: {} });

      expect(result.headers).toEqual({});
      expect(result.usedVariables).toEqual([]);
    });
  });

  describe('buildBody', () => {
    it('应该处理字符串请求体', () => {
      const result = builder.buildBody('Hello {{data.name}}!', {
        data: { name: 'World' },
        env: {},
      });

      expect(result.body).toBe('Hello World!');
      expect(result.usedVariables).toContain('data.name');
    });

    it('应该处理对象请求体', () => {
      const result = builder.buildBody(
        {
          message: 'Hello {{data.name}}',
          timestamp: '{{data.time}}',
          count: 42,
        },
        { data: { name: 'Alice', time: '2023-12-01' }, env: {} },
      );

      expect(result.body).toEqual({
        message: 'Hello Alice',
        timestamp: '2023-12-01',
        count: 42,
      });
      expect(result.usedVariables).toContain('data.name');
      expect(result.usedVariables).toContain('data.time');
    });

    it('应该处理undefined请求体', () => {
      const result = builder.buildBody(undefined, { data: {}, env: {} });

      expect(result.body).toBeUndefined();
      expect(result.usedVariables).toEqual([]);
    });

    it('应该处理复杂嵌套结构', () => {
      const complexBody = {
        users: [
          { name: '{{data.user1}}', active: true },
          { name: '{{data.user2}}', active: false },
        ],
        metadata: {
          source: '{{data.source}}',
          nested: {
            deep: {
              value: '{{data.deepValue}}',
            },
          },
        },
      };

      const result = builder.buildBody(complexBody, {
        data: {
          user1: 'Alice',
          user2: 'Bob',
          source: 'api',
          deepValue: 'deep-test',
        },
        env: {},
      });

      expect(result.body).toEqual({
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
        metadata: {
          source: 'api',
          nested: {
            deep: {
              value: 'deep-test',
            },
          },
        },
      });
      expect(result.usedVariables).toContain('data.user1');
      expect(result.usedVariables).toContain('data.user2');
      expect(result.usedVariables).toContain('data.source');
      expect(result.usedVariables).toContain('data.deepValue');
    });
  });
});
