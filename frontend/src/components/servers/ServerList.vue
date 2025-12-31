<template>
  <ContentLayout
    title="MCP服务器管理"
    description="管理和监控MCP服务器的连接状态，查看可用工具"
    :actions="[
      { text: '刷新', theme: 'default', variant: 'outline', icon: RefreshIcon, loading, onClick: handleRefresh },
      { text: '添加服务器', theme: 'primary', icon: AddIcon, onClick: handleAddServer }
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
      :search-placeholder="'搜索服务器...'"
      :selectable="false"
      @search="handleSearch"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    >
      <!-- 服务器名称 -->
      <template #name="{ row }">
        <div class="server-name">
          <div class="server-name__main">{{ row.name }}</div>
          <div class="server-name__id">{{ row.id }}</div>
        </div>
      </template>

      <!-- 类型 -->
      <template #type="{ row }">
        <t-tag variant="light">{{ getTypeLabel(row.type) }}</t-tag>
      </template>

      <!-- 状态 -->
      <template #status="{ row }">
        <StatusIndicator :status="row.status" mode="tag" />
      </template>

      <!-- 工具数量 -->
      <template #toolCount="{ row }">
        <div class="tool-count">
          <ToolsIcon class="tool-count__icon" />
          <span>{{ row.toolCount }}</span>
        </div>
      </template>

      <!-- 最后连接 -->
      <template #lastConnected="{ row }">
        <div class="last-connected">
          {{ formatLastConnected(row.lastConnected) }}
        </div>
      </template>

      <!-- 操作 -->
      <template #actions="{ row }">
        <ActionGroup
          :actions="getServerActions(row)"
          :size="'small'"
          layout="horizontal"
          @action-click="handleActionClick(row, $event)"
        />
      </template>
    </DataTable>

    <!-- 服务器详情抽屉 -->
    <t-drawer
      v-model:visible="detailDrawerVisible"
      :header="selectedServer ? `服务器详情 - ${selectedServer.name}` : '服务器详情'"
      size="large"
      :footer="false"
    >
      <ServerDetail
        v-if="selectedServer"
        :server="selectedServer"
        @close="detailDrawerVisible = false"
        @refresh="handleRefreshServer"
      />
    </t-drawer>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:visible="deleteDialogVisible"
      title="确认删除"
      type="danger"
      :confirm-text="'删除'"
      :cancel-text="'取消'"
      :async-confirm="true"
      @confirm="handleConfirmDelete"
    >
      <p>
        确定要删除服务器 <strong>{{ serverToDelete?.name }}</strong> 吗？
      </p>
      <p class="delete-warning">
        此操作不可撤销，删除后该服务器的所有配置将丢失。
      </p>
    </ConfirmDialog>
  </ContentLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  AddIcon,
  BrowseIcon,
  LinkIcon,
  LinkUnlinkIcon,
  ToolsIcon,
  EditIcon,
  DeleteIcon,
} from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import { ContentLayout, StatCard, DataTable, StatusIndicator, ConfirmDialog } from '@/design-system';
import type { Action } from '@/design-system';
import ServerDetail from './ServerDetail.vue';
import type { ServerInfo, ServerStatus, ServerType } from '@/types/server';
import type { DataTableColumn, DataTablePagination } from '@/design-system';

// 组件事件
const emit = defineEmits<{
  addServer: [];
  editServer: [server: ServerInfo];
}>();

// 状态管理
const serverStore = useServerStore();

// 使用 storeToRefs 保持响应式状态
const {
  serverList,
  loading,
  error,
  summary,
} = storeToRefs(serverStore);

// 方法直接从 store 解构（不需要响应式）
const {
  fetchServers,
  connectServer,
  disconnectServer,
  deleteServer,
  refreshServerStatus,
  clearError,
} = serverStore;

// 本地状态
const searchKeyword = ref('');
const detailDrawerVisible = ref(false);
const selectedServer = ref<ServerInfo | null>(null);
const deleteDialogVisible = ref(false);
const serverToDelete = ref<ServerInfo | null>(null);

// 分页配置
const paginationConfig = ref<DataTablePagination>({
  current: 1,
  pageSize: 10,
  total: 0,
  showJumper: true,
  showSizer: true,
  pageSizeOptions: [10, 20, 50, 100],
});

// 定时刷新
let refreshTimer: NodeJS.Timeout | null = null;

// 统计卡片数据
const statsCards = computed(() => [
  {
    key: 'total',
    label: '总服务器',
    value: summary.value.total,
    icon: 'server',
    theme: 'blue' as const,
  },
  {
    key: 'connected',
    label: '已连接',
    value: summary.value.connected,
    icon: 'check-circle',
    theme: 'green' as const,
  },
  {
    key: 'disconnected',
    label: '未连接',
    value: summary.value.disconnected,
    icon: 'close-circle',
    theme: 'orange' as const,
  },
  {
    key: 'error',
    label: '错误',
    value: summary.value.error,
    icon: 'error-circle',
    theme: 'red' as const,
  },
]);

// 表格数据（已过滤和分页）
const tableData = computed(() => {
  let filtered = serverList.value;

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(server =>
      server.name.toLowerCase().includes(keyword) ||
      server.id.toLowerCase().includes(keyword)
    );
  }

  // 更新分页总数
  paginationConfig.value.total = filtered.length;

  // 分页
  const start = (paginationConfig.value.current - 1) * paginationConfig.value.pageSize;
  const end = start + paginationConfig.value.pageSize;
  return filtered.slice(start, end);
});

// 表格列配置
const tableColumns: DataTableColumn[] = [
  {
    colKey: 'name',
    title: '服务器名称',
    width: 200,
    fixed: 'left',
  },
  {
    colKey: 'type',
    title: '类型',
    width: 100,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
  },
  {
    colKey: 'toolCount',
    title: '工具数量',
    width: 100,
  },
  {
    colKey: 'lastConnected',
    title: '最后连接',
    width: 160,
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 150,
    fixed: 'right',
  },
];

// 工具函数
const getTypeLabel = (type: ServerType): string => {
  const labels = {
    stdio: 'Stdio',
    sse: 'SSE',
    websocket: 'WebSocket',
  };
  return labels[type] || type;
};

const formatLastConnected = (lastConnected?: string): string => {
  if (!lastConnected) return '从未连接';

  const date = new Date(lastConnected);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getServerActions = (server: ServerInfo): Action[] => {
  const actions: Action[] = [
    {
      key: 'view',
      text: '查看',
      icon: BrowseIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => handleViewServer(server),
    },
    {
      key: 'connect',
      text: server.status === 'connected' ? '断开' : '连接',
      icon: server.status === 'connected' ? LinkUnlinkIcon : LinkIcon,
      theme: server.status === 'connected' ? 'danger' : 'success',
      variant: 'text',
      priority: 'secondary',
      loading: server.status === 'connecting',
      disabled: server.status === 'connecting',
      onClick: () => handleToggleConnection(server),
    },
    {
      key: 'edit',
      text: '编辑',
      icon: EditIcon,
      theme: 'default',
      variant: 'text',
      priority: 'secondary',
      onClick: () => emit('editServer', server),
    },
    {
      key: 'delete',
      text: '删除',
      icon: DeleteIcon,
      theme: 'danger',
      variant: 'text',
      priority: 'danger',
      confirm: {
        type: 'danger',
        content: '确定要删除此服务器吗？',
      },
      onClick: () => handleDeleteServer(server),
    },
  ];

  return actions;
};

// 事件处理
const handleSearch = (keyword: string) => {
  searchKeyword.value = keyword;
  paginationConfig.value.current = 1;
};

const handleRefresh = async () => {
  try {
    await fetchServers();
    MessagePlugin.success('刷新成功');
  } catch (err) {
    MessagePlugin.error('刷新失败');
  }
};

const handleAddServer = () => {
  emit('addServer');
};

const handleViewServer = (server: ServerInfo) => {
  selectedServer.value = server;
  detailDrawerVisible.value = true;
};

const handleRefreshServer = async (serverId: string) => {
  try {
    await refreshServerStatus(serverId);
    // 如果当前查看的是这个服务器，更新详情
    if (selectedServer.value?.id === serverId) {
      selectedServer.value = serverList.value.find(s => s.id === serverId) || null;
    }
  } catch (err) {
    console.error('刷新服务器状态失败:', err);
  }
};

const handleToggleConnection = async (server: ServerInfo) => {
  try {
    if (server.status === 'connected') {
      await disconnectServer(server.id);
      MessagePlugin.success(`服务器 ${server.name} 已断开连接`);
    } else {
      await connectServer(server.id);
      MessagePlugin.success(`服务器 ${server.name} 连接请求已发送`);
    }
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '操作失败');
  }
};

const handleDeleteServer = (server: ServerInfo) => {
  serverToDelete.value = server;
  deleteDialogVisible.value = true;
};

const handleActionClick = (server: ServerInfo, action: Action) => {
  // Action 的 onClick 已经在 getServerActions 中定义
  // 这里可以添加额外的处理逻辑
};

const handleConfirmDelete = async () => {
  if (!serverToDelete.value) return;

  try {
    await deleteServer(serverToDelete.value.id);
    MessagePlugin.success(`服务器 ${serverToDelete.value.name} 删除成功`);
    deleteDialogVisible.value = false;
    serverToDelete.value = null;
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '删除失败');
  }
};

const handlePageChange = (current: number) => {
  paginationConfig.value.current = current;
};

const handlePageSizeChange = (pageSize: number) => {
  paginationConfig.value.pageSize = pageSize;
  paginationConfig.value.current = 1;
};

// 生命周期
onMounted(async () => {
  // 初始加载
  await fetchServers();

  // 设置定时刷新
  refreshTimer = setInterval(() => {
    // 静默刷新服务器状态
    serverList.value.forEach(server => {
      refreshServerStatus(server.id);
    });
  }, 30000); // 30秒刷新一次

  // 清除错误
  if (error.value) {
    clearError();
  }
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
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

.server-name__main {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.server-name__id {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-top: 2px;
}

.tool-count {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--td-text-color-secondary);
}

.tool-count__icon {
  font-size: 14px;
}

.last-connected {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.delete-warning {
  color: var(--td-warning-color);
  font-size: 13px;
  margin-top: 8px;
  margin-bottom: 0;
}

// 响应式
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
