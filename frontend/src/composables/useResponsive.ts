import { onMounted, onUnmounted, ref } from 'vue';

// 断点定义（与 TDesign 保持一致）
export const breakpoints = {
  xs: 0,
  sm: 768,
  md: 992,
  lg: 1200,
  xl: 1400,
  xxl: 1880,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * 响应式设计 Composable
 */
export function useResponsive() {
  // 当前屏幕宽度
  const screenWidth = ref(0);

  // 当前断点
  const currentBreakpoint = ref<Breakpoint>('lg');

  // 是否为移动设备
  const isMobile = ref(false);

  // 是否为平板设备
  const isTablet = ref(false);

  // 是否为桌面设备
  const isDesktop = ref(true);

  /**
   * 更新屏幕尺寸信息
   */
  const updateScreenSize = () => {
    screenWidth.value = window.innerWidth;

    // 确定当前断点
    if (screenWidth.value < breakpoints.sm) {
      currentBreakpoint.value = 'xs';
      isMobile.value = true;
      isTablet.value = false;
      isDesktop.value = false;
    } else if (screenWidth.value < breakpoints.md) {
      currentBreakpoint.value = 'sm';
      isMobile.value = false;
      isTablet.value = true;
      isDesktop.value = false;
    } else if (screenWidth.value < breakpoints.lg) {
      currentBreakpoint.value = 'md';
      isMobile.value = false;
      isTablet.value = true;
      isDesktop.value = false;
    } else if (screenWidth.value < breakpoints.xl) {
      currentBreakpoint.value = 'lg';
      isMobile.value = false;
      isTablet.value = false;
      isDesktop.value = true;
    } else if (screenWidth.value < breakpoints.xxl) {
      currentBreakpoint.value = 'xl';
      isMobile.value = false;
      isTablet.value = false;
      isDesktop.value = true;
    } else {
      currentBreakpoint.value = 'xxl';
      isMobile.value = false;
      isTablet.value = false;
      isDesktop.value = true;
    }
  };

  /**
   * 检查是否大于等于指定断点
   */
  const isGreaterThan = (breakpoint: Breakpoint): boolean => {
    return screenWidth.value >= breakpoints[breakpoint];
  };

  /**
   * 检查是否小于指定断点
   */
  const isLessThan = (breakpoint: Breakpoint): boolean => {
    return screenWidth.value < breakpoints[breakpoint];
  };

  /**
   * 检查是否在指定断点范围内
   */
  const isBetween = (min: Breakpoint, max: Breakpoint): boolean => {
    return (
      screenWidth.value >= breakpoints[min] &&
      screenWidth.value < breakpoints[max]
    );
  };

  // 防抖处理
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const handleResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      updateScreenSize();
    }, 150);
  };

  // 初始化
  onMounted(() => {
    updateScreenSize();
    window.addEventListener('resize', handleResize);
  });

  // 清理
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
  });

  return {
    screenWidth,
    currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isGreaterThan,
    isLessThan,
    isBetween,
  };
}
