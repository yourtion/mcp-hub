<template>
  <div class="debug-page">
    <div class="page-header">
      <h1>MCP调试工具</h1>
      <p>监控和调试MCP协议消息、工具执行和系统性能</p>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import McpMessageMonitor from '@/components/debug/McpMessageMonitor.vue';
import ToolDebugger from '@/components/debug/ToolDebugger.vue';
import PerformanceAnalyzer from '@/components/debug/PerformanceAnalyzer.vue';
import ErrorAnalyzer from '@/components/debug/ErrorAnalyzer.vue';

const activeTab = ref('messages');
</script>

<style scoped>
.debug-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-header p {
  margin: 0;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.debug-tabs {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: 16px;
}
</style>