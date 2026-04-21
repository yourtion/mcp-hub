<template>
  <t-dialog
    :visible="visible"
    header="管理组成员"
    :width="640"
    placement="center"
    :footer="false"
    @close="handleClose"
  >
    <div v-if="dialogLoading" style="padding: var(--space-10) 0">
      <t-loading size="medium" text="加载中..." />
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="group-members__summary" v-if="servers.length > 0">
        <t-tag theme="primary" variant="light"> 总计 {{ serverStats.total }} </t-tag>
        <t-tag theme="success" variant="light"> 已连接 {{ serverStats.connected }} </t-tag>
        <t-tag theme="danger" variant="light"> 未连接 {{ serverStats.disconnected }} </t-tag>
      </div>

      <!-- Server list -->
      <t-table
        v-if="servers.length > 0"
        :data="servers"
        :columns="columns"
        row-key="id"
        hover
        size="small"
        style="margin-top: var(--space-4)"
      >
        <template #status="{ row }">
          <span :class="['mcp-status', serverStatusClass(row)]">
            <span class="mcp-status__dot" />
            {{ row.status }}
          </span>
        </template>

        <template #toolCount="{ row }">
          {{ row.toolCount ?? 0 }}
        </template>

        <template #isHealthy="{ row }">
          <t-tag :theme="row.isHealthy ? 'success' : 'danger'" variant="light" size="small">
            {{ row.isHealthy ? '健康' : '异常' }}
          </t-tag>
        </template>
      </t-table>

      <!-- Empty state -->
      <div v-if="servers.length === 0" class="mcp-empty">
        <ServerIcon class="mcp-empty__icon" />
        <p class="mcp-empty__title">暂无服务器</p>
        <p class="mcp-empty__desc">该组尚未关联任何服务器</p>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ServerIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ref, watch, computed } from 'vue';

import { useGroupStore } from '@/stores/group';

import type { GroupServerInfo } from '@/types/group';

const props = defineProps<{
  visible: boolean;
  groupId: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const groupStore = useGroupStore();
const servers = ref<GroupServerInfo[]>([]);
const dialogLoading = ref(false);

const columns = [
  { colKey: 'id', title: '服务器 ID', width: 180 },
  { colKey: 'status', title: '状态', width: 120 },
  { colKey: 'toolCount', title: '工具数', width: 100 },
  { colKey: 'isHealthy', title: '健康', width: 100 },
];

const serverStats = computed(() => {
  const total = servers.value.length;
  const connected = servers.value.filter((s) => s.status === 'connected').length;
  return { total, connected, disconnected: total - connected };
});

function serverStatusClass(server: GroupServerInfo): string {
  if (server.isHealthy) return 'mcp-status--healthy';
  if (server.status === 'connected') return 'mcp-status--connected';
  return 'mcp-status--error';
}

// Fetch servers when dialog opens
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible && props.groupId) {
      dialogLoading.value = true;
      try {
        const response = await groupStore.getGroupServers(props.groupId);
        servers.value = response.servers;
      } catch (err: unknown) {
        MessagePlugin.error(err instanceof Error ? err.message : '获取组服务器列表失败');
      } finally {
        dialogLoading.value = false;
      }
    }
  },
);

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped>
.group-members__summary {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
