<template>
  <ContentLayout
    title="组管理"
    description="管理MCP服务器组，配置工具过滤和验证密钥"
    :actions="[
      { text: '刷新', theme: 'default', variant: 'outline', icon: RefreshIcon, loading, onClick: handleRefresh },
      { text: '添加组', theme: 'primary', icon: AddIcon, onClick: handleAddGroup }
    ]"
  >
    <!-- 统计卡片 -->
    <div class="stats-row">
      <StatCard
        v-for="stat in statsCards"
        :key="stat.key"
        :value="stat.value"
        :label="stat.label"
        :icon="stat.icon"
        :theme="stat.theme"
      />
    </div>

    <!-- 数据表格 -->
    <DataTable
      :data="tableData"
      :columns="tableColumns"
      :loading="loading"
      :pagination="paginationConfig"
      :searchable="true"
      :search-placeholder="'搜索组...'"
      :selectable="false"
      @search="handleSearch"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <!-- 组名称 -->
      <template #name="{ row }">
        <div class="group-name">
          <div class="group-name__main">{{ row.name }}</div>
          <div class="group-name__id">ID: {{ row.id }}</div>
          <div v-if="row.description" class="group-name__description">
            {{ row.description }}
          </div>
        </div>
      </template>

      <!-- 服务器数量 -->
      <template #serverCount="{ row }">
        <div class="server-count">
          {{ row.connectedServers }}/{{ row.serverCount }}
        </div>
      </template>

      <!-- 工具数量 -->
      <template #toolCount="{ row }">
        <div class="tool-count-badge">
          {{ row.toolCount }}
        </div>
      </template>

      <!-- 健康状态 -->
      <template #health="{ row }">
        <div class="health-status">
          <GroupStatusTag :status="row.isHealthy ? 'healthy' : 'unhealthy'" />
          <div class="health-score">
            <t-progress
              :percentage="row.healthScore"
              :status="row.isHealthy ? 'success' : 'danger'"
              :show-info="false"
              size="small"
            />
            <span class="health-score__text">{{ row.healthScore }}%</span>
          </div>
        </div>
      </template>

      <!-- 验证状态 -->
      <template #validation="{ row }">
        <div class="validation-status">
          <t-tag
            :theme="row.validation.enabled ? 'success' : 'default'"
            variant="light"
            size="small"
          >
            {{ row.validation.enabled ? '已启用' : '未启用' }}
          </t-tag>
          <t-tag
            v-if="row.validation.hasKey"
            theme="primary"
            variant="light"
            size="small"
          >
            有密钥
          </t-tag>
        </div>
      </template>

      <!-- 工具过滤 -->
      <template #toolFilter="{ row }">
        <div class="tool-filter-status">
          <t-tag
            :theme="row.toolFilterMode === 'whitelist' ? 'primary' : 'default'"
            variant="light"
            size="small"
          >
            {{ row.toolFilterMode === 'whitelist' ? '白名单' : '无过滤' }}
          </t-tag>
          <div v-if="row.toolFilterMode === 'whitelist'" class="tool-count">
            {{ row.filteredToolCount }}/{{ row.toolCount }}
          </div>
        </div>
      </template>

      <!-- 操作 -->
      <template #operations="{ row }">
        <ActionGroup
          :actions="getGroupActions(row)"
          :size="'small'"
          layout="horizontal"
          @action-click="handleActionClick(row, $event)"
        />
      </template>
    </DataTable>

    <!-- 空状态 -->
    <EmptyPage
      v-if="!loading && tableData.length === 0 && !searchKeyword"
      type="no-data"
      description="暂无组数据"
      :actions="[
        { text: '创建第一个组', theme: 'primary', icon: AddIcon, onClick: handleAddGroup }
      ]"
    />
  </ContentLayout>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  RefreshIcon,
  InfoCircleIcon,
  EditIcon,
  UsergroupFilledIcon,
  KeyIcon,
  HeartFilledIcon,
} from 'tdesign-icons-vue-next';
import { ContentLayout, StatCard, DataTable, EmptyPage } from '@/design-system';
import type { Action } from '@/design-system';
import GroupStatusTag from '@/components/common/GroupStatusTag.vue';
import { useGroupStore } from '@/stores/group';
import type { GroupInfo } from '@/types/group';
import type { DataTableColumn, DataTablePagination } from '@/design-system';

// 定义事件
const emit = defineEmits<{
  'add-group': [];
  'edit-group': [group: GroupInfo];
  'manage-members': [group: GroupInfo];
  'manage-validation': [group: GroupInfo];
  'view-detail': [group: GroupInfo];
}>();

// 状态
const groupStore = useGroupStore();
const loading = computed(() => groupStore.loading);
const searchKeyword = ref('');

// 分页配置
const paginationConfig = ref<DataTablePagination>({
  current: 1,
  pageSize: 10,
  total: 0,
  showJumper: true,
  showSizer: true,
  pageSizeOptions: [10, 20, 50, 100],
});

// 表格数据（已过滤和分页）
const tableData = computed(() => {
  let groups = groupStore.groupList;

  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    groups = groups.filter(group =>
      group.name.toLowerCase().includes(keyword) ||
      group.id.toLowerCase().includes(keyword) ||
      (group.description && group.description.toLowerCase().includes(keyword))
    );
  }

  // 更新分页总数
  paginationConfig.value.total = groups.length;

  // 分页
  const start = (paginationConfig.value.current - 1) * paginationConfig.value.pageSize;
  const end = start + paginationConfig.value.pageSize;
  return groups.slice(start, end);
});

// 统计卡片
const statsCards = computed(() => [
  {
    key: 'total',
    value: groupStore.summary.totalGroups,
    label: '总组数',
    icon: 'folder',
    theme: 'blue' as const,
  },
  {
    key: 'healthy',
    value: groupStore.summary.healthyGroups,
    label: '健康组',
    icon: 'check-circle',
    theme: 'green' as const,
  },
  {
    key: 'servers',
    value: groupStore.summary.totalServers,
    label: '服务器',
    icon: 'server',
    theme: 'purple' as const,
  },
  {
    key: 'tools',
    value: groupStore.summary.totalTools,
    label: '工具总数',
    icon: 'tool',
    theme: 'orange' as const,
  },
]);

// 表格列配置
const tableColumns: DataTableColumn[] = [
  {
    colKey: 'name',
    title: '组名称',
    width: 280,
    fixed: 'left',
  },
  {
    colKey: 'serverCount',
    title: '服务器',
    width: 120,
    align: 'center' as const,
  },
  {
    colKey: 'toolCount',
    title: '工具',
    width: 100,
    align: 'center' as const,
  },
  {
    colKey: 'health',
    title: '健康状态',
    width: 150,
    align: 'center' as const,
  },
  {
    colKey: 'validation',
    title: '验证状态',
    width: 120,
    align: 'center' as const,
  },
  {
    colKey: 'toolFilter',
    title: '工具过滤',
    width: 120,
    align: 'center' as const,
  },
  {
    colKey: 'operations',
    title: '操作',
    width: 200,
    align: 'center' as const,
    fixed: 'right',
  },
];

// 方法定义
const handleSearch = (keyword: string) => {
  searchKeyword.value = keyword;
  paginationConfig.value.current = 1;
};

const handleRefresh = () => {
  groupStore.fetchGroups();
};

const handleAddGroup = () => {
  emit('add-group');
};

const handleEditGroup = (group: GroupInfo) => {
  emit('edit-group', group);
};

const handleManageMembers = (group: GroupInfo) => {
  emit('manage-members', group);
};

const handleManageValidation = (group: GroupInfo) => {
  emit('manage-validation', group);
};

const handleViewDetail = (group: GroupInfo) => {
  emit('view-detail', group);
};

const handlePageChange = (current: number) => {
  paginationConfig.value.current = current;
};

const handlePageSizeChange = (pageSize: number) => {
  paginationConfig.value.pageSize = pageSize;
  paginationConfig.value.current = 1;
};

const getGroupActions = (group: GroupInfo): Action[] => {
  return [
    {
      key: 'detail',
      text: '详情',
      icon: InfoCircleIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleViewDetail(group),
    },
    {
      key: 'edit',
      text: '编辑',
      icon: EditIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleEditGroup(group),
    },
    {
      key: 'members',
      text: '成员',
      icon: UsergroupFilledIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleManageMembers(group),
    },
    {
      key: 'validation',
      text: '密钥',
      icon: KeyIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleManageValidation(group),
    },
    {
      key: 'health',
      text: '健康',
      icon: HeartFilledIcon,
      theme: 'success',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleHealthCheck(group),
    },
  ];
};

const handleActionClick = (group: GroupInfo, action: Action) => {
  // Action 的 onClick 已经在 getGroupActions 中定义
};

const handleHealthCheck = async (group: GroupInfo) => {
  try {
    const health = await groupStore.getGroupHealth(group.id);
    MessagePlugin.success(`组 "${group.name}" 健康状态: ${health.healthy ? '健康' : '不健康'}`);
  } catch (error) {
    MessagePlugin.error(`获取组健康状态失败: ${error}`);
  }
};

// 生命周期
onMounted(() => {
  groupStore.fetchGroups();
});

onUnmounted(() => {
  groupStore.clearError();
});
</script>

<style lang="less" scoped>
@import '../../design-system/styles/mixins.less';
@import '../../design-system/tokens/spacing.less';

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: @spacing-lg;
  margin-bottom: @spacing-xxl;
}

.group-name {
  line-height: 1.5;
}

.group-name__main {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.group-name__id {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.group-name__description {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 4px;
}

.server-count {
  text-align: center;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tool-count-badge {
  text-align: center;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.health-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.health-score {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-score__text {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  min-width: 40px;
}

.validation-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.tool-filter-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.tool-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

// 响应式
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
