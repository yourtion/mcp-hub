/**
 * 统一错误处理工具
 * 提供全局错误处理和用户友好的错误提示
 */

import type { AxiosError } from 'axios';
import { MessagePlugin } from 'tdesign-vue-next';

export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * 错误代码映射到用户友好的消息
 */
const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  // 认证错误
  AUTH_INVALID_CREDENTIALS: {
    title: '登录失败',
    message: '用户名或密码错误，请重试',
    action: '检查您的登录凭据',
    severity: 'error',
  },
  AUTH_TOKEN_EXPIRED: {
    title: '会话已过期',
    message: '您的登录会话已过期，请重新登录',
    action: '点击确定跳转到登录页面',
    severity: 'warning',
  },
  AUTH_UNAUTHORIZED: {
    title: '未授权',
    message: '您没有权限执行此操作',
    action: '请联系管理员获取权限',
    severity: 'error',
  },

  // 网络错误
  NETWORK_ERROR: {
    title: '网络错误',
    message: '无法连接到服务器，请检查网络连接',
    action: '稍后重试或联系技术支持',
    severity: 'error',
  },
  NETWORK_TIMEOUT: {
    title: '请求超时',
    message: '服务器响应超时，请稍后重试',
    action: '检查网络连接或稍后重试',
    severity: 'warning',
  },

  // 服务器错误
  SERVER_ERROR: {
    title: '服务器错误',
    message: '服务器遇到了问题，请稍后重试',
    action: '如果问题持续存在，请联系技术支持',
    severity: 'error',
  },
  SERVER_UNAVAILABLE: {
    title: '服务不可用',
    message: '服务器暂时不可用，请稍后重试',
    action: '等待几分钟后重试',
    severity: 'warning',
  },

  // 验证错误
  VALIDATION_ERROR: {
    title: '输入验证失败',
    message: '请检查您的输入并重试',
    action: '确保所有必填字段都已正确填写',
    severity: 'warning',
  },
  VALIDATION_REQUIRED_FIELD: {
    title: '缺少必填字段',
    message: '请填写所有必填字段',
    action: '检查表单中标记为必填的字段',
    severity: 'warning',
  },

  // 资源错误
  RESOURCE_NOT_FOUND: {
    title: '资源未找到',
    message: '请求的资源不存在',
    action: '检查资源ID或返回列表页面',
    severity: 'warning',
  },
  RESOURCE_CONFLICT: {
    title: '资源冲突',
    message: '该资源已存在或正在被使用',
    action: '使用不同的名称或ID',
    severity: 'warning',
  },

  // 业务逻辑错误
  BUSINESS_LOGIC_ERROR: {
    title: '操作失败',
    message: '无法完成此操作',
    action: '请检查操作条件并重试',
    severity: 'error',
  },

  // 默认错误
  UNKNOWN_ERROR: {
    title: '未知错误',
    message: '发生了意外错误',
    action: '请刷新页面或联系技术支持',
    severity: 'error',
  },
};

/**
 * 错误处理类
 */
export class ErrorHandler {
  /**
   * 处理HTTP错误
   */
  static handleHttpError(error: AxiosError): UserFriendlyError {
    if (!error.response) {
      // 网络错误
      if (error.code === 'ECONNABORTED') {
        return ERROR_MESSAGES.NETWORK_TIMEOUT;
      }
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    const status = error.response.status;
    const data = error.response.data as any;

    // 根据HTTP状态码处理
    switch (status) {
      case 400:
        return ERROR_MESSAGES.VALIDATION_ERROR;
      case 401:
        return ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS;
      case 403:
        return ERROR_MESSAGES.AUTH_UNAUTHORIZED;
      case 404:
        return ERROR_MESSAGES.RESOURCE_NOT_FOUND;
      case 409:
        return ERROR_MESSAGES.RESOURCE_CONFLICT;
      case 500:
      case 502:
      case 503:
        return ERROR_MESSAGES.SERVER_ERROR;
      case 504:
        return ERROR_MESSAGES.NETWORK_TIMEOUT;
      default:
        // 尝试从响应数据中获取错误信息
        if (data?.error?.code && ERROR_MESSAGES[data.error.code]) {
          return ERROR_MESSAGES[data.error.code];
        }
        return ERROR_MESSAGES.UNKNOWN_ERROR;
    }
  }

  /**
   * 处理业务错误
   */
  static handleBusinessError(errorCode: string): UserFriendlyError {
    return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * 显示错误消息
   */
  static showError(error: UserFriendlyError | string): void {
    if (typeof error === 'string') {
      MessagePlugin.error(error);
      return;
    }

    const message = error.action
      ? `${error.message}\n${error.action}`
      : error.message;

    switch (error.severity) {
      case 'error':
        MessagePlugin.error({
          content: message,
          duration: 5000,
        });
        break;
      case 'warning':
        MessagePlugin.warning({
          content: message,
          duration: 4000,
        });
        break;
      case 'info':
        MessagePlugin.info({
          content: message,
          duration: 3000,
        });
        break;
    }
  }

  /**
   * 处理并显示错误
   */
  static handle(error: unknown): void {
    console.error('Error occurred:', error);

    let userError: UserFriendlyError;

    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      // Axios错误
      userError = ErrorHandler.handleHttpError(error as AxiosError);
    } else if (error instanceof Error) {
      // 普通JavaScript错误
      userError = {
        title: '错误',
        message: error.message,
        severity: 'error',
      };
    } else if (typeof error === 'string') {
      // 字符串错误
      userError = {
        title: '错误',
        message: error,
        severity: 'error',
      };
    } else {
      // 未知错误
      userError = ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    ErrorHandler.showError(userError);
  }

  /**
   * 创建错误日志
   */
  static logError(error: unknown, context?: string): void {
    const timestamp = new Date().toISOString();
    const errorLog = {
      timestamp,
      context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    };

    console.error('Error Log:', errorLog);

    // 可以在这里添加发送错误日志到服务器的逻辑
    // sendErrorToServer(errorLog);
  }
}

/**
 * 全局错误处理器
 */
export function setupGlobalErrorHandler(): void {
  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    ErrorHandler.logError(event.reason, 'Unhandled Promise Rejection');
    ErrorHandler.handle(event.reason);
  });

  // 捕获全局错误
  window.addEventListener('error', (event) => {
    event.preventDefault();
    ErrorHandler.logError(event.error, 'Global Error');
    ErrorHandler.handle(event.error);
  });
}

/**
 * 创建错误边界
 */
export function createErrorBoundary(
  handler: (error: Error) => void,
): (fn: () => Promise<void>) => Promise<void> {
  return async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      if (error instanceof Error) {
        handler(error);
      } else {
        handler(new Error(String(error)));
      }
    }
  };
}

/**
 * 重试函数
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError!;
}
