import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupList from '@/components/groups/GroupList.vue';
import { useGroupStore } from '@/stores/group';
import type { GroupInfo } from '@/types/group';

describe('GroupList', () => {
  let groupStore: ReturnType<typeof useGroupStore>;

  const mockGroups: GroupInfo[] = [
    {
      id: 'group1',
      name: 'Test Group 1',
      description: 'Test group description',
      servers: ['server1', 'server2'],
      serverCount: 2,
      connectedServers: 2,
      toolCount: 10,
      filteredToolCount: 8,
      tools: ['tool1', 'tool2'],
      toolFilterMode: 'whitelist',
      isHealthy: true,
      healthScore: 100,
      validation: {
        enabled: true,
        hasKey: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdated: '2024-01-01T00:00:00.000Z',
      },
      stats: {
        totalServers: 2,
        availableServers: 2,
        totalTools: 10,
        filteredTools: 8,
        healthPercentage: 100,
      },
      lastUpdated: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    groupStore = useGroupStore();

    // Mock store's internal map
    groupStore.groups = new Map(mockGroups.map((group) => [group.id, group]));

    groupStore.summary = {
      totalGroups: 1,
      healthyGroups: 1,
      totalServers: 2,
      connectedServers: 2,
      totalTools: 10,
      filteredTools: 8,
      averageHealthScore: 100,
      groupsWithValidation: 1,
      groupsWithToolFilter: 1,
      summaryStatus: 'healthy',
      issues: [],
    };
  });

  it('应该正确渲染组件', () => {
    const wrapper = mount(GroupList);

    expect(wrapper.find('.group-list').exists()).toBe(true);
    expect(wrapper.find('.group-list__header').exists()).toBe(true);
    expect(wrapper.find('.group-list__stats').exists()).toBe(true);
    expect(wrapper.find('.group-list__table-card').exists()).toBe(true);
  });

  it('应该显示正确的页面标题', () => {
    const wrapper = mount(GroupList);

    const title = wrapper.find('.group-list__title h2');
    expect(title.text()).toBe('组管理');

    const description = wrapper.find('.group-list__description');
    expect(description.text()).toBe('管理MCP服务器组，配置工具过滤和验证密钥');
  });

  it('应该显示统计卡片', () => {
    const wrapper = mount(GroupList);

    const statCards = wrapper.findAll('.stat-card');
    expect(statCards).toHaveLength(4);

    const statValues = wrapper.findAll('.stat-card__value');
    expect(statValues[0].text()).toBe('1'); // 总组数
    expect(statValues[1].text()).toBe('1'); // 健康组
    expect(statValues[2].text()).toBe('2'); // 服务器
    expect(statValues[3].text()).toBe('10'); // 工具总数
  });

  it('应该有正确的表格列配置', () => {
    const wrapper = mount(GroupList);

    const columns = wrapper.vm.columns;
    expect(columns).toHaveLength(7);

    const columnKeys = columns.map((col) => col.key);
    expect(columnKeys).toContain('name');
    expect(columnKeys).toContain('health');
    expect(columnKeys).toContain('operations');
  });

  it('应该有正确的方法', () => {
    const wrapper = mount(GroupList);

    expect(typeof wrapper.vm.handleEditGroup).toBe('function');
    expect(typeof wrapper.vm.handleManageMembers).toBe('function');
    expect(typeof wrapper.vm.handleManageValidation).toBe('function');
  });
});
