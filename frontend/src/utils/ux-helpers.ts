/**
 * 用户体验优化工具
 * 提供各种UX增强功能
 */

import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';

/**
 * 确认对话框选项
 */
export interface ConfirmOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  theme?: 'default' | 'info' | 'warning' | 'danger' | 'success';
}

/**
 * 显示确认对话框
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = DialogPlugin.confirm({
      header: options.title,
      body: options.content,
      confirmBtn: options.confirmText || '确定',
      cancelBtn: options.cancelText || '取消',
      theme: options.theme || 'default',
      onConfirm: () => {
        dialog.hide();
        resolve(true);
      },
      onCancel: () => {
        dialog.hide();
        resolve(false);
      },
      onClose: () => {
        dialog.hide();
        resolve(false);
      },
    });
  });
}

/**
 * 显示成功消息
 */
export function showSuccess(message: string, duration: number = 3000): void {
  MessagePlugin.success({
    content: message,
    duration,
  });
}

/**
 * 显示警告消息
 */
export function showWarning(message: string, duration: number = 4000): void {
  MessagePlugin.warning({
    content: message,
    duration,
  });
}

/**
 * 显示信息消息
 */
export function showInfo(message: string, duration: number = 3000): void {
  MessagePlugin.info({
    content: message,
    duration,
  });
}

/**
 * 显示加载消息
 */
export function showLoading(message: string = '加载中...'): () => void {
  const loading = MessagePlugin.loading({
    content: message,
    duration: 0, // 不自动关闭
  });

  return () => {
    loading.close();
  };
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showSuccess('已复制到剪贴板');
      return true;
    }

    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (success) {
      showSuccess('已复制到剪贴板');
    } else {
      showWarning('复制失败，请手动复制');
    }

    return success;
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    showWarning('复制失败，请手动复制');
    return false;
  }
}

/**
 * 下载文件
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showSuccess(`文件 ${filename} 已下载`);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * 格式化时间
 */
export function formatTime(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 小于1天
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 小于7天
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }

  // 超过7天，显示具体日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化持续时间
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  if (milliseconds < 3600000) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}...`;
}

/**
 * 高亮搜索关键词
 */
export function highlightText(text: string, keyword: string): string {
  if (!keyword) return text;

  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 滚动到顶部
 */
export function scrollToTop(smooth: boolean = true): void {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

/**
 * 滚动到元素
 */
export function scrollToElement(
  element: HTMLElement | string,
  smooth: boolean = true,
): void {
  const target =
    typeof element === 'string' ? document.querySelector(element) : element;

  if (target) {
    target.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'start',
    });
  }
}

/**
 * 检查元素是否在视口中
 */
export function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * 获取URL参数
 */
export function getUrlParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(window.location.search);

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}

/**
 * 设置URL参数
 */
export function setUrlParams(params: Record<string, string>): void {
  const searchParams = new URLSearchParams(window.location.search);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
  }

  const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
  window.history.pushState({}, '', newUrl);
}

/**
 * 本地存储助手
 */
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return defaultValue || null;
    }
  },

  set(key: string, value: any): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Failed to set to localStorage:', error);
      return false;
    }
  },

  remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
      return false;
    }
  },

  clear(): boolean {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  },
};

/**
 * 会话存储助手
 */
export const sessionStorage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error('Failed to get from sessionStorage:', error);
      return defaultValue || null;
    }
  },

  set(key: string, value: any): boolean {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Failed to set to sessionStorage:', error);
      return false;
    }
  },

  remove(key: string): boolean {
    try {
      window.sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove from sessionStorage:', error);
      return false;
    }
  },

  clear(): boolean {
    try {
      window.sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
      return false;
    }
  },
};
