<template>
  <div class="api-config-list">
    <div class="page-header">
      <h1>API配置管理</h1>
      <div class="header-actions">
        <t-space>
          <t-button
            v-if="selectedConfigs.length > 0"
            variant="outline"
            @click="handleBatchDelete"
          >
            <template #icon><delete-icon /></template>
            批量删除
          </t-button>
          <t-button
            variant="outline"
            @click="handleImport"
          >
            <template #icon><upload-icon /></template>
            导入配置
          </t-button>
          <t-button
            v-if="configs.length > 0"
            variant="outline"
            @click="handleExport"
          >
            <template #icon><download-icon /></template>
            导出配置
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
          <t-card>
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalConfigs }}</div>
              <div class="stat-label">总配置数</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card>
            <div class="stat-item">
              <div class="stat-value">{{ stats.activeConfigs }}</div>
              <div class="stat-label">活跃配置</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card>
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalTools }}</div>
              <div class="stat-label">生成的工具数</div>
            </div>
          </t-card>
        </t-col>
        <t-col :span="6">
          <t-card>
            <div class="stat-item">
              <div class="stat-value">{{ formatTime(stats.lastUpdated) }}</div>
              <div class="stat-label">最后更新</div>
            </div>
          </t-card>
        </t-col>
      </t-row>

      <!-- 搜索和过滤 -->
      <t-card class="filter-section">
        <t-row :gutter="16">
          <t-col :span="8">
            <t-input
              v-model="searchQuery"
              placeholder="搜索配置名称或描述"
              @change="handleSearch"
            >
              <template #prefix-icon><search-icon /></template>
            </t-input>
          </t-col>
          <t-col :span="4">
            <t-select
              v-model="statusFilter"
              placeholder="状态过滤"
              clearable
              @change="handleSearch"
            >
              <t-option value="active">活跃</t-option>
              <t-option value="inactive">非活跃</t-option>
              <t-option value="error">错误</t-option>
            </t-select>
          </t-col>
          <t-col :span="4">
            <t-select
              v-model="methodFilter"
              placeholder="HTTP方法"
              clearable
              @change="handleSearch"
            >
              <t-option value="GET">GET</t-option>
              <t-option value="POST">POST</t-option>
              <t-option value="PUT">PUT</t-option>
              <t-option value="DELETE">DELETE</t-option>
            </t-select>
          </t-col>
        </t-row>
      </t-card>

      <!-- 配置列表 -->
      <t-card>
        <t-table
          :data="filteredConfigs"
          :columns="columns"
          :loading="loading"
          :selected-row-keys="selectedConfigs"
          @select-change="handleSelectionChange"
          row-key="id"
        >
          <template #status="{ row }">
            <t-tag :variant="getStatusVariant(row.status)">
              {{ getStatusText(row.status) }}
            </t-tag>
          </template>

          <template #api="{ row }">
            <div class="api-info">
              <div class="api-method">{{ row.api.method }}</div>
              <div class="api-url">{{ row.api.url }}</div>
            </div>
          </template>

          <template #lastUpdated="{ row }">
            {{ formatTime(row.lastUpdated) }}
          </template>

          <template #actions="{ row }">
            <t-space>
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
              <t-tooltip content="删除配置">
                <t-button
                  variant="text"
                  size="small"
                  theme="danger"
                  @click="handleDelete(row)"
                >
                  <template #icon><delete-icon /></template>
                </t-button>
              </t-tooltip>
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

// 表格列定义
const columns = [
  {
    colKey: 'name',
    title: '配置名称',
    width: 200,
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
    width: 100,
    cell: 'status',
  },
  {
    colKey: 'api',
    title: 'API信息',
    cell: 'api',
  },
  {
    colKey: 'toolsGenerated',
    title: '工具数',
    width: 100,
  },
  {
    colKey: 'lastUpdated',
    title: '最后更新',
    width: 150,
    cell: 'lastUpdated',
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 180,
    cell: 'actions',
    align: 'center',
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

// 加载统计信息
const loadStats = async () => {
  try {
    const response = await apiToMcpService.getConfigStats();
    Object.assign(stats, response);
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
};

// 获取状态变体
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'warning';
    case 'error':
      return 'error';
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
const handleImportSubmit = async (result: any) => {
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
const handleExportSubmit = async (result: any) => {
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
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-section {
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--td-brand-color);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.filter-section {
  margin-bottom: 16px;
}

.api-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.api-method {
  font-weight: 600;
  color: var(--td-brand-color);
  font-size: 12px;
  padding: 2px 6px;
  background: var(--td-brand-color-1);
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.api-url {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-family: monospace;
  word-break: break-all;
}
</style>