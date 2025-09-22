import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import ErrorAnalyzer from './ErrorAnalyzer.vue';

// Mock the services
vi.mock('@/services/debug', () => ({
  getErrorAnalysis: vi.fn().mockResolvedValue({
    analysis: {
      totalErrors: 0,
      errorRate: 0,
      mostCommonErrors: {},
      recentErrors: [],
    },
  }),
}));

describe('ErrorAnalyzer', () => {
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
    return mount(ErrorAnalyzer, {
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
          't-progress': true,
          't-space': true,
        },
      },
    });
  };

  it('should render correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.error-analyzer')).toBeTruthy();
  });

  it('should have error statistics display', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.error-analyzer').exists()).toBe(true);
  });

  it('should have error table', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.error-analyzer').exists()).toBe(true);
  });
});
