import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import GroupStatusTag from '@/components/common/GroupStatusTag.vue';

describe('GroupStatusTag', () => {
  it('应该渲染组件', () => {
    const wrapper = mount(GroupStatusTag, {
      props: {
        status: 'healthy',
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain('健康');
  });

  it('应该正确渲染部分健康状态', () => {
    const wrapper = mount(GroupStatusTag, {
      props: {
        status: 'partial',
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain('部分健康');
  });

  it('应该正确渲染不健康状态', () => {
    const wrapper = mount(GroupStatusTag, {
      props: {
        status: 'unhealthy',
      },
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.text()).toContain('不健康');
  });

  it('应该支持不同的variant', () => {
    const wrapper = mount(GroupStatusTag, {
      props: {
        status: 'healthy',
        variant: 'dark',
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('应该应用正确的CSS类', () => {
    const wrapper = mount(GroupStatusTag, {
      props: {
        status: 'healthy',
      },
    });

    expect(wrapper.find('.group-status-tag').exists()).toBe(true);
    expect(wrapper.find('.group-status-tag--healthy').exists()).toBe(true);
  });
});
