import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ConfigProvider } from 'tdesign-vue-next';
import ParameterMappingEditor from '@/components/api-to-mcp/ParameterMappingEditor.vue';

describe('ParameterMappingEditor', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  const createWrapper = (props: any = {}) => {
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
          'delete-icon': true,
          'add-icon': true,
          'auto-icon': true,
          'clear-icon': true,
          'preview-icon': true,
          'test-icon': true,
        },
      },
    });
  };

  it('renders correctly', () => {
    wrapper = createWrapper();
    
    expect(wrapper.find('.parameter-mapping-editor').exists()).toBe(true);
    expect(wrapper.find('.editor-header h3').text()).toBe('参数映射编辑器');
  });

  it('displays source parameters correctly', () => {
    wrapper = createWrapper();
    
    const sourceParams = wrapper.findAll('.param-item');
    expect(sourceParams).toHaveLength(2);
    
    expect(sourceParams[0].find('.param-name').text()).toBe('param1');
    expect(sourceParams[0].find('.param-type').text()).toBe('string');
    expect(sourceParams[0].find('.param-required').exists()).toBe(true);
    
    expect(sourceParams[1].find('.param-name').text()).toBe('param2');
    expect(sourceParams[1].find('.param-type').text()).toBe('number');
    expect(sourceParams[1].find('.param-required').exists()).toBe(false);
  });

  it('handles parameter selection', async () => {
    wrapper = createWrapper();
    
    const paramItems = wrapper.findAll('.param-item');
    await paramItems[0].trigger('click');
    
    expect(wrapper.vm.selectedSourceParam).toBe('param1');
    expect(paramItems[0].classes()).toContain('selected');
  });

  it('auto maps all parameters', async () => {
    wrapper = createWrapper();
    
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    expect(wrapper.vm.mappings).toHaveLength(2);
    expect(wrapper.vm.mappings[0].source).toBe('param1');
    expect(wrapper.vm.mappings[0].target).toBe('param1');
    expect(wrapper.vm.mappings[0].type).toBe('direct');
    
    expect(wrapper.vm.mappings[1].source).toBe('param2');
    expect(wrapper.vm.mappings[1].target).toBe('param2');
    expect(wrapper.vm.mappings[1].type).toBe('direct');
  });

  it('adds new mapping manually', async () => {
    wrapper = createWrapper();
    
    // First select a parameter
    const paramItems = wrapper.findAll('.param-item');
    await paramItems[0].trigger('click');
    
    // Then click add mapping button
    const addButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('添加映射')
    );
    if (addButton) {
      await addButton.trigger('click');
    }
    
    expect(wrapper.vm.mappings).toHaveLength(1);
    expect(wrapper.vm.mappings[0].source).toBe('param1');
    expect(wrapper.vm.mappings[0].target).toBe('param1');
  });

  it('removes mapping', async () => {
    wrapper = createWrapper();
    
    // First add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Then remove it
    const removeButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.attributes('theme') === 'danger'
    );
    if (removeButton) {
      await removeButton.trigger('click');
    }
    
    expect(wrapper.vm.mappings).toHaveLength(1);
  });

  it('clears all mappings', async () => {
    wrapper = createWrapper();
    
    // First add mappings
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Then clear them
    const clearButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('清空映射')
    );
    if (clearButton) {
      await clearButton.trigger('click');
    }
    
    expect(wrapper.vm.mappings).toHaveLength(0);
  });

  it('updates preview when mappings change', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Check preview
    expect(wrapper.vm.previewJson).toContain('param1');
    expect(wrapper.vm.previewJson).toContain('param2');
  });

  it('handles mapping type changes', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Change mapping type
    const selects = wrapper.findAll('t-select-stub');
    if (selects.length > 0) {
      await selects[0].setValue('transform');
    }
    
    expect(wrapper.vm.mappings[0].type).toBe('transform');
    expect(wrapper.vm.mappings[0].staticValue).toBeUndefined();
  });

  it('handles static mapping type', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Change mapping type to static
    const selects = wrapper.findAll('t-select-stub');
    if (selects.length > 0) {
      await selects[0].setValue('static');
    }
    
    expect(wrapper.vm.mappings[0].type).toBe('static');
    expect(wrapper.vm.mappings[0].transform).toBeUndefined();
  });

  it('gets parameter type icon correctly', () => {
    wrapper = createWrapper();
    
    expect(wrapper.vm.getParamTypeIcon('string')).toBe('text');
    expect(wrapper.vm.getParamTypeIcon('number')).toBe('number');
    expect(wrapper.vm.getParamTypeIcon('boolean')).toBe('check-circle');
    expect(wrapper.vm.getParamTypeIcon('object')).toBe('layers');
    expect(wrapper.vm.getParamTypeIcon('array')).toBe('list');
    expect(wrapper.vm.getParamTypeIcon('unknown')).toBe('variable');
  });

  it('gets parameter type from name correctly', () => {
    wrapper = createWrapper();
    
    expect(wrapper.vm.getParamType('param1')).toBe('string');
    expect(wrapper.vm.getParamType('nonexistent')).toBe('unknown');
  });

  it('handles drag and drop events', async () => {
    wrapper = createWrapper();
    
    const paramItem = wrapper.find('.param-item');
    const mockEvent = {
      dataTransfer: {
        setData: vi.fn(),
      },
      preventDefault: vi.fn(),
    };
    
    await paramItem.trigger('dragstart', mockEvent);
    
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      JSON.stringify({
        type: 'source',
        param: { name: 'param1', type: 'string', required: true },
      })
    );
  });

  it('tests mapping functionality', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Set test data
    wrapper.vm.testData = JSON.stringify({ param1: 'test', param2: 42 });
    
    // Test mapping
    await wrapper.vm.testMapping();
    
    expect(wrapper.vm.testResult).toContain('test');
    expect(wrapper.vm.testResult).toContain(42);
  });

  it('handles invalid test data', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Set invalid test data
    wrapper.vm.testData = 'invalid json';
    
    // Test mapping
    await wrapper.vm.testMapping();
    
    expect(wrapper.vm.testResult).toContain('测试错误');
  });

  it('emits mappings update event', async () => {
    wrapper = createWrapper();
    
    // Add a mapping
    const autoMapButton = wrapper.findAll('t-button-stub').find(btn => 
      btn.text().includes('自动映射')
    );
    if (autoMapButton) {
      await autoMapButton.trigger('click');
    }
    
    // Check if event was emitted
    expect(wrapper.emitted('update:mappings')).toBeTruthy();
    expect(wrapper.emitted('update:mappings')[0][0]).toHaveLength(2);
  });
});