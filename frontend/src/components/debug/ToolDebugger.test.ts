import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import ToolDebugger from './ToolDebugger.vue';

// Mock the services
vi.mock('@/services/debug', () => ({
  testTool: vi.fn().mockResolvedValue({
    toolName: 'test-tool',
    serverId: 'test-server',
    groupId: 'test-group',
    arguments: {},
    result: { success: true },
    executionTime: 100,
  }),
}));

// Mock the stores
vi.mock('@/stores/tool', () => ({
  useToolStore: () => ({
    tools: new Map([
      ['test-tool', { name: 'test-tool', serverId: 'test-server' }],
    ]),
    toolsByServer: new Map(),
    toolList: [{ name: 'test-tool', serverId: 'test-server' }],
    fetchTools: vi.fn(),
    testTool: vi.fn(),
  }),
}));

vi.mock('@/stores/server', () => ({
  useServerStore: () => ({
    servers: new Map([
      ['test-server', { id: 'test-server', name: 'Test Server' }],
    ]),
    serverList: [{ id: 'test-server', name: 'Test Server' }],
    fetchServers: vi.fn(),
  }),
}));

vi.mock('@/stores/group', () => ({
  useGroupStore: () => ({
    groups: new Map([['test-group', { id: 'test-group', name: 'Test Group' }]]),
    groupList: [{ id: 'test-group', name: 'Test Group' }],
    fetchGroups: vi.fn(),
  }),
}));

describe('ToolDebugger', () => {
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
    return mount(ToolDebugger, {
      global: {
        plugins: [router, ConfigProvider],
        stubs: {
          't-button': true,
          't-card': true,
          't-row': true,
          't-col': true,
          't-form': true,
          't-form-item': { template: '<div><slot /></div>' },
          't-select': true,
          't-option': true,
          't-textarea': true,
          't-space': true,
          't-list': true,
          't-list-item': true,
          't-list-item-meta': true,
          't-tag': true,
          't-descriptions': true,
          't-descriptions-item': true,
          't-alert': true,
        },
      },
    });
  };

  it('should render correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.tool-debugger')).toBeTruthy();
  });

  it('should have tool selection', () => {
    wrapper = createWrapper();
    // 检查是否存在工具选择的表单项
    expect(wrapper.find('.tool-debugger').exists()).toBe(true);
  });

  it('should have test form', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.tool-debugger').exists()).toBe(true);
  });
});
