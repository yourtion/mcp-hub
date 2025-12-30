<template>
  <t-dialog
    :visible="localVisible"
    :header="dialogTitle"
    :width="props.width"
    :confirm-btn="confirmButtonProps"
    :cancel-btn="cancelButtonProps"
    :close-on-overlay-click="props.closeOnOverlayClick"
    :attach-body="true"
    @confirm="handleSubmit"
    @cancel="handleCancel"
    @close="handleClose"
  >
    <t-form
      ref="formRef"
      :data="localFormData"
      :rules="localRules"
      :label-width="props.labelWidth"
      :label-align="props.labelAlign"
      :colon="props.colon"
      :disabled="props.mode === 'view'"
      @reset="handleReset"
    >
      <template v-for="field in visibleFields" :key="field.name">
        <!-- 表单分组 -->
        <template v-if="field.type === 'section'">
          <div class="ds-form-dialog__section">
            <div class="ds-form-dialog__section-header">
              <h4>{{ field.label }}</h4>
              <p v-if="field.description">{{ field.description }}</p>
            </div>
          </div>
        </template>

        <!-- 普通字段 -->
        <t-form-item
          v-else
          :name="field.name"
          :label="field.label"
          :required="field.required"
          :help="field.tip"
        >
          <!-- 输入框 -->
          <t-input
            v-if="field.type === 'input'"
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
            :clearable="true"
            :disabled="field.disabled"
          />

          <!-- 文本域 -->
          <t-textarea
            v-else-if="field.type === 'textarea'"
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
            :autosize="{ minRows: 3, maxRows: 10 }"
            :disabled="field.disabled"
          />

          <!-- 数字输入 -->
          <t-input-number
            v-else-if="field.type === 'number'"
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            v-bind="field.props"
          />

          <!-- 选择器 -->
          <t-select
            v-else-if="field.type === 'select'"
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
            :clearable="true"
            :disabled="field.disabled"
            :multiple="field.props?.multiple"
            :filterable="field.props?.filterable"
          >
            <t-option
              v-for="option in field.options"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            >
              <template v-if="option.icon" #prefix-icon>
                <component :is="option.icon" />
              </template>
              {{ option.label }}
            </t-option>
          </t-select>

          <!-- 日期选择 -->
          <t-date-picker
            v-else-if="field.type === 'date'"
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            v-bind="field.props"
          />

          <!-- 开关 -->
          <t-switch
            v-else-if="field.type === 'switch'"
            v-model="localFormData[field.name]"
            :disabled="field.disabled"
            v-bind="field.props"
          />

          <!-- 复选框 -->
          <t-checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="localFormData[field.name]"
            :disabled="field.disabled"
          >
            {{ field.checkboxLabel }}
          </t-checkbox>

          <!-- 单选框组 -->
          <t-radio-group
            v-else-if="field.type === 'radio'"
            v-model="localFormData[field.name]"
            :disabled="field.disabled"
          >
            <t-radio
              v-for="option in field.options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </t-radio>
          </t-radio-group>

          <!-- 文件上传 -->
          <t-upload
            v-else-if="field.type === 'upload'"
            v-model="localFormData[field.name]"
            :disabled="field.disabled"
            v-bind="field.props"
          />

          <!-- 自定义插槽 -->
          <slot
            v-else-if="field.type === 'slot'"
            :name="field.name"
            :field="field"
            :value="localFormData[field.name]"
          />

          <!-- 默认：文本输入 -->
          <t-input
            v-else
            v-model="localFormData[field.name]"
            :placeholder="field.placeholder"
          />
        </t-form-item>
      </template>
    </t-form>

    <!-- 底部额外内容 -->
    <div v-if="$slots.footer" class="ds-form-dialog__footer">
      <slot name="footer" />
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, type PropType } from 'vue';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';

export interface FormFieldOption {
  label: string;
  value: any;
  icon?: any;
}

export interface FormField {
  name: string;
  label: string;
  type:
    | 'input'
    | 'textarea'
    | 'number'
    | 'select'
    | 'date'
    | 'switch'
    | 'checkbox'
    | 'radio'
    | 'upload'
    | 'section'
    | 'slot';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  span?: number;
  tip?: string;
  description?: string;
  checkboxLabel?: string;
  options?: FormFieldOption[];
  defaultValue?: any;
  props?: Record<string, any>;
  visible?: boolean | ((formData: Record<string, any>) => boolean);
}

export interface FormDialogProps {
  visible: boolean;
  title?: string;
  mode: 'create' | 'edit' | 'view';
  formState: Record<string, any>;
  fields: FormField[];
  rules?: Record<string, FormRule[]>;
  labelWidth?: string | number;
  labelAlign?: 'left' | 'right' | 'top';
  colon?: boolean;
  loading?: boolean;
  width?: string | number;
  closeOnOverlayClick?: boolean;
}

const props = withDefaults(defineProps<FormDialogProps>(), {
  labelWidth: '100px',
  labelAlign: 'right',
  colon: true,
  loading: false,
  width: 600,
  closeOnOverlayClick: false,
});

// Emits
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'update:formState': [formState: Record<string, any>];
  'submit': [formState: Record<string, any>];
  'cancel': [];
  'close': [];
}>();

// Refs
const formRef = ref<FormInstanceFunctions>();
const localVisible = ref(props.visible);
const localFormData = ref<Record<string, any>>({ ...props.formState });
const localRules = ref<Record<string, FormRule[]>>(props.rules || {});

// 计算属性
const dialogTitle = computed(() => {
  if (props.title) return props.title;
  const titles = {
    create: '新建',
    edit: '编辑',
    view: '查看',
  };
  return titles[props.mode];
});

const confirmButtonProps = computed(() => {
  const baseProps = {
    theme: 'primary' as const,
    loading: props.loading,
    content: props.mode === 'view' ? '关闭' : '确定',
  };

  if (props.mode === 'view') {
    return { ...baseProps, content: '关闭', theme: 'default' as const };
  }

  return baseProps;
});

const cancelButtonProps = computed(() => {
  return {
    theme: 'default',
    content: props.mode === 'view' ? undefined : '取消',
  };
});

const visibleFields = computed(() => {
  return props.fields.filter((field) => {
    if (typeof field.visible === 'boolean') return field.visible;
    if (typeof field.visible === 'function') {
      return field.visible(localFormData.value);
    }
    return true;
  });
});

// 方法
const handleSubmit = async () => {
  if (props.mode === 'view') {
    handleClose();
    return;
  }

  try {
    // 验证表单
    const valid = await formRef.value?.validate();
    if (!valid) return;

    // 发送提交事件
    emit('submit', localFormData.value);
  } catch (error) {
    console.error('Form validation failed:', error);
    MessagePlugin.error('请检查表单填写是否正确');
  }
};

const handleCancel = () => {
  localVisible.value = false;
  emit('cancel');
};

const handleClose = () => {
  localVisible.value = false;
  emit('close');
};

const handleReset = () => {
  localFormData.value = { ...props.formState };
};

// 暴露方法
defineExpose({
  validate: () => formRef.value?.validate(),
  reset: () => {
    formRef.value?.reset();
    localFormData.value = { ...props.formState };
  },
  setFieldValue: (field: string, value: any) => {
    localFormData.value[field] = value;
  },
  getFormData: () => localFormData.value,
});

// 监听
watch(
  () => props.visible,
  (val) => {
    localVisible.value = val;
    if (val) {
      // 对话框打开时重置表单数据
      localFormData.value = { ...props.formState };
    }
  }
);

watch(localVisible, (val) => {
  emit('update:visible', val);
});

watch(
  () => props.formState,
  (newState) => {
    localFormData.value = { ...newState };
  },
  { deep: true }
);

watch(localFormData, (newData) => {
  emit('update:formState', { ...newData });
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';

.ds-form-dialog__section {
  margin: @spacing-lg 0;
  padding: @spacing-md @spacing-lg;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-default);
  border-left: 3px solid var(--td-brand-color);
}

.ds-form-dialog__section-header h4 {
  margin: 0 0 @spacing-xs 0;
  font-size: var(--td-font-size-title-medium);
  font-weight: var(--td-font-weight-medium);
  color: var(--td-text-color-primary);
}

.ds-form-dialog__section-header p {
  margin: 0;
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-secondary);
}

.ds-form-dialog__footer {
  margin-top: @spacing-lg;
  padding-top: @spacing-lg;
  border-top: 1px solid var(--td-border-level-1-color);
}
</style>
