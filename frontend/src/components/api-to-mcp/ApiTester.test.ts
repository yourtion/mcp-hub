import { mount, type VueWrapper } from '@vue/test-utils';
import { ConfigProvider } from 'tdesign-vue-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApiTester from '@/components/api-to-mcp/ApiTester.vue';

// Mock service
const mockApiToMcpService = {
  getConfigs: vi.fn(),
  getConfigDetails: vi.fn(),
  testConfig: vi.fn(),
  generateToolPreview: vi.fn(),
};

vi.mock('@/services/api-to-mcp', () => ({
  apiToMcpService: mockApiToMcpService,
}));

describe('ApiTester', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful responses
    mockApiToMcpService.getConfigs.mockResolvedValue({
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

    mockApiToMcpService.getConfigDetails.mockResolvedValue({
      id: 'test-config-1',
      name: 'Test API',
      description: 'Test API configuration',
      api: {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: [],
        timeout: 10000,
      },
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      response: {
        statusCodePath: '',
        dataPath: '',
        errorMessagePath: '',
        successCodes: [200],
        errorCodes: [400],
      },
    });

    mockApiToMcpService.testConfig.mockResolvedValue({
      success: true,
      response: { result: 'success' },
      executionTime: 150,
    });

    mockApiToMcpService.generateToolPreview.mockResolvedValue({
      tools: [
        {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          serverName: 'test-server',
        },
      ],
      message: 'Tool preview generated',
    });
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
    expect(wrapper.find('.tester-header h3').text()).toBe(
      'API测试与MCP工具预览',
    );
  });

  it('loads config information correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.vm.configInfo.name).toBe('Test API');
    });

    expect(wrapper.vm.configInfo.id).toBe('test-config-1');
    expect(wrapper.vm.configInfo.description).toBe('Test API configuration');
  });

  it('displays config info correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('t-card-stub').exists()).toBe(true);
    });

    const cards = wrapper.findAll('t-card-stub');
    expect(cards[0].attributes('title')).toBe('配置信息');
  });

  it('handles parameter input mode', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.parameters-section').exists()).toBe(true);
    });

    // Add a parameter
    const addButton = wrapper.find('t-button-stub');
    await addButton.trigger('click');

    expect(wrapper.vm.testParameters).toHaveLength(1);
    expect(wrapper.vm.testParameters[0].name).toBe('');
    expect(wrapper.vm.testParameters[0].value).toBe('');
    expect(wrapper.vm.testParameters[0].type).toBe('string');
  });

  it('handles JSON input mode', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.json-section').exists()).toBe(true);
    });

    // Switch to JSON input
    const switchComponent = wrapper.find('t-switch-stub');
    await switchComponent.setValue(true);

    expect(wrapper.vm.useJsonInput).toBe(true);
  });

  it('loads sample data correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.test-content').exists()).toBe(true);
    });

    // Load sample data
    const sampleButtons = wrapper.findAll('t-button-stub');
    const sampleButton = sampleButtons.find((btn) =>
      btn.text().includes('加载示例数据'),
    );
    if (sampleButton) {
      await sampleButton.trigger('click');
    }

    if (wrapper.vm.useJsonInput) {
      expect(wrapper.vm.jsonInput).toContain('param1');
      expect(wrapper.vm.jsonInput).toContain('value1');
    } else {
      expect(wrapper.vm.testParameters).toHaveLength(3);
      expect(wrapper.vm.testParameters[0].value).toBe('value1');
    }
  });

  it('runs API test with parameters', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.test-actions').exists()).toBe(true);
    });

    // Add test parameters
    wrapper.vm.testParameters = [
      { name: 'param1', value: 'test', type: 'string' },
    ];

    // Run test
    const testButton = wrapper.find('t-button-stub');
    await testButton.trigger('click');

    expect(wrapper.vm.testing).toBe(true);

    // Wait for test completion
    await vi.waitFor(() => {
      expect(wrapper.vm.testing).toBe(false);
    });

    expect(wrapper.vm.testResult).toBeTruthy();
    expect(wrapper.vm.testResult.success).toBe(true);
  });

  it('runs API test with JSON input', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.test-actions').exists()).toBe(true);
    });

    // Switch to JSON input and set data
    wrapper.vm.useJsonInput = true;
    wrapper.vm.jsonInput = JSON.stringify({ param1: 'test' });

    // Run test
    const testButton = wrapper.find('t-button-stub');
    await testButton.trigger('click');

    expect(wrapper.vm.testing).toBe(true);

    // Wait for test completion
    await vi.waitFor(() => {
      expect(wrapper.vm.testing).toBe(false);
    });

    expect(wrapper.vm.testResult).toBeTruthy();
  });

  it('handles API test errors gracefully', async () => {
    wrapper = createWrapper();

    // Mock API error
    mockApiToMcpService.testConfig.mockResolvedValue({
      success: false,
      error: 'API Error',
      executionTime: 150,
    });

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.test-actions').exists()).toBe(true);
    });

    // Run test
    const testButton = wrapper.find('t-button-stub');
    await testButton.trigger('click');

    // Wait for test completion
    await vi.waitFor(() => {
      expect(wrapper.vm.testing).toBe(false);
    });

    expect(wrapper.vm.testResult).toBeTruthy();
    expect(wrapper.vm.testResult.success).toBe(false);
    expect(wrapper.vm.testResult.error).toBe('API Error');
  });

  it('displays test results correctly', async () => {
    wrapper = createWrapper();

    // Set test result
    wrapper.vm.testResult = {
      success: true,
      response: { result: 'success' },
      executionTime: 150,
    };

    // Check result display
    expect(wrapper.find('.result-section').exists()).toBe(true);
    expect(wrapper.find('.summary-value').exists()).toBe(true);
    expect(wrapper.find('t-tabs-stub').exists()).toBe(true);
  });

  it('clears test results correctly', async () => {
    wrapper = createWrapper();

    // Set test result
    wrapper.vm.testResult = {
      success: true,
      response: { result: 'success' },
      executionTime: 150,
    };

    // Clear result
    const clearButtons = wrapper.findAll('t-button-stub');
    const clearButton = clearButtons.find((btn) =>
      btn.text()?.includes('清除结果'),
    );
    if (clearButton) {
      await clearButton.trigger('click');
    }

    expect(wrapper.vm.testResult).toBeNull();
    expect(wrapper.vm.activeTab).toBe('response');
  });

  it('generates tool preview correctly', async () => {
    wrapper = createWrapper();

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.tool-preview').exists()).toBe(true);
    });

    // Generate tool preview
    const generateButtons = wrapper.findAll('t-button-stub');
    const generateButton = generateButtons.find((btn) =>
      btn.text().includes('生成工具预览'),
    );
    if (generateButton) {
      await generateButton.trigger('click');
    }

    expect(wrapper.vm.toolPreview.loading).toBe(true);

    // Wait for completion
    await vi.waitFor(() => {
      expect(wrapper.vm.toolPreview.loading).toBe(false);
    });

    expect(wrapper.vm.toolPreview.tools).toHaveLength(1);
    expect(wrapper.vm.toolPreview.tools[0].name).toBe('test-tool');
  });

  it('handles tool preview errors gracefully', async () => {
    wrapper = createWrapper();

    // Mock API error
    mockApiToMcpService.generateToolPreview.mockRejectedValue(
      new Error('Generation Error'),
    );

    // Wait for data loading
    await vi.waitFor(() => {
      expect(wrapper.find('.tool-preview').exists()).toBe(true);
    });

    // Generate tool preview
    const generateButtons = wrapper.findAll('t-button-stub');
    const generateButton = generateButtons.find((btn) =>
      btn.text().includes('生成工具预览'),
    );
    if (generateButton) {
      await generateButton.trigger('click');
    }

    // Wait for completion
    await vi.waitFor(() => {
      expect(wrapper.vm.toolPreview.loading).toBe(false);
    });

    expect(wrapper.vm.toolPreview.tools).toHaveLength(0);
  });

  it('formats JSON correctly', async () => {
    wrapper = createWrapper();

    const testData = { key: 'value', number: 42 };
    const formatted = wrapper.vm.formatJson(testData);

    expect(formatted).toBe(JSON.stringify(testData, null, 2));
  });

  it('handles invalid JSON formatting', async () => {
    wrapper = createWrapper();

    const circularObject = {};
    circularObject.self = circularObject;

    const formatted = wrapper.vm.formatJson(circularObject);

    expect(formatted).toBe('[object Object]');
  });

  it('gets status variant correctly', async () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getStatusVariant('active')).toBe('success');
    expect(wrapper.vm.getStatusVariant('inactive')).toBe('warning');
    expect(wrapper.vm.getStatusVariant('error')).toBe('error');
    expect(wrapper.vm.getStatusVariant('unknown')).toBe('default');
  });

  it('gets status text correctly', async () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getStatusText('active')).toBe('活跃');
    expect(wrapper.vm.getStatusText('inactive')).toBe('非活跃');
    expect(wrapper.vm.getStatusText('error')).toBe('错误');
    expect(wrapper.vm.getStatusText('unknown')).toBe('未知');
  });

  it('removes parameters correctly', async () => {
    wrapper = createWrapper();

    // Add parameters
    wrapper.vm.testParameters = [
      { name: 'param1', value: 'value1', type: 'string' },
      { name: 'param2', value: 'value2', type: 'number' },
    ];

    // Remove second parameter
    const removeButtons = wrapper
      .findAll('t-button-stub')
      .filter((btn) => btn.attributes('theme') === 'danger');
    if (removeButtons.length > 1) {
      await removeButtons[1].trigger('click');
    }

    expect(wrapper.vm.testParameters).toHaveLength(1);
    expect(wrapper.vm.testParameters[0].name).toBe('param1');
  });
});
