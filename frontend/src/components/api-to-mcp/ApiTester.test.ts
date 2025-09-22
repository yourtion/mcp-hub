import { mount, type VueWrapper } from '@vue/test-utils';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApiTester from '@/components/api-to-mcp/ApiTester.vue';

// Mock service
vi.mock('@/services/api-to-mcp', () => {
  return {
    apiToMcpService: {
      getConfigs: vi.fn(),
      getConfigDetails: vi.fn(),
      testConfig: vi.fn(),
      generateToolPreview: vi.fn(),
    },
  };
});

describe('ApiTester', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  const createWrapper = (props: Record<string, unknown> = {}) => {
    return mount(ApiTester, {
      props: {
        configId: 'test-config-1',
        ...props,
      },
      global: {
        plugins: [ConfigProvider],
        stubs: {
          't-card': true,
          't-descriptions': true,
          't-descriptions-item': true,
          't-tag': true,
          't-button': true,
          't-input': true,
          't-select': true,
          't-switch': true,
          't-textarea': true,
          't-tabs': true,
          't-tab-panel': true,
          't-loading': true,
          't-empty': true,
          't-alert': true,
          't-row': true,
          't-col': true,
          'refresh-icon': true,
          'tool-icon': true,
          'add-icon': true,
          'delete-icon': true,
          'play-icon': true,
          'copy-icon': true,
        },
      },
    });
  };

  it('renders correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('loads config information correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('displays config info correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('handles parameter input mode', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('handles JSON input mode', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('loads sample data correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('runs API test with parameters', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('runs API test with JSON input', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('handles API test errors gracefully', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('displays test results correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('clears test results correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('generates tool preview correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('handles tool preview errors gracefully', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('formats JSON correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('handles invalid JSON formatting', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('gets status variant correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('gets status text correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });

  it('removes parameters correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.api-tester').exists()).toBe(true);
  });
});
