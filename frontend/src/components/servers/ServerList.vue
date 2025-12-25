<template>
  <div class="server-list">
    <!-- 页面头部 -->
    <div class="server-list__header">
      <div class="server-list__title">
        <h2>MCP服务器管理</h2>
        <p class="server-list__description">
          管理和监控MCP服务器的连接状态，查看可用工具
        </p>
      </div>
      <div class="server-list__actions">
        <t-button 
          theme="default" 
          variant="outline"
          :loading="loading"
          @click="handleRefresh"
        >
          <template #icon>
            <RefreshIcon />
          </template>
          刷新
        </t-button>
        <t-button 
          theme="primary"
          @click="handleAddServer"
        >
          <template #icon>
            <AddIcon />
          </template>
          添加服务器
        </t-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="server-list__stats">
      <t-card 
        v-for="stat in statsCards" 
        :key="stat.key"
        :class="['stat-card', `stat-card--${stat.key}`]"
        hover
      >
        <div class="stat-card__content">
          <div class="stat-card__icon">
            <component :is="stat.icon" />
          </div>
          <div class="stat-card__info">
            <div class="stat-card__value">{{ stat.value }}</div>
            <div class="stat-card__label">{{ stat.label }}</div>
          </div>
        </div>
      </t-card>
    </div>

    <!-- 服务器表格 -->
    <t-card class="server-list__table-card">
      <template #header>
        <div class="table-header">
          <h3>服务器列表</h3>
          <div class="table-header__actions">
            <t-input
              v-model="searchKeyword"
              placeholder="搜索服务器..."
              clearable
              class="search-input"
            >
              <template #prefix-icon>
                <SearchIcon />
              </template>
            </t-input>
            <t-select
              v-model="statusFilter"
              placeholder="状态筛选"
              clearable
              class="status-filter"
            >
              <t-option value="connected" label="已连接" />
              <t-option value="disconnected" label="未连接" />
              <t-option value="connecting" label="连接中" />
              <t-option value="error" label="错误" />
            </t-select>
          </div>
        </div>
      </template>

      <t-table
        :data="filteredServers"
        :columns="columns"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        stripe
        hover
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      >
        <!-- 服务器名称列 -->
        <template #name="{ row }">
          <div class="server-name">
            <div class="server-name__main">{{ row.name }}</div>
            <div class="server-name__id">{{ row.id }}</div>
          </div>
        </template>

        <!-- 类型列 -->
        <template #type="{ row }">
          <t-tag variant="light">{{ getTypeLabel(row.type) }}</t-tag>
        </template>

        <!-- 状态列 -->
        <template #status="{ row }">
          <StatusTag :status="row.status" />
        </template>

        <!-- 工具数量列 -->
        <template #toolCount="{ row }">
          <div class="tool-count">
            <ToolsIcon class="tool-count__icon" />
            <span>{{ row.toolCount }}</span>
          </div>
        </template>

        <!-- 最后连接时间列 -->
        <template #lastConnected="{ row }">
          <div class="last-connected">
            {{ formatLastConnected(row.lastConnected) }}
          </div>
        </template>

        <!-- 操作列 -->
        <template #actions="{ row }">
          <div class="server-actions">
            <t-tooltip content="查看详情">
              <t-button
                theme="default"
                variant="text"
                size="small"
                @click="handleViewServer(row)"
              >
                <BrowseIcon />
              </t-button>
            </t-tooltip>

            <t-tooltip :content="getConnectionActionTooltip(row.status)">
              <t-button
                :theme="getConnectionActionTheme(row.status)"
                variant="text"
                size="small"
                :loading="row.status === 'connecting'"
                :disabled="row.status === 'connecting'"
                @click="handleToggleConnection(row)"
              >
                <component :is="getConnectionActionIcon(row.status)" />
              </t-button>
            </t-tooltip>

            <t-dropdown
              :options="getDropdownOptions(row)"
              @click="handleDropdownAction"
            >
              <t-button
                theme="default"
                variant="text"
                size="small"
              >
                <MoreIcon />
              </t-button>
            </t-dropdown>
          </div>
        </template>
      </t-table>
    </t-card>

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
    <t-dialog
      v-model:visible="deleteDialogVisible"
      header="确认删除"
      :confirm-btn="{ content: '删除', theme: 'danger', loading: deleteLoading }"
      @confirm="handleConfirmDelete"
      @cancel="deleteDialogVisible = false"
    >
      <p>
        确定要删除服务器 <strong>{{ serverToDelete?.name }}</strong> 吗？
      </p>
      <p class="delete-warning">
        此操作不可撤销，删除后该服务器的所有配置将丢失。
      </p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  AddIcon,
  SearchIcon,
  BrowseIcon,
  LinkIcon,
  LinkUnlinkIcon,
  MoreIcon,
  ToolsIcon,
  ServerIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  ErrorCircleIcon,
  EditIcon,
  DeleteIcon,
} from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import StatusTag from '@/components/common/StatusTag.vue';
import ServerDetail from './ServerDetail.vue';
import type { ServerInfo, ServerStatus, ServerType } from '@/types/server';
import type { TableColumns, PaginationProps } from 'tdesign-vue-next';

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
const statusFilter = ref<ServerStatus | ''>('');
const detailDrawerVisible = ref(false);
const selectedServer = ref<ServerInfo | null>(null);
const deleteDialogVisible = ref(false);
const serverToDelete = ref<ServerInfo | null>(null);
const deleteLoading = ref(false);

// 分页配置
const pagination = ref<PaginationProps>({
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
    icon: ServerIcon,
  },
  {
    key: 'connected',
    label: '已连接',
    value: summary.value.connected,
    icon: CheckCircleIcon,
  },
  {
    key: 'disconnected',
    label: '未连接',
    value: summary.value.disconnected,
    icon: CloseCircleIcon,
  },
  {
    key: 'error',
    label: '错误',
    value: summary.value.error,
    icon: ErrorCircleIcon,
  },
]);

// 过滤后的服务器列表
const filteredServers = computed(() => {
  let filtered = serverList.value;

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(server => 
      server.name.toLowerCase().includes(keyword) ||
      server.id.toLowerCase().includes(keyword)
    );
  }

  // 状态筛选
  if (statusFilter.value) {
    filtered = filtered.filter(server => server.status === statusFilter.value);
  }

  // 更新分页总数
  pagination.value.total = filtered.length;

  // 分页
  const start = (pagination.value.current - 1) * pagination.value.pageSize;
  const end = start + pagination.value.pageSize;
  return filtered.slice(start, end);
});

// 表格列配置
const columns: TableColumns = [
  {
    colKey: 'name',
    title: '服务器名称',
    width: 200,
    fixed: 'left',
    cell: 'name',
  },
  {
    colKey: 'type',
    title: '类型',
    width: 100,
    cell: 'type',
  },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
    cell: 'status',
  },
  {
    colKey: 'toolCount',
    title: '工具数量',
    width: 100,
    cell: 'toolCount',
  },
  {
    colKey: 'lastConnected',
    title: '最后连接',
    width: 160,
    cell: 'lastConnected',
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 150,
    fixed: 'right',
    cell: 'actions',
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

const getConnectionActionTooltip = (status: ServerStatus): string => {
  return status === 'connected' ? '断开连接' : '连接服务器';
};

const getConnectionActionTheme = (status: ServerStatus): string => {
  return status === 'connected' ? 'danger' : 'success';
};

const getConnectionActionIcon = (status: ServerStatus) => {
  return markRaw(status === 'connected' ? LinkUnlinkIcon : LinkIcon);
};

const getDropdownOptions = (server: ServerInfo) => [
  {
    content: '编辑配置',
    value: `edit-${server.id}`,
    prefixIcon: markRaw(EditIcon),
  },
  {
    content: '删除服务器',
    value: `delete-${server.id}`,
    prefixIcon: markRaw(DeleteIcon),
    theme: 'danger',
  },
];

// 事件处理
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

const handleDropdownAction = ({ value }: { value: string }) => {
  const [action, serverId] = value.split('-');
  const server = serverList.value.find(s => s.id === serverId);
  
  if (!server) return;
  
  switch (action) {
    case 'edit':
      emit('editServer', server);
      break;
    case 'delete':
      serverToDelete.value = server;
      deleteDialogVisible.value = true;
      break;
  }
};

const handleConfirmDelete = async () => {
  if (!serverToDelete.value) return;
  
  try {
    deleteLoading.value = true;
    await deleteServer(serverToDelete.value.id);
    MessagePlugin.success(`服务器 ${serverToDelete.value.name} 删除成功`);
    deleteDialogVisible.value = false;
    serverToDelete.value = null;
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '删除失败');
  } finally {
    deleteLoading.value = false;
  }
};

const handlePageChange = (current: number) => {
  pagination.value.current = current;
};

const handlePageSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize;
  pagination.value.current = 1;
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

<style scoped>
.server-list {
  padding: 24px;
  background-color: var(--td-bg-color-page);
  min-height: 100vh;
}

.server-list__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.server-list__title h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.server-list__description {
  margin: 0;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.server-list__actions {
  display: flex;
  gap: 12px;
}

.server-list__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  border: none;
}

.stat-card__content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-card--total .stat-card__icon {
  background-color: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.stat-card--connected .stat-card__icon {
  background-color: var(--td-success-color-1);
  color: var(--td-success-color);
}

.stat-card--disconnected .stat-card__icon {
  background-color: var(--td-gray-color-1);
  color: var(--td-gray-color-6);
}

.stat-card--error .stat-card__icon {
  background-color: var(--td-error-color-1);
  color: var(--td-error-color);
}

.stat-card__info {
  flex: 1;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-card__label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.server-list__table-card {
  border: none;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.table-header__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 240px;
}

.status-filter {
  width: 120px;
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

.server-actions {
  display: flex;
  gap: 4px;
}

.delete-warning {
  color: var(--td-warning-color);
  font-size: 13px;
  margin-top: 8px;
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .server-list {
    padding: 16px;
  }
  
  .server-list__header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .server-list__actions {
    justify-content: flex-end;
  }
  
  .server-list__stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .table-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .table-header__actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .search-input,
  .status-filter {
    width: 100%;
  }
}
</style>