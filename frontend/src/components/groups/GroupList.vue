<template>
  <div class="group-list">
    <!-- 页面头部 -->
    <PageHeader
      title="组管理"
      description="管理MCP服务器组，配置工具过滤和验证密钥"
      :actions="[
        { text: '刷新', theme: 'default', variant: 'outline', icon: RefreshIcon, loading, onClick: handleRefresh },
        { text: '添加组', theme: 'primary', icon: AddIcon, onClick: handleAddGroup }
      ]"
    />

    <!-- 统计卡片 -->
    <div class="group-list__stats">
      <StatCard
        v-for="stat in statsCards"
        :key="stat.key"
        :value="stat.value"
        :label="stat.label"
        :icon="stat.icon"
        :theme="stat.theme"
      />
    </div>

    <!-- 组表格 -->
    <t-card class="group-list__table-card">
      <template #header>
        <div class="table-header">
          <h3>组列表</h3>
          <div class="table-header__actions">
            <t-input
              v-model="searchKeyword"
              placeholder="搜索组..."
              clearable
              class="search-input"
            >
              <template #prefix-icon>
                <SearchIcon />
              </template>
            </t-input>
            <t-select
              v-model="statusFilter"
              placeholder="健康状态筛选"
              clearable
              class="status-filter"
            >
              <t-option value="healthy" label="健康" />
              <t-option value="partial" label="部分健康" />
              <t-option value="unhealthy" label="不健康" />
            </t-select>
          </div>
        </div>
      </template>

      <t-table
        :data="filteredGroups"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        stripe
        hover
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <!-- 组名称列 -->
        <template #name="{ row }">
          <div class="group-name">
            <div class="group-name__main">{{ row.name }}</div>
            <div class="group-name__id">ID: {{ row.id }}</div>
            <div v-if="row.description" class="group-name__description">
              {{ row.description }}
            </div>
          </div>
        </template>

        <!-- 服务器数量列 -->
        <template #serverCount="{ row }">
          <div class="server-count">
            {{ row.connectedServers }}/{{ row.serverCount }}
          </div>
        </template>

        <!-- 健康状态列 -->
        <template #health="{ row }">
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
        </template>

        <!-- 验证状态列 -->
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

        <!-- 工具过滤列 -->
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

        <!-- 操作列 -->
        <template #operations="{ row }">
          <div class="group-operations">
            <t-tooltip content="查看详情">
              <t-button
                theme="default"
                variant="text"
                size="small"
                @click="handleViewDetail(row)"
              >
                <template #icon>
                  <InfoCircleIcon />
                </template>
              </t-button>
            </t-tooltip>
            <t-tooltip content="编辑组">
              <t-button
                theme="default"
                variant="text"
                size="small"
                @click="handleEditGroup(row)"
              >
                <template #icon>
                  <EditIcon />
                </template>
              </t-button>
            </t-tooltip>
            <t-tooltip content="管理成员">
              <t-button
                theme="default"
                variant="text"
                size="small"
                @click="handleManageMembers(row)"
              >
                <template #icon>
                  <UsergroupFilledIcon />
                </template>
              </t-button>
            </t-tooltip>
            <t-tooltip content="验证密钥">
              <t-button
                theme="default"
                variant="text"
                size="small"
                @click="handleManageValidation(row)"
              >
                <template #icon>
                  <KeyIcon />
                </template>
              </t-button>
            </t-tooltip>
            <t-dropdown :options="getDropdownOptions(row)" trigger="click">
              <t-button
                theme="default"
                variant="text"
                size="small"
              >
                <template #icon>
                  <MoreIcon />
                </template>
              </t-button>
            </t-dropdown>
          </div>
        </template>
      </t-table>
    </t-card>

    <!-- 空状态 -->
    <t-empty v-if="!loading && filteredGroups.length === 0" description="暂无组数据">
      <template #action>
        <t-button theme="primary" @click="handleAddGroup">
          <template #icon>
            <AddIcon />
          </template>
          创建第一个组
        </t-button>
      </template>
    </t-empty>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  RefreshIcon,
  SearchIcon,
  InfoCircleIcon,
  EditIcon,
  UsergroupFilledIcon,
  KeyIcon,
  MoreIcon,
  DeleteIcon,
  HeartFilledIcon,
} from 'tdesign-icons-vue-next';
import PageHeader from '@/design-system/components/layout/PageHeader.vue';
import StatCard from '@/design-system/components/data-display/StatCard.vue';
import FilterBar from '@/design-system/components/layout/FilterBar.vue';
import GroupStatusTag from '@/components/common/GroupStatusTag.vue';
import { useGroupStore } from '@/stores/group';
import type { GroupInfo } from '@/types/group';

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
const error = computed(() => groupStore.error);
const searchKeyword = ref('');
const statusFilter = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

// 计算属性
const filteredGroups = computed(() => {
  let groups = groupStore.groupList;

  // 搜索过滤
  if (searchKeyword.value) {
    groups = groups.filter(group => 
      group.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      group.id.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchKeyword.value.toLowerCase()))
    );
  }

  // 状态过滤
  if (statusFilter.value) {
    groups = groups.filter(group => {
      switch (statusFilter.value) {
        case 'healthy':
          return group.isHealthy;
        case 'partial':
          return !group.isHealthy && group.healthScore > 0;
        case 'unhealthy':
          return !group.isHealthy && group.healthScore === 0;
        default:
          return true;
      }
    });
  }

  return groups;
});

const paginatedGroups = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredGroups.value.slice(start, end);
});

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: filteredGroups.value.length,
  showJumper: true,
  showSizeChanger: true,
  pageSizeOptions: [10, 20, 50, 100],
}));

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
    icon: 'success',
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

const columns = [
  {
    colKey: 'name',
    title: '组名称',
    width: 280,
    ellipsis: true,
    cell: 'name',
  },
  {
    colKey: 'serverCount',
    title: '服务器',
    width: 120,
    align: 'center',
    cell: 'serverCount',
  },
  {
    colKey: 'toolCount',
    title: '工具',
    width: 100,
    align: 'center',
  },
  {
    colKey: 'health',
    title: '健康状态',
    width: 150,
    align: 'center',
    cell: 'health',
  },
  {
    colKey: 'validation',
    title: '验证状态',
    width: 120,
    align: 'center',
    cell: 'validation',
  },
  {
    colKey: 'toolFilter',
    title: '工具过滤',
    width: 120,
    align: 'center',
    cell: 'toolFilter',
  },
  {
    colKey: 'operations',
    title: '操作',
    width: 200,
    align: 'center',
    fixed: 'right',
    cell: 'operations',
  },
];

// 方法定义
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

const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
};

const getDropdownOptions = (group: GroupInfo) => [
  {
    content: '查看健康检查',
    value: 'health',
    onClick: () => handleHealthCheck(group),
  },
  {
    content: '查看工具列表',
    value: 'tools',
    onClick: () => handleViewTools(group),
  },
  {
    content: '删除组',
    value: 'delete',
    theme: 'error',
    onClick: () => handleDeleteGroup(group),
  },
];

const handleHealthCheck = async (group: GroupInfo) => {
  try {
    const health = await groupStore.getGroupHealth(group.id);
    MessagePlugin.success(`组 "${group.name}" 健康状态: ${health.healthy ? '健康' : '不健康'}`);
  } catch (error) {
    MessagePlugin.error(`获取组健康状态失败: ${error}`);
  }
};

const handleViewTools = async (group: GroupInfo) => {
  try {
    const tools = await groupStore.getGroupTools(group.id);
    MessagePlugin.success(`组 "${group.name}" 包含 ${tools.totalTools} 个工具`);
  } catch (error) {
    MessagePlugin.error(`获取组工具列表失败: ${error}`);
  }
};

const handleDeleteGroup = async (group: GroupInfo) => {
  if (!confirm(`确定要删除组 "${group.name}" 吗？此操作不可撤销。`)) {
    return;
  }

  try {
    await groupStore.deleteGroup(group.id);
    MessagePlugin.success(`组 "${group.name}" 删除成功`);
  } catch (error) {
    MessagePlugin.error(`删除组失败: ${error}`);
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

.group-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.group-list__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.group-list__table-card {
  flex: 1;
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-header__actions {
  display: flex;
  gap: 12px;
}

.search-input {
  width: 200px;
}

.status-filter {
  width: 150px;
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

.health-score {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
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

.group-operations {
  display: flex;
  gap: 4px;
  justify-content: center;
}
</style>