<template>
  <t-tag 
    :theme="tagTheme" 
    :variant="variant"
    :icon="icon"
    :class="['group-status-tag', `group-status-tag--${status}`]"
  >
    {{ text }}
  </t-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  CheckCircleIcon, 
  CloseCircleIcon, 
  WarningCircleIcon,
  ErrorCircleIcon 
} from 'tdesign-icons-vue-next';

interface Props {
  status: 'healthy' | 'partial' | 'unhealthy';
  variant?: 'dark' | 'light' | 'outline' | 'light-outline';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'light',
});

// 状态配置映射
const statusConfig = {
  healthy: {
    theme: 'success' as const,
    text: '健康',
    icon: CheckCircleIcon,
  },
  partial: {
    theme: 'warning' as const,
    text: '部分健康',
    icon: WarningCircleIcon,
  },
  unhealthy: {
    theme: 'danger' as const,
    text: '不健康',
    icon: ErrorCircleIcon,
  },
};

const config = computed(() => statusConfig[props.status]);
const tagTheme = computed(() => config.value.theme);
const text = computed(() => config.value.text);
const icon = computed(() => config.value.icon);
</script>

<style scoped>
.group-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>