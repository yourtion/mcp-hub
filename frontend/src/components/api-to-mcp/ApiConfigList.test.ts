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
          'api-config-form-dialog': true,
          'api-import-dialog': true,
          'api-export-dialog': true,
          'delete-icon': true,
          'upload-icon': true,
          'download-icon': true,
          'add-icon': true,
          'search-icon': true,
          'view-icon': true,
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

  it('displays statistics correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.stat-value').exists()).toBe(true);
    });

    const statValues = wrapper.findAll('.stat-value');
    expect(statValues[0].text()).toBe('1'); // totalConfigs
    expect(statValues[1].text()).toBe('1'); // activeConfigs
    expect(statValues[2].text()).toBe('5'); // totalTools
  });

  it('displays config list correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-table-stub').exists()).toBe(true);
    });

    const table = wrapper.find('t-table-stub');
    expect(table.attributes('data')).toBeDefined();
  });

  it('filters configs by search query', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-input-stub').exists()).toBe(true);
    });

    const searchInput = wrapper.find('t-input-stub');
    await searchInput.setValue('nonexistent');

    // Filter should result in empty list
    expect(wrapper.vm.filteredConfigs).toHaveLength(0);
  });

  it('filters configs by status', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-select-stub').exists()).toBe(true);
    });

    const statusSelect = wrapper.findAll('t-select-stub')[0];
    await statusSelect.setValue('inactive');

    // Filter should result in empty list
    expect(wrapper.vm.filteredConfigs).toHaveLength(0);
  });

  it('handles config deletion', async () => {
    wrapper = createWrapper();

    // Mock successful deletion
    vi.mocked(apiToMcpService.deleteConfig).mockResolvedValue({
      id: 'test-config-1',
      message: 'Config deleted successfully',
    });

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-button-stub').exists()).toBe(true);
    });

    // Find and click delete button
    const deleteButton = wrapper
      .findAll('t-button-stub')
      .find((btn) => btn.attributes('theme') === 'danger');
    await deleteButton.trigger('click');

    // Verify deletion was called
    expect(apiToMcpService.deleteConfig).toHaveBeenCalledWith('test-config-1');
  });

  it('handles batch deletion', async () => {
    wrapper = createWrapper();

    // Mock successful batch deletion
    vi.mocked(apiToMcpService.deleteConfig).mockResolvedValue({
      id: 'test-config-1',
      message: 'Config deleted successfully',
    });

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-table-stub').exists()).toBe(true);
    });

    // Select config for deletion
    await wrapper.vm.handleSelectionChange(['test-config-1']);

    // Find and click batch delete button
    const batchDeleteButton = wrapper
      .findAll('t-button-stub')
      .find((btn) => btn.text().includes('批量删除'));
    await batchDeleteButton.trigger('click');

    // Verify deletion was called
    expect(apiToMcpService.deleteConfig).toHaveBeenCalledWith('test-config-1');
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

  it('gets status variant correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.getStatusVariant).toBeDefined();
    });

    expect(wrapper.vm.getStatusVariant('active')).toBe('success');
    expect(wrapper.vm.getStatusVariant('inactive')).toBe('warning');
    expect(wrapper.vm.getStatusVariant('error')).toBe('error');
  });

  it('gets status text correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.getStatusText).toBeDefined();
    });

    expect(wrapper.vm.getStatusText('active')).toBe('活跃');
    expect(wrapper.vm.getStatusText('inactive')).toBe('非活跃');
    expect(wrapper.vm.getStatusText('error')).toBe('错误');
  });
});
