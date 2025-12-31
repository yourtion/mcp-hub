<template>
  <ContentLayout
    :title="toolName"
    description="查看工具的详细信息、参数定义和执行历史"
    :actions="[
      { text: '返回', theme: 'default', variant: 'outline', icon: ArrowLeftIcon, onClick: handleGoBack },
      { text: '测试工具', theme: 'primary', icon: PlayIcon, onClick: handleTest },
      { text: '执行工具', theme: 'success', icon: CheckIcon, onClick: handleExecute }
    ]"
  >
    <tool-detail />
  </ContentLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon, PlayIcon, CheckIcon } from 'tdesign-icons-vue-next';
import { ContentLayout } from '@/design-system';
import ToolDetail from '@/components/tools/ToolDetail.vue';

const route = useRoute();
const router = useRouter();

const toolName = computed(() => route.params.toolName as string || '工具详情');

const handleGoBack = () => {
  router.push('/tools');
};

const handleTest = () => {
  router.push(`/tools/${toolName.value}/test`);
};

const handleExecute = () => {
  router.push(`/tools/${toolName.value}/execute`);
};
</script>
