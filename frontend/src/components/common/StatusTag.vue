<template>
  <t-tag 
    :theme="tagTheme" 
    :variant="variant"
    :icon="icon"
    :class="['status-tag', `status-tag--${status}`]"
  >
    {{ text }}
  </t-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  CheckCircleIcon, 
  CloseCircleIcon, 
  LoadingIcon, 
  ErrorCircleIcon 
} from 'tdesign-icons-vue-next';
import type { ServerStatus } from '@/types/server';

interface Props {
  status: ServerStatus;
  variant?: 'dark' | 'light' | 'outline' | 'light-outline';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'light',
});

// 状态配置映射
const statusConfig = {
  connected: {
    theme: 'success' as const,
    text: '已连接',
    icon: CheckCircleIcon,
  },
  disconnected: {
    theme: 'default' as const,
    text: '未连接',
    icon: CloseCircleIcon,
  },
  connecting: {
    theme: 'warning' as const,
    text: '连接中',
    icon: LoadingIcon,
  },
  error: {
    theme: 'danger' as const,
    text: '错误',
    icon: ErrorCircleIcon,
  },
};

const config = computed(() => {
  // 调试：检查 status 类型
  if (typeof props.status !== 'string') {
    console.error('StatusTag: status is not a string', props.status);
    return statusConfig.disconnected; // 默认返回未连接状态
  }
  const config = statusConfig[props.status];
  if (!config) {
    console.error('StatusTag: invalid status value', props.status);
    return statusConfig.disconnected; // 默认返回未连接状态
  }
  return config;
});

const tagTheme = computed(() => config.value.theme);
const text = computed(() => config.value.text);
const icon = computed(() => config.value.icon);
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-tag--connecting :deep(.t-icon) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>