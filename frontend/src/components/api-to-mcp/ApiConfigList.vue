<template>
  <div class="api-config-list">
    <div class="page-header">
      <div class="header-title">
        <h1>API配置管理</h1>
        <p class="header-subtitle">管理和配置 API 到 MCP 工具的转换</p>
      </div>
      <div class="header-actions">
        <t-space>
          <t-button
            v-if="selectedConfigs.length > 0"
            variant="outline"
            theme="danger"
            @click="handleBatchDelete"
          >
            <template #icon><delete-icon /></template>
            批量删除 ({{ selectedConfigs.length }})
          </t-button>
          <t-button
            variant="outline"
            @click="handleImport"
          >
            <template #icon><upload-icon /></template>
            导入
          </t-button>
          <t-button
            v-if="configs.length > 0"
            variant="outline"
            @click="handleExport"
          >
            <template #icon><download-icon /></template>
            导出
          </t-button>
          <t-button
            theme="primary"
            @click="handleCreate"
          >
            <template #icon><add-icon /></template>
            新建配置
          </t-button>
        </t-space>
      </div>
    </div>

    <div class="content">
      <!-- 统计信息 -->
      <t-row :gutter="16" class="stats-section">
        <t-col :span="6">
          <div class="stat-card stat-primary">
            <div class="stat-icon">
              <server-icon />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalConfigs }}</div>
              <div class="stat-label">总配置数</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-success">
            <div class="stat-icon">
              <check-circle-icon />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.activeConfigs }}</div>
              <div class="stat-label">活跃配置</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-warning">
            <div class="stat-icon">
              <tools-icon />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalTools }}</div>
              <div class="stat-label">生成的工具</div>
            </div>
          </div>
        </t-col>
        <t-col :span="6">
          <div class="stat-card stat-info">
            <div class="stat-icon">
              <time-icon />
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ formatTimeShort(stats.lastUpdated) }}</div>
              <div class="stat-label">最后更新</div>
            </div>
          </div>
        </t-col>
      </t-row>

      <!-- 搜索和过滤 -->
      <t-card class="filter-section" bordered>
        <t-row :gutter="16" align="center">
          <t-col :span="8">
            <t-input
              v-model="searchQuery"
              placeholder="搜索配置名称或描述"
              clearable
              @change="handleSearch"
            >
              <template #prefix-icon><search-icon /></template>
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
              <template #icon><refresh-icon /></template>
              刷新
            </t-button>
          </t-col>
        </t-row>
      </t-card>

      <!-- 配置列表 -->
      <t-card :bordered="false">
        <t-table
          :data="filteredConfigs"
          :columns="columns"
          :loading="loading"
          :selected-row-keys="selectedConfigs"
          :pagination="{ pageSize: 10, total: filteredConfigs.length }"
          :empty="emptyProps"
          row-key="id"
          size="large"
          stripe
          @select-change="handleSelectionChange"
        >
          <template #status="{ row }">
            <t-tag :theme="getStatusTheme(row.status)" variant="light">
              <template #icon>
                <component :is="getStatusIcon(row.status)" />
              </template>
              {{ getStatusText(row.status) }}
            </t-tag>
          </template>

          <template #api="{ row }">
            <div class="api-info">
              <t-tag :theme="getMethodTheme(row.api.method)" size="small" class="api-method">
                {{ row.api.method }}
              </t-tag>
              <div class="api-url">{{ row.api.url }}</div>
            </div>
          </template>

          <template #lastUpdated="{ row }">
            <div class="time-info">
              <div class="time-relative">{{ formatTimeRelative(row.lastUpdated) }}</div>
              <div class="time-absolute">{{ formatTime(row.lastUpdated) }}</div>
            </div>
          </template>

          <template #actions="{ row }">
            <t-space :size="4">
              <t-tooltip content="查看详情">
                <t-button
                  variant="text"
                  size="small"
                  @click="handleView(row)"
                >
                  <template #icon><browse-icon /></template>
                </t-button>
              </t-tooltip>
              <t-tooltip content="编辑配置">
                <t-button
                  variant="text"
                  size="small"
                  @click="handleEdit(row)"
                >
                  <template #icon><edit-icon /></template>
                </t-button>
              </t-tooltip>
              <t-tooltip content="测试配置">
                <t-button
                  variant="text"
                  size="small"
                  @click="handleTest(row)"
                >
                  <template #icon><play-icon /></template>
                </t-button>
              </t-tooltip>
              <t-popconfirm
                content="确认删除此配置？"
                @confirm="handleDelete(row)"
              >
                <t-button
                  variant="text"
                  size="small"
                  theme="danger"
                >
                  <template #icon><delete-icon /></template>
                </t-button>
              </t-popconfirm>
            </t-space>
          </template>
        </t-table>
      </t-card>
    </div>

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
  </div>
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
  ServerIcon,
  CheckCircleIcon,
  ToolsIcon,
  TimeIcon,
  RefreshIcon,
  CheckIcon,
  CloseIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-vue-next';
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

const currentConfig = ref<ApiToolConfig | undefined>();

// 空状态配置
const emptyProps = computed(() => ({
  description: loading.value ? '加载中...' : '暂无配置，点击上方"新建配置"按钮创建',
}));

// 表格列定义
const columns = [
  {
    colKey: 'name',
    title: '配置名称',
    width: 200,
    ellipsis: true,
  },
  {
    colKey: 'description',
    title: '描述',
    width: 250,
    ellipsis: true,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
    cell: 'status',
  },
  {
    colKey: 'api',
    title: 'API端点',
    cell: 'api',
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
    cell: 'lastUpdated',
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 180,
    cell: 'actions',
    align: 'center' as const,
    fixed: 'right' as const,
  },
];

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

// 获取状态主题
const getStatusTheme = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'default';
  }
};

// 获取状态图标
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return CheckIcon;
    case 'inactive':
      return CloseIcon;
    case 'error':
      return ErrorCircleIcon;
    default:
      return CheckIcon;
  }
};

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

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'active':
      return '活跃';
    case 'inactive':
      return '非活跃';
    case 'error':
      return '错误';
    default:
      return '未知';
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
  // 搜索逻辑在computed属性中处理
};

// 选择变更处理
const handleSelectionChange = (selectedKeys: string[]) => {
  selectedConfigs.value = selectedKeys;
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
  // 导航到测试页面
  // router.push(`/api-to-mcp/test/${config.id}`);
  MessagePlugin.info('测试功能开发中...');
};

// 删除配置
const handleDelete = async (config: ApiConfigInfo) => {
  try {
    const confirmDelete = await MessagePlugin.confirm({
      header: '确认删除',
      body: `确定要删除配置 "${config.name}" 吗？此操作不可撤销。`,
      confirmBtn: '删除',
      cancelBtn: '取消',
      theme: 'warning',
    });

    if (confirmDelete) {
      await apiToMcpService.deleteConfig(config.id);
      MessagePlugin.success('配置删除成功');
      await loadConfigs();
    }
  } catch (error) {
    MessagePlugin.error('删除配置失败');
    console.error('删除配置失败:', error);
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (selectedConfigs.value.length === 0) {
    MessagePlugin.warning('请先选择要删除的配置');
    return;
  }

  try {
    const confirmDelete = await MessagePlugin.confirm({
      header: '确认批量删除',
      body: `确定要删除选中的 ${selectedConfigs.value.length} 个配置吗？此操作不可撤销。`,
      confirmBtn: '删除',
      cancelBtn: '取消',
      theme: 'warning',
    });

    if (confirmDelete) {
      for (const configId of selectedConfigs.value) {
        await apiToMcpService.deleteConfig(configId);
      }
      MessagePlugin.success('批量删除成功');
      selectedConfigs.value = [];
      await loadConfigs();
    }
  } catch (error) {
    MessagePlugin.error('批量删除失败');
    console.error('批量删除失败:', error);
  }
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
    if (config.id) {
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

<style scoped>
.api-config-list {
  padding: 24px;
  background: var(--td-bg-color-container);
  min-height: 100vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.header-title h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  line-height: 1.2;
}

.header-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 统计卡片样式 */
.stats-section {
  margin-bottom: 8px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 24px;
}

.stat-primary .stat-icon {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.stat-success .stat-icon {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.stat-warning .stat-icon {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color);
}

.stat-info .stat-icon {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 4px;
  background: linear-gradient(135deg, var(--td-brand-color) 0%, var(--td-brand-color-7) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

/* 过滤区域样式 */
.filter-section {
  border-radius: 8px;
}

.filter-option {
  display: flex;
  align-items: center;
  width: 100%;
}

/* 表格样式 */
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

/* 响应式设计 */
@media (max-width: 1200px) {
  .api-config-list {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions :deep(.t-space) {
    flex-wrap: wrap;
  }
}
</style>