import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import McpMessageMonitor from './McpMessageMonitor.vue';

describe('McpMessageMonitor', () => {
  it('should render correctly', () => {
    const wrapper = mount(McpMessageMonitor);
    expect(wrapper.find('.mcp-message-monitor')).toBeTruthy();
  });

  it('should have search input', () => {
    const wrapper = mount(McpMessageMonitor);
    expect(wrapper.find('input[placeholder="搜索消息内容"]').exists()).toBe(
      true,
    );
  });

  it('should have table component', () => {
    const wrapper = mount(McpMessageMonitor);
    expect(wrapper.find('table').exists()).toBe(true);
  });
});
