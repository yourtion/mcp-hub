<template>
  <div class="tools-page">
    <div class="page-header">
      <h1>工具管理</h1>
      <p>管理和监控MCP工具的执行状态</p>
    </div>

    <t-tabs v-model="activeTab" class="tools-tabs">
      <t-tab-panel value="list" label="工具列表">
        <tool-list />
      </t-tab-panel>

      <t-tab-panel value="monitoring" label="状态监控">
        <tool-monitoring />
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ToolList from '@/components/tools/ToolList.vue';
import ToolMonitoring from '@/components/tools/ToolMonitoring.vue';

const activeTab = ref('list');
</script>

<style scoped>
.tools-page {
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

.tools-tabs {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  padding: 16px;
}
</style>