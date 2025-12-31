<template>
  <ContentLayout
    :title="toolName"
    description="测试工具功能，验证参数和响应"
    :actions="[
      { text: '返回', theme: 'default', variant: 'outline', icon: ArrowLeftIcon, onClick: handleGoBack },
      { text: '执行工具', theme: 'success', icon: CheckIcon, onClick: handleExecute }
    ]"
  >
    <tool-tester />
  </ContentLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon, CheckIcon } from 'tdesign-icons-vue-next';
import { ContentLayout } from '@/design-system';
import ToolTester from '@/components/tools/ToolTester.vue';

const route = useRoute();
const router = useRouter();

const toolName = computed(() => route.params.toolName as string || '工具测试');

const handleGoBack = () => {
  router.push('/tools');
};

const handleExecute = () => {
  router.push(`/tools/${toolName.value}/execute`);
};
</script>
