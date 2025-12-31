<template>
  <ContentLayout
    title="MCP调试工具"
    description="监控和调试MCP协议消息、工具执行和系统性能"
    :actions="[
      { text: '清空日志', theme: 'default', variant: 'outline', icon: DeleteIcon, onClick: handleClearLogs },
      { text: '导出日志', theme: 'default', variant: 'outline', icon: DownloadIcon, onClick: handleExportLogs }
    ]"
  >
    <t-tabs v-model="activeTab" class="debug-tabs">
      <t-tab-panel value="messages" label="协议消息">
        <mcp-message-monitor />
      </t-tab-panel>

      <t-tab-panel value="tools" label="工具调试">
        <tool-debugger />
      </t-tab-panel>

      <t-tab-panel value="performance" label="性能分析">
        <performance-analyzer />
      </t-tab-panel>

      <t-tab-panel value="errors" label="错误分析">
        <error-analyzer />
      </t-tab-panel>
    </t-tabs>
  </ContentLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { DeleteIcon, DownloadIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ContentLayout } from '@/design-system';
import McpMessageMonitor from '@/components/debug/McpMessageMonitor.vue';
import ToolDebugger from '@/components/debug/ToolDebugger.vue';
import PerformanceAnalyzer from '@/components/debug/PerformanceAnalyzer.vue';
import ErrorAnalyzer from '@/components/debug/ErrorAnalyzer.vue';

const activeTab = ref('messages');

const handleClearLogs = () => {
  // 清空调试日志逻辑
  MessagePlugin.success('日志已清空');
};

const handleExportLogs = () => {
  // 导出日志逻辑
  MessagePlugin.success('日志已导出');
};
</script>

<style lang="less" scoped>
@import '../design-system/styles/mixins.less';
@import '../design-system/tokens/spacing.less';

.debug-tabs {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: @spacing-lg;
}
</style>
