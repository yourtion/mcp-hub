<template>
  <div class="mcp-page config-page">
    <!-- Page Header -->
    <div class="mcp-page__header">
      <div class="mcp-page__header-content">
        <h1 class="mcp-page__title">系统配置</h1>
        <p class="mcp-page__desc">管理系统配置与备份</p>
      </div>
    </div>

    <!-- Tabs -->
    <t-tabs v-model="activeTab" class="config-page__tabs">
      <!-- Tab: MCP Service Config -->
      <t-tab-panel value="mcp" label="MCP服务配置">
        <div class="mcp-card config-page__panel">
          <div class="config-page__editor-header">
            <h3 class="config-page__editor-title">MCP服务配置</h3>
            <div class="config-page__editor-actions">
              <t-button size="small" variant="outline" @click="handleValidate('mcp')">
                <template #icon><CheckCircleIcon /></template>
                验证
              </t-button>
              <t-button size="small" theme="primary" @click="handleSave('mcp')">
                <template #icon><SaveIcon /></template>
                保存
              </t-button>
            </div>
          </div>
          <t-textarea
            v-model="mcpConfigText"
            :autosize="{ minRows: 12, maxRows: 30 }"
            class="config-page__textarea"
            placeholder="MCP服务配置 JSON"
          />
        </div>
      </t-tab-panel>

      <!-- Tab: System Config -->
      <t-tab-panel value="system" label="系统配置">
        <div class="mcp-card config-page__panel">
          <div class="config-page__editor-header">
            <h3 class="config-page__editor-title">系统配置</h3>
            <div class="config-page__editor-actions">
              <t-button size="small" variant="outline" @click="handleValidate('system')">
                <template #icon><CheckCircleIcon /></template>
                验证
              </t-button>
              <t-button size="small" theme="primary" @click="handleSave('system')">
                <template #icon><SaveIcon /></template>
                保存
              </t-button>
            </div>
          </div>
          <t-textarea
            v-model="systemConfigText"
            :autosize="{ minRows: 12, maxRows: 30 }"
            class="config-page__textarea"
            placeholder="系统配置 JSON"
          />
        </div>
      </t-tab-panel>

      <!-- Tab: Group Config -->
      <t-tab-panel value="groups" label="组配置">
        <div class="mcp-card config-page__panel">
          <div class="config-page__editor-header">
            <h3 class="config-page__editor-title">组配置</h3>
            <div class="config-page__editor-actions">
              <t-button size="small" variant="outline" @click="handleValidate('groups')">
                <template #icon><CheckCircleIcon /></template>
                验证
              </t-button>
              <t-button size="small" theme="primary" @click="handleSave('groups')">
                <template #icon><SaveIcon /></template>
                保存
              </t-button>
            </div>
          </div>
          <t-textarea
            v-model="groupsConfigText"
            :autosize="{ minRows: 12, maxRows: 30 }"
            class="config-page__textarea"
            placeholder="组配置 JSON"
          />
        </div>
      </t-tab-panel>

      <!-- Tab: Backup & Restore -->
      <t-tab-panel value="backup" label="备份与恢复">
        <div class="mcp-card config-page__panel">
          <div class="config-page__editor-header">
            <h3 class="config-page__editor-title">备份与恢复</h3>
            <div class="config-page__editor-actions">
              <t-button size="small" theme="primary" @click="handleCreateBackup">
                <template #icon><AddIcon /></template>
                创建备份
              </t-button>
              <t-button size="small" variant="outline" @click="fetchBackups">
                <template #icon><RefreshIcon /></template>
                刷新
              </t-button>
            </div>
          </div>

          <!-- Backup list -->
          <div v-if="backupLoading" style="padding: var(--space-8) 0">
            <t-loading size="medium" text="加载备份列表..." />
          </div>

          <div v-else-if="backups.length === 0" class="mcp-empty">
            <FolderIcon class="mcp-empty__icon" />
            <p class="mcp-empty__title">暂无备份</p>
            <p class="mcp-empty__desc">点击"创建备份"按钮生成第一份配置备份</p>
          </div>

          <t-table
            v-else
            :data="backups"
            :columns="backupColumns"
            row-key="id"
            hover
            stripe
          >
            <template #configTypes="{ row }">
              <t-tag
                v-for="ct in row.configTypes"
                :key="ct"
                variant="light"
                size="small"
                style="margin-right: var(--space-1)"
              >
                {{ ct }}
              </t-tag>
            </template>

            <template #timestamp="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>

            <template #size="{ row }">
              {{ formatSize(row.size) }}
            </template>

            <template #actions="{ row }">
              <t-popconfirm content="确认从此备份恢复配置？" @confirm="handleRestore(row.id)">
                <t-button variant="text" size="small" theme="primary">
                  恢复
                </t-button>
              </t-popconfirm>
            </template>
          </t-table>
        </div>
      </t-tab-panel>
    </t-tabs>

    <!-- Validation Result Dialog -->
    <t-dialog
      v-model:visible="validationDialogVisible"
      header="验证结果"
      :footer="false"
      width="600px"
    >
      <div v-if="validationResult">
        <div class="config-page__validation-status" :class="validationResult.valid ? 'config-page__validation-status--valid' : 'config-page__validation-status--invalid'">
          <CheckCircleIcon v-if="validationResult.valid" />
          <CloseCircleIcon v-else />
          <span>{{ validationResult.valid ? '验证通过' : '验证失败' }}</span>
        </div>

        <div v-if="validationResult.errors.length > 0" class="config-page__validation-section">
          <h4 class="config-page__validation-section-title">错误</h4>
          <div
            v-for="(err, idx) in validationResult.errors"
            :key="`err-${idx}`"
            class="config-page__validation-item config-page__validation-item--error"
          >
            <span class="config-page__validation-path">{{ err.path }}</span>
            <span class="config-page__validation-message">{{ err.message }}</span>
          </div>
        </div>

        <div v-if="validationResult.warnings.length > 0" class="config-page__validation-section">
          <h4 class="config-page__validation-section-title">警告</h4>
          <div
            v-for="(warn, idx) in validationResult.warnings"
            :key="`warn-${idx}`"
            class="config-page__validation-item config-page__validation-item--warning"
          >
            <span class="config-page__validation-path">{{ warn.path }}</span>
            <span class="config-page__validation-message">{{ warn.message }}</span>
          </div>
        </div>

        <div v-if="validationResult.impact" class="config-page__validation-section">
          <h4 class="config-page__validation-section-title">影响分析</h4>
          <div v-if="validationResult.impact.requiresRestart" class="config-page__validation-item config-page__validation-item--warning">
            <span class="config-page__validation-message">此更改需要重启服务才能生效</span>
          </div>
          <div v-if="validationResult.impact.potentialIssues.length > 0">
            <div
              v-for="(issue, idx) in validationResult.impact.potentialIssues"
              :key="`issue-${idx}`"
              class="config-page__validation-item"
            >
              <span class="config-page__validation-message">{{ issue }}</span>
            </div>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  Tabs as TTabs,
  TabPanel as TTabPanel,
  Textarea as TTextarea,
  Button as TButton,
  Table as TTable,
  Tag as TTag,
  Loading as TLoading,
  Dialog as TDialog,
  Popconfirm as TPopconfirm,
  MessagePlugin,
} from 'tdesign-vue-next';
import {
  CheckCircleIcon,
  SaveIcon,
  AddIcon,
  RefreshIcon,
  FolderIcon,
  CloseCircleIcon,
} from 'tdesign-icons-vue-next';
import { configService } from '@/services/config';
import type {
  ConfigBackup,
  ConfigData,
  ConfigType,
  ConfigValidationResponse,
} from '@/types/config';

// --- State ---
const activeTab = ref('mcp');
const backupLoading = ref(false);

const mcpConfigText = ref('{}');
const systemConfigText = ref('{}');
const groupsConfigText = ref('{}');

const backups = ref<ConfigBackup[]>([]);
const validationResult = ref<ConfigValidationResponse | null>(null);
const validationDialogVisible = ref(false);

// --- Backup table columns ---
const backupColumns = [
  { colKey: 'timestamp', title: '时间', width: 200 },
  { colKey: 'description', title: '描述', ellipsis: true },
  { colKey: 'configTypes', title: '配置类型', width: 200 },
  { colKey: 'size', title: '大小', width: 100 },
  { colKey: 'user', title: '操作者', width: 120 },
  { colKey: 'actions', title: '操作', width: 100, fixed: 'right' as const },
];

// --- Helpers ---
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseConfigText(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    MessagePlugin.error('JSON 格式错误，请检查输入');
    return null;
  }
}

function getConfigTextByType(type: ConfigType): string {
  switch (type) {
    case 'mcp':
      return mcpConfigText.value;
    case 'system':
      return systemConfigText.value;
    case 'groups':
      return groupsConfigText.value;
    default:
      return '{}';
  }
}

// --- Actions ---
async function loadConfig(): Promise<void> {
  try {
    const data: ConfigData = await configService.getCurrentConfig();
    mcpConfigText.value = JSON.stringify(data.mcp, null, 2);
    systemConfigText.value = JSON.stringify(data.system, null, 2);
    groupsConfigText.value = JSON.stringify(data.groups, null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载配置失败';
    MessagePlugin.error(message);
  }
}

async function handleSave(type: ConfigType): Promise<void> {
  const config = parseConfigText(getConfigTextByType(type));
  if (!config) return;

  try {
    await configService.updateConfig({ configType: type, config });
    MessagePlugin.success('配置保存成功');
    await loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存配置失败';
    MessagePlugin.error(message);
  }
}

async function handleValidate(type: ConfigType): Promise<void> {
  const config = parseConfigText(getConfigTextByType(type));
  if (!config) return;

  try {
    const result = await configService.validateConfig({ configType: type, config });
    validationResult.value = result;
    validationDialogVisible.value = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : '验证配置失败';
    MessagePlugin.error(message);
  }
}

async function fetchBackups(): Promise<void> {
  backupLoading.value = true;
  try {
    const result = await configService.getBackupList();
    backups.value = result.backups;
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取备份列表失败';
    MessagePlugin.error(message);
  } finally {
    backupLoading.value = false;
  }
}

async function handleCreateBackup(): Promise<void> {
  try {
    const result = await configService.createBackup({ description: `手动备份 - ${new Date().toLocaleString('zh-CN')}` });
    MessagePlugin.success(`备份创建成功: ${result.backupId}`);
    await fetchBackups();
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建备份失败';
    MessagePlugin.error(message);
  }
}

async function handleRestore(backupId: string): Promise<void> {
  try {
    await configService.restoreFromBackup({ backupId });
    MessagePlugin.success('配置恢复成功');
    await loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : '恢复配置失败';
    MessagePlugin.error(message);
  }
}

// --- Lifecycle ---
onMounted(async () => {
  await loadConfig();
  await fetchBackups();
});
</script>

<style scoped>
.config-page__tabs {
  margin-top: var(--space-4);
}

.config-page__panel {
  padding: var(--space-5);
}

.config-page__editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.config-page__editor-title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.config-page__editor-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.config-page__textarea {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.config-page__textarea :deep(textarea) {
  font-family: var(--font-mono) !important;
  font-size: var(--text-sm) !important;
  line-height: var(--leading-relaxed) !important;
}

/* Validation dialog */
.config-page__validation-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--weight-semibold);
  font-size: var(--text-base);
  margin-bottom: var(--space-4);
}

.config-page__validation-status--valid {
  background: var(--success-light);
  color: var(--success);
}

.config-page__validation-status--invalid {
  background: var(--danger-light);
  color: var(--danger);
}

.config-page__validation-section {
  margin-bottom: var(--space-4);
}

.config-page__validation-section-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.config-page__validation-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  margin-bottom: var(--space-1);
}

.config-page__validation-item--error {
  background: var(--danger-light);
  color: var(--danger);
}

.config-page__validation-item--warning {
  background: var(--warning-light);
  color: var(--warning);
}

.config-page__validation-path {
  font-family: var(--font-mono);
  font-weight: var(--weight-medium);
  min-width: 120px;
}

.config-page__validation-message {
  flex: 1;
  color: var(--text-primary);
}

.config-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.config-page__header-content {
  flex: 1;
}
</style>
