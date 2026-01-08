/**
 * 错误处理器测试
 */

import { describe, expect, it } from 'vitest';
import type { ValidationResult } from '../types/api-tool.js';
import {
  ConfigurationError,
  ErrorHandlerImpl,
  ErrorSeverity,
} from './error-handler.js';

describe('ErrorHandlerImpl', () => {
  let errorHandler: ErrorHandlerImpl;

  beforeEach(() => {
    errorHandler = new ErrorHandlerImpl();
  });

  describe('createErrorReport', () => {
    it('应该创建无错误的报告', () => {
      const validationResult: ValidationResult = {
        valid: true,
        errors: [],
      };

      const report = errorHandler.createErrorReport(validationResult);

      expect(report.hasErrors).toBe(false);
      expect(report.errorCount).toBe(0);
      expect(report.warningCount).toBe(0);
      expect(report.errors).toHaveLength(0);
      expect(report.summary).toBe('配置验证通过，没有发现错误');
      expect(report.suggestions).toHaveLength(0);
    });

    it('应该创建包含错误的报告', () => {
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          {
            path: 'tools.0.id',
            message: '工具ID不能为空',
            code: 'MISSING_REQUIRED_PARAMETER',
          },
          {
            path: 'tools.0.api.url',
            message: '无效的URL格式',
            code: 'INVALID_URL',
          },
        ],
      };

      const report = errorHandler.createErrorReport(validationResult);

      expect(report.hasErrors).toBe(true);
      expect(report.errorCount).toBe(2); // 两个都是高级错误
      expect(report.warningCount).toBe(0);
      expect(report.errors).toHaveLength(2);
      expect(report.summary).toContain('2个高级错误');
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('应该正确分类错误严重级别', () => {
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          {
            path: 'config',
            message: '配置文件不存在',
            code: 'CONFIG_FILE_NOT_FOUND',
          },
          {
            path: 'tools.0.api.url',
            message: '无效的URL',
            code: 'INVALID_URL',
          },
          {
            path: 'tools.0.name',
            message: '类型错误',
            code: 'INVALID_TYPE',
          },
          {
            path: 'unknown',
            message: '未知错误',
            code: 'UNKNOWN_ERROR',
          },
        ],
      };

      const report = errorHandler.createErrorReport(validationResult);

      expect(report.errors[0].severity).toBe(ErrorSeverity.CRITICAL);
      expect(report.errors[1].severity).toBe(ErrorSeverity.HIGH);
      expect(report.errors[2].severity).toBe(ErrorSeverity.MEDIUM);
      expect(report.errors[3].severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('formatErrorMessage', () => {
    it('应该格式化错误消息', () => {
      const error = {
        path: 'tools.0.api.url',
        message: '无效的URL格式',
        code: 'INVALID_URL',
        severity: ErrorSeverity.HIGH,
        suggestion: '请提供有效的HTTP/HTTPS URL',
      };

      const formatted = errorHandler.formatErrorMessage(error);

      expect(formatted).toContain('❌');
      expect(formatted).toContain('[tools.0.api.url]');
      expect(formatted).toContain('无效的URL格式');
      expect(formatted).toContain('建议: 请提供有效的HTTP/HTTPS URL');
    });

    it('应该处理没有路径的错误', () => {
      const error = {
        path: '',
        message: '全局错误',
        code: 'GLOBAL_ERROR',
        severity: ErrorSeverity.MEDIUM,
      };

      const formatted = errorHandler.formatErrorMessage(error);

      expect(formatted).not.toContain('[]');
      expect(formatted).toContain('全局错误');
    });
  });

  describe('generateSuggestion', () => {
    it('应该为已知错误代码生成建议', () => {
      const error = {
        path: 'config',
        message: '配置文件不存在',
        code: 'CONFIG_FILE_NOT_FOUND',
      };

      const suggestion = errorHandler.generateSuggestion(error);

      expect(suggestion).toBe('请确保配置文件存在且路径正确');
    });

    it('应该根据路径生成建议', () => {
      const urlError = {
        path: 'api.url',
        message: '格式错误',
      };

      const suggestion = errorHandler.generateSuggestion(urlError);

      expect(suggestion).toBe('请提供有效的HTTP/HTTPS URL格式');
    });

    it('应该根据消息内容生成建议', () => {
      const enumError = {
        path: 'method',
        message: 'Invalid enum value',
      };

      const suggestion = errorHandler.generateSuggestion(enumError);

      expect(suggestion).toBe('请使用允许的枚举值');
    });

    it('应该为未知错误生成通用建议', () => {
      const unknownError = {
        path: 'unknown',
        message: '未知错误',
      };

      const suggestion = errorHandler.generateSuggestion(unknownError);

      expect(suggestion).toBe('请检查配置格式是否正确');
    });
  });

  describe('determineSeverity', () => {
    it('应该根据错误代码确定严重级别', () => {
      const criticalError = {
        path: 'config',
        message: '配置文件不存在',
        code: 'CONFIG_FILE_NOT_FOUND',
      };

      const severity = errorHandler.determineSeverity(criticalError);

      expect(severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('应该根据消息内容确定严重级别', () => {
      const requiredError = {
        path: 'field',
        message: 'Required field is missing',
      };

      const severity = errorHandler.determineSeverity(requiredError);

      expect(severity).toBe(ErrorSeverity.HIGH);
    });

    it('应该为未知错误返回低级别', () => {
      const unknownError = {
        path: 'unknown',
        message: '未知错误',
      };

      const severity = errorHandler.determineSeverity(unknownError);

      expect(severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('createErrorSummary', () => {
    it('应该为空错误列表创建摘要', () => {
      const summary = errorHandler.createErrorSummary([]);

      expect(summary).toBe('配置验证通过，没有发现错误');
    });

    it('应该为混合错误级别创建摘要', () => {
      const errors = [
        {
          path: 'config',
          message: '严重错误',
          code: 'CRITICAL',
          severity: ErrorSeverity.CRITICAL,
        },
        {
          path: 'field1',
          message: '高级错误',
          code: 'HIGH',
          severity: ErrorSeverity.HIGH,
        },
        {
          path: 'field2',
          message: '中级错误',
          code: 'MEDIUM',
          severity: ErrorSeverity.MEDIUM,
        },
        {
          path: 'field3',
          message: '警告',
          code: 'LOW',
          severity: ErrorSeverity.LOW,
        },
      ];

      const summary = errorHandler.createErrorSummary(errors);

      expect(summary).toBe(
        '配置验证发现 1个严重错误、1个高级错误、1个中级错误、1个警告',
      );
    });
  });
});

describe('ConfigurationError', () => {
  it('应该创建配置错误实例', () => {
    const report = {
      hasErrors: true,
      errorCount: 1,
      warningCount: 0,
      errors: [
        {
          path: 'config',
          message: '配置错误',
          code: 'CONFIG_ERROR',
          severity: ErrorSeverity.HIGH,
        },
      ],
      summary: '配置验证发现 1个高级错误',
      suggestions: ['请检查配置格式'],
    };

    const error = new ConfigurationError(
      '配置验证失败',
      report,
      '/path/to/config.json',
    );

    expect(error.name).toBe('ConfigurationError');
    expect(error.message).toBe('配置验证失败');
    expect(error.report).toBe(report);
    expect(error.configPath).toBe('/path/to/config.json');
  });

  it('应该生成格式化的错误报告', () => {
    const report = {
      hasErrors: true,
      errorCount: 1,
      warningCount: 0,
      errors: [
        {
          path: 'tools.0.id',
          message: '工具ID不能为空',
          code: 'MISSING_REQUIRED_PARAMETER',
          severity: ErrorSeverity.HIGH,
          suggestion: '请添加所有必需的参数字段',
        },
      ],
      summary: '配置验证发现 1个高级错误',
      suggestions: ['请添加所有必需的参数字段'],
    };

    const error = new ConfigurationError('配置验证失败', report, 'config.json');
    const formatted = error.getFormattedReport();

    expect(formatted).toContain('配置错误报告 (config.json)');
    expect(formatted).toContain('配置验证发现 1个高级错误');
    expect(formatted).toContain('详细错误信息:');
    expect(formatted).toContain('工具ID不能为空');
    expect(formatted).toContain('修复建议:');
    expect(formatted).toContain('请添加所有必需的参数字段');
  });
});
