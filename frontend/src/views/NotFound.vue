<template>
  <ErrorPage
    :code="404"
    title="页面未找到"
    description="抱歉，您访问的页面不存在或已被删除"
    :show-back="true"
    :show-home="true"
  />
</template>

<script setup lang="ts">
import ErrorPage from '@/design-system/components/feedback/ErrorPage.vue';
</script>
