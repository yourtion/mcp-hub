import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import StatusTag from '../StatusTag.vue';

describe('StatusTag', () => {
  it('should render connected status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'connected' } });
    expect(wrapper.text()).toContain('已连接');
  });

  it('should render disconnected status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'disconnected' } });
    expect(wrapper.text()).toContain('已断开');
  });

  it('should render connecting status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'connecting' } });
    expect(wrapper.text()).toContain('连接中');
  });

  it('should render error status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'error' } });
    expect(wrapper.text()).toContain('错误');
  });

  it('should render available status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'available' } });
    expect(wrapper.text()).toContain('可用');
  });

  it('should render unavailable status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'unavailable' } });
    expect(wrapper.text()).toContain('不可用');
  });

  it('should render healthy status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'healthy' } });
    expect(wrapper.text()).toContain('健康');
  });

  it('should render active status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'active' } });
    expect(wrapper.text()).toContain('活跃');
  });

  it('should render inactive status', () => {
    const wrapper = mount(StatusTag, { props: { status: 'inactive' } });
    expect(wrapper.text()).toContain('未激活');
  });

  it('should render a tag element', () => {
    const wrapper = mount(StatusTag, { props: { status: 'connected' } });
    const tag = wrapper.find('.t-tag');
    expect(tag.exists()).toBe(true);
  });

  it('should fallback to raw status value for unknown status', () => {
    const wrapper = mount(StatusTag, {
      props: { status: 'unknown_status' as 'connected' },
    });
    expect(wrapper.text()).toContain('unknown_status');
  });
});
