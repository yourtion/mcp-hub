<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="验证密钥管理"
    width="700px"
    :cancel-btn="{ content: '关闭' }"
    @cancel="handleCancel"
    @close="handleCancel"
  >
    <div class="group-validation-manager">
      <t-alert
        v-if="group"
        theme="info"
        :message="groupMessage"
        class="group-info"
      />

      <!-- 当前状态 -->
      <div class="validation-section">
        <h4 class="section-title">当前状态</h4>
        <div v-if="loading" class="loading-status">
          <t-loading text="加载中..." size="small" />
        </div>
        <div v-else-if="validationStatus" class="status-details">
          <div class="status-item">
            <span class="status-label">验证状态:</span>
            <t-tag
              :theme="validationStatus.enabled ? 'success' : 'default'"
              variant="light"
            >
              {{ validationStatus.enabled ? '已启用' : '已禁用' }}
            </t-tag>
          </div>
          <div class="status-item">
            <span class="status-label">密钥状态:</span>
            <t-tag
              :theme="validationStatus.hasKey ? 'primary' : 'default'"
              variant="light"
            >
              {{ validationStatus.hasKey ? '已设置' : '未设置' }}
            </t-tag>
          </div>
          <div v-if="validationStatus.createdAt" class="status-item">
            <span class="status-label">创建时间:</span>
            <span class="status-value">{{ formatDateTime(validationStatus.createdAt) }}</span>
          </div>
          <div v-if="validationStatus.lastUpdated" class="status-item">
            <span class="status-label">更新时间:</span>
            <span class="status-value">{{ formatDateTime(validationStatus.lastUpdated) }}</span>
          </div>
        </div>
        <t-empty v-else description="无法加载验证状态" />
      </div>

      <!-- 密钥操作 -->
      <div class="validation-section">
        <h4 class="section-title">密钥操作</h4>
        <div class="key-actions">
          <t-button
            theme="primary"
            variant="outline"
            @click="handleGenerateKey"
            :loading="generatingKey"
          >
            <template #icon>
              <AddIcon />
            </template>
            生成新密钥
          </t-button>
          <t-button
            v-if="validationStatus?.hasKey"
            theme="default"
            variant="outline"
            @click="handleSetKey"
          >
            <template #icon>
              <KeyIcon />
            </template>
            设置密钥
          </t-button>
          <t-button
            v-if="validationStatus?.hasKey"
            theme="default"
            variant="outline"
            @click="handleValidateKey"
          >
            <template #icon>
              <CheckCircleFilledIcon />
            </template>
            验证密钥
          </t-button>
          <t-button
            v-if="validationStatus?.hasKey"
            theme="danger"
            variant="outline"
            @click="handleDeleteKey"
          >
            <template #icon>
              <DeleteIcon />
            </template>
            删除密钥
          </t-button>
        </div>
      </div>

      <!-- 密钥设置 -->
      <div v-if="showKeyForm" class="validation-section">
        <h4 class="section-title">设置验证密钥</h4>
        <t-form
          ref="formRef"
          :model="keyForm"
          :rules="keyFormRules"
          label-align="top"
          @submit="handleKeySubmit"
        >
          <t-form-item label="验证密钥" name="validationKey">
            <t-input
              v-model="keyForm.validationKey"
              type="password"
              placeholder="请输入验证密钥"
              :show-password="showPassword"
              @click-password-icon="togglePasswordVisibility"
            />
            <template #help>
              密钥长度至少8个字符，必须包含字母和数字
            </template>
          </t-form-item>
          <t-form-item label="启用验证" name="enabled">
            <t-switch v-model="keyForm.enabled" />
            <template #help>
              启用后，访问该组需要提供验证密钥
            </template>
          </t-form-item>
          <div class="form-actions">
            <t-button
              theme="default"
              variant="outline"
              @click="cancelKeyForm"
            >
              取消
            </t-button>
            <t-button
              type="submit"
              theme="primary"
              :loading="submittingKey"
            >
              保存
            </t-button>
          </div>
        </t-form>
      </div>

      <!-- 密钥验证 -->
      <div v-if="showValidateForm" class="validation-section">
        <h4 class="section-title">验证密钥</h4>
        <t-form
          ref="validateFormRef"
          :model="validateForm"
          :rules="validateFormRules"
          label-align="top"
          @submit="handleValidateSubmit"
        >
          <t-form-item label="验证密钥" name="validationKey">
            <t-input
              v-model="validateForm.validationKey"
              type="password"
              placeholder="请输入验证密钥进行验证"
              :show-password="showPassword"
              @click-password-icon="togglePasswordVisibility"
            />
          </t-form-item>
          <div class="form-actions">
            <t-button
              theme="default"
              variant="outline"
              @click="cancelValidateForm"
            >
              取消
            </t-button>
            <t-button
              type="submit"
              theme="primary"
              :loading="validatingKey"
            >
              验证
            </t-button>
          </div>
        </t-form>
      </div>

      <!-- 生成的密钥 -->
      <div v-if="generatedKey" class="validation-section">
        <h4 class="section-title">新生成的密钥</h4>
        <t-alert theme="success" class="key-success-alert">
          请妥善保存此密钥，此为唯一显示机会
        </t-alert>
        <div class="generated-key-display">
          <div class="key-content">
            <t-input
              :value="generatedKey.validationKey"
              readonly
              type="password"
              :show-password="showGeneratedKey"
              @click-password-icon="toggleGeneratedKeyVisibility"
            />
          </div>
          <t-button
            theme="default"
            variant="outline"
            @click="copyGeneratedKey"
            :loading="copyingKey"
          >
            <template #icon>
              <CopyIcon />
            </template>
            复制
          </t-button>
        </div>
        <div v-if="generatedKey.security" class="security-info">
          <h5 class="security-title">安全评估</h5>
          <div class="security-items">
            <div class="security-item">
              <span class="security-label">密钥强度:</span>
              <t-tag
                :theme="getSecurityTagTheme(generatedKey.security.keyComplexity)"
                variant="light"
              >
                {{ getSecurityLabelText(generatedKey.security.keyComplexity) }}
              </t-tag>
            </div>
            <div class="security-item">
              <span class="security-label">密钥长度:</span>
              <span class="security-value">{{ generatedKey.security.keyLength }} 字符</span>
            </div>
            <div class="security-item">
              <span class="security-label">熵值:</span>
              <span class="security-value">{{ generatedKey.security.entropy }} bits</span>
            </div>
          </div>
          <div v-if="generatedKey.warnings.length > 0" class="security-warnings">
            <h6 class="warnings-title">安全建议:</h6>
            <ul class="warnings-list">
              <li v-for="(warning, index) in generatedKey.warnings" :key="index">
                {{ warning }}
              </li>
            </ul>
          </div>
        </div>
        <div class="generated-key-actions">
          <t-button
            theme="default"
            variant="outline"
            @click="closeGeneratedKey"
          >
            我已保存
          </t-button>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  AddIcon,
  KeyIcon,
  CheckCircleFilledIcon,
  DeleteIcon,
  CopyIcon,
} from 'tdesign-icons-vue-next';
import type { FormInstance, FormRule } from 'tdesign-vue-next';
import { useGroupStore } from '@/stores/group';
import type { GroupInfo } from '@/types/group';

interface Props {
  visible: boolean;
  group?: GroupInfo | null;
}

interface Emits {
  'update:visible': [visible: boolean];
  'success': [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 状态
const groupStore = useGroupStore();
const formRef = ref<FormInstance>();
const validateFormRef = ref<FormInstance>();
const loading = ref(false);
const generatingKey = ref(false);
const submittingKey = ref(false);
const validatingKey = ref(false);
const copyingKey = ref(false);
const showPassword = ref(false);
const showGeneratedKey = ref(false);
const showKeyForm = ref(false);
const showValidateForm = ref(false);
const validationStatus = ref<{
  enabled: boolean;
  hasKey: boolean;
  createdAt?: string;
  lastUpdated?: string;
} | null>(null);
const generatedKey = ref<{
  validationKey: string;
  security: {
    keyComplexity: 'weak' | 'medium' | 'strong';
    keyLength: number;
    entropy: number;
    recommendations: string[];
  };
  warnings: string[];
} | null>(null);

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const groupMessage = computed(() => {
  return props.group ? `管理组 "${props.group.name}" 的验证密钥设置` : '';
});

// 表单数据
const keyForm = ref({
  validationKey: '',
  enabled: true,
});

const validateForm = ref({
  validationKey: '',
});

// 表单验证规则
const keyFormRules: Record<string, FormRule[]> = {
  validationKey: [
    { required: true, message: '请输入验证密钥', trigger: 'blur' },
    { min: 8, message: '密钥长度至少为8个字符', trigger: 'blur' },
    { max: 128, message: '密钥长度不能超过128个字符', trigger: 'blur' },
    {
      pattern: /^(?=.*[a-zA-Z])(?=.*[0-9])/,
      message: '密钥必须包含字母和数字',
      trigger: 'blur',
    },
  ],
};

const validateFormRules: Record<string, FormRule[]> = {
  validationKey: [
    { required: true, message: '请输入验证密钥', trigger: 'blur' },
  ],
};

// 方法
const formatDateTime = (datetime: string) => {
  return new Date(datetime).toLocaleString('zh-CN');
};

const getSecurityTagTheme = (complexity: 'weak' | 'medium' | 'strong') => {
  switch (complexity) {
    case 'strong':
      return 'success';
    case 'medium':
      return 'warning';
    case 'weak':
      return 'danger';
    default:
      return 'default';
  }
};

const getSecurityLabelText = (complexity: 'weak' | 'medium' | 'strong') => {
  switch (complexity) {
    case 'strong':
      return '强';
    case 'medium':
      return '中';
    case 'weak':
      return '弱';
    default:
      return '未知';
  }
};

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

const toggleGeneratedKeyVisibility = () => {
  showGeneratedKey.value = !showGeneratedKey.value;
};

const loadValidationStatus = async () => {
  if (!props.group) return;

  try {
    loading.value = true;
    const response = await groupStore.getGroupValidationKeyStatus(props.group.id);
    validationStatus.value = response.data.validation;
  } catch (error) {
    console.error('加载验证状态失败:', error);
    MessagePlugin.error('加载验证状态失败');
  } finally {
    loading.value = false;
  }
};

const handleGenerateKey = async () => {
  if (!props.group) return;

  try {
    generatingKey.value = true;
    const response = await groupStore.generateGroupValidationKey(props.group.id);
    generatedKey.value = {
      validationKey: response.data.validationKey,
      security: response.data.security,
      warnings: response.data.warnings,
    };
    showKeyForm.value = false;
    showValidateForm.value = false;
  } catch (error) {
    console.error('生成密钥失败:', error);
    MessagePlugin.error('生成密钥失败');
  } finally {
    generatingKey.value = false;
  }
};

const handleSetKey = () => {
  showKeyForm.value = true;
  showValidateForm.value = false;
  generatedKey.value = null;
  keyForm.value = {
    validationKey: '',
    enabled: true,
  };
};

const handleValidateKey = () => {
  showValidateForm.value = true;
  showKeyForm.value = false;
  generatedKey.value = null;
  validateForm.value = {
    validationKey: '',
  };
};

const handleDeleteKey = async () => {
  if (!props.group) return;

  if (!confirm('确定要删除验证密钥吗？删除后将无法恢复。')) {
    return;
  }

  try {
    await groupStore.deleteGroupValidationKey(props.group.id);
    MessagePlugin.success('验证密钥删除成功');
    await loadValidationStatus();
    showKeyForm.value = false;
    showValidateForm.value = false;
    generatedKey.value = null;
  } catch (error) {
    console.error('删除密钥失败:', error);
    MessagePlugin.error('删除密钥失败');
  }
};

const handleKeySubmit = async () => {
  if (!props.group) return;

  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;

    submittingKey.value = true;
    await groupStore.setGroupValidationKey(props.group.id, {
      validationKey: keyForm.value.validationKey,
      enabled: keyForm.value.enabled,
    });
    
    MessagePlugin.success('验证密钥设置成功');
    showKeyForm.value = false;
    keyForm.value = {
      validationKey: '',
      enabled: true,
    };
    await loadValidationStatus();
    emit('success');
  } catch (error) {
    console.error('设置密钥失败:', error);
    MessagePlugin.error('设置密钥失败');
  } finally {
    submittingKey.value = false;
  }
};

const handleValidateSubmit = async () => {
  if (!props.group) return;

  try {
    const valid = await validateFormRef.value?.validate();
    if (!valid) return;

    validatingKey.value = true;
    const response = await groupStore.validateGroupKey(props.group.id, {
      validationKey: validateForm.value.validationKey,
    });

    if (response.data.valid) {
      MessagePlugin.success('密钥验证成功');
    } else {
      MessagePlugin.warning(`密钥验证失败: ${response.data.message}`);
    }
    
    showValidateForm.value = false;
    validateForm.value = {
      validationKey: '',
    };
  } catch (error) {
    console.error('验证密钥失败:', error);
    MessagePlugin.error('验证密钥失败');
  } finally {
    validatingKey.value = false;
  }
};

const cancelKeyForm = () => {
  showKeyForm.value = false;
  keyForm.value = {
    validationKey: '',
    enabled: true,
  };
  formRef.value?.clearValidate();
};

const cancelValidateForm = () => {
  showValidateForm.value = false;
  validateForm.value = {
    validationKey: '',
  };
  validateFormRef.value?.clearValidate();
};

const copyGeneratedKey = async () => {
  if (!generatedKey.value) return;

  try {
    copyingKey.value = true;
    await navigator.clipboard.writeText(generatedKey.value.validationKey);
    MessagePlugin.success('密钥已复制到剪贴板');
  } catch (error) {
    console.error('复制密钥失败:', error);
    MessagePlugin.error('复制密钥失败');
  } finally {
    copyingKey.value = false;
  }
};

const closeGeneratedKey = () => {
  generatedKey.value = null;
  showGeneratedKey.value = false;
  loadValidationStatus();
  emit('success');
};

const resetState = () => {
  validationStatus.value = null;
  generatedKey.value = null;
  showKeyForm.value = false;
  showValidateForm.value = false;
  showPassword.value = false;
  showGeneratedKey.value = false;
  keyForm.value = {
    validationKey: '',
    enabled: true,
  };
  validateForm.value = {
    validationKey: '',
  };
  formRef.value?.clearValidate();
  validateFormRef.value?.clearValidate();
};

const handleCancel = () => {
  resetState();
  emit('update:visible', false);
};

// 监听器
const handleVisibleChange = async (visible: boolean) => {
  if (visible && props.group) {
    await loadValidationStatus();
  } else {
    resetState();
  }
};

// 初始化
handleVisibleChange(props.visible);
</script>

<style scoped>
.group-validation-manager {
  padding: 16px 0;
}

.group-info {
  margin-bottom: 24px;
}

.validation-section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.loading-status {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  font-weight: 500;
  color: var(--td-text-color-secondary);
  min-width: 80px;
}

.status-value {
  color: var(--td-text-color-primary);
}

.key-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.key-success-alert {
  margin-bottom: 16px;
}

.generated-key-display {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.key-content {
  flex: 1;
}

.security-info {
  background-color: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  padding: 16px;
  margin-bottom: 16px;
}

.security-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.security-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.security-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.security-label {
  font-weight: 500;
  color: var(--td-text-color-secondary);
  min-width: 80px;
}

.security-value {
  color: var(--td-text-color-primary);
}

.security-warnings {
  margin-top: 16px;
}

.warnings-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-warning-color);
}

.warnings-list {
  margin: 0;
  padding-left: 20px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.warnings-list li {
  margin-bottom: 4px;
}

.generated-key-actions {
  display: flex;
  justify-content: center;
}
</style>