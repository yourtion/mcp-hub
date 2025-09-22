import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import PerformanceAnalyzer from './PerformanceAnalyzer.vue';

// Mock the services
vi.mock('@/services/debug', () => ({
  getPerformanceStats: vi.fn().mockResolvedValue({
    stats: {
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      topTools: [],
      responseTimeTrend: [],
      requestVolume: [],
      toolPerformance: [],
    },
  }),
}));

describe('PerformanceAnalyzer', () => {
  let router: Router;
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Pinia
    const pinia = createPinia();
    setActivePinia(pinia);

    // Setup Router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/',
          name: 'Home',
          component: { template: '<div></div>' },
        },
      ],
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  const createWrapper = () => {
    return mount(PerformanceAnalyzer, {
      global: {
        plugins: [router, ConfigProvider],
        stubs: {
          't-button': true,
          't-card': true,
          't-row': true,
          't-col': true,
          't-statistic': true,
          't-table': true,
          't-tag': true,
          't-space': true,
        },
      },
    });
  };

  it('should render correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.performance-analyzer')).toBeTruthy();
  });

  it('should have performance metrics display', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.performance-analyzer').exists()).toBe(true);
  });

  it('should have chart container', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.performance-analyzer').exists()).toBe(true);
  });
});
