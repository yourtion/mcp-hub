<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="配置验证结果"
    width="800px"
    :confirm-btn="{ content: '确认', theme: 'primary' }"
    :cancel-btn="{ content: '关闭', theme: 'default' }"
    @confirm="handleConfirm"
  >
    <div class="validation-dialog-content">
      <!-- 验证结果标签页 -->
      <t-tabs v-model="activeTab" placement="top">
        <!-- 验证结果 -->
        <t-tab-panel value="validation" label="验证结果">
          <div v-if="validationResult" class="validation-result">
            <!-- 验证状态 -->
            <div class="validation-status">
              <t-result
                :theme="validationResult.valid ? 'success' : 'error'"
                :title="validationResult.valid ? '配置验证通过' : '配置验证失败'"
                :description="getValidationDescription()"
              />
            </div>

            <!-- 错误列表 -->
            <div v-if="validationResult.errors.length > 0" class="validation-errors">
              <h5>错误信息</h5>
              <div class="error-list">
                <div
                  v-for="(error, index) in validationResult.errors"
                  :key="index"
                  class="error-item"
                >
                  <div class="error-icon">
                    <t-icon name="close-circle-filled" />
                  </div>
                  <div class="error-content">
                    <div class="error-path">{{ error.path }}</div>
                    <div class="error-message">{{ error.message }}</div>
                    <div class="error-code">错误代码: {{ error.code }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 警告列表 -->
            <div v-if="validationResult.warnings.length > 0" class="validation-warnings">
              <h5>警告信息</h5>
              <div class="warning-list">
                <div
                  v-for="(warning, index) in validationResult.warnings"
                  :key="index"
                  class="warning-item"
                >
                  <div class="warning-icon">
                    <t-icon name="error-circle-filled" />
                  </div>
                  <div class="warning-content">
                    <div class="warning-path">{{ warning.path }}</div>
                    <div class="warning-message">{{ warning.message }}</div>
                    <div class="warning-code">警告代码: {{ warning.code }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 影响分析 -->
            <div v-if="validationResult.impact" class="impact-analysis">
              <h5>影响分析</h5>
              <div class="impact-content">
                <div class="impact-item">
                  <strong>受影响的服务:</strong>
                  <t-tag
                    v-for="service in validationResult.impact.affectedServices"
                    :key="service"
                    theme="primary"
                    variant="light"
                    size="small"
                  >
                    {{ service }}
                  </t-tag>
                </div>
                
                <div v-if="validationResult.impact.requiresRestart" class="impact-item">
                  <t-alert theme="warning" message="此配置更改需要重启系统才能生效" />
                </div>
                
                <div v-if="validationResult.impact.potentialIssues.length > 0" class="impact-item">
                  <strong>潜在问题:</strong>
                  <ul class="issue-list">
                    <li
                      v-for="issue in validationResult.impact.potentialIssues"
                      :key="issue"
                    >
                      {{ issue }}
                    </li>
                  </ul>
                </div>
                
                <div v-if="validationResult.impact.recommendations.length > 0" class="impact-item">
                  <strong>建议:</strong>
                  <ul class="recommendation-list">
                    <li
                      v-for="recommendation in validationResult.impact.recommendations"
                      :key="recommendation"
                    >
                      {{ recommendation }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </t-tab-panel>

        <!-- 测试结果 -->
        <t-tab-panel value="test" label="测试结果">
          <div v-if="testResult" class="test-result">
            <!-- 测试摘要 -->
            <div class="test-summary">
              <t-result
                :theme="testResult.success ? 'success' : 'error'"
                :title="testResult.success ? '配置测试通过' : '配置测试失败'"
                :description="getTestDescription()"
              />
              
              <div class="test-stats">
                <t-space>
                  <t-tag theme="success" variant="light">
                    通过: {{ testResult.summary.passed }}
                  </t-tag>
                  <t-tag theme="danger" variant="light">
                    失败: {{ testResult.summary.failed }}
                  </t-tag>
                  <t-tag theme="warning" variant="light">
                    警告: {{ testResult.summary.warnings }}
                  </t-tag>
                  <t-tag theme="default" variant="light">
                    总计: {{ testResult.summary.total }}
                  </t-tag>
                </t-space>
              </div>
            </div>

            <!-- 测试详情 -->
            <div class="test-details">
              <h5>测试详情</h5>
              <div class="test-list">
                <div
                  v-for="(test, index) in testResult.tests"
                  :key="index"
                  class="test-item"
                  :class="test.status"
                >
                  <div class="test-icon">
                    <t-icon
                      :name="getTestIcon(test.status)"
                      :class="test.status"
                    />
                  </div>
                  <div class="test-content">
                    <div class="test-name">{{ test.name }}</div>
                    <div class="test-description">{{ test.description }}</div>
                    <div class="test-message">{{ test.message }}</div>
                    <div v-if="test.details" class="test-details-info">
                      <pre>{{ formatTestDetails(test.details) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </t-tab-panel>

        <!-- 预览结果 -->
        <t-tab-panel value="preview" label="预览结果">
          <div v-if="previewResult" class="preview-result">
            <!-- 变更摘要 -->
            <div class="preview-summary">
              <h5>配置变更预览</h5>
              <p>以下是即将应用的配置更改:</p>
            </div>

            <!-- 变更列表 -->
            <div class="changes-list">
              <div
                v-for="(change, index) in previewResult.changes"
                :key="index"
                class="change-item"
              >
                <div class="change-operation">
                  <t-tag
                    :theme="getChangeOperationTheme(change.operation)"
                    size="small"
                  >
                    {{ getChangeOperationLabel(change.operation) }}
                  </t-tag>
                </div>
                <div class="change-path">{{ change.path }}</div>
                <div class="change-values">
                  <div v-if="change.oldValue !== undefined" class="old-value">
                    <strong>旧值:</strong>
                    <code>{{ formatValue(change.oldValue) }}</code>
                  </div>
                  <div v-if="change.newValue !== undefined" class="new-value">
                    <strong>新值:</strong>
                    <code>{{ formatValue(change.newValue) }}</code>
                  </div>
                </div>
              </div>
            </div>

            <!-- 回滚计划 -->
            <div v-if="previewResult.rollbackPlan.length > 0" class="rollback-plan">
              <h5>回滚计划</h5>
              <ol class="rollback-steps">
                <li
                  v-for="step in previewResult.rollbackPlan"
                  :key="step"
                >
                  {{ step }}
                </li>
              </ol>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type {
  ConfigValidationResponse,
  ConfigTestResult,
  ConfigPreview,
  ConfigTest,
} from '@/types/config';

// Props
interface Props {
  visible: boolean;
  validationResult?: ConfigValidationResponse | null;
  testResult?: ConfigTestResult | null;
  previewResult?: ConfigPreview | null;
}

const props = withDefaults(defineProps<Props>(), {
  validationResult: null,
  testResult: null,
  previewResult: null,
});

// Emits
interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'confirm'): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const dialogVisible = ref(props.visible);
const activeTab = ref('validation');

// 监听visible变化
watch(
  () => props.visible,
  (newVisible) => {
    dialogVisible.value = newVisible;
  }
);

watch(
  () => dialogVisible.value,
  (newVisible) => {
    emit('update:visible', newVisible);
  }
);

// 计算属性
const hasValidationResult = computed(() => !!props.validationResult);
const hasTestResult = computed(() => !!props.testResult);
const hasPreviewResult = computed(() => !!props.previewResult);

// 方法
const handleConfirm = (): void => {
  emit('confirm');
};

const getValidationDescription = (): string => {
  if (!props.validationResult) return '';
  
  const { errors, warnings } = props.validationResult;
  if (errors.length === 0 && warnings.length === 0) {
    return '配置格式正确，所有验证项都通过了检查。';
  }
  
  const parts = [];
  if (errors.length > 0) {
    parts.push(`发现 ${errors.length} 个错误`);
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} 个警告`);
  }
  
  return parts.join('，') + '。';
};

const getTestDescription = (): string => {
  if (!props.testResult) return '';
  
  const { summary } = props.testResult;
  return `共执行 ${summary.total} 项测试，${summary.passed} 项通过，${summary.failed} 项失败，${summary.warnings} 项警告。`;
};

const getTestIcon = (status: string): string => {
  switch (status) {
    case 'passed':
      return 'check-circle-filled';
    case 'failed':
      return 'close-circle-filled';
    case 'warning':
      return 'error-circle-filled';
    default:
      return 'help-circle-filled';
  }
};

const formatTestDetails = (details: unknown): string => {
  if (typeof details === 'string') {
    return details;
  }
  return JSON.stringify(details, null, 2);
};

const getChangeOperationTheme = (operation: string): string => {
  switch (operation) {
    case 'add':
      return 'success';
    case 'update':
      return 'warning';
    case 'delete':
      return 'danger';
    default:
      return 'default';
  }
};

const getChangeOperationLabel = (operation: string): string => {
  switch (operation) {
    case 'add':
      return '新增';
    case 'update':
      return '修改';
    case 'delete':
      return '删除';
    default:
      return '未知';
  }
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
};

// 根据结果自动切换标签页
watch(
  [hasValidationResult, hasTestResult, hasPreviewResult],
  ([validation, test, preview]) => {
    if (test) {
      activeTab.value = 'test';
    } else if (preview) {
      activeTab.value = 'preview';
    } else if (validation) {
      activeTab.value = 'validation';
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.validation-dialog-content {
  max-height: 600px;
  overflow-y: auto;
}

.validation-status,
.test-summary {
  margin-bottom: 24px;
}

.test-stats {
  margin-top: 16px;
  text-align: center;
}

.validation-errors,
.validation-warnings,
.impact-analysis,
.test-details {
  margin-bottom: 24px;
}

.validation-errors h5,
.validation-warnings h5,
.impact-analysis h5,
.test-details h5,
.preview-summary h5,
.rollback-plan h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.error-list,
.warning-list,
.test-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-item,
.warning-item,
.test-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.error-item {
  background-color: #fef2f2;
  border-color: #fecaca;
}

.warning-item {
  background-color: #fffbeb;
  border-color: #fed7aa;
}

.test-item.passed {
  background-color: #f0fdf4;
  border-color: #bbf7d0;
}

.test-item.failed {
  background-color: #fef2f2;
  border-color: #fecaca;
}

.test-item.warning {
  background-color: #fffbeb;
  border-color: #fed7aa;
}

.error-icon,
.warning-icon,
.test-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon {
  color: #dc2626;
}

.warning-icon {
  color: #d97706;
}

.test-icon.passed {
  color: #16a34a;
}

.test-icon.failed {
  color: #dc2626;
}

.test-icon.warning {
  color: #d97706;
}

.error-content,
.warning-content,
.test-content {
  flex: 1;
  min-width: 0;
}

.error-path,
.warning-path,
.test-name {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 4px;
}

.error-message,
.warning-message,
.test-description {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.test-message {
  font-size: 12px;
  color: #374151;
  margin-bottom: 8px;
}

.error-code,
.warning-code {
  font-size: 11px;
  color: #9ca3af;
  font-family: monospace;
}

.test-details-info {
  margin-top: 8px;
}

.test-details-info pre {
  font-size: 11px;
  color: #6b7280;
  background-color: #f9fafb;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0;
}

.impact-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.impact-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.impact-item strong {
  font-size: 13px;
  color: #374151;
}

.issue-list,
.recommendation-list {
  margin: 0;
  padding-left: 20px;
}

.issue-list li,
.recommendation-list li {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.change-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background-color: #f9fafb;
}

.change-operation {
  margin-bottom: 8px;
}

.change-path {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
  font-family: monospace;
}

.change-values {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.old-value,
.new-value {
  font-size: 12px;
  color: #6b7280;
}

.old-value code,
.new-value code {
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 11px;
  margin-left: 8px;
}

.rollback-steps {
  margin: 0;
  padding-left: 20px;
}

.rollback-steps li {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.preview-summary p {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #6b7280;
}
</style>