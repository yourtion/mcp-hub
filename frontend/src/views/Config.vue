<template>
  <div class="config-page">
    <!-- 页面头部 -->
    <div class="config-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title">系统配置</h1>
          <p class="page-description">管理系统配置、查看历史记录和创建备份</p>
        </div>
        <div class="header-right">
          <t-space>
            <t-button
              theme="default"
              variant="outline"
              :loading="configStore.isLoading"
              @click="handleRefresh"
            >
              <template #icon>
                <RefreshIcon />
              </template>
              刷新
            </t-button>
            <t-button
              theme="primary"
              variant="outline"
              @click="handleCreateBackup"
            >
              <template #icon>
                <BackupIcon />
              </template>
              创建备份
            </t-button>
            <t-button
              theme="success"
              :disabled="!configStore.isFormDirty"
              :loading="configStore.isLoading"
              @click="handleSaveConfig"
            >
              <template #icon>
                <CheckIcon />
              </template>
              保存配置
            </t-button>
          </t-space>
        </div>
      </div>
    </div>

    <!-- 搜索和过滤器 -->
    <div class="config-filters">
      <t-card>
        <t-row :gutter="16">
          <t-col :span="6">
            <t-input
              v-model="searchKeyword"
              placeholder="搜索配置项..."
              clearable
              @change="handleSearch"
            >
              <template #prefix-icon>
                <t-icon name="search" />
              </template>
            </t-input>
          </t-col>
          <t-col :span="4">
            <t-select
              v-model="selectedConfigType"
              placeholder="配置类型"
              clearable
              @change="handleConfigTypeChange"
            >
              <t-option value="system" label="系统配置" />
              <t-option value="mcp" label="MCP配置" />
              <t-option value="groups" label="组配置" />
            </t-select>
          </t-col>
          <t-col :span="4">
            <t-select
              v-model="selectedCategory"
              placeholder="配置分类"
              clearable
              @change="handleCategoryChange"
            >
              <t-option
                v-for="category in configCategories"
                :key="category.key"
                :value="category.key"
                :label="category.label"
              />
            </t-select>
          </t-col>
          <t-col :span="4">
            <div class="advanced-switch">
              <t-switch
                v-model="showAdvanced"
                :custom-value="true"
                :default-value="false"
                @change="handleAdvancedToggle"
              />
              <span class="switch-label">显示高级选项</span>
            </div>
          </t-col>
          <t-col :span="6">
            <t-space>
              <t-button
                theme="default"
                variant="text"
                @click="handleViewHistory"
              >
                <template #icon>
                  <t-icon name="time" />
                </template>
                查看历史
              </t-button>
              <t-button
                theme="default"
                variant="text"
                @click="handleManageBackups"
              >
                <template #icon>
                  <t-icon name="folder" />
                </template>
                管理备份
              </t-button>
            </t-space>
          </t-col>
        </t-row>
      </t-card>
    </div>

    <!-- 主要内容区域 -->
    <div class="config-content">
      <t-row :gutter="24">
        <!-- 左侧配置分类导航 -->
        <t-col :span="6">
          <t-card title="配置分类" class="category-card">
            <config-category-nav
              :categories="configCategories"
              :selected-category="selectedCategory"
              @category-select="handleCategorySelect"
            />
          </t-card>
        </t-col>

        <!-- 右侧配置编辑区域 -->
        <t-col :span="18">
          <t-card class="config-editor-card">
            <!-- 配置编辑器 -->
            <config-editor
              v-if="configStore.hasConfigData"
              :config-data="configStore.configData"
              :selected-config-type="selectedConfigType"
              :selected-category="selectedCategory"
              :search-keyword="searchKeyword"
              :show-advanced="showAdvanced"
              @config-change="handleConfigChange"
              @validate="handleValidateConfig"
              @test="handleTestConfig"
              @preview="handlePreviewConfig"
            />
            
            <!-- 加载状态 -->
            <div v-else-if="configStore.isLoading" class="loading-container">
              <t-loading size="large" text="加载配置中..." />
            </div>
            
            <!-- 错误状态 -->
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
          </t-card>
        </t-col>
      </t-row>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { BackupIcon, CheckIcon, RefreshIcon } from 'tdesign-icons-vue-next';
import { useConfigStore } from '@/stores/config';
import type { ConfigType, ConfigFormData } from '@/types/config';

// 导入子组件
import ConfigCategoryNav from '@/components/config/ConfigCategoryNav.vue';
import ConfigEditor from '@/components/config/ConfigEditor.vue';
import ConfigValidationDialog from '@/components/config/ConfigValidationDialog.vue';
import ConfigHistoryDialog from '@/components/config/ConfigHistoryDialog.vue';
import ConfigBackupDialog from '@/components/config/ConfigBackupDialog.vue';
import ConfigCreateBackupDialog from '@/components/config/ConfigCreateBackupDialog.vue';

// 使用状态管理
const configStore = useConfigStore();

// 响应式数据
const searchKeyword = ref('');
const selectedConfigType = ref<ConfigType | undefined>(undefined);
const selectedCategory = ref<string | undefined>(undefined);
const showAdvanced = ref(false);

// 对话框状态
const validationDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const backupDialogVisible = ref(false);
const createBackupDialogVisible = ref(false);

// 配置分类定义
const configCategories = computed(() => [
  {
    key: 'server',
    label: '服务器配置',
    description: '端口、主机等服务器基础配置',
    icon: 'server',
    configType: 'system' as ConfigType,
    path: 'server',
  },
  {
    key: 'auth',
    label: '认证配置',
    description: 'JWT、用户认证相关配置',
    icon: 'lock-on',
    configType: 'system' as ConfigType,
    path: 'auth',
  },
  {
    key: 'users',
    label: '用户管理',
    description: '系统用户配置和权限管理',
    icon: 'user',
    configType: 'system' as ConfigType,
    path: 'users',
  },
  {
    key: 'ui',
    label: '界面配置',
    description: '主题、功能开关等界面配置',
    icon: 'view-module',
    configType: 'system' as ConfigType,
    path: 'ui',
  },
  {
    key: 'monitoring',
    label: '监控配置',
    description: '日志、指标等监控相关配置',
    icon: 'chart',
    configType: 'system' as ConfigType,
    path: 'monitoring',
  },
  {
    key: 'mcp-servers',
    label: 'MCP服务器',
    description: 'MCP服务器连接和传输配置',
    icon: 'server',
    configType: 'mcp' as ConfigType,
    path: 'mcpServers',
  },
  {
    key: 'groups',
    label: '组管理',
    description: '服务器组和工具过滤配置',
    icon: 'usergroup',
    configType: 'groups' as ConfigType,
    path: '',
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
 * 搜索配置项
 */
const handleSearch = (): void => {
  configStore.setSearchFilter({ keyword: searchKeyword.value });
};

/**
 * 配置类型变更
 */
const handleConfigTypeChange = (): void => {
  configStore.setSearchFilter({ configType: selectedConfigType.value });
  // 清除分类选择，因为不同配置类型的分类不同
  selectedCategory.value = undefined;
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
 * 分类选择
 */
const handleCategorySelect = (categoryKey: string): void => {
  selectedCategory.value = categoryKey;
  const category = configCategories.value.find(c => c.key === categoryKey);
  if (category) {
    selectedConfigType.value = category.configType;
  }
  handleCategoryChange();
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
 * 保存配置
 */
const handleSaveConfig = async (): Promise<void> => {
  if (!configStore.formData) return;

  const confirmDialog = DialogPlugin.confirm({
    header: '确认保存配置',
    body: '确定要保存当前配置更改吗？此操作可能会影响系统运行。',
    confirmBtn: '确认保存',
    cancelBtn: '取消',
    onConfirm: async () => {
      try {
        await configStore.updateConfig({
          configType: configStore.formData!.configType,
          config: configStore.formData!.config,
          description: '通过Web界面更新配置',
        });
        MessagePlugin.success('配置保存成功');
        confirmDialog.destroy();
      } catch (error) {
        MessagePlugin.error('配置保存失败');
      }
    },
  });
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
    await configStore.fetchConfigHistory(50, 0, selectedConfigType.value);
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
    await configStore.fetchConfigHistory(50, offset, selectedConfigType.value);
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
const handleRestoreFromBackup = async (backupId: string, configTypes?: ConfigType[]): Promise<void> => {
  const confirmDialog = DialogPlugin.confirm({
    header: '确认恢复配置',
    body: '确定要从备份恢复配置吗？当前配置将被覆盖。',
    confirmBtn: '确认恢复',
    cancelBtn: '取消',
    onConfirm: async () => {
      try {
        await configStore.restoreFromBackup(backupId, configTypes);
        MessagePlugin.success('配置恢复成功');
        confirmDialog.destroy();
        backupDialogVisible.value = false;
      } catch (error) {
        MessagePlugin.error('配置恢复失败');
      }
    },
  });
};
</script>

<style scoped>
.config-page {
  padding: 24px;
  background-color: var(--td-bg-color-page, #f3f3f3);
  min-height: calc(100vh - 64px);
}

.config-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary, #1f2937);
}

.page-description {
  margin: 0;
  color: var(--td-text-color-secondary, #6b7280);
  font-size: 14px;
}

.header-right {
  flex-shrink: 0;
}

.config-filters {
  margin-bottom: 24px;
}

.config-content {
  margin-bottom: 24px;
}

.config-content .t-card {
  background-color: var(--td-bg-color-container, #ffffff);
  border: 1px solid var(--td-component-border, #e7e7e7);
  overflow: visible;
}

.category-card {
  height: fit-content;
  position: sticky;
  top: 24px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  background-color: var(--td-bg-color-container, #ffffff);
  scrollbar-width: thin;
  scrollbar-color: var(--td-scrollbar-color, #d9d9d9) var(--td-bg-color-container, #ffffff);
}

.category-card::-webkit-scrollbar {
  width: 6px;
}

.category-card::-webkit-scrollbar-track {
  background: var(--td-bg-color-container, #ffffff);
}

.category-card::-webkit-scrollbar-thumb {
  background-color: var(--td-scrollbar-color, #d9d9d9);
  border-radius: 3px;
}

.config-editor-card {
  min-height: 500px;
  display: flex;
  flex-direction: column;
  background-color: var(--td-bg-color-container, #ffffff);
}

.loading-container,
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 60px 20px;
  background-color: var(--td-bg-color-container, #ffffff);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .config-content .t-col:first-child {
    margin-bottom: 24px;
  }

  .category-card {
    position: static;
    max-height: none;
    overflow-y: visible;
  }
}

@media (max-width: 768px) {
  .config-page {
    padding: 16px;
  }

  .header-content {
    flex-direction: column;
    gap: 16px;
  }

  .header-right {
    width: 100%;
  }

  .header-right .t-space {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
  }

  .header-right .t-space .t-button {
    flex: 1;
    min-width: 120px;
  }

  .config-filters .t-row .t-col {
    margin-bottom: 16px;
  }

  .config-editor-card {
    min-height: 400px;
  }

  .category-card {
    position: static;
  }
}

.advanced-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  background-color: transparent;
}

.switch-label {
  font-size: 14px;
  color: var(--td-text-color-primary, #1f2937);
  white-space: nowrap;
}
</style>