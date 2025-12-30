<template>
  <div class="config-page">
    <!-- 页面头部 -->
    <ContentLayout
      title="系统配置"
      description="管理系统配置、查看历史记录和创建备份"
      :actions="headerActions"
    >
      <template #extra>
        <t-space>
          <t-button
            theme="default"
            variant="text"
            @click="handleViewHistory"
          >
            <template #icon>
              <TimeIcon />
            </template>
            查看历史
          </t-button>
          <t-button
            theme="default"
            variant="text"
            @click="handleManageBackups"
          >
            <template #icon>
              <FolderIcon />
            </template>
            管理备份
          </t-button>
        </t-space>
      </template>

      <!-- Tab 导航 -->
      <t-tabs
        v-model="activeTab"
        :size="'large'"
        @change="handleTabChange"
      >
        <!-- 系统配置 Tab -->
        <t-tab-panel value="system" label="系统配置">
          <div class="tab-content">
            <!-- 筛选栏 -->
            <t-card bordered class="filter-card">
              <t-row :gutter="16" align="middle">
                <t-col :flex="'auto'">
                  <t-input
                    v-model="searchKeyword"
                    placeholder="搜索配置项..."
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
                    v-model="selectedCategory"
                    placeholder="配置分类"
                    clearable
                    size="large"
                    @change="handleCategoryChange"
                  >
                    <t-option
                      v-for="category in systemCategories"
                      :key="category.key"
                      :value="category.key"
                      :label="category.label"
                    />
                  </t-select>
                </t-col>
                <t-col :span="2">
                  <div class="advanced-switch-wrapper">
                    <t-switch
                      v-model="showAdvanced"
                      :custom-value="true"
                      :default-value="false"
                      size="large"
                      @change="handleAdvancedToggle"
                    />
                    <span class="switch-label">高级</span>
                  </div>
                </t-col>
                <t-col :flex="'150px'">
                  <t-button
                    block
                    variant="dashed"
                    size="large"
                    @click="handleResetFilters"
                  >
                    <template #icon>
                      <RefreshIcon />
                    </template>
                    重置
                  </t-button>
                </t-col>
              </t-row>
            </t-card>

            <!-- 配置编辑器 -->
            <t-card bordered class="config-editor-card">
              <div v-if="configStore.isLoading" class="loading-container">
                <t-loading size="large" text="加载配置中..." />
              </div>
              <div v-else-if="configStore.hasError" class="error-container">
                <t-alert
                  theme="error"
                  title="加载配置失败"
                  :message="configStore.error"
                >
                  <template #operation>
                    <t-button theme="primary" size="small" @click="handleRefresh">
                      重新加载
                    </t-button>
                  </template>
                </t-alert>
              </div>
              <system-config-editor
                v-else-if="configStore.hasConfigData"
                :config="configStore.configData.system"
                :selected-category="selectedCategory"
                :search-keyword="searchKeyword"
                :show-advanced="showAdvanced"
                @change="handleConfigChange"
              />
            </t-card>
          </div>
        </t-tab-panel>

        <!-- MCP配置 Tab -->
        <t-tab-panel value="mcp" label="MCP配置">
          <div class="tab-content">
            <t-card bordered class="filter-card">
              <t-row :gutter="16" align="middle">
                <t-col :flex="'auto'">
                  <t-input
                    v-model="searchKeyword"
                    placeholder="搜索配置项..."
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
                    v-model="selectedCategory"
                    placeholder="配置分类"
                    clearable
                    size="large"
                    @change="handleCategoryChange"
                  >
                    <t-option
                      v-for="category in mcpCategories"
                      :key="category.key"
                      :value="category.key"
                      :label="category.label"
                    />
                  </t-select>
                </t-col>
                <t-col :span="2">
                  <div class="advanced-switch-wrapper">
                    <t-switch
                      v-model="showAdvanced"
                      :custom-value="true"
                      :default-value="false"
                      size="large"
                      @change="handleAdvancedToggle"
                    />
                    <span class="switch-label">高级</span>
                  </div>
                </t-col>
                <t-col :flex="'150px'">
                  <t-button
                    block
                    variant="dashed"
                    size="large"
                    @click="handleResetFilters"
                  >
                    <template #icon>
                      <RefreshIcon />
                    </template>
                    重置
                  </t-button>
                </t-col>
              </t-row>
            </t-card>

            <t-card bordered class="config-editor-card">
              <div v-if="configStore.isLoading" class="loading-container">
                <t-loading size="large" text="加载配置中..." />
              </div>
              <div v-else-if="configStore.hasError" class="error-container">
                <t-alert
                  theme="error"
                  title="加载配置失败"
                  :message="configStore.error"
                >
                  <template #operation>
                    <t-button theme="primary" size="small" @click="handleRefresh">
                      重新加载
                    </t-button>
                  </template>
                </t-alert>
              </div>
              <mcp-config-editor
                v-else-if="configStore.hasConfigData"
                :config="configStore.configData.mcp"
                :selected-category="selectedCategory"
                :search-keyword="searchKeyword"
                :show-advanced="showAdvanced"
                @change="handleConfigChange"
              />
            </t-card>
          </div>
        </t-tab-panel>

        <!-- 组配置 Tab -->
        <t-tab-panel value="groups" label="组配置">
          <div class="tab-content">
            <t-card bordered class="filter-card">
              <t-row :gutter="16" align="middle">
                <t-col :flex="'auto'">
                  <t-input
                    v-model="searchKeyword"
                    placeholder="搜索配置项..."
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
                    v-model="selectedCategory"
                    placeholder="配置分类"
                    clearable
                    size="large"
                    @change="handleCategoryChange"
                  >
                    <t-option
                      v-for="category in groupCategories"
                      :key="category.key"
                      :value="category.key"
                      :label="category.label"
                    />
                  </t-select>
                </t-col>
                <t-col :span="2">
                  <div class="advanced-switch-wrapper">
                    <t-switch
                      v-model="showAdvanced"
                      :custom-value="true"
                      :default-value="false"
                      size="large"
                      @change="handleAdvancedToggle"
                    />
                    <span class="switch-label">高级</span>
                  </div>
                </t-col>
                <t-col :flex="'150px'">
                  <t-button
                    block
                    variant="dashed"
                    size="large"
                    @click="handleResetFilters"
                  >
                    <template #icon>
                      <RefreshIcon />
                    </template>
                    重置
                  </t-button>
                </t-col>
              </t-row>
            </t-card>

            <t-card bordered class="config-editor-card">
              <div v-if="configStore.isLoading" class="loading-container">
                <t-loading size="large" text="加载配置中..." />
              </div>
              <div v-else-if="configStore.hasError" class="error-container">
                <t-alert
                  theme="error"
                  title="加载配置失败"
                  :message="configStore.error"
                >
                  <template #operation>
                    <t-button theme="primary" size="small" @click="handleRefresh">
                      重新加载
                    </t-button>
                  </template>
                </t-alert>
              </div>
              <group-config-editor
                v-else-if="configStore.hasConfigData"
                :config="configStore.configData.groups"
                :selected-category="selectedCategory"
                :search-keyword="searchKeyword"
                :show-advanced="showAdvanced"
                @change="handleConfigChange"
              />
            </t-card>
          </div>
        </t-tab-panel>
      </t-tabs>
    </ContentLayout>

    <!-- 配置验证结果对话框 -->
    <config-validation-dialog
      v-model:visible="validationDialogVisible"
      :validation-result="configStore.validationResult"
      :test-result="configStore.testResult"
      :preview-result="configStore.previewResult"
      @confirm="handleValidationConfirm"
    />

    <!-- 配置历史对话框 -->
    <config-history-dialog
      v-model:visible="historyDialogVisible"
      :history-entries="configStore.historyEntries"
      :total="configStore.historyTotal"
      :loading="configStore.isLoading"
      @load-more="handleLoadMoreHistory"
      @restore="handleRestoreFromHistory"
    />

    <!-- 备份管理对话框 -->
    <config-backup-dialog
      v-model:visible="backupDialogVisible"
      :backups="configStore.backups"
      :total="configStore.backupTotal"
      :loading="configStore.isLoading"
      @create-backup="handleCreateBackupDialog"
      @restore-backup="handleRestoreFromBackup"
      @load-more="handleLoadMoreBackups"
    />

    <!-- 创建备份对话框 -->
    <config-create-backup-dialog
      v-model:visible="createBackupDialogVisible"
      @create="handleConfirmCreateBackup"
    />

    <!-- 保存配置确认对话框 -->
    <ConfirmDialog
      v-model:visible="saveConfirmDialogVisible"
      title="确认保存配置"
      :confirm-text="'确认保存'"
      :cancel-text="'取消'"
      type="warning"
      @confirm="handleConfirmSave"
    >
      <p>确定要保存当前配置更改吗？此操作可能会影响系统运行。</p>
    </ConfirmDialog>

    <!-- 恢复备份确认对话框 -->
    <ConfirmDialog
      v-model:visible="restoreConfirmDialogVisible"
      title="确认恢复配置"
      :confirm-text="'确认恢复'"
      :cancel-text="'取消'"
      type="warning"
      @confirm="handleConfirmRestore"
    >
      <p>确定要从备份恢复配置吗？当前配置将被覆盖。</p>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  BackupIcon,
  CheckIcon,
  RefreshIcon,
  SearchIcon,
  TimeIcon,
  FolderIcon,
} from 'tdesign-icons-vue-next';
import { ContentLayout, ConfirmDialog } from '@/design-system';
import { useConfigStore } from '@/stores/config';
import type { ConfigType, ConfigFormData } from '@/types/config';

// 导入子组件
import SystemConfigEditor from '@/components/config/SystemConfigEditor.vue';
import McpConfigEditor from '@/components/config/McpConfigEditor.vue';
import GroupConfigEditor from '@/components/config/GroupConfigEditor.vue';
import ConfigValidationDialog from '@/components/config/ConfigValidationDialog.vue';
import ConfigHistoryDialog from '@/components/config/ConfigHistoryDialog.vue';
import ConfigBackupDialog from '@/components/config/ConfigBackupDialog.vue';
import ConfigCreateBackupDialog from '@/components/config/ConfigCreateBackupDialog.vue';

// 使用状态管理
const configStore = useConfigStore();

// 响应式数据
const activeTab = ref<ConfigType>('system');
const searchKeyword = ref('');
const selectedCategory = ref<string>('');
const showAdvanced = ref(false);

// 对话框状态
const validationDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const backupDialogVisible = ref(false);
const createBackupDialogVisible = ref(false);
const saveConfirmDialogVisible = ref(false);
const restoreConfirmDialogVisible = ref(false);

// 临时存储恢复备份的参数
const pendingRestoreBackup = ref<{ backupId: string; configTypes?: ConfigType[] } | null>(null);

// 配置分类选项
const systemCategories = [
  { key: '', label: '全部配置' },
  { key: 'server', label: '服务器配置' },
  { key: 'auth', label: '认证配置' },
  { key: 'logging', label: '日志配置' },
];

const mcpCategories = [
  { key: '', label: '全部配置' },
  { key: 'servers', label: 'MCP服务器' },
  { key: 'timeout', label: '超时配置' },
];

const groupCategories = [
  { key: '', label: '全部配置' },
  { key: 'basic', label: '基础信息' },
  { key: 'servers', label: '服务器管理' },
];

// 头部操作按钮
const headerActions = computed(() => [
  {
    text: '刷新',
    theme: 'default' as const,
    variant: 'outline' as const,
    icon: RefreshIcon,
    loading: configStore.isLoading,
    onClick: handleRefresh,
  },
  {
    text: '创建备份',
    theme: 'primary' as const,
    variant: 'outline' as const,
    icon: BackupIcon,
    onClick: handleCreateBackup,
  },
  {
    text: '保存配置',
    theme: 'success' as const,
    disabled: !configStore.isFormDirty,
    loading: configStore.isLoading,
    icon: CheckIcon,
    onClick: () => {
      saveConfirmDialogVisible.value = true;
    },
  },
]);

// 生命周期
onMounted(async () => {
  await handleRefresh();
});

// 事件处理函数

/**
 * 刷新配置
 */
const handleRefresh = async (): Promise<void> => {
  try {
    await configStore.fetchConfig();
    MessagePlugin.success('配置刷新成功');
  } catch (error) {
    MessagePlugin.error('配置刷新失败');
  }
};

/**
 * Tab 切换
 */
const handleTabChange = (value: string): void => {
  activeTab.value = value as ConfigType;
  // 重置筛选
  searchKeyword.value = '';
  selectedCategory.value = '';
  showAdvanced.value = false;
};

/**
 * 搜索配置项
 */
const handleSearch = (): void => {
  configStore.setSearchFilter({ keyword: searchKeyword.value });
};

/**
 * 配置分类变更
 */
const handleCategoryChange = (): void => {
  configStore.setSearchFilter({ category: selectedCategory.value });
};

/**
 * 高级选项切换
 */
const handleAdvancedToggle = (): void => {
  configStore.setSearchFilter({ showAdvanced: showAdvanced.value });
};

/**
 * 重置筛选
 */
const handleResetFilters = (): void => {
  searchKeyword.value = '';
  selectedCategory.value = '';
  showAdvanced.value = false;
  configStore.setSearchFilter({
    keyword: '',
    category: '',
    showAdvanced: false,
  });
};

/**
 * 配置变更
 */
const handleConfigChange = (configType: ConfigType, config: Record<string, unknown>): void => {
  if (!configStore.configData) return;

  // 获取原始配置
  let originalConfig: Record<string, unknown>;
  switch (configType) {
    case 'system':
      originalConfig = configStore.configData.system as Record<string, unknown>;
      break;
    case 'mcp':
      originalConfig = configStore.configData.mcp as Record<string, unknown>;
      break;
    case 'groups':
      originalConfig = configStore.configData.groups as Record<string, unknown>;
      break;
    default:
      return;
  }

  // 设置表单数据
  const formData: ConfigFormData = {
    configType,
    config,
    originalConfig,
    isDirty: JSON.stringify(config) !== JSON.stringify(originalConfig),
  };

  configStore.setFormData(formData);
};

/**
 * 验证配置
 */
const handleValidateConfig = async (configType: ConfigType, config: Record<string, unknown>): Promise<void> => {
  try {
    await configStore.validateConfig({ configType, config });
    validationDialogVisible.value = true;
  } catch (error) {
    MessagePlugin.error('配置验证失败');
  }
};

/**
 * 测试配置
 */
const handleTestConfig = async (configType: ConfigType, config: Record<string, unknown>): Promise<void> => {
  try {
    await configStore.testConfig({ configType, config });
    validationDialogVisible.value = true;
  } catch (error) {
    MessagePlugin.error('配置测试失败');
  }
};

/**
 * 预览配置
 */
const handlePreviewConfig = async (configType: ConfigType, config: Record<string, unknown>): Promise<void> => {
  try {
    await configStore.previewConfigChanges({ configType, config });
    validationDialogVisible.value = true;
  } catch (error) {
    MessagePlugin.error('配置预览失败');
  }
};

/**
 * 确认保存配置
 */
const handleConfirmSave = async (): Promise<void> => {
  if (!configStore.formData) return;

  try {
    await configStore.updateConfig({
      configType: configStore.formData.configType,
      config: configStore.formData.config,
      description: '通过Web界面更新配置',
    });
    MessagePlugin.success('配置保存成功');
    saveConfirmDialogVisible.value = false;
  } catch (error) {
    MessagePlugin.error('配置保存失败');
  }
};

/**
 * 验证确认
 */
const handleValidationConfirm = (): void => {
  validationDialogVisible.value = false;
};

/**
 * 查看历史
 */
const handleViewHistory = async (): Promise<void> => {
  try {
    await configStore.fetchConfigHistory(50, 0, activeTab.value);
    historyDialogVisible.value = true;
  } catch (error) {
    MessagePlugin.error('获取配置历史失败');
  }
};

/**
 * 加载更多历史记录
 */
const handleLoadMoreHistory = async (offset: number): Promise<void> => {
  try {
    await configStore.fetchConfigHistory(50, offset, activeTab.value);
  } catch (error) {
    MessagePlugin.error('加载历史记录失败');
  }
};

/**
 * 从历史恢复
 */
const handleRestoreFromHistory = (historyEntry: any): void => {
  // 实现从历史记录恢复配置的逻辑
  MessagePlugin.info('历史恢复功能开发中');
};

/**
 * 管理备份
 */
const handleManageBackups = async (): Promise<void> => {
  try {
    await configStore.fetchBackupList();
    backupDialogVisible.value = true;
  } catch (error) {
    MessagePlugin.error('获取备份列表失败');
  }
};

/**
 * 加载更多备份
 */
const handleLoadMoreBackups = async (offset: number): Promise<void> => {
  try {
    await configStore.fetchBackupList(50, offset);
  } catch (error) {
    MessagePlugin.error('加载备份列表失败');
  }
};

/**
 * 创建备份
 */
const handleCreateBackup = (): void => {
  createBackupDialogVisible.value = true;
};

/**
 * 创建备份对话框
 */
const handleCreateBackupDialog = (): void => {
  createBackupDialogVisible.value = true;
};

/**
 * 确认创建备份
 */
const handleConfirmCreateBackup = async (description: string, includeTypes: ConfigType[]): Promise<void> => {
  try {
    const backupId = await configStore.createBackup(description, includeTypes);
    MessagePlugin.success(`备份创建成功，备份ID: ${backupId}`);
    createBackupDialogVisible.value = false;
  } catch (error) {
    MessagePlugin.error('创建备份失败');
  }
};

/**
 * 从备份恢复
 */
const handleRestoreFromBackup = (backupId: string, configTypes?: ConfigType[]): void => {
  // 存储参数，等待用户确认
  pendingRestoreBackup.value = { backupId, configTypes };
  restoreConfirmDialogVisible.value = true;
};

/**
 * 确认恢复备份
 */
const handleConfirmRestore = async (): Promise<void> => {
  if (!pendingRestoreBackup.value) return;

  const { backupId, configTypes } = pendingRestoreBackup.value;
  try {
    await configStore.restoreFromBackup(backupId, configTypes);
    MessagePlugin.success('配置恢复成功');
    backupDialogVisible.value = false;
    restoreConfirmDialogVisible.value = false;
    pendingRestoreBackup.value = null;
  } catch (error) {
    MessagePlugin.error('配置恢复失败');
  }
};
</script>

<style lang="less" scoped>
@import '../design-system/styles/mixins.less';
@import '../design-system/tokens/spacing.less';
@import '../design-system/tokens/typography.less';

.config-page {
  height: 100%;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: @spacing-xl;
}

.filter-card {
  margin-bottom: 0;
}

.advanced-switch-wrapper {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  height: 32px;
  padding: 0 @spacing-md;
}

.switch-label {
  font-size: @font-size-base;
  color: var(--td-text-color-primary);
  white-space: nowrap;
}

.config-editor-card {
  min-height: 500px;
}

.loading-container,
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 60px 20px;
}

// Tab 样式优化
:deep(.t-tabs) {
  .t-tabs__nav {
    margin-bottom: @spacing-lg;
  }

  .t-tabs__nav-item {
    font-size: @font-size-lg;
    font-weight: @font-weight-medium;
  }

  .t-tabs__panel {
    padding: 0;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-card .t-row .t-col {
    margin-bottom: @spacing-md;
  }

  .config-editor-card {
    min-height: 400px;
  }

  :deep(.t-tabs) {
    .t-tabs__nav-item {
      font-size: @font-size-base;
    }
  }
}
</style>
