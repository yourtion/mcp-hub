/**
 * 模板引擎
 * 支持 {{data.xxx}} 和 {{env.xxx}} 占位符替换
 */

import type { ValidationResult } from '../types/api-tool.js';
import type {
  TemplateContext,
  TemplateRenderResult,
  TemplateVariable,
} from '../types/template.js';

/**
 * 模板引擎接口
 */
export interface TemplateEngine {
  /**
   * 渲染模板字符串
   * @param template 模板字符串
   * @param context 渲染上下文
   */
  render(template: string, context: TemplateContext): TemplateRenderResult;

  /**
   * 验证模板语法
   * @param template 模板字符串
   */
  validateTemplate(template: string): ValidationResult;

  /**
   * 提取模板中的变量
   * @param template 模板字符串
   */
  extractVariables(template: string): TemplateVariable[];
}

/**
 * 模板引擎实现类
 */
export class TemplateEngineImpl implements TemplateEngine {
  private readonly variablePattern = /\{\{([^}]+)\}\}/g;

  render(template: string, context: TemplateContext): TemplateRenderResult {
    const usedVariables: string[] = [];
    let result = template;
    let success = true;
    let error: string | undefined;

    try {
      result = template.replace(this.variablePattern, (match, variable) => {
        const trimmedVar = variable.trim();
        usedVariables.push(trimmedVar);

        const value = this.resolveVariable(trimmedVar, context);
        if (value === undefined) {
          success = false;
          error = `未找到变量: ${trimmedVar}`;
          return match; // 保持原始占位符
        }

        return String(value);
      });
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : '模板渲染失败';
    }

    return {
      result,
      success,
      error,
      usedVariables,
    };
  }

  validateTemplate(template: string): ValidationResult {
    const errors: Array<{ path: string; message: string; code?: string }> = [];

    try {
      const variables = this.extractVariables(template);

      for (const variable of variables) {
        // 验证变量语法
        if (!this.isValidVariablePath(variable.path)) {
          errors.push({
            path: variable.path,
            message: `无效的变量路径: ${variable.path}`,
            code: 'INVALID_VARIABLE_PATH',
          });
        }
      }
    } catch (err) {
      errors.push({
        path: 'template',
        message: err instanceof Error ? err.message : '模板语法错误',
        code: 'TEMPLATE_SYNTAX_ERROR',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  extractVariables(template: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const matches = template.matchAll(this.variablePattern);

    for (const match of matches) {
      const variable = match[1].trim();
      variables.push({
        name: variable,
        path: variable,
        required: true, // 默认所有变量都是必需的
      });
    }

    return variables;
  }

  private resolveVariable(variablePath: string, context: TemplateContext): any {
    const parts = variablePath.split('.');

    if (parts.length < 2) {
      return undefined;
    }

    const [namespace, ...propertyPath] = parts;
    let source: any;

    switch (namespace) {
      case 'data':
        source = context.data;
        break;
      case 'env':
        source = context.env;
        break;
      default:
        return undefined;
    }

    // 遍历属性路径
    let current = source;
    for (const property of propertyPath) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[property];
    }

    return current;
  }

  private isValidVariablePath(path: string): boolean {
    // 检查基本格式: namespace.property[.subproperty...]
    const parts = path.split('.');

    if (parts.length < 2) {
      return false;
    }

    const [namespace] = parts;
    if (!['data', 'env'].includes(namespace)) {
      return false;
    }

    // 检查属性名是否有效（只允许字母、数字、下划线）
    const propertyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    for (let i = 1; i < parts.length; i++) {
      if (!propertyPattern.test(parts[i])) {
        return false;
      }
    }

    return true;
  }
}
