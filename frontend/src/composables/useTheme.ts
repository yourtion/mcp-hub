import { onMounted, ref, watch } from 'vue';

// 主题类型
export type ThemeMode = 'light' | 'dark' | 'auto';

// 本地存储键
const THEME_STORAGE_KEY = 'mcp-hub-theme';

// 主题状态
const currentTheme = ref<ThemeMode>('light');
const isDark = ref(false);

/**
 * 主题管理 Composable
 */
export function useTheme() {
  /**
   * 应用主题到 DOM
   */
  const applyTheme = (theme: ThemeMode) => {
    const htmlElement = document.documentElement;

    // 移除所有主题类
    htmlElement.classList.remove('theme-light', 'theme-dark');

    // 确定实际应用的主题
    let actualTheme: 'light' | 'dark' = 'light';

    if (theme === 'auto') {
      // 自动模式：根据系统偏好
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches;
      actualTheme = prefersDark ? 'dark' : 'light';
    } else {
      actualTheme = theme;
    }

    // 应用主题类
    htmlElement.classList.add(`theme-${actualTheme}`);

    // 设置 TDesign 主题
    htmlElement.setAttribute('theme-mode', actualTheme);

    // 更新状态
    isDark.value = actualTheme === 'dark';
  };

  /**
   * 设置主题
   */
  const setTheme = (theme: ThemeMode) => {
    currentTheme.value = theme;
    applyTheme(theme);

    // 保存到本地存储
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  };

  /**
   * 切换主题（在 light 和 dark 之间切换）
   */
  const toggleTheme = () => {
    const newTheme = isDark.value ? 'light' : 'dark';
    setTheme(newTheme);
  };

  /**
   * 从本地存储加载主题
   */
  const loadTheme = () => {
    try {
      const savedTheme = localStorage.getItem(
        THEME_STORAGE_KEY,
      ) as ThemeMode | null;
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setTheme(savedTheme);
      } else {
        // 默认使用 light 主题
        setTheme('light');
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
      setTheme('light');
    }
  };

  /**
   * 监听系统主题变化（仅在 auto 模式下）
   */
  const watchSystemTheme = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (currentTheme.value === 'auto') {
        applyTheme('auto');
      }
    };

    // 添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // 兼容旧版浏览器
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  };

  // 初始化
  onMounted(() => {
    loadTheme();
    const cleanup = watchSystemTheme();

    // 组件卸载时清理
    return cleanup;
  });

  // 监听主题变化
  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme);
  });

  return {
    currentTheme,
    isDark,
    setTheme,
    toggleTheme,
    loadTheme,
  };
}
