<template>
  <ContentLayout
    :title="toolName"
    description="执行MCP工具，查看执行结果和日志"
    :actions="[
      { text: '返回', theme: 'default', variant: 'outline', icon: ArrowLeftIcon, onClick: handleGoBack },
      { text: '测试工具', theme: 'primary', icon: PlayIcon, onClick: handleTest }
    ]"
  >
    <tool-tester />
  </ContentLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon, PlayIcon } from 'tdesign-icons-vue-next';
import { ContentLayout } from '@/design-system';
import ToolTester from '@/components/tools/ToolTester.vue';

const route = useRoute();
const router = useRouter();

const toolName = computed(() => route.params.toolName as string || '工具执行');

const handleGoBack = () => {
  router.push('/tools');
};

const handleTest = () => {
  router.push(`/tools/${toolName.value}/test`);
};
</script>
