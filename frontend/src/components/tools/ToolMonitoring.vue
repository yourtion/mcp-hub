<template>
  <div class="tool-monitoring">
    <t-loading :loading="loading" />
    <template v-if="!loading && monitoring">
      <!-- Overview Stats -->
      <div class="mcp-section">
        <h3 class="mcp-section__title">概览统计</h3>
        <div class="mcp-grid mcp-grid--4">
          <div class="mcp-card mcp-stat">
            <span class="mcp-stat__label">工具总数</span>
            <span class="mcp-stat__value">{{ monitoring.overview.totalTools }}</span>
          </div>
          <div class="mcp-card mcp-stat">
            <span class="mcp-stat__label">可用工具</span>
            <span class="mcp-stat__value" style="color: var(--success)">
              {{ monitoring.overview.availableTools }}
            </span>
          </div>
          <div class="mcp-card mcp-stat">
            <span class="mcp-stat__label">不可用工具</span>
            <span class="mcp-stat__value" style="color: var(--danger)">
              {{ monitoring.overview.unavailableTools }}
            </span>
          </div>
          <div class="mcp-card mcp-stat">
            <span class="mcp-stat__label">已连接服务器</span>
            <span class="mcp-stat__value">
              {{ monitoring.overview.connectedServers }} / {{ monitoring.overview.totalServers }}
            </span>
          </div>
        </div>
      </div>

      <!-- Availability Rate -->
      <div class="mcp-section">
        <h3 class="mcp-section__title">
          可用率
          <span class="monitoring-rate">{{ availabilityPercent }}%</span>
        </h3>
        <t-progress
          :percentage="monitoring.overview.availabilityRate"
          :color="availabilityColor"
          :track-color="'var(--bg-tertiary)'"
          size="large"
          :label="false"
        />
      </div>

      <!-- Tools by Server -->
      <div class="mcp-section">
        <h3 class="mcp-section__title">按服务器分组</h3>
        <div class="monitoring-servers">
          <t-collapse :borderless="false">
            <t-collapse-panel
              v-for="(serverData, serverKey) in monitoring.toolsByServer"
              :key="serverKey"
              :value="serverKey"
            >
              <template #header>
                <div class="server-header">
                  <span class="server-header__name">{{ serverKey }}</span>
                  <span
                    class="mcp-status"
                    :class="`mcp-status--${getServerStatusClass(serverData.serverStatus)}`"
                  >
                    <span class="mcp-status__dot" />
                    <span>{{ serverData.serverStatus }}</span>
                  </span>
                  <span class="server-header__count"> {{ serverData.tools.length }} 个工具 </span>
                </div>
              </template>
              <t-table
                :data="serverData.tools"
                :columns="serverToolColumns"
                row-key="name"
                size="small"
                :max-height="300"
              />
            </t-collapse-panel>
          </t-collapse>
        </div>
      </div>
    </template>

    <template v-if="!loading && !monitoring">
      <div class="mcp-empty">
        <div class="mcp-empty__icon">&#128202;</div>
        <div class="mcp-empty__title">暂无监控数据</div>
        <div class="mcp-empty__desc">点击刷新按钮获取最新监控信息</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';

import { useToolStore } from '@/stores/tool';

import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';

const toolStore = useToolStore();

const loading = ref(false);
const monitoring = computed(() => toolStore.monitoring);

const availabilityPercent = computed(() => {
  if (!monitoring.value) return 0;
  return Math.round(monitoring.value.overview.availabilityRate);
});

const availabilityColor = computed(() => {
  const rate = availabilityPercent.value;
  if (rate >= 90) return 'var(--success)';
  if (rate >= 70) return 'var(--warning)';
  return 'var(--danger)';
});

const getServerStatusClass = (status: string): string => {
  if (status === 'connected') return 'connected';
  if (status === 'disconnected') return 'disconnected';
  if (status === 'connecting') return 'connecting';
  return 'error';
};

const serverToolColumns: PrimaryTableCol<TableRowData>[] = [
  {
    title: '名称',
    colKey: 'name',
    cell: (_h, { row }) =>
      h('span', { style: { fontWeight: 600 } }, (row as Record<string, string>).name),
  },
  {
    title: '描述',
    colKey: 'description',
    cell: (_h, { row }) => {
      const desc = (row as Record<string, string>).description || '-';
      const truncated = desc.length > 50 ? `${desc.slice(0, 50)}...` : desc;
      return h('span', { style: { color: 'var(--text-secondary)' } }, truncated);
    },
  },
  {
    title: '状态',
    colKey: 'status',
    width: 100,
    cell: (_h, { row }) => {
      const tool = row as Record<string, string>;
      const isAvailable = tool.status === 'available';
      return h('span', { class: `mcp-status mcp-status--${tool.status}` }, [
        h('span', { class: 'mcp-status__dot' }),
        h(
          'span',
          { style: { color: isAvailable ? 'var(--success)' : 'var(--text-tertiary)' } },
          isAvailable ? '可用' : '不可用',
        ),
      ]);
    },
  },
];

onMounted(async () => {
  loading.value = true;
  try {
    await toolStore.fetchMonitoring();
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.tool-monitoring {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.monitoring-rate {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  color: var(--accent);
  margin-left: var(--space-3);
}

.monitoring-servers {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.server-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
}

.server-header__name {
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}

.server-header__count {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-left: auto;
}
</style>
