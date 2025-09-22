import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { StatCardData } from '@/types/dashboard';
import StatCard from '../StatCard.vue';

describe('StatCard', () => {
  const mockData: StatCardData = {
    value: 42,
    label: '测试指标',
    icon: 'server',
    color: 'blue',
    trend: {
      value: 15,
      direction: 'up',
      period: '本月',
    },
  };

  it('应该正确渲染统计卡片', () => {
    const wrapper = mount(StatCard, {
      props: { data: mockData },
    });

    expect(wrapper.find('.stat-card__value').text()).toBe('42');
    expect(wrapper.find('.stat-card__label').text()).toBe('测试指标');
  });

  it('应该正确格式化大数值', () => {
    const largeValueData: StatCardData = {
      value: 1500,
      label: '大数值',
      icon: 'chart',
      color: 'green',
    };

    const wrapper = mount(StatCard, {
      props: { data: largeValueData },
    });

    expect(wrapper.find('.stat-card__value').text()).toBe('1.5K');
  });

  it('应该正确显示趋势信息', () => {
    const wrapper = mount(StatCard, {
      props: { data: mockData },
    });

    const trendElement = wrapper.find('.stat-card__trend');
    expect(trendElement.exists()).toBe(true);
    expect(trendElement.text()).toContain('15');
    expect(trendElement.text()).toContain('本月');
  });

  it('应该应用正确的颜色主题', () => {
    const wrapper = mount(StatCard, {
      props: { data: mockData },
    });

    expect(wrapper.find('.stat-card--blue').exists()).toBe(true);
  });
});
