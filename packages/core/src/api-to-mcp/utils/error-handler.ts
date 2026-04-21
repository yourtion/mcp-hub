/**
 * 错误处理工具
 * 提供详细的错误报告和处理功能
 */

import type { ValidationError, ValidationResult } from '../types/api-tool.js';

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 详细错误信息
 */
export interface DetailedError extends ValidationError {
  /** 错误严重级别 */
  severity: ErrorSeverity;
  /** 修复建议 */
  suggestion?: string;
  /** 相关文档链接 */
  docUrl?: string;
  /** 错误发生的上下文 */
  context?: Record<string, unknown>;
}

/**
 * 错误报告
 */
export interface ErrorReport {
  /** 是否有错误 */
  hasErrors: boolean;
  /** 错误总数 */
  errorCount: number;
  /** 警告总数 */
  warningCount: number;
  /** 详细错误列表 */
  errors: DetailedError[];
  /** 错误摘要 */
  summary: string;
  /** 修复建议列表 */
  suggestions: string[];
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  /**
   * 创建详细的错误报告
   * @param validationResult 验证结果
   * @param context 错误上下文
   */
  createErrorReport(
    validationResult: ValidationResult,
    context?: Record<string, unknown>,
  ): ErrorReport;

  /**
   * 格式化错误消息
   * @param error 详细错误信息
   */
  formatErrorMessage(error: DetailedError): string;

  /**
   * 生成修复建议
   * @param error 验证错误
   */
  generateSuggestion(error: ValidationError): string;

  /**
   * 确定错误严重级别
   * @param error 验证错误
   */
  determineSeverity(error: ValidationError): ErrorSeverity;

  /**
   * 创建用户友好的错误摘要
   * @param errors 错误列表
   */
  createErrorSummary(errors: DetailedError[]): string;
}

/**
 * 错误处理器实现类
 */
export class ErrorHandlerImpl implements ErrorHandler {
  private readonly errorCodeSeverityMap: Record<string, ErrorSeverity> = {
    // 关键错误
    CONFIG_FILE_NOT_FOUND: ErrorSeverity.CRITICAL,
    INVALID_CONFIG_FORMAT: ErrorSeverity.CRITICAL,
    DUPLICATE_TOOL_ID: ErrorSeverity.CRITICAL,

    // 高级错误
    INVALID_URL: ErrorSeverity.HIGH,
    INVALID_JSONATA_SYNTAX: ErrorSeverity.HIGH,
    MISSING_REQUIRED_PARAMETER: ErrorSeverity.HIGH,

    // 中级错误
    INVALID_TYPE: ErrorSeverity.MEDIUM,
    INVALID_SYNTAX: ErrorSeverity.MEDIUM,

    // 低级错误/警告
    VALIDATION_ERROR: ErrorSeverity.LOW,
    UNKNOWN_ERROR: ErrorSeverity.LOW,
  };

  private readonly errorSuggestions: Record<string, string> = {
    CONFIG_FILE_NOT_FOUND: '请确保配置文件存在且路径正确',
    INVALID_CONFIG_FORMAT: '请检查配置文件的JSON格式是否正确',
    DUPLICATE_TOOL_ID: '请确保每个工具的ID都是唯一的',
    INVALID_URL: '请提供有效的HTTP/HTTPS URL，例如: https://api.example.com',
    INVALID_JSONATA_SYNTAX: '请检查JSONata表达式语法，参考: https://jsonata.org/',
    MISSING_REQUIRED_PARAMETER: '请添加所有必需的参数字段',
    INVALID_TYPE: '请检查字段类型是否符合要求',
    INVALID_SYNTAX: '请检查语法格式是否正确',
  };

  createErrorReport(
    validationResult: ValidationResult,
    context?: Record<string, unknown>,
  ): ErrorReport {
    const detailedErrors: DetailedError[] = validationResult.errors.map((error) => ({
      ...error,
      severity: this.determineSeverity(error),
      suggestion: this.generateSuggestion(error),
      context,
    }));

    const errorCount = detailedErrors.filter(
      (e) => e.severity === ErrorSeverity.HIGH || e.severity === ErrorSeverity.CRITICAL,
    ).length;

    const warningCount = detailedErrors.filter(
      (e) => e.severity === ErrorSeverity.LOW || e.severity === ErrorSeverity.MEDIUM,
    ).length;

    return {
      hasErrors: !validationResult.valid,
      errorCount,
      warningCount,
      errors: detailedErrors,
      summary: this.createErrorSummary(detailedErrors),
      suggestions: detailedErrors
        .filter((e) => e.suggestion)
        .map((e) => e.suggestion as string)
        .filter((suggestion, index, array) => array.indexOf(suggestion) === index), // 去重
    };
  }

  formatErrorMessage(error: DetailedError): string {
    const severityIcon = this.getSeverityIcon(error.severity);
    const pathInfo = error.path ? `[${error.path}] ` : '';
    const suggestion = error.suggestion ? `\n  建议: ${error.suggestion}` : '';

    return `${severityIcon} ${pathInfo}${error.message}${suggestion}`;
  }

  generateSuggestion(error: ValidationError): string {
    // 首先尝试从预定义建议中获取
    if (error.code && this.errorSuggestions[error.code]) {
      return this.errorSuggestions[error.code];
    }

    // 根据错误路径和消息生成建议
    if (error.path.includes('url')) {
      return '请提供有效的HTTP/HTTPS URL格式';
    }

    if (error.path.includes('jsonata')) {
      return '请检查JSONata表达式语法，确保符合JSONata规范';
    }

    if (error.path.includes('id')) {
      return '请提供唯一的工具标识符';
    }

    if (error.path.includes('required')) {
      return '请添加所有必需的字段';
    }

    if (error.message.includes('Invalid enum value')) {
      return '请使用允许的枚举值';
    }

    if (error.message.includes('Expected string')) {
      return '请提供字符串类型的值';
    }

    if (error.message.includes('Expected number')) {
      return '请提供数字类型的值';
    }

    return '请检查配置格式是否正确';
  }

  determineSeverity(error: ValidationError): ErrorSeverity {
    if (error.code && this.errorCodeSeverityMap[error.code]) {
      return this.errorCodeSeverityMap[error.code];
    }

    // 根据错误消息内容判断严重级别
    const message = error.message.toLowerCase();

    if (message.includes('required') || message.includes('missing')) {
      return ErrorSeverity.HIGH;
    }

    if (message.includes('invalid') || message.includes('syntax')) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  createErrorSummary(errors: DetailedError[]): string {
    if (errors.length === 0) {
      return '配置验证通过，没有发现错误';
    }

    const criticalCount = errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length;
    const highCount = errors.filter((e) => e.severity === ErrorSeverity.HIGH).length;
    const mediumCount = errors.filter((e) => e.severity === ErrorSeverity.MEDIUM).length;
    const lowCount = errors.filter((e) => e.severity === ErrorSeverity.LOW).length;

    const parts: string[] = [];

    if (criticalCount > 0) {
      parts.push(`${criticalCount}个严重错误`);
    }
    if (highCount > 0) {
      parts.push(`${highCount}个高级错误`);
    }
    if (mediumCount > 0) {
      parts.push(`${mediumCount}个中级错误`);
    }
    if (lowCount > 0) {
      parts.push(`${lowCount}个警告`);
    }

    return `配置验证发现 ${parts.join('、')}`;
  }

  private getSeverityIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return '🚨';
      case ErrorSeverity.HIGH:
        return '❌';
      case ErrorSeverity.MEDIUM:
        return '⚠️';
      case ErrorSeverity.LOW:
        return 'ℹ️';
      default:
        return '❓';
    }
  }
}

/**
 * 配置错误类
 * 用于包装配置相关的错误信息
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly report: ErrorReport,
    public readonly configPath?: string,
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }

  /**
   * 获取格式化的错误报告
   */
  getFormattedReport(): string {
    const errorHandler = new ErrorHandlerImpl();
    const lines: string[] = [];

    lines.push(`配置错误报告 ${this.configPath ? `(${this.configPath})` : ''}`);
    lines.push('='.repeat(50));
    lines.push(this.report.summary);
    lines.push('');

    if (this.report.errors.length > 0) {
      lines.push('详细错误信息:');
      this.report.errors.forEach((error, index) => {
        lines.push(`${index + 1}. ${errorHandler.formatErrorMessage(error)}`);
      });
      lines.push('');
    }

    if (this.report.suggestions.length > 0) {
      lines.push('修复建议:');
      this.report.suggestions.forEach((suggestion, index) => {
        lines.push(`${index + 1}. ${suggestion}`);
      });
    }

    return lines.join('\n');
  }
}
