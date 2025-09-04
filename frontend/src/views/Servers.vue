<template>
  <div class="servers-page">
    <ServerList 
      @add-server="handleAddServer"
      @edit-server="handleEditServer"
    />

    <!-- 服务器配置对话框 -->
    <ServerFormDialog
      v-model:visible="formDialogVisible"
      :server="editingServer"
      :mode="formMode"
      @success="handleFormSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ServerList from '@/components/servers/ServerList.vue';
import ServerFormDialog from '@/components/servers/ServerFormDialog.vue';
import type { ServerInfo } from '@/types/server';

// 本地状态
const formDialogVisible = ref(false);
const editingServer = ref<ServerInfo | null>(null);
const formMode = ref<'create' | 'edit'>('create');

// 事件处理
const handleAddServer = () => {
  editingServer.value = null;
  formMode.value = 'create';
  formDialogVisible.value = true;
};

const handleEditServer = (server: ServerInfo) => {
  editingServer.value = server;
  formMode.value = 'edit';
  formDialogVisible.value = true;
};

const handleFormSuccess = () => {
  formDialogVisible.value = false;
  editingServer.value = null;
};
</script>

<style scoped>
.servers-page {
  height: 100%;
}
</style>