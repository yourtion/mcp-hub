<template>
  <div class="mcp-page">
    <div
      class="mcp-page__header"
      style="display: flex; justify-content: space-between; align-items: flex-start"
    >
      <div>
        <h1 class="mcp-page__title">服务器管理</h1>
        <p class="mcp-page__desc">管理MCP服务器连接与配置</p>
      </div>
      <div class="mcp-page__actions">
        <t-button theme="primary" @click="showCreateDialog = true">
          <template #icon><AddIcon /></template>
          添加服务器
        </t-button>
        <t-button
          variant="outline"
          @click="serverStore.fetchServers()"
          :loading="serverStore.loading"
        >
          <template #icon><RefreshIcon /></template>
          刷新
        </t-button>
      </div>
    </div>

    <!-- Summary tags -->
    <div
      class="server-summary"
      style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap"
    >
      <t-tag theme="primary" variant="light"> 总计 {{ serverStore.summary.total }} </t-tag>
      <t-tag theme="success" variant="light"> 已连接 {{ serverStore.summary.connected }} </t-tag>
      <t-tag theme="warning" variant="light"> 连接中 {{ serverStore.summary.connecting }} </t-tag>
      <t-tag theme="danger" variant="light"> 错误 {{ serverStore.summary.error }} </t-tag>
    </div>

    <ServerList
      :servers="serverStore.serverList"
      :loading="serverStore.loading"
      @edit="editServer"
      @delete="confirmDelete"
      @connect="handleConnect"
      @disconnect="handleDisconnect"
    />

    <ServerFormDialog
      v-model:visible="showFormDialog"
      :mode="formMode"
      :server-data="editingServer"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { AddIcon, RefreshIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ref, watch, onMounted } from 'vue';

import { ServerList, ServerFormDialog } from '@/components/servers';
import { useServerStore } from '@/stores/server';

import type { ServerInfo, CreateServerRequest, UpdateServerRequest } from '@/types/server';

const serverStore = useServerStore();

// Dialog state
const showCreateDialog = ref(false);
const showFormDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingServer = ref<ServerInfo | null>(null);

function editServer(server: ServerInfo) {
  editingServer.value = server;
  formMode.value = 'edit';
  showFormDialog.value = true;
}

function confirmDelete(id: string) {
  handleDelete(id);
}

async function handleConnect(id: string) {
  try {
    await serverStore.connectServer(id);
    MessagePlugin.success('连接请求已发送');
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '连接失败');
  }
}

async function handleDisconnect(id: string) {
  try {
    await serverStore.disconnectServer(id);
    MessagePlugin.success('断开连接请求已发送');
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '断开连接失败');
  }
}

async function handleSubmit(data: CreateServerRequest | UpdateServerRequest) {
  try {
    if (formMode.value === 'create') {
      const createData = data as CreateServerRequest;
      await serverStore.createServer(createData);
      MessagePlugin.success('服务器创建成功');
    } else if (editingServer.value) {
      const updateData = data as UpdateServerRequest;
      await serverStore.updateServer(editingServer.value.id, updateData);
      MessagePlugin.success('服务器更新成功');
    }
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '操作失败');
  }
}

async function handleDelete(id: string) {
  try {
    await serverStore.deleteServer(id);
    MessagePlugin.success('服务器已删除');
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '删除失败');
  }
}

// Watch showCreateDialog to open the form dialog
watch(showCreateDialog, (val) => {
  if (val) {
    editingServer.value = null;
    formMode.value = 'create';
    showFormDialog.value = true;
    showCreateDialog.value = false;
  }
});

onMounted(() => {
  serverStore.fetchServers();
});
</script>

<style scoped>
.server-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
</style>
