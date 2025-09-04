<template>
  <div class="tool-list">
    <!-- 工具过滤和搜索栏 -->
    <div class="tool-filters">
      <t-row :gutter="16" align="middle">
        <t-col :span="6">
          <t-input
            v-model="searchText"
            placeholder="搜索工具名称或描述"
            clearable
            @change="handleSearch"
          >
            <template #prefix-icon>
              <search-icon />
            </template>
          </t-input>
        </t-col>
        
        <t-col :span="4">
          <t-select
            v-model="selectedServerId"
            placeholder="选择服务器"
            clearable
            @change="handleServerFilter"
          >
            <t-option value="" label="全部服务器" />
            <t-option
              v-for="serverId in serverList"
              :key="serverId"
              :value="serverId"
              :label="serverId"
            />
          </t-select>
        </t-col>

        <t-col :span="3">
          <t-select
            v-model="selectedStatus"
            placeholder="工具状态"
            @change="handleStatusFilter"
          >
            <t-option value="all" label="全部状态" />
            <t-option value="available" label="可用" />
            <t-option value="unavailable" label="不可用" />
          </t-select>
        </t-col>

        <t-col :span="3">
          <t-select
            v-model="sortBy"
            placeholder="排序方式"
            @change="handleSortChange"
          >
            <t-option value="name" label="按名称" />
            <t-option value="server" label="按服务器" />
            <t-option value="status" label="按状态" />
          </t-select>
        </t-col>

        <t-col :span="2">
          <t-button
            variant="outline"
            :icon="sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'"
            @click="toggleSortOrder"
          >
            {{ sortOrder === 'asc' ? '升序' : '降序' }}
          </t-button>
        </t-col>

        <t-col :span="6" class="tool-actions">
          <t-space>
            <t-button
              theme="primary"
              :loading="loading"
              @click="handleRefresh"
            >
              刷新
            </t-button>
            
            <t-button
              variant="outline"
              @click="handleResetFilters"
            >
              重置筛选
            </t-button>

            <t-dropdown
              :options="viewOptions"
              @click="handleViewChange"
            >
              <t-button variant="outline">
                {{ currentView === 'list' ? '列表视图' : '卡片视图' }}
                <chevron-down-icon />
              </t-button>
            </t-dropdown>
          </t-space>
        </t-col>
      </t-row>
    </div>

    <!-- 工具统计信息 -->
    <div class="tool-stats">
      <t-row :gutter="16">
        <t-col :span="6">
          <t-card size="small">
            <div class="stat-item">
              <div class="stat-value">{{ toolList.length }}</div>
              <div class="stat-label">总工具数</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card size="small">
            <div class="stat-item">
              <div class="stat-value text-success">{{ availableTools.length }}</div>
              <div class="stat-label">可用工具</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card size="small">
            <div class="stat-item">
              <div class="stat-value text-error">{{ unavailableTools.length }}</div>
              <div class="stat-label">不可用工具</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card size="small">
            <div class="stat-item">
              <div class="stat-value">{{ serverList.length }}</div>
              <div class="stat-label">服务器数</div>
            </div>
          </t-card>
        </t-col>
      </t-row>
    </div>

    <!-- 工具列表内容 -->
    <div class="tool-content">
      <t-loading :loading="loading" size="large">
        <!-- 列表视图 -->
        <div v-if="currentView === 'list'" class="tool-table">
          <t-table
            :data="filteredTools"
            :columns="tableColumns"
            :pagination="pagination"
            row-key="name"
            stripe
            hover
            @page-change="handlePageChange"
            @page-size-change="handlePageSizeChange"
          >
            <template #status="{ row }">
              <status-tag :status="row.status" />
            </template>

            <template #actions="{ row }">
              <t-space>
                <t-button
                  size="small"
                  theme="primary"
                  variant="text"
                  @click="handleViewDetail(row)"
                >
                  查看详情
                </t-button>
                
                <t-button
                  size="small"
                  theme="success"
                  variant="text"
                  :disabled="row.status !== 'available'"
                  @click="handleTestTool(row)"
                >
                  测试工具
                </t-button>

                <t-button
                  size="small"
                  theme="warning"
                  variant="text"
                  :disabled="row.status !== 'available'"
                  @click="handleExecuteTool(row)"
                >
                  执行工具
                </t-button>
              </t-space>
            </template>
          </t-table>
        </div>

        <!-- 卡片视图 -->
        <div v-else class="tool-cards">
          <t-row :gutter="16">
            <t-col
              v-for="tool in paginatedTools"
              :key="tool.name"
              :span="8"
              class="tool-card-col"
            >
              <t-card
                :title="tool.name"
                :subtitle="tool.serverId"
                hover
                class="tool-card"
                @click="handleViewDetail(tool)"
              >
                <template #actions>
                  <t-space>
                    <t-button
                      size="small"
                      theme="success"
                      variant="text"
                      :disabled="tool.status !== 'available'"
                      @click.stop="handleTestTool(tool)"
                    >
                      测试
                    </t-button>
                    
                    <t-button
                      size="small"
                      theme="primary"
                      variant="text"
                      :disabled="tool.status !== 'available'"
                      @click.stop="handleExecuteTool(tool)"
                    >
                      执行
                    </t-button>
                  </t-space>
                </template>

                <div class="tool-card-content">
                  <div class="tool-description">
                    {{ tool.description || '暂无描述' }}
                  </div>
                  
                  <div class="tool-meta">
                    <status-tag :status="tool.status" />
                    <t-tag size="small" variant="outline">
                      {{ tool.serverId }}
                    </t-tag>
                  </div>
                </div>
              </t-card>
            </t-col>
          </t-row>

          <!-- 卡片视图分页 -->
          <div class="card-pagination">
            <t-pagination
              v-model="pagination.current"
              :total="filteredTools.length"
              :page-size="pagination.pageSize"
              :page-size-options="pagination.pageSizeOptions"
              show-sizer
              show-jumper
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  SearchIcon,
  ChevronDownIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import type { ToolInfo } from '@/types/tool';

// 路由
const router = useRouter();

// Store
const toolStore = useToolStore();

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

// 计算属性
const { 
  toolList, 
  filteredTools, 
  availableTools, 
  unavailableTools, 
  serverList, 
  loading, 
  error,
  clearError 
} = toolStore;

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
const viewOptions = [
  { content: '列表视图', value: 'list' },
  { content: '卡片视图', value: 'card' },
];

// 事件处理
const handleSearch = () => {
  toolStore.updateFilters({ search: searchText.value });
  pagination.value.current = 1;
};

const handleServerFilter = () => {
  toolStore.updateFilters({ serverId: selectedServerId.value });
  pagination.value.current = 1;
};

const handleStatusFilter = () => {
  toolStore.updateFilters({ 
    status: selectedStatus.value as 'available' | 'unavailable' | 'all' 
  });
  pagination.value.current = 1;
};

const handleSortChange = () => {
  toolStore.updateFilters({ sortBy: sortBy.value as any });
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  toolStore.updateFilters({ sortOrder: sortOrder.value });
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
  toolStore.resetFilters();
  pagination.value.current = 1;
};

const handleViewChange = (option: any) => {
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

// 监听过滤条件变化
watch(
  () => toolStore.filters,
  (newFilters) => {
    searchText.value = newFilters.search || '';
    selectedServerId.value = newFilters.serverId || '';
    selectedStatus.value = newFilters.status || 'all';
    sortBy.value = newFilters.sortBy || 'name';
    sortOrder.value = newFilters.sortOrder || 'asc';
  },
  { deep: true }
);

// 组件挂载时加载数据
onMounted(async () => {
  try {
    await toolStore.fetchTools();
  } catch (err) {
    MessagePlugin.error('加载工具列表失败');
  }
});
</script>

<style scoped>
.tool-list {
  padding: 16px;
}

.tool-filters {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
}

.tool-actions {
  text-align: right;
}

.tool-stats {
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.text-success {
  color: var(--td-success-color);
}

.text-error {
  color: var(--td-error-color);
}

.tool-content {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: 16px;
}

.tool-table {
  min-height: 400px;
}

.tool-cards {
  min-height: 400px;
}

.tool-card-col {
  margin-bottom: 16px;
}

.tool-card {
  height: 200px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--td-shadow-3);
}

.tool-card-content {
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.tool-description {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.card-pagination {
  margin-top: 24px;
  text-align: center;
}
</style>