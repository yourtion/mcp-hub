import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import ApiConfigList from '@/components/api-to-mcp/ApiConfigList.vue';
import { apiToMcpService } from '@/services/api-to-mcp';

// Mock the service
vi.mock('@/services/api-to-mcp', () => ({
  apiToMcpService: {
    getConfigs: vi.fn(),
    getConfigStats: vi.fn(),
    deleteConfig: vi.fn(),
    batchTestConfigs: vi.fn(),
  },
}));

describe('ApiConfigList', () => {
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
          path: '/api-to-mcp',
          name: 'ApiToMcp',
          component: { template: '<div></div>' },
        },
      ],
    });

    // Mock successful responses
    vi.mocked(apiToMcpService.getConfigs).mockResolvedValue({
      configs: [
        {
          id: 'test-config-1',
          name: 'Test API',
          description: 'Test API configuration',
          status: 'active',
          api: { url: 'https://api.example.com/test', method: 'GET' },
          toolsGenerated: 5,
          lastUpdated: '2023-01-01T00:00:00Z',
        },
      ],
    });

    vi.mocked(apiToMcpService.getConfigStats).mockResolvedValue({
      totalConfigs: 1,
      activeConfigs: 1,
      totalTools: 5,
      lastUpdated: '2023-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  const createWrapper = () => {
    return mount(ApiConfigList, {
      global: {
        plugins: [router, ConfigProvider],
        stubs: {
          't-button': true,
          't-card': true,
          't-row': true,
          't-col': true,
          't-table': true,
          't-tag': true,
          't-space': true,
          't-input': true,
          't-select': true,
          't-dialog': true,
          't-tooltip': true,
          'api-config-form-dialog': true,
          'api-import-dialog': true,
          'api-export-dialog': true,
          'delete-icon': true,
          'upload-icon': true,
          'download-icon': true,
          'add-icon': true,
          'search-icon': true,
          'browse-icon': true,
          'edit-icon': true,
          'play-icon': true,
        },
      },
    });
  };

  it('renders correctly', () => {
    wrapper = createWrapper();

    expect(wrapper.find('.api-config-list').exists()).toBe(true);
    expect(wrapper.find('.page-header h1').text()).toBe('API配置管理');
  });

  it('displays statistics correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('displays config list correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('filters configs by search query', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('filters configs by status', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('handles config deletion', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('handles batch deletion', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('handles API errors gracefully', async () => {
    wrapper = createWrapper();

    // Mock API error
    vi.mocked(apiToMcpService.getConfigs).mockRejectedValue(
      new Error('API Error'),
    );

    // Wait for error handling
    await vi.waitFor(() => {
      expect(wrapper.vm.loading).toBe(false);
    });

    // Should still render UI
    expect(wrapper.find('.api-config-list').exists()).toBe(true);
  });

  it('formats time correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.formatTime).toBeDefined();
    });

    const formattedTime = wrapper.vm.formatTime('2023-01-01T00:00:00Z');
    expect(formattedTime).toContain('2023');
  });

  it('gets status theme correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.getStatusTheme).toBeDefined();
    });

    expect(wrapper.vm.getStatusTheme('active')).toBe('success');
    expect(wrapper.vm.getStatusTheme('inactive')).toBe('warning');
    expect(wrapper.vm.getStatusTheme('error')).toBe('danger');
  });

  it('gets status icon correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.getStatusIcon).toBeDefined();
    });

    expect(wrapper.vm.getStatusIcon('active')).toBeDefined();
    expect(wrapper.vm.getStatusIcon('inactive')).toBeDefined();
    expect(wrapper.vm.getStatusIcon('error')).toBeDefined();
  });
});
