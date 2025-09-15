import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PerformanceAnalyzer from './PerformanceAnalyzer.vue';

describe('PerformanceAnalyzer', () => {
  it('should render correctly', () => {
    const wrapper = mount(PerformanceAnalyzer);
    expect(wrapper.find('.performance-analyzer')).toBeTruthy();
  });

  it('should have performance metrics display', () => {
    const wrapper = mount(PerformanceAnalyzer);
    expect(wrapper.find('.t-statistic').exists()).toBe(true);
  });

  it('should have chart container', () => {
    const wrapper = mount(PerformanceAnalyzer);
    expect(wrapper.find('.chart-container').exists()).toBe(true);
  });
});
