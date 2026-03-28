<template>
  <t-tag :theme="theme" variant="light" size="small">
    {{ label }}
  </t-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Tag as TTag } from 'tdesign-vue-next';

type StatusValue =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error'
  | 'available'
  | 'unavailable'
  | 'healthy'
  | 'active'
  | 'inactive';

const props = defineProps<{
  status: StatusValue;
}>();

const themeMap: Record<StatusValue, 'success' | 'warning' | 'default' | 'danger'> = {
  connected: 'success',
  available: 'success',
  healthy: 'success',
  active: 'success',
  connecting: 'warning',
  disconnected: 'default',
  unavailable: 'default',
  inactive: 'default',
  error: 'danger',
};

const labelMap: Record<StatusValue, string> = {
  connected: '已连接',
  disconnected: '已断开',
  connecting: '连接中',
  error: '错误',
  available: '可用',
  unavailable: '不可用',
  healthy: '健康',
  active: '活跃',
  inactive: '未激活',
};

const theme = computed(() => themeMap[props.status] ?? 'default');
const label = computed(() => labelMap[props.status] ?? props.status);
</script>
