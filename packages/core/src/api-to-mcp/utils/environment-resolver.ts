/**
 * 环境变量解析器
 * 处理配置中的环境变量引用
 */

/**
 * 环境变量解析器接口
 */
export interface EnvironmentResolver {
  /**
   * 解析字符串中的环境变量引用
   * @param value 包含环境变量引用的字符串
   */
  resolve(value: string): string;

  /**
   * 递归解析对象中的环境变量引用
   * @param obj 要解析的对象
   */
  resolveObject<T>(obj: T): T;

  /**
   * 验证必需的环境变量是否存在
   * @param requiredVars 必需的环境变量列表
   */
  validateRequiredVariables(requiredVars: string[]): string[];
}

/**
 * 环境变量解析器实现类
 */
export class EnvironmentResolverImpl implements EnvironmentResolver {
  private readonly envPattern = /\{\{env\.([^}]+)\}\}/g;

  resolve(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    return value.replace(this.envPattern, (match, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        console.warn(`环境变量 ${varName} 未定义，保持原始值`);
        return match;
      }
      return envValue;
    });
  }

  resolveObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.resolve(obj) as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item)) as T;
    }

    if (typeof obj === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObject(value);
      }
      return resolved as T;
    }

    return obj;
  }

  validateRequiredVariables(requiredVars: string[]): string[] {
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (process.env[varName] === undefined) {
        missing.push(varName);
      }
    }

    return missing;
  }

  /**
   * 从字符串中提取环境变量引用
   * @param value 字符串值
   */
  extractEnvironmentVariables(value: string): string[] {
    if (typeof value !== 'string') {
      return [];
    }

    const variables: string[] = [];
    const matches = value.matchAll(this.envPattern);

    for (const match of matches) {
      variables.push(match[1]);
    }

    return variables;
  }

  /**
   * 从对象中提取所有环境变量引用
   * @param obj 要分析的对象
   */
  extractAllEnvironmentVariables(obj: unknown): string[] {
    const variables = new Set<string>();

    const extract = (value: unknown): void => {
      if (typeof value === 'string') {
        const vars = this.extractEnvironmentVariables(value);
        vars.forEach((v) => variables.add(v));
      } else if (Array.isArray(value)) {
        value.forEach(extract);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(extract);
      }
    };

    extract(obj);
    return Array.from(variables);
  }
}
