<template>
  <t-tag
    :theme="tagTheme"
    :variant="variant"
    :class="['group-status-tag', `group-status-tag--${status}`]"
  >
    <component :is="icon" size="14px" />
    {{ text }}
  </t-tag>
</template>

<script setup lang="ts">
import { computed, markRaw } from 'vue';
import {
  CheckCircleFilledIcon,
  CloseCircleFilledIcon,
  InfoCircleFilledIcon,
  ErrorCircleFilledIcon
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
    icon: markRaw(CheckCircleFilledIcon),
  },
  partial: {
    theme: 'warning' as const,
    text: '部分健康',
    icon: markRaw(InfoCircleFilledIcon),
  },
  unhealthy: {
    theme: 'danger' as const,
    text: '不健康',
    icon: markRaw(ErrorCircleFilledIcon),
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