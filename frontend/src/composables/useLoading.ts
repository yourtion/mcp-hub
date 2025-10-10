import { LoadingPlugin } from 'tdesign-vue-next';
import { ref } from 'vue';

// 全局加载状态
const globalLoading = ref(false);
const loadingCount = ref(0);

/**
 * 全局加载状态管理 Composable
 */
export function useLoading() {
  /**
   * 显示全局加载
   */
  const showLoading = (text = '加载中...') => {
    loadingCount.value++;
    if (loadingCount.value === 1) {
      globalLoading.value = true;
      LoadingPlugin({
        text,
        fullscreen: true,
        preventScrollThrough: true,
      });
    }
  };

  /**
   * 隐藏全局加载
   */
  const hideLoading = () => {
    loadingCount.value = Math.max(0, loadingCount.value - 1);
    if (loadingCount.value === 0) {
      globalLoading.value = false;
      LoadingPlugin.hide();
    }
  };

  /**
   * 包装异步操作，自动显示/隐藏加载状态
   */
  const withLoading = async <T>(
    fn: () => Promise<T>,
    text = '加载中...',
  ): Promise<T> => {
    showLoading(text);
    try {
      return await fn();
    } finally {
      hideLoading();
    }
  };

  /**
   * 重置加载状态（用于错误恢复）
   */
  const resetLoading = () => {
    loadingCount.value = 0;
    globalLoading.value = false;
    LoadingPlugin.hide();
  };

  return {
    globalLoading,
    showLoading,
    hideLoading,
    withLoading,
    resetLoading,
  };
}
