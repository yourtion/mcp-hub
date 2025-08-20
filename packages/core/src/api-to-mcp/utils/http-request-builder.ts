/**
 * HTTP请求构建器
 * 支持URL路径参数替换、查询参数和请求头的模板处理，以及JSON请求体的参数替换
 */

import type { ApiEndpointConfig } from '../types/api-config.js';
import type { HttpRequestConfig } from '../types/http-client.js';
import type { TemplateContext } from '../types/template.js';
import { TemplateEngineImpl } from './template-engine.js';

/**
 * HTTP请求构建结果
 */
export interface HttpRequestBuildResult {
  /** 是否成功 */
  success: boolean;
  /** 构建的请求配置 */
  request?: HttpRequestConfig;
  /** 错误信息 */
  error?: string;
  /** 使用的模板变量 */
  usedVariables?: string[];
}

/**
 * HTTP请求构建器接口
 */
export interface HttpRequestBuilder {
  /**
   * 构建HTTP请求
   * @param config API端点配置
   * @param context 模板上下文
   */
  buildRequest(
    config: ApiEndpointConfig,
    context: TemplateContext,
  ): HttpRequestBuildResult;

  /**
   * 构建URL（包含路径参数和查询参数）
   * @param baseUrl 基础URL
   * @param queryParams 查询参数
   * @param context 模板上下文
   */
  buildUrl(
    baseUrl: string,
    queryParams: Record<string, string> | undefined,
    context: TemplateContext,
  ): { url: string; usedVariables: string[] };

  /**
   * 构建请求头
   * @param headers 请求头配置
   * @param context 模板上下文
   */
  buildHeaders(
    headers: Record<string, string> | undefined,
    context: TemplateContext,
  ): { headers: Record<string, string>; usedVariables: string[] };

  /**
   * 构建请求体
   * @param body 请求体配置
   * @param context 模板上下文
   */
  buildBody(
    body: string | Record<string, unknown> | undefined,
    context: TemplateContext,
  ): { body?: string | Record<string, unknown>; usedVariables: string[] };
}

/**
 * HTTP请求构建器实现类
 */
export class HttpRequestBuilderImpl implements HttpRequestBuilder {
  private readonly templateEngine = new TemplateEngineImpl();

  buildRequest(
    config: ApiEndpointConfig,
    context: TemplateContext,
  ): HttpRequestBuildResult {
    const allUsedVariables: string[] = [];
    let error: string | undefined;

    try {
      // 构建URL
      const urlResult = this.buildUrl(config.url, config.queryParams, context);
      allUsedVariables.push(...urlResult.usedVariables);

      // 构建请求头
      const headersResult = this.buildHeaders(config.headers, context);
      allUsedVariables.push(...headersResult.usedVariables);

      // 构建请求体
      const bodyResult = this.buildBody(config.body, context);
      allUsedVariables.push(...bodyResult.usedVariables);

      const request: HttpRequestConfig = {
        url: urlResult.url,
        method: config.method,
        headers: headersResult.headers,
        timeout: config.timeout,
        retries: config.retries,
      };

      // 只有在有请求体时才添加
      if (bodyResult.body !== undefined) {
        request.data = bodyResult.body;
      }

      return {
        success: true,
        request,
        usedVariables: [...new Set(allUsedVariables)], // 去重
      };
    } catch (err) {
      error = err instanceof Error ? err.message : '构建HTTP请求失败';
      return {
        success: false,
        error,
        usedVariables: allUsedVariables,
      };
    }
  }

  buildUrl(
    baseUrl: string,
    queryParams: Record<string, string> | undefined,
    context: TemplateContext,
  ): { url: string; usedVariables: string[] } {
    const usedVariables: string[] = [];

    // 处理基础URL中的路径参数
    const urlResult = this.templateEngine.render(baseUrl, context);
    if (!urlResult.success) {
      throw new Error(`URL模板渲染失败: ${urlResult.error}`);
    }
    usedVariables.push(...urlResult.usedVariables);

    let finalUrl = urlResult.result;

    // 处理查询参数
    if (queryParams && Object.keys(queryParams).length > 0) {
      const processedParams: Record<string, string> = {};

      for (const [key, value] of Object.entries(queryParams)) {
        const paramResult = this.templateEngine.render(value, context);
        if (!paramResult.success) {
          throw new Error(
            `查询参数 '${key}' 模板渲染失败: ${paramResult.error}`,
          );
        }
        processedParams[key] = paramResult.result;
        usedVariables.push(...paramResult.usedVariables);
      }

      // 构建查询字符串
      const queryString = this.buildQueryString(processedParams);
      if (queryString) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    return {
      url: finalUrl,
      usedVariables,
    };
  }

  buildHeaders(
    headers: Record<string, string> | undefined,
    context: TemplateContext,
  ): { headers: Record<string, string>; usedVariables: string[] } {
    const usedVariables: string[] = [];
    const processedHeaders: Record<string, string> = {};

    if (!headers) {
      return { headers: processedHeaders, usedVariables };
    }

    for (const [key, value] of Object.entries(headers)) {
      const headerResult = this.templateEngine.render(value, context);
      if (!headerResult.success) {
        throw new Error(`请求头 '${key}' 模板渲染失败: ${headerResult.error}`);
      }
      processedHeaders[key] = headerResult.result;
      usedVariables.push(...headerResult.usedVariables);
    }

    return {
      headers: processedHeaders,
      usedVariables,
    };
  }

  buildBody(
    body: string | Record<string, unknown> | undefined,
    context: TemplateContext,
  ): { body?: string | Record<string, unknown>; usedVariables: string[] } {
    const usedVariables: string[] = [];

    if (body === undefined) {
      return { usedVariables };
    }

    if (typeof body === 'string') {
      // 字符串类型的请求体，直接进行模板替换
      const bodyResult = this.templateEngine.render(body, context);
      if (!bodyResult.success) {
        throw new Error(`请求体模板渲染失败: ${bodyResult.error}`);
      }
      return {
        body: bodyResult.result,
        usedVariables: bodyResult.usedVariables,
      };
    }

    if (typeof body === 'object' && body !== null) {
      // 对象类型的请求体，递归处理每个属性
      const processedBody = this.processObjectTemplate(
        body,
        context,
        usedVariables,
      );
      return {
        body: processedBody,
        usedVariables,
      };
    }

    return { body, usedVariables };
  }

  private processObjectTemplate(
    obj: Record<string, unknown>,
    context: TemplateContext,
    usedVariables: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // 字符串值，进行模板替换
        const templateResult = this.templateEngine.render(value, context);
        if (!templateResult.success) {
          throw new Error(
            `对象属性 '${key}' 模板渲染失败: ${templateResult.error}`,
          );
        }
        result[key] = templateResult.result;
        usedVariables.push(...templateResult.usedVariables);
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // 嵌套对象，递归处理
        result[key] = this.processObjectTemplate(
          value as Record<string, unknown>,
          context,
          usedVariables,
        );
      } else if (Array.isArray(value)) {
        // 数组，处理每个元素
        result[key] = this.processArrayTemplate(value, context, usedVariables);
      } else {
        // 其他类型（数字、布尔值等），直接复制
        result[key] = value;
      }
    }

    return result;
  }

  private processArrayTemplate(
    arr: unknown[],
    context: TemplateContext,
    usedVariables: string[],
  ): unknown[] {
    return arr.map((item) => {
      if (typeof item === 'string') {
        const templateResult = this.templateEngine.render(item, context);
        if (!templateResult.success) {
          throw new Error(`数组元素模板渲染失败: ${templateResult.error}`);
        }
        usedVariables.push(...templateResult.usedVariables);
        return templateResult.result;
      } else if (
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item)
      ) {
        return this.processObjectTemplate(
          item as Record<string, unknown>,
          context,
          usedVariables,
        );
      } else if (Array.isArray(item)) {
        return this.processArrayTemplate(item, context, usedVariables);
      } else {
        return item;
      }
    });
  }

  private buildQueryString(params: Record<string, string>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      // 只添加非空值
      if (value !== '' && value !== null && value !== undefined) {
        searchParams.append(key, value);
      }
    }

    return searchParams.toString();
  }
}
