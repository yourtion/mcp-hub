<template>
  <div class="tool-list">
    <!-- 页面头部 -->
    <div class="page-header-section">
      <div class="header-title">
        <h1 class="page-title">工具列表</h1>
        <p class="page-description">浏览和管理所有可用的 MCP 工具</p>
      </div>
      <div class="header-actions">
        <t-space>
          <t-button
            variant="outline"
            :loading="loading"
            @click="handleRefresh"
          >
            <template #icon>
              <t-icon name="refresh" />
            </template>
            刷新
          </t-button>

          <t-dropdown
            :options="viewOptions"
            @click="handleViewChange"
          >
            <t-button variant="outline">
              <template #icon>
                <t-icon :name="currentView === 'list' ? 'view-list' : 'view-module'" />
              </template>
              {{ currentView === 'list' ? '列表视图' : '卡片视图' }}
              <template #suffix>
                <chevron-down-icon />
              </template>
            </t-button>
          </t-dropdown>
        </t-space>
      </div>
    </div>

    <!-- 工具统计卡片 -->
    <div class="stats-section">
      <t-row :gutter="12">
        <t-col :span="6">
          <div class="stat-card stat-primary">
            <div class="stat-icon">
              <t-icon name="layers" size="28px" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ toolList.length }}</div>
              <div class="stat-label">总工具数</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-success">
            <div class="stat-icon">
              <t-icon name="check-circle" size="28px" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ availableTools.length }}</div>
              <div class="stat-label">可用工具</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-warning">
            <div class="stat-icon">
              <t-icon name="close-circle" size="28px" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ unavailableTools.length }}</div>
              <div class="stat-label">不可用工具</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-info">
            <div class="stat-icon">
              <t-icon name="server" size="28px" />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ serverList.length }}</div>
              <div class="stat-label">服务器数</div>
            </div>
          </div>
        </t-col>
      </t-row>
    </div>

    <!-- 工具过滤和搜索栏 -->
    <div class="filter-section">
      <t-card bordered>
        <t-row :gutter="16" align="middle">
          <t-col :flex="'auto'">
            <t-input
              v-model="searchText"
              placeholder="搜索工具名称或描述..."
              clearable
              size="large"
              @change="handleSearch"
            >
              <template #prefix-icon>
                <t-icon name="search" />
              </template>
            </t-input>
          </t-col>

          <t-col :span="3">
            <t-select
              v-model="selectedServerId"
              placeholder="全部服务器"
              clearable
              filterable
              size="large"
              @change="handleServerFilter"
            >
              <t-option
                v-for="serverId in serverList"
                :key="serverId"
                :value="serverId"
                :label="serverId"
              >
                <template #prefix-icon>
                  <t-icon name="server" />
                </template>
                {{ serverId }}
              </t-option>
            </t-select>
          </t-col>

          <t-col :span="3">
            <t-select
              v-model="selectedStatus"
              placeholder="全部状态"
              size="large"
              @change="handleStatusFilter"
            >
              <t-option value="all">
                <template #prefix-icon>
                  <t-icon name="layers" />
                </template>
                全部状态
              </t-option>
              <t-option value="available">
                <template #prefix-icon>
                  <t-icon name="check-circle" />
                </template>
                可用
              </t-option>
              <t-option value="unavailable">
                <template #prefix-icon>
                  <t-icon name="close-circle" />
                </template>
                不可用
              </t-option>
            </t-select>
          </t-col>

          <t-col :span="2">
            <t-select
              v-model="sortBy"
              placeholder="排序"
              size="large"
              @change="handleSortChange"
            >
              <t-option value="name">名称</t-option>
              <t-option value="server">服务器</t-option>
              <t-option value="status">状态</t-option>
            </t-select>
          </t-col>

          <t-col :span="1">
            <t-button
              variant="outline"
              size="large"
              @click="toggleSortOrder"
            >
              <template #icon>
                <t-icon :name="sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'" />
              </template>
            </t-button>
          </t-col>

          <t-col :flex="'280px'" class="filter-actions">
            <t-button
              block
              variant="dashed"
              @click="handleResetFilters"
            >
              <template #icon>
                <t-icon name="refresh" />
              </template>
              重置筛选
            </t-button>
          </t-col>
        </t-row>
      </t-card>
    </div>

    <!-- 工具列表内容 -->
    <div class="content-section">
      <t-loading :loading="loading" size="large">
        <!-- 空状态 -->
        <div v-if="filteredTools.length === 0 && !loading" class="empty-state">
          <t-icon name="info-circle" size="64px" />
          <p class="empty-text">暂无符合条件的工具</p>
          <t-button theme="primary" variant="outline" @click="handleResetFilters">
            重置筛选条件
          </t-button>
        </div>

        <!-- 列表视图 -->
        <div v-else-if="currentView === 'list'" class="table-view">
          <t-table
            :data="filteredTools"
            :columns="tableColumns"
            :pagination="pagination"
            row-key="name"
            stripe
            hover
            size="large"
            @page-change="handlePageChange"
            @page-size-change="handlePageSizeChange"
          >
            <template #name="{ row }">
              <div class="tool-name-cell">
                <t-icon name="code" size="20px" />
                <span class="tool-name">{{ row.name }}</span>
              </div>
            </template>

            <template #description="{ row }">
              <div class="tool-description-cell">
                {{ row.description || '暂无描述' }}
              </div>
            </template>

            <template #serverId="{ row }">
              <t-tag theme="primary" variant="light" size="medium">
                <template #icon>
                  <t-icon name="server" />
                </template>
                {{ row.serverId }}
              </t-tag>
            </template>

            <template #status="{ row }">
              <status-tag :status="row.status" />
            </template>

            <template #actions="{ row }">
              <t-space break-line>
                <t-button
                  size="small"
                  theme="primary"
                  variant="text"
                  @click="handleViewDetail(row)"
                >
                  <template #icon>
                    <t-icon name="zoom-in" />
                  </template>
                  详情
                </t-button>

                <t-button
                  size="small"
                  theme="success"
                  variant="text"
                  :disabled="row.status !== 'available'"
                  @click="handleTestTool(row)"
                >
                  <template #icon>
                    <t-icon name="play-circle" />
                  </template>
                  测试
                </t-button>

                <t-button
                  size="small"
                  theme="default"
                  variant="text"
                  :disabled="row.status !== 'available'"
                  @click="handleExecuteTool(row)"
                >
                  <template #icon>
                    <t-icon name="play-circle-filled" />
                  </template>
                  执行
                </t-button>
              </t-space>
            </template>
          </t-table>
        </div>

        <!-- 卡片视图 -->
        <div v-else class="card-view">
          <t-row :gutter="16">
            <t-col
              v-for="tool in paginatedTools"
              :key="tool.name"
              :span="8"
              class="tool-card-col"
            >
              <t-card
                :bordered="true"
                :hover="true"
                class="tool-card-modern"
                @click="handleViewDetail(tool)"
              >
                <template #header>
                  <div class="card-header">
                    <div class="tool-icon">
                      <t-icon name="code" size="28px" />
                    </div>
                    <div class="tool-info">
                      <div class="tool-title">{{ tool.name }}</div>
                      <div class="tool-server">
                        <t-icon name="server" size="14px" />
                        {{ tool.serverId }}
                      </div>
                    </div>
                    <status-tag :status="tool.status" size="small" />
                  </div>
                </template>

                <div class="card-body">
                  <p class="tool-description">
                    {{ tool.description || '暂无描述信息' }}
                  </p>
                </div>

                <template #footer>
                  <div class="card-footer">
                    <t-space size="small">
                      <t-button
                        size="small"
                        theme="primary"
                        variant="outline"
                        :disabled="tool.status !== 'available'"
                        @click.stop="handleTestTool(tool)"
                      >
                        <template #icon>
                          <t-icon name="play-circle" />
                        </template>
                        测试
                      </t-button>

                      <t-button
                        size="small"
                        theme="success"
                        variant="outline"
                        :disabled="tool.status !== 'available'"
                        @click.stop="handleExecuteTool(tool)"
                      >
                        <template #icon>
                          <t-icon name="play-circle-filled" />
                        </template>
                        执行
                      </t-button>
                    </t-space>
                  </div>
                </template>
              </t-card>
            </t-col>
          </t-row>

          <!-- 卡片视图分页 -->
          <div v-if="filteredTools.length > pagination.pageSize" class="card-pagination-wrapper">
            <t-pagination
              v-model="pagination.current"
              :total="filteredTools.length"
              :page-size="pagination.pageSize"
              :page-size-options="pagination.pageSizeOptions"
              size="large"
              show-page-number
              show-page-size
              show-previous
              show-next
              @change="handlePageChange"
              @page-size-change="handlePageSizeChange"
            />
          </div>
        </div>
      </t-loading>
    </div>

    <!-- 错误提示 -->
    <t-message
      v-if="error"
      theme="error"
      :content="error"
      :duration="5000"
      @close="clearError"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import type { ToolInfo } from '@/types/tool';

// 路由
const router = useRouter();

// Store
const toolStore = useToolStore();

// 使用 storeToRefs 保持响应式状态
const {
  toolList,
  availableTools,
  unavailableTools,
  serverList,
  loading,
  error,
} = storeToRefs(toolStore);

// 方法直接从 store 解构（不需要响应式）
const {
  fetchTools,
  clearError,
} = toolStore;

// 响应式数据
const searchText = ref('');
const selectedServerId = ref('');
const selectedStatus = ref('all');
const sortBy = ref('name');
const sortOrder = ref<'asc' | 'desc'>('asc');
const currentView = ref<'list' | 'card'>('list');

// 分页配置
const pagination = ref({
  current: 1,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
});

// 过滤后的工具列表
const filteredTools = computed(() => {
  let tools = [...toolList.value];

  // 搜索过滤
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase();
    tools = tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(keyword) ||
        (tool.description && tool.description.toLowerCase().includes(keyword))
    );
  }

  // 服务器过滤
  if (selectedServerId.value) {
    tools = tools.filter((tool) => tool.serverId === selectedServerId.value);
  }

  // 状态过滤
  if (selectedStatus.value && selectedStatus.value !== 'all') {
    tools = tools.filter((tool) => tool.status === selectedStatus.value);
  }

  // 排序
  tools.sort((a, b) => {
    let comparison = 0;

    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'server':
        comparison = a.serverId.localeCompare(b.serverId);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }

    return sortOrder.value === 'asc' ? comparison : -comparison;
  });

  return tools;
});

// 分页后的工具列表（用于卡片视图）
const paginatedTools = computed(() => {
  const start = (pagination.value.current - 1) * pagination.value.pageSize;
  const end = start + pagination.value.pageSize;
  return filteredTools.value.slice(start, end);
});

// 表格列配置
const tableColumns = [
  {
    colKey: 'name',
    title: '工具名称',
    width: 200,
    ellipsis: true,
  },
  {
    colKey: 'description',
    title: '描述',
    ellipsis: true,
  },
  {
    colKey: 'serverId',
    title: '所属服务器',
    width: 150,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 100,
    cell: 'status',
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 200,
    cell: 'actions',
  },
];

// 视图选项
interface ViewOption {
  content: string;
  value: string;
}

const viewOptions: ViewOption[] = [
  { content: '列表视图', value: 'list' },
  { content: '卡片视图', value: 'card' },
];

// 事件处理
const handleSearch = () => {
  pagination.value.current = 1;
};

const handleServerFilter = () => {
  pagination.value.current = 1;
};

const handleStatusFilter = () => {
  pagination.value.current = 1;
};

const handleSortChange = () => {
  pagination.value.current = 1;
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  pagination.value.current = 1;
};

const handleRefresh = async () => {
  try {
    await toolStore.refresh();
    MessagePlugin.success('刷新成功');
  } catch (err) {
    MessagePlugin.error('刷新失败');
  }
};

const handleResetFilters = () => {
  searchText.value = '';
  selectedServerId.value = '';
  selectedStatus.value = 'all';
  sortBy.value = 'name';
  sortOrder.value = 'asc';
  pagination.value.current = 1;
};

const handleViewChange = (option: ViewOption) => {
  currentView.value = option.value;
};

const handlePageChange = (page: number) => {
  pagination.value.current = page;
};

const handlePageSizeChange = (size: number) => {
  pagination.value.pageSize = size;
  pagination.value.current = 1;
};

const handleViewDetail = (tool: ToolInfo) => {
  router.push({
    name: 'ToolDetail',
    params: { toolName: tool.name },
    query: { serverId: tool.serverId },
  });
};

const handleTestTool = (tool: ToolInfo) => {
  router.push({
    name: 'ToolTest',
    params: { toolName: tool.name },
    query: { serverId: tool.serverId },
  });
};

const handleExecuteTool = (tool: ToolInfo) => {
  router.push({
    name: 'ToolExecute',
    params: { toolName: tool.name },
    query: { serverId: tool.serverId },
  });
};

// 组件挂载时加载数据
onMounted(async () => {
  await toolStore.fetchTools();
});
</script>

<style scoped>
.tool-list {
  padding: 0;
  background-color: var(--td-bg-color-page);
}

/* 页面头部 */
.page-header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px 20px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.header-title {
  flex: 1;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  line-height: 1.2;
}

.page-description {
  margin: 0;
  font-size: 13px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}

.header-actions {
  flex-shrink: 0;
}

/* 统计卡片区域 */
.stats-section {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  height: 100%;
}

.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--td-radius-default);
  margin-right: 10px;
}

.stat-primary .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-success .stat-icon {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
  color: white;
}

.stat-warning .stat-icon {
  background: linear-gradient(135deg, #ffa69e 0%, #fdfbfb 100%);
  color: white;
}

.stat-info .stat-icon {
  background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 2px;
  background: linear-gradient(135deg, var(--td-text-color-primary) 0%, var(--td-text-color-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  font-weight: 500;
}

/* 过滤区域 */
.filter-section {
  margin-bottom: 16px;
}

.filter-section .t-card {
  border-radius: var(--td-radius-default);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.filter-section .t-card .t-card__body {
  padding: 16px;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
}

/* 内容区域 */
.content-section {
  min-height: 400px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--td-text-color-secondary);
}

.empty-state .t-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin-bottom: 16px;
}

/* 表格视图 */
.table-view {
  min-height: 300px;
}

.table-view :deep(.t-table) {
  font-size: 14px;
}

.table-view :deep(.t-table__thead th) {
  padding: 12px 16px;
  font-size: 13px;
  height: 48px;
}

.table-view :deep(.t-table__tbody td) {
  padding: 10px 16px;
  height: 56px;
}

.table-view :deep(.t-table__tr) {
  font-size: 14px;
}

.tool-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-name-cell .t-icon {
  color: var(--td-brand-color);
}

.tool-name {
  font-weight: 600;
  color: var(--td-text-color-primary);
  font-size: 14px;
}

.tool-description-cell {
  color: var(--td-text-color-secondary);
  font-size: 13px;
  line-height: 1.4;
  max-width: 350px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 卡片视图 */
.card-view {
  min-height: 300px;
}

.tool-card-col {
  margin-bottom: 12px;
}

.tool-card-modern {
  height: 100%;
  border-radius: var(--td-radius-default);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid var(--td-component-border);
}

.tool-card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--td-brand-color-light);
}

.tool-card-modern :deep(.t-card__header) {
  padding: 12px 16px;
}

.tool-card-modern :deep(.t-card__body) {
  padding: 0 16px 12px;
}

.tool-card-modern :deep(.t-card__footer) {
  padding: 10px 16px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.tool-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--td-brand-color-light) 0%, var(--td-brand-color) 100%);
  border-radius: var(--td-radius-default);
  color: white;
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-server {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.tool-server .t-icon {
  color: var(--td-brand-color);
}

.card-body {
  padding: 10px 0;
}

.tool-description {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 58px;
  max-height: 58px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--td-component-border);
}

.card-pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--td-component-border);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .page-header-section {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .stats-section :deep(.t-col) {
    margin-bottom: 0;
  }
}

@media (max-width: 768px) {
  .tool-list {
    padding: 0;
  }

  .page-header-section {
    padding: 12px 16px;
    margin-bottom: 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .page-description {
    font-size: 12px;
  }

  /* 统计卡片在移动端保持四个一行 */
  .stats-section {
    margin-bottom: 12px;
  }

  .stats-section :deep(.t-row) {
    margin-left: -6px;
    margin-right: -6px;
  }

  .stats-section :deep(.t-col) {
    padding-left: 6px;
    padding-right: 6px;
    margin-bottom: 0;
  }

  .stat-card {
    padding: 8px 10px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    margin-right: 8px;
  }

  .stat-icon :deep(.t-icon) {
    font-size: 20px !important;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }

  .filter-section {
    margin-bottom: 12px;
  }

  .filter-section .t-card .t-card__body {
    padding: 12px;
  }

  .content-section {
    padding: 12px 16px;
  }

  .table-view :deep(.t-table__thead th) {
    padding: 10px 12px;
    font-size: 12px;
    height: 44px;
  }

  .table-view :deep(.t-table__tbody td) {
    padding: 8px 12px;
    height: 52px;
  }

  .tool-name {
    font-size: 13px;
  }

  .tool-description-cell {
    font-size: 12px;
    max-width: 250px;
  }

  .tool-card-modern:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .card-pagination-wrapper {
    margin-top: 16px;
    padding-top: 12px;
  }
}
</style>