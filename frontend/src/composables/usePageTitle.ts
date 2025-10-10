import { watch } from 'vue';
import { useRoute } from 'vue-router';

// 默认标题
const DEFAULT_TITLE = 'MCP Hub';

/**
 * 页面标题管理 Composable
 */
export function usePageTitle() {
  const route = useRoute();

  /**
   * 设置页面标题
   */
  const setTitle = (title: string) => {
    document.title = title ? `${title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  };

  /**
   * 根据路由自动设置标题
   */
  const updateTitleFromRoute = () => {
    const routeTitle = route.meta.title as string;
    if (routeTitle) {
      setTitle(routeTitle);
    } else {
      document.title = DEFAULT_TITLE;
    }
  };

  // 监听路由变化自动更新标题
  watch(
    () => route.meta.title,
    () => {
      updateTitleFromRoute();
    },
    { immediate: true },
  );

  return {
    setTitle,
    updateTitleFromRoute,
  };
}
