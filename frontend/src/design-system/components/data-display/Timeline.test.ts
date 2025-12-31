import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import Timeline from './Timeline.vue';

describe('Timeline', () => {
  const mockItems = [
    {
      time: '2024-01-01 10:00',
      title: '项目启动',
      description: '项目正式启动，完成需求分析',
      status: 'success' as const,
      icon: 'check-circle',
    },
    {
      time: '2024-01-15 14:30',
      title: '设计完成',
      description: '完成UI/UX设计，进入开发阶段',
      status: 'info' as const,
      icon: 'info-circle',
    },
    {
      time: '2024-02-01 09:00',
      title: '开发中',
      description: '正在进行核心功能开发',
      status: 'warning' as const,
      icon: 'time',
    },
  ];

  it('应该正确渲染时间轴', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
      },
    });

    expect(wrapper.find('.ds-timeline').exists()).toBe(true);
    expect(wrapper.findAll('.ds-timeline-item').length).toBe(3);
  });

  it('应该正确渲染时间轴节点的信息', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
      },
    });

    const firstItem = wrapper.findAll('.ds-timeline-item')[0];
    expect(firstItem.find('.ds-timeline-item__time').text()).toBe(
      '2024-01-01 10:00',
    );
    expect(firstItem.find('.ds-timeline-item__title').text()).toBe('项目启动');
    expect(firstItem.find('.ds-timeline-item__description').text()).toBe(
      '项目正式启动，完成需求分析',
    );
  });

  it('应该正确应用状态样式', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
      },
    });

    const items = wrapper.findAll('.ds-timeline-item');
    expect(items[0].classes()).toContain('ds-timeline-item--success');
    expect(items[1].classes()).toContain('ds-timeline-item--info');
    expect(items[2].classes()).toContain('ds-timeline-item--warning');
  });

  it('应该支持垂直方向', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
        direction: 'vertical',
      },
    });

    expect(wrapper.find('.ds-timeline--vertical').exists()).toBe(true);
  });

  it('应该支持水平方向', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
        direction: 'horizontal',
      },
    });

    expect(wrapper.find('.ds-timeline--horizontal').exists()).toBe(true);
  });

  it('应该支持左侧模式', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
        mode: 'left',
      },
    });

    expect(wrapper.find('.ds-timeline--left').exists()).toBe(true);
  });

  it('应该支持右侧模式', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
        mode: 'right',
      },
    });

    expect(wrapper.find('.ds-timeline--right').exists()).toBe(true);
  });

  it('应该支持交替模式', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
        mode: 'alternate',
      },
    });

    expect(wrapper.find('.ds-timeline--alternate').exists()).toBe(true);
  });

  it('应该正确渲染最后一个节点', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
      },
    });

    const items = wrapper.findAll('.ds-timeline-item');
    const lastItem = items[items.length - 1];
    expect(lastItem.classes()).toContain('ds-timeline-item--last');
  });

  it('应该处理没有描述的时间轴项', () => {
    const itemsWithoutDescription = [
      {
        time: '2024-01-01',
        title: '仅标题',
        status: 'default' as const,
      },
    ];

    const wrapper = mount(Timeline, {
      props: {
        items: itemsWithoutDescription,
      },
    });

    const firstItem = wrapper.find('.ds-timeline-item');
    expect(firstItem.find('.ds-timeline-item__description').exists()).toBe(
      false,
    );
    expect(firstItem.find('.ds-timeline-item__title').text()).toBe('仅标题');
  });

  it('应该正确设置默认方向和模式', () => {
    const wrapper = mount(Timeline, {
      props: {
        items: mockItems,
      },
    });

    // 默认应该是垂直方向和左侧模式
    expect(wrapper.find('.ds-timeline--vertical').exists()).toBe(true);
    expect(wrapper.find('.ds-timeline--left').exists()).toBe(true);
  });
});
