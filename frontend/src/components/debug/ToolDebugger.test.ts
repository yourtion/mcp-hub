import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ToolDebugger from './ToolDebugger.vue';

describe('ToolDebugger', () => {
  it('should render correctly', () => {
    const wrapper = mount(ToolDebugger);
    expect(wrapper.find('.tool-debugger')).toBeTruthy();
  });

  it('should have tool selection', () => {
    const wrapper = mount(ToolDebugger);
    expect(wrapper.find('select').exists()).toBe(true);
  });

  it('should have test form', () => {
    const wrapper = mount(ToolDebugger);
    expect(wrapper.find('form').exists()).toBe(true);
  });
});