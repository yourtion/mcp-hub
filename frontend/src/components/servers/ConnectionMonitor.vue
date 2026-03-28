<template>
  <div class="connection-monitor">
    <span :class="['mcp-status', `mcp-status--${status}`]">
      <span class="mcp-status__dot" />
      <span class="connection-monitor__label">{{ statusLabel }}</span>
    </span>
    <span v-if="lastConnected" class="connection-monitor__time">
      {{ formatTime(lastConnected) }}
    </span>
    <span v-if="reconnectAttempts > 0" class="connection-monitor__reconnect">
      重试 {{ reconnectAttempts }} 次
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useServerStore } from '@/stores/server';
import type { ServerStatus } from '@/types/server';

const props = defineProps<{
  serverId: string;
  status: ServerStatus;
  lastConnected: string;
  reconnectAttempts: number;
}>();

const serverStore = useServerStore();

const statusLabelMap: Record<ServerStatus, string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '已断开',
  error: '错误',
};

const statusLabel = computed(() => statusLabelMap[props.status] ?? props.status);

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  refreshTimer = setInterval(() => {
    serverStore.refreshServerStatus(props.serverId);
  }, 10000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
});
</script>

<style scoped>
.connection-monitor {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.connection-monitor__label {
  color: var(--text-primary);
  font-weight: var(--weight-medium);
}

.connection-monitor__time {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.connection-monitor__reconnect {
  color: var(--warning);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: 1px 6px;
  background: var(--warning-light);
  border-radius: var(--radius-full);
}
</style>
