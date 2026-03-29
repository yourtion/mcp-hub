/**
 * 通用 Zod Schema 校验工具函数
 */
import type { z } from 'zod/v4';

/**
 * 校验结果
 */
export interface SchemaValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * 使用 Zod schema 校验数据
 */
export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
): SchemaValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodIssues(result.error) };
}

/**
 * 格式化 Zod 错误为字符串数组（兼容 Zod 4 的 issues 格式）
 */
function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}
