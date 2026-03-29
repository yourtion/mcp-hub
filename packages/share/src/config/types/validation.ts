/**
 * 校验结果类型定义
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationWarning {
  path: string[];
  message: string;
  suggestion?: string;
}
