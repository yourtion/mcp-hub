import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import GroupStatusTag from '../GroupStatusTag.vue';

describe('GroupStatusTag', () => {
  it('should render healthy state when healthScore > 80', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: true, healthScore: 90 },
    });
    expect(wrapper.text()).toContain('健康');
    expect(wrapper.text()).toContain('90');
  });

  it('should render warning state when healthScore between 51 and 80', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: false, healthScore: 65 },
    });
    expect(wrapper.text()).toContain('警告');
    expect(wrapper.text()).toContain('65');
  });

  it('should render danger state when healthScore <= 50', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: false, healthScore: 30 },
    });
    expect(wrapper.text()).toContain('异常');
    expect(wrapper.text()).toContain('30');
  });

  it('should render boundary value 81 as healthy', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: true, healthScore: 81 },
    });
    expect(wrapper.text()).toContain('健康');
  });

  it('should render boundary value 51 as warning', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: false, healthScore: 51 },
    });
    expect(wrapper.text()).toContain('警告');
  });

  it('should render boundary value 50 as danger', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: false, healthScore: 50 },
    });
    expect(wrapper.text()).toContain('异常');
  });

  it('should render boundary value 80 as warning', () => {
    const wrapper = mount(GroupStatusTag, {
      props: { isHealthy: false, healthScore: 80 },
    });
    expect(wrapper.text()).toContain('警告');
  });
});
