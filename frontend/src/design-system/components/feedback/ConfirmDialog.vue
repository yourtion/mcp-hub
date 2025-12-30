<template>
  <t-dialog
    :visible="localVisible"
    :header="props.title"
    :width="props.width"
    :confirm-btn="confirmButtonProps"
    :cancel-btn="props.cancelText ? { content: props.cancelText } : undefined"
    :close-on-overlay-click="props.closeOnOverlayClick"
    :attach-body="true"
    @confirm="handleConfirm"
    @cancel="handleCancel"
    @close="handleClose"
  >
    <!-- 图标 -->
    <div v-if="props.showIcon" class="ds-confirm-dialog__icon" :class="`ds-confirm-dialog__icon--${props.type}`">
      <component :is="iconComponent" size="48px" />
    </div>

    <!-- 内容 -->
    <div class="ds-confirm-dialog__content">
      <p v-if="props.content">{{ props.content }}</p>
      <slot v-else />
    </div>

    <!-- 额外信息 -->
    <div v-if="props.extra" class="ds-confirm-dialog__extra">
      {{ props.extra }}
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue';
import {
  InfoCircleIcon,
  CheckCircleIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-vue-next';

export interface ConfirmDialogProps {
  visible: boolean;
  title?: string;
  content?: string;
  extra?: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  showIcon?: boolean;
  width?: string | number;
  closeOnOverlayClick?: boolean;
  asyncConfirm?: boolean;
}

const props = withDefaults(defineProps<ConfirmDialogProps>(), {
  type: 'info',
  confirmText: '确定',
  cancelText: '取消',
  showIcon: true,
  width: 420,
  closeOnOverlayClick: false,
  asyncConfirm: false,
});

// Emits
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'confirm': [];
  'cancel': [];
  'close': [];
}>();

// 状态
const localVisible = ref(props.visible);
const confirming = ref(false);

// 计算属性
const iconComponent = computed(() => {
  const iconMap: Record<string, Component> = {
    info: InfoCircleIcon,
    success: CheckCircleIcon,
    warning: ErrorCircleIcon,
    danger: ErrorCircleIcon,
  };
  return iconMap[props.type] || iconMap.info;
});

const confirmButtonProps = computed(() => {
  const themeMap: Record<string, string> = {
    info: 'primary',
    success: 'success',
    warning: 'warning',
    danger: 'danger',
  };

  return {
    theme: themeMap[props.type] || 'primary',
    content: props.confirmText,
    loading: confirming.value,
  };
});

// 方法
const handleConfirm = async () => {
  if (props.asyncConfirm) {
    confirming.value = true;
    try {
      await new Promise((resolve) => {
        emit('confirm');
        // 等待父组件处理完成后 resolve
        setTimeout(() => {
          confirming.value = false;
          localVisible.value = false;
        }, 300);
      });
    } catch (error) {
      confirming.value = false;
    }
  } else {
    localVisible.value = false;
    emit('confirm');
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

// 监听 visible 变化
watch(
  () => props.visible,
  (val) => {
    localVisible.value = val;
  }
);

watch(localVisible, (val) => {
  emit('update:visible', val);
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';

.ds-confirm-dialog {
  &__icon {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: @spacing-lg;

    &--info {
      color: var(--td-brand-color);
    }

    &--success {
      color: var(--td-success-color);
    }

    &--warning {
      color: var(--td-warning-color);
    }

    &--danger {
      color: var(--td-error-color);
    }
  }

  &__content {
    text-align: center;
    margin-bottom: @spacing-lg;
    font-size: var(--td-font-size-base);
    color: var(--td-text-color-primary);
    line-height: var(--td-line-heading);
  }

  &__extra {
    padding: @spacing-md;
    margin-top: @spacing-md;
    background: var(--td-bg-color-container-hover);
    border-radius: var(--td-radius-default);
    font-size: var(--td-font-size-sm);
    color: var(--td-text-color-secondary);
  }

  // 对话框样式调整
  :deep(.t-dialog__body) {
    padding: @spacing-xxl @spacing-lg;
  }

  :deep(.t-dialog__header) {
    padding-top: @spacing-xxl;
  }
}
</style>
