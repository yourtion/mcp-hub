<template>
  <ContentLayout
    title="API配置管理"
    description="管理和配置 API 到 MCP 工具的转换"
    :actions="headerActions"
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

    <!-- 搜索和过滤 -->
    <t-card class="filter-card" bordered>
      <t-row :gutter="16" align="center">
        <t-col :span="8">
          <t-input
            v-model="searchQuery"
            placeholder="搜索配置名称或描述"
            clearable
            @change="handleSearch"
          >
            <template #prefix-icon><SearchIcon /></template>
          </t-input>
        </t-col>
        <t-col :span="4">
          <t-select
            v-model="statusFilter"
            placeholder="全部状态"
            clearable
            @change="handleSearch"
          >
            <t-option value="active">
              <div class="filter-option">
                <t-tag variant="success" size="small">活跃</t-tag>
              </div>
            </t-option>
            <t-option value="inactive">
              <div class="filter-option">
                <t-tag variant="warning" size="small">非活跃</t-tag>
              </div>
            </t-option>
            <t-option value="error">
              <div class="filter-option">
                <t-tag variant="error" size="small">错误</t-tag>
              </div>
            </t-option>
          </t-select>
        </t-col>
        <t-col :span="4">
          <t-select
            v-model="methodFilter"
            placeholder="HTTP方法"
            clearable
            @change="handleSearch"
          >
            <t-option value="GET">
              <t-tag theme="primary" size="small">GET</t-tag>
            </t-option>
            <t-option value="POST">
              <t-tag theme="success" size="small">POST</t-tag>
            </t-option>
            <t-option value="PUT">
              <t-tag theme="warning" size="small">PUT</t-tag>
            </t-option>
            <t-option value="DELETE">
              <t-tag theme="danger" size="small">DELETE</t-tag>
            </t-option>
          </t-select>
        </t-col>
        <t-col :span="4">
          <t-button
            variant="outline"
            block
            @click="handleRefresh"
          >
            <template #icon><RefreshIcon /></template>
            刷新
          </t-button>
        </t-col>
      </t-row>
    </t-card>

    <!-- 配置列表 -->
    <DataTable
      :data="tableData"
      :columns="tableColumns"
      :loading="loading"
      :pagination="paginationConfig"
      :selectable="true"
      :selected-row-keys="selectedConfigs"
      @search="handleSearch"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
      @select-change="handleSelectionChange"
    >
      <!-- 状态 -->
      <template #status="{ row }">
        <StatusIndicator :status="row.status" mode="tag" />
      </template>

      <!-- API端点 -->
      <template #api="{ row }">
        <div class="api-info">
          <t-tag :theme="getMethodTheme(row.api.method)" size="small" class="api-method">
            {{ row.api.method }}
          </t-tag>
          <div class="api-url">{{ row.api.url }}</div>
        </div>
      </template>

      <!-- 更新时间 -->
      <template #lastUpdated="{ row }">
        <div class="time-info">
          <div class="time-relative">{{ formatTimeRelative(row.lastUpdated) }}</div>
          <div class="time-absolute">{{ formatTime(row.lastUpdated) }}</div>
        </div>
      </template>

      <!-- 操作 -->
      <template #actions="{ row }">
        <ActionGroup
          :actions="getConfigActions(row)"
          :size="'small'"
          layout="horizontal"
          @action-click="() => {}"
        />
      </template>
    </DataTable>

    <!-- 空状态 -->
    <EmptyPage
      v-if="!loading && configs.length === 0"
      type="no-data"
      description="暂无配置，点击上方新建配置按钮创建"
    />

    <!-- 配置表单对话框 -->
    <api-config-form-dialog
      v-model:visible="showFormDialog"
      :config="currentConfig"
      @submit="handleFormSubmit"
    />

    <!-- 导入对话框 -->
    <api-import-dialog
      v-model:visible="showImportDialog"
      @submit="handleImportSubmit"
    />

    <!-- 导出对话框 -->
    <api-export-dialog
      v-model:visible="showExportDialog"
      :configs="configs"
      @submit="handleExportSubmit"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-model:visible="deleteDialogVisible"
      :title="deleteDialogTitle"
      :confirm-text="'删除'"
      :cancel-text="'取消'"
      type="danger"
      :async-confirm="true"
      @confirm="handleConfirmDelete"
    >
      <p>{{ deleteDialogMessage }}</p>
    </ConfirmDialog>
  </ContentLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  DeleteIcon,
  UploadIcon,
  DownloadIcon,
  AddIcon,
  SearchIcon,
  BrowseIcon,
  EditIcon,
  PlayIcon,
  RefreshIcon,
} from 'tdesign-icons-vue-next';
import { ContentLayout, StatCard, DataTable, ActionGroup, StatusIndicator, EmptyPage, ConfirmDialog } from '@/design-system';
import type { Action } from '@/design-system';
import type { DataTableColumn, DataTablePagination } from '@/design-system';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiConfigInfo, ApiToolConfig } from '@/types/api-to-mcp';
import ApiConfigFormDialog from './ApiConfigFormDialog.vue';
import ApiImportDialog from './ApiImportDialog.vue';
import ApiExportDialog from './ApiExportDialog.vue';

const loading = ref(false);
const configs = ref<ApiConfigInfo[]>([]);
const selectedConfigs = ref<string[]>([]);
const searchQuery = ref('');
const statusFilter = ref('');
const methodFilter = ref('');

const stats = reactive({
  totalConfigs: 0,
  activeConfigs: 0,
  totalTools: 0,
  lastUpdated: '',
});

const showFormDialog = ref(false);
const showImportDialog = ref(false);
const showExportDialog = ref(false);
const deleteDialogVisible = ref(false);
const configToDelete = ref<ApiConfigInfo | null>(null);

const currentConfig = ref<ApiToolConfig | undefined>();

// 分页配置
const paginationConfig = ref<DataTablePagination>({
  current: 1,
  pageSize: 10,
  total: 0,
  showJumper: true,
  showSizer: true,
  pageSizeOptions: [10, 20, 50, 100],
});

// 统计卡片
const statsCards = computed(() => [
  {
    key: 'total',
    value: stats.totalConfigs,
    label: '总配置数',
    icon: 'server',
    theme: 'blue' as const,
  },
  {
    key: 'active',
    value: stats.activeConfigs,
    label: '活跃配置',
    icon: 'success',
    theme: 'green' as const,
  },
  {
    key: 'tools',
    value: stats.totalTools,
    label: '生成的工具',
    icon: 'tools',
    theme: 'orange' as const,
  },
  {
    key: 'updated',
    value: formatTimeShort(stats.lastUpdated),
    label: '最后更新',
    icon: 'server',
    theme: 'purple' as const,
  },
]);

// 头部操作按钮
const headerActions = computed(() => [
  {
    text: '批量删除',
    theme: 'danger' as const,
    variant: 'outline' as const,
    icon: DeleteIcon,
    onClick: handleBatchDelete,
    show: selectedConfigs.value.length > 0,
  },
  {
    text: '导入',
    theme: 'default' as const,
    variant: 'outline' as const,
    icon: UploadIcon,
    onClick: handleImport,
  },
  {
    text: '导出',
    theme: 'default' as const,
    variant: 'outline' as const,
    icon: DownloadIcon,
    onClick: handleExport,
    show: configs.value.length > 0,
  },
  {
    text: '新建配置',
    theme: 'primary' as const,
    icon: AddIcon,
    onClick: handleCreate,
  },
].filter((action) => action.show !== false) as Action[]);

// 过滤后的配置列表
const filteredConfigs = computed(() => {
  return configs.value.filter((config) => {
    const matchesSearch = !searchQuery.value ||
      config.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesStatus = !statusFilter.value || config.status === statusFilter.value;
    const matchesMethod = !methodFilter.value || config.api.method === methodFilter.value;

    return matchesSearch && matchesStatus && matchesMethod;
  });
});

// 表格数据（分页后）
const tableData = computed(() => {
  const start = (paginationConfig.value.current - 1) * paginationConfig.value.pageSize;
  const end = start + paginationConfig.value.pageSize;
  paginationConfig.value.total = filteredConfigs.value.length;
  return filteredConfigs.value.slice(start, end);
});

// 表格列配置
const tableColumns: DataTableColumn[] = [
  {
    colKey: 'name',
    title: '配置名称',
    width: 200,
    fixed: 'left',
  },
  {
    colKey: 'description',
    title: '描述',
    width: 250,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
    align: 'center' as const,
  },
  {
    colKey: 'api',
    title: 'API端点',
  },
  {
    colKey: 'toolsGenerated',
    title: '工具',
    width: 80,
    align: 'center' as const,
  },
  {
    colKey: 'lastUpdated',
    title: '更新时间',
    width: 160,
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 180,
    align: 'center' as const,
    fixed: 'right',
  },
];

// 删除对话框标题
const deleteDialogTitle = computed(() => {
  if (!configToDelete.value) return '确认删除';
  return configToDelete.value === selectedConfigs.value ? '确认批量删除' : '确认删除';
});

// 删除对话框消息
const deleteDialogMessage = computed(() => {
  if (selectedConfigs.value.length > 0) {
    return `确定要删除选中的 ${selectedConfigs.value.length} 个配置吗？此操作不可撤销。`;
  }
  if (configToDelete.value) {
    return `确定要删除配置 "${configToDelete.value.name}" 吗？此操作不可撤销。`;
  }
  return '';
});

// 获取配置操作
const getConfigActions = (config: ApiConfigInfo): Action[] => [
  {
    key: 'view',
    text: '查看',
    icon: BrowseIcon,
    theme: 'default',
    variant: 'text',
    priority: 'secondary',
    onClick: () => handleView(config),
  },
  {
    key: 'edit',
    text: '编辑',
    icon: EditIcon,
    theme: 'default',
    variant: 'text',
    priority: 'secondary',
    onClick: () => handleEdit(config),
  },
  {
    key: 'test',
    text: '测试',
    icon: PlayIcon,
    theme: 'default',
    variant: 'text',
    priority: 'secondary',
    onClick: () => handleTest(config),
  },
  {
    key: 'delete',
    text: '删除',
    theme: 'danger',
    variant: 'text',
    priority: 'danger',
    onClick: () => handleDeleteClick(config),
  },
];

// 获取方法主题
const getMethodTheme = (method: string) => {
  switch (method) {
    case 'GET':
      return 'primary';
    case 'POST':
      return 'success';
    case 'PUT':
      return 'warning';
    case 'DELETE':
      return 'danger';
    default:
      return 'default';
  }
};

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
};

// 格式化短时间（仅日期）
const formatTimeShort = (time: string) => {
  if (!time) return '-';
  const date = new Date(time);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 格式化相对时间
const formatTimeRelative = (time: string) => {
  if (!time) return '-';
  const date = new Date(time);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatTime(time);
};

// 搜索处理
const handleSearch = () => {
  paginationConfig.value.current = 1;
};

// 分页变更处理
const handlePageChange = (page: number) => {
  paginationConfig.value.current = page;
};

// 分页大小变更处理
const handlePageSizeChange = (pageSize: number) => {
  paginationConfig.value.pageSize = pageSize;
  paginationConfig.value.current = 1;
};

// 选择变更处理
const handleSelectionChange = (selectedKeys: string[]) => {
  selectedConfigs.value = selectedKeys;
};

// 加载配置列表
const loadConfigs = async () => {
  try {
    loading.value = true;
    const response = await apiToMcpService.getConfigs();
    configs.value = response.configs;

    // 加载统计信息
    loadStats();
  } catch (error) {
    MessagePlugin.error('加载配置列表失败');
    console.error('加载配置列表失败:', error);
  } finally {
    loading.value = false;
  }
};

// 刷新配置列表
const handleRefresh = async () => {
  await loadConfigs();
  MessagePlugin.success('刷新成功');
};

// 加载统计信息
const loadStats = async () => {
  try {
    const response = await apiToMcpService.getConfigStats();
    Object.assign(stats, response);
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
};

// 创建配置
const handleCreate = () => {
  currentConfig.value = undefined;
  showFormDialog.value = true;
};

// 查看配置
const handleView = async (config: ApiConfigInfo) => {
  try {
    const details = await apiToMcpService.getConfigDetails(config.id);
    currentConfig.value = details;
    showFormDialog.value = true;
  } catch (error) {
    MessagePlugin.error('获取配置详情失败');
    console.error('获取配置详情失败:', error);
  }
};

// 编辑配置
const handleEdit = async (config: ApiConfigInfo) => {
  try {
    const details = await apiToMcpService.getConfigDetails(config.id);
    currentConfig.value = details;
    showFormDialog.value = true;
  } catch (error) {
    MessagePlugin.error('获取配置详情失败');
    console.error('获取配置详情失败:', error);
  }
};

// 测试配置
const handleTest = (config: ApiConfigInfo) => {
  MessagePlugin.info('测试功能开发中...');
};

// 删除配置点击
const handleDeleteClick = (config: ApiConfigInfo) => {
  configToDelete.value = config;
  deleteDialogVisible.value = true;
};

// 确认删除
const handleConfirmDelete = async () => {
  if (selectedConfigs.value.length > 0) {
    // 批量删除
    try {
      for (const configId of selectedConfigs.value) {
        await apiToMcpService.deleteConfig(configId);
      }
      MessagePlugin.success('批量删除成功');
      selectedConfigs.value = [];
      deleteDialogVisible.value = false;
      await loadConfigs();
    } catch (error) {
      MessagePlugin.error('批量删除失败');
      console.error('批量删除失败:', error);
    }
  } else if (configToDelete.value) {
    // 单个删除
    try {
      await apiToMcpService.deleteConfig(configToDelete.value.id);
      MessagePlugin.success('配置删除成功');
      deleteDialogVisible.value = false;
      configToDelete.value = null;
      await loadConfigs();
    } catch (error) {
      MessagePlugin.error('删除配置失败');
      console.error('删除配置失败:', error);
    }
  }
};

// 批量删除
const handleBatchDelete = () => {
  deleteDialogVisible.value = true;
};

// 导入配置
const handleImport = () => {
  showImportDialog.value = true;
};

// 导出配置
const handleExport = () => {
  showExportDialog.value = true;
};

// 表单提交处理
const handleFormSubmit = async (config: ApiToolConfig) => {
  try {
    if (currentConfig.value) {
      // 更新配置
      await apiToMcpService.updateConfig(config.id, config);
      MessagePlugin.success('配置更新成功');
    } else {
      // 创建配置
      await apiToMcpService.createConfig(config);
      MessagePlugin.success('配置创建成功');
    }
    showFormDialog.value = false;
    await loadConfigs();
  } catch (error) {
    MessagePlugin.error('配置保存失败');
    console.error('配置保存失败:', error);
  }
};

// 导入提交处理
const handleImportSubmit = async (result: { configs: ApiToolConfig[]; message: string }) => {
  try {
    MessagePlugin.success(`成功导入 ${result.configs.length} 个配置`);
    showImportDialog.value = false;
    await loadConfigs();
  } catch (error) {
    MessagePlugin.error('导入失败');
    console.error('导入失败:', error);
  }
};

// 导出提交处理
const handleExportSubmit = async (result: { data: string; filename: string; message: string }) => {
  try {
    // 创建下载链接
    const blob = new Blob([result.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);

    MessagePlugin.success('导出成功');
    showExportDialog.value = false;
  } catch (error) {
    MessagePlugin.error('导出失败');
    console.error('导出失败:', error);
  }
};

// 组件挂载时加载数据
onMounted(() => {
  loadConfigs();
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

.filter-option {
  display: flex;
  align-items: center;
  width: 100%;
}

.api-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-method {
  font-weight: 600;
  flex-shrink: 0;
}

.api-url {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  font-family: 'Monaco', 'Menlo', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.time-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.time-relative {
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.time-absolute {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

// 响应式
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
