<template>
  <t-loading
    v-if="globalLoading"
    :loading="globalLoading"
    fullscreen
    :text="loadingText"
    :prevent-scroll-through="true"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Loading as TLoading } from 'tdesign-vue-next';
import { useLoading } from '@/composables';

const { globalLoading } = useLoading();
const loadingText = ref('加载中...');
</script>

<style scoped>
/* 全局加载样式已由 TDesign 提供 */
</style>
