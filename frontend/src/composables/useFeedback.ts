import type {
  DialogOptions,
  MessageOptions,
  NotifyOptions,
} from 'tdesign-vue-next';
import { DialogPlugin, MessagePlugin, NotifyPlugin } from 'tdesign-vue-next';

/**
 * 全局操作反馈 Composable
 */
export function useFeedback() {
  /**
   * 显示成功消息
   */
  const success = (message: string, options?: Partial<MessageOptions>) => {
    return MessagePlugin.success(message, options);
  };

  /**
   * 显示错误消息
   */
  const error = (message: string, options?: Partial<MessageOptions>) => {
    return MessagePlugin.error(message, options);
  };

  /**
   * 显示警告消息
   */
  const warning = (message: string, options?: Partial<MessageOptions>) => {
    return MessagePlugin.warning(message, options);
  };

  /**
   * 显示信息消息
   */
  const info = (message: string, options?: Partial<MessageOptions>) => {
    return MessagePlugin.info(message, options);
  };

  /**
   * 显示确认对话框
   */
  const confirm = (options: DialogOptions) => {
    return DialogPlugin.confirm({
      theme: 'warning',
      ...options,
    });
  };

  /**
   * 显示警告对话框
   */
  const alert = (options: DialogOptions) => {
    return DialogPlugin.alert({
      theme: 'info',
      ...options,
    });
  };

  /**
   * 显示通知
   */
  const notify = (options: NotifyOptions) => {
    return NotifyPlugin(options);
  };

  /**
   * 显示成功通知
   */
  const notifySuccess = (title: string, content?: string) => {
    return NotifyPlugin.success({
      title,
      content,
      duration: 3000,
      placement: 'top-right',
    });
  };

  /**
   * 显示错误通知
   */
  const notifyError = (title: string, content?: string) => {
    return NotifyPlugin.error({
      title,
      content,
      duration: 5000,
      placement: 'top-right',
    });
  };

  /**
   * 显示警告通知
   */
  const notifyWarning = (title: string, content?: string) => {
    return NotifyPlugin.warning({
      title,
      content,
      duration: 4000,
      placement: 'top-right',
    });
  };

  /**
   * 显示信息通知
   */
  const notifyInfo = (title: string, content?: string) => {
    return NotifyPlugin.info({
      title,
      content,
      duration: 3000,
      placement: 'top-right',
    });
  };

  /**
   * 处理 API 错误并显示友好的错误消息
   */
  const handleApiError = (err: unknown, defaultMessage = '操作失败') => {
    let errorMessage = defaultMessage;

    if (err && typeof err === 'object') {
      if (
        'response' in err &&
        err.response &&
        typeof err.response === 'object'
      ) {
        const response = err.response as Record<string, unknown>;
        if (
          'data' in response &&
          response.data &&
          typeof response.data === 'object'
        ) {
          const data = response.data as Record<string, unknown>;
          if ('error' in data && data.error && typeof data.error === 'object') {
            const errorObj = data.error as Record<string, unknown>;
            if ('message' in errorObj && typeof errorObj.message === 'string') {
              errorMessage = errorObj.message;
            }
          } else if ('message' in data && typeof data.message === 'string') {
            errorMessage = data.message;
          }
        }
      } else if ('message' in err && typeof err.message === 'string') {
        errorMessage = err.message;
      }
    }

    error(errorMessage);
    return errorMessage;
  };

  return {
    // 消息提示
    success,
    error,
    warning,
    info,

    // 对话框
    confirm,
    alert,

    // 通知
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,

    // 错误处理
    handleApiError,
  };
}
