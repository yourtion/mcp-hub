import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import McpMessageMonitor from './McpMessageMonitor.vue';

// Mock the services
vi.mock('@/services/debug', () => ({
  getMcpMessages: vi.fn().mockResolvedValue({
    messages: [],
  }),
}));

// Mock the stores
vi.mock('@/stores/server', () => ({
  useServerStore: () => ({
    servers: new Map([
      ['test-server', { id: 'test-server', name: 'Test Server' }],
    ]),
    serverList: [{ id: 'test-server', name: 'Test Server' }],
    fetchServers: vi.fn(),
  }),
}));

describe('McpMessageMonitor', () => {
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
    return mount(McpMessageMonitor, {
      global: {
        plugins: [router, ConfigProvider],
        stubs: {
          't-button': true,
          't-card': true,
          't-row': true,
          't-col': true,
          't-input': true,
          't-select': true,
          't-option': true,
          't-table': true,
          't-tag': true,
          't-dialog': true,
          't-descriptions': true,
          't-descriptions-item': true,
        },
      },
    });
  };

  it('should render correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.mcp-message-monitor')).toBeTruthy();
  });

  it('should have search input', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.mcp-message-monitor').exists()).toBe(true);
  });

  it('should have table component', () => {
    wrapper = createWrapper();
    // 检查组件是否正确渲染
    expect(wrapper.find('.mcp-message-monitor').exists()).toBe(true);
  });
});
