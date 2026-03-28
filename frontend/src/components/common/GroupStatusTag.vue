<template>
  <t-tag :theme="theme" variant="light" size="small">
    {{ label }} ({{ healthScore }})
  </t-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Tag as TTag } from 'tdesign-vue-next';

const props = defineProps<{
  isHealthy: boolean;
  healthScore: number;
}>();

const theme = computed<'success' | 'warning' | 'danger'>(() => {
  if (props.healthScore > 80) return 'success';
  if (props.healthScore > 50) return 'warning';
  return 'danger';
});

const label = computed(() => {
  if (props.healthScore > 80) return '健康';
  if (props.healthScore > 50) return '警告';
  return '异常';
});
</script>
