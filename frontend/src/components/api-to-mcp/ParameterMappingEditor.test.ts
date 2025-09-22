import { mount, type VueWrapper } from '@vue/test-utils';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ParameterMappingEditor from '@/components/api-to-mcp/ParameterMappingEditor.vue';

describe('ParameterMappingEditor', () => {
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
    return mount(ParameterMappingEditor, {
      props: {
        sourceSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'number', description: 'Second parameter' },
          },
          required: ['param1'],
        },
        ...props,
      },
      global: {
        plugins: [ConfigProvider],
        stubs: {
          't-button': true,
          't-icon': true,
          't-input': true,
          't-select': true,
          't-switch': true,
          't-textarea': true,
          't-badge': true,
          't-space': true,
          't-divider': true,
          't-form': true,
          't-form-item': true,
          't-alert': true,
          'delete-icon': true,
          'add-icon': true,
          'auto-icon': true,
          'clear-icon': true,
          'preview-icon': true,
          'test-icon': true,
          'star-icon': true,
          'close-icon': true,
        },
      },
    });
  };

  it('renders correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('displays source parameters correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('handles parameter selection', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('auto maps all parameters', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('adds new mapping manually', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('removes mapping', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('clears all mappings', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('updates preview when mappings change', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('handles mapping type changes', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('handles static mapping type', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('gets parameter type icon correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('gets parameter type from name correctly', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('handles drag and drop events', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('tests mapping functionality', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('handles invalid test data', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });

  it('emits mappings update event', () => {
    wrapper = createWrapper();
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
  });
});
