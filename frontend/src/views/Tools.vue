<template>
  <div class="mcp-page">
    <div class="mcp-page__header">
      <div class="tools-header">
        <div>
          <h2 class="mcp-page__title">工具管理</h2>
          <p class="mcp-page__desc">可用工具概览</p>
        </div>
        <div class="mcp-page__actions">
          <t-button :loading="toolStore.loading" variant="outline" @click="handleRefresh">
            <template #icon><RefreshIcon /></template>
            刷新
          </t-button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="tools-filters mcp-card">
      <div class="mcp-toolbar">
        <div class="mcp-toolbar__left">
          <t-input
            v-model="searchText"
            placeholder="搜索工具..."
            clearable
            style="width: 240px"
            @change="handleSearchChange"
          >
            <template #prefixIcon>
              <SearchIcon />
            </template>
          </t-input>
          <t-select
            v-model="serverFilter"
            placeholder="服务器筛选"
            clearable
            style="width: 180px"
            :options="serverOptions"
            @change="handleServerChange"
          />
          <t-select
            v-model="statusFilter"
            placeholder="状态筛选"
            clearable
            style="width: 140px"
            :options="statusOptions"
            @change="handleStatusChange"
          />
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <t-tabs v-model="activeTab" class="tools-tabs" @change="handleTabChange">
      <t-tab-panel value="list" label="工具列表">
        <ToolList
          :tools="toolStore.filteredTools"
          :loading="toolStore.loading"
          @select="handleToolSelect"
        />
      </t-tab-panel>

      <t-tab-panel value="monitoring" label="监控">
        <ToolMonitoring />
      </t-tab-panel>

      <t-tab-panel value="history" label="执行历史">
        <div class="tools-history">
          <template v-if="toolStore.executionHistory.length > 0">
            <ExecutionDetail
              v-for="execution in toolStore.executionHistory"
              :key="execution.executionId"
              :execution="execution"
            />
          </template>
          <template v-else>
            <div class="mcp-empty">
              <div class="mcp-empty__icon">&#128203;</div>
              <div class="mcp-empty__title">暂无执行历史</div>
              <div class="mcp-empty__desc">执行工具后，历史记录将显示在这里</div>
            </div>
          </template>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script setup lang="ts">
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ToolList, ToolMonitoring, ExecutionDetail } from '@/components/tools';
import { useToolStore } from '@/stores/tool';

import type { ToolInfo } from '@/types/tool';

const router = useRouter();
const toolStore = useToolStore();

const activeTab = ref('list');
const searchText = ref('');
const serverFilter = ref<string | undefined>(undefined);
const statusFilter = ref<string | undefined>(undefined);

const serverOptions = computed(() =>
  toolStore.serverList.map((serverId) => ({
    label: serverId,
    value: serverId,
  })),
);

const statusOptions = [
  { label: '可用', value: 'available' },
  { label: '不可用', value: 'unavailable' },
];

const handleRefresh = async () => {
  try {
    await toolStore.refresh();
    MessagePlugin.success('工具列表已刷新');
  } catch {
    MessagePlugin.error('刷新失败');
  }
};

const handleTabChange = async (value: string | number) => {
  // 切到"执行历史"时按需加载，避免空数据（参考 ToolMonitoring 的按需加载模式）
  if (value === 'history') {
    try {
      await toolStore.fetchExecutionHistory();
    } catch {
      MessagePlugin.error('获取执行历史失败');
    }
  }
};

const handleSearchChange = (value: string | number) => {
  toolStore.updateFilters({ search: String(value) });
};

const handleServerChange = (value: string | number | undefined) => {
  toolStore.updateFilters({ serverId: value ? String(value) : undefined });
};

const handleStatusChange = (value: string | number | undefined) => {
  const status = value ? String(value) : 'all';
  toolStore.updateFilters({ status: status as 'available' | 'unavailable' | 'all' });
};

const handleToolSelect = (tool: ToolInfo) => {
  router.push({
    name: 'ToolDetail',
    params: { toolName: tool.name },
  });
};

onMounted(async () => {
  try {
    await toolStore.fetchTools();
  } catch {
    MessagePlugin.error('获取工具列表失败');
  }
});
</script>

<style scoped>
.tools-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.tools-filters {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.tools-tabs {
  background: transparent;
}

.tools-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
