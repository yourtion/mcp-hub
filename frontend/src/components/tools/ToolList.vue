<template>
  <div class="tool-list">
    <!-- 页面头部 -->
    <ContentLayout
      title="工具列表"
      description="浏览和管理所有可用的 MCP 工具"
      :actions="[
        { text: '刷新', theme: 'default', variant: 'outline', icon: RefreshIcon, loading, onClick: handleRefresh }
      ]"
    >
      <!-- 视图切换器 -->
      <template #extra>
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
      </template>

      <!-- 工具统计卡片 -->
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

      <!-- 工具过滤和搜索栏 -->
      <t-card bordered class="filter-card">
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
                <SearchIcon />
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
              <t-option value="all">全部状态</t-option>
              <t-option value="available">可用</t-option>
              <t-option value="unavailable">不可用</t-option>
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
                <component :is="sortOrder === 'asc' ? ArrowUpIcon : ArrowDownIcon" />
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
                <RefreshIcon />
              </template>
              重置筛选
            </t-button>
          </t-col>
        </t-row>
      </t-card>

      <!-- 列表视图 -->
      <div v-if="currentView === 'list'" class="list-view">
        <DataTable
          :data="tableData"
          :columns="tableColumns"
          :loading="loading"
          :pagination="paginationConfig"
          :searchable="false"
          :selectable="false"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <!-- 工具名称 -->
          <template #name="{ row }">
            <div class="tool-name">
              <CodeIcon class="tool-name__icon" />
              <span class="tool-name__text">{{ row.name }}</span>
            </div>
          </template>

          <!-- 描述 -->
          <template #description="{ row }">
            <div class="tool-description">
              {{ row.description || '暂无描述' }}
            </div>
          </template>

          <!-- 服务器 -->
          <template #serverId="{ row }">
            <t-tag theme="primary" variant="light" size="medium">
              {{ row.serverId }}
            </t-tag>
          </template>

          <!-- 状态 -->
          <template #status="{ row }">
            <StatusIndicator :status="row.status" mode="tag" />
          </template>

          <!-- 操作 -->
          <template #actions="{ row }">
            <ActionGroup
              :actions="getToolActions(row)"
              :size="'small'"
              layout="horizontal"
              @action-click="() => {}"
            />
          </template>
        </DataTable>
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
              class="tool-card"
              @click="handleViewDetail(tool)"
            >
              <template #header>
                <div class="card-header">
                  <div class="tool-icon">
                    <CodeIcon size="20px" />
                  </div>
                  <div class="tool-info">
                    <div class="tool-title">{{ tool.name }}</div>
                    <div class="tool-server">
                      <ServerIcon size="14px" />
                      {{ tool.serverId }}
                    </div>
                  </div>
                  <StatusIndicator :status="tool.status" mode="tag" size="small" />
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
                        <PlayIcon />
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
                        <PlayCircleIcon />
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
        <div v-if="filteredTools.length > paginationConfig.pageSize" class="card-pagination">
          <t-pagination
            v-model="paginationConfig.current"
            :total="filteredTools.length"
            :page-size="paginationConfig.pageSize"
            :page-size-options="paginationConfig.pageSizeOptions"
            size="large"
            show-page-number
            show-page-size
            @change="handlePageChange"
            @page-size-change="handlePageSizeChange"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <EmptyPage
        v-if="!loading && filteredTools.length === 0"
        type="no-result"
        description="暂无符合条件的工具"
        :actions="[
          { text: '重置筛选条件', theme: 'primary', onClick: handleResetFilters }
        ]"
      />
    </ContentLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
  ChevronDownIcon,
  SearchIcon,
  RefreshIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CodeIcon,
  ServerIcon,
  PlayIcon,
  PlayCircleIcon,
  BrowseIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ContentLayout, StatCard, DataTable, ActionGroup, StatusIndicator, EmptyPage } from '@/design-system';
import type { Action } from '@/design-system';
import { useToolStore } from '@/stores/tool';
import type { ToolInfo } from '@/types/tool';
import type { DataTableColumn, DataTablePagination } from '@/design-system';

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
} = storeToRefs(toolStore);

// 方法直接从 store 解构（不需要响应式）
const {
  refresh,
} = toolStore;

// 响应式数据
const searchText = ref('');
const selectedServerId = ref('');
const selectedStatus = ref('all');
const sortBy = ref('name');
const sortOrder = ref<'asc' | 'desc'>('asc');
const currentView = ref<'list' | 'card'>('list');

// 分页配置
const paginationConfig = ref<DataTablePagination>({
  current: 1,
  pageSize: 20,
  total: 0,
  showJumper: true,
  showSizer: true,
  pageSizeOptions: [10, 20, 50, 100],
});

// 统计卡片
const statsCards = computed(() => [
  {
    key: 'total',
    value: toolList.value.length,
    label: '总工具数',
    icon: 'tool',
    theme: 'blue' as const,
  },
  {
    key: 'available',
    value: availableTools.value.length,
    label: '可用工具',
    icon: 'check-circle',
    theme: 'green' as const,
  },
  {
    key: 'unavailable',
    value: unavailableTools.value.length,
    label: '不可用工具',
    icon: 'error-circle',
    theme: 'orange' as const,
  },
  {
    key: 'servers',
    value: serverList.value.length,
    label: '服务器数',
    icon: 'server',
    theme: 'purple' as const,
  },
]);

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

// 表格数据（分页后）
const tableData = computed(() => {
  const start = (paginationConfig.value.current - 1) * paginationConfig.value.pageSize;
  const end = start + paginationConfig.value.pageSize;
  paginationConfig.value.total = filteredTools.value.length;
  return filteredTools.value.slice(start, end);
});

// 分页后的工具列表（用于卡片视图）
const paginatedTools = computed(() => {
  const start = (paginationConfig.value.current - 1) * paginationConfig.value.pageSize;
  const end = start + paginationConfig.value.pageSize;
  return filteredTools.value.slice(start, end);
});

// 表格列配置
const tableColumns: DataTableColumn[] = [
  {
    colKey: 'name',
    title: '工具名称',
    width: 200,
    fixed: 'left',
  },
  {
    colKey: 'description',
    title: '描述',
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
    align: 'center' as const,
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 200,
    align: 'center' as const,
    fixed: 'right',
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

// 获取工具操作
const getToolActions = (tool: ToolInfo): Action[] => [
  {
    key: 'detail',
    text: '详情',
    icon: BrowseIcon,
    theme: 'default',
    variant: 'text',
    priority: 'secondary',
    onClick: () => handleViewDetail(tool),
  },
  {
    key: 'test',
    text: '测试',
    icon: PlayIcon,
    theme: 'success',
    variant: 'text',
    priority: 'secondary',
    disabled: tool.status !== 'available',
    onClick: () => handleTestTool(tool),
  },
  {
    key: 'execute',
    text: '执行',
    icon: PlayCircleIcon,
    theme: 'default',
    variant: 'text',
    priority: 'secondary',
    disabled: tool.status !== 'available',
    onClick: () => handleExecuteTool(tool),
  },
];

// 事件处理
const handleSearch = () => {
  paginationConfig.value.current = 1;
};

const handleServerFilter = () => {
  paginationConfig.value.current = 1;
};

const handleStatusFilter = () => {
  paginationConfig.value.current = 1;
};

const handleSortChange = () => {
  paginationConfig.value.current = 1;
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  paginationConfig.value.current = 1;
};

const handleRefresh = async () => {
  try {
    await refresh();
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
  paginationConfig.value.current = 1;
};

const handleViewChange = (option: ViewOption) => {
  currentView.value = option.value;
};

const handlePageChange = (page: number) => {
  paginationConfig.value.current = page;
};

const handlePageSizeChange = (size: number) => {
  paginationConfig.value.pageSize = size;
  paginationConfig.value.current = 1;
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

<style lang="less" scoped>
@import '../../design-system/styles/mixins.less';
@import '../../design-system/tokens/spacing.less';

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: @spacing-lg;
  margin-bottom: @spacing-xl;
}

.filter-card {
  margin-bottom: @spacing-xl;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
}

.list-view {
  min-height: 400px;
}

.tool-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-name__icon {
  color: var(--td-brand-color);
}

.tool-name__text {
  font-weight: 600;
  color: var(--td-text-color-primary);
  font-size: 14px;
}

.tool-description {
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

.card-view {
  min-height: 400px;
}

.tool-card-col {
  margin-bottom: 12px;
}

.tool-card {
  height: 100%;
  border-radius: var(--td-radius-default);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid var(--td-component-border);
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--td-brand-color-light);
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

.card-pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--td-component-border);
}

// 响应式
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .tool-name__text {
    font-size: 13px;
  }

  .tool-description {
    font-size: 12px;
    max-width: 250px;
  }

  .tool-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}
</style>
