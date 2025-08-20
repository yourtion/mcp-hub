/**
 * 模板引擎相关的类型定义
 */

/**
 * 模板变量
 */
export interface TemplateVariable {
  /** 变量名 */
  name: string;
  /** 变量路径 */
  path: string;
  /** 是否必需 */
  required: boolean;
}

/**
 * 模板渲染上下文
 */
export interface TemplateContext {
  /** 数据对象 */
  data: Record<string, unknown>;
  /** 环境变量 */
  env: Record<string, string>;
}

/**
 * 模板渲染结果
 */
export interface TemplateRenderResult {
  /** 渲染后的字符串 */
  result: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 使用的变量 */
  usedVariables: string[];
}
