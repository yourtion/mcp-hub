import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ErrorAnalyzer from './ErrorAnalyzer.vue';

describe('ErrorAnalyzer', () => {
  it('should render correctly', () => {
    const wrapper = mount(ErrorAnalyzer);
    expect(wrapper.find('.error-analyzer')).toBeTruthy();
  });

  it('should have error statistics display', () => {
    const wrapper = mount(ErrorAnalyzer);
    expect(wrapper.find('.t-statistic').exists()).toBe(true);
  });

  it('should have error table', () => {
    const wrapper = mount(ErrorAnalyzer);
    expect(wrapper.find('table').exists()).toBe(true);
  });
});