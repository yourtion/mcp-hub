<template>
  <ContentLayout
    title="工具管理"
    description="管理和监控MCP工具的执行状态"
    :actions="[
      { text: '刷新', theme: 'default', variant: 'outline', icon: RefreshIcon, onClick: handleRefresh }
    ]"
  >
    <t-tabs v-model="activeTab" class="tools-tabs">
      <t-tab-panel value="list" label="工具列表">
        <tool-list />
      </t-tab-panel>

      <t-tab-panel value="monitoring" label="状态监控">
        <tool-monitoring />
      </t-tab-panel>
    </t-tabs>
  </ContentLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RefreshIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ContentLayout } from '@/design-system';
import ToolList from '@/components/tools/ToolList.vue';
import ToolMonitoring from '@/components/tools/ToolMonitoring.vue';

const activeTab = ref('list');

const handleRefresh = () => {
  // 触发刷新事件
  MessagePlugin.success('刷新成功');
};
</script>

<style lang="less" scoped>
@import '../design-system/styles/mixins.less';
@import '../design-system/tokens/spacing.less';

.tools-tabs {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: @spacing-lg;
}
</style>
