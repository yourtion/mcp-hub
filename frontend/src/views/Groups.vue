<template>
  <div class="mcp-page">
    <div
      class="mcp-page__header"
      style="display: flex; justify-content: space-between; align-items: flex-start"
    >
      <div>
        <h1 class="mcp-page__title">组管理</h1>
        <p class="mcp-page__desc">管理服务器组与访问控制</p>
      </div>
      <div class="mcp-page__actions">
        <t-button theme="primary" @click="showCreateDialog = true">
          <template #icon><AddIcon /></template>
          创建组
        </t-button>
        <t-button
          variant="outline"
          @click="groupStore.fetchGroups()"
          :loading="groupStore.loading"
        >
          <template #icon><RefreshIcon /></template>
          刷新
        </t-button>
      </div>
    </div>

    <!-- Summary tags -->
    <div class="group-summary">
      <t-tag theme="primary" variant="light">
        总计 {{ groupStore.summary.totalGroups }}
      </t-tag>
      <t-tag theme="success" variant="light">
        健康 {{ groupStore.summary.healthyGroups }}
      </t-tag>
      <t-tag theme="danger" variant="light">
        异常 {{ groupStore.summary.unhealthyGroups }}
      </t-tag>
    </div>

    <GroupList
      :groups="groupStore.groupList"
      :loading="groupStore.loading"
      @edit="editGroup"
      @delete="handleDelete"
      @manage-tools="openToolManager"
      @manage-validation="openValidationManager"
    />

    <GroupFormDialog
      v-model:visible="showFormDialog"
      :mode="formMode"
      :group-data="editingGroup"
      @submit="handleSubmit"
    />

    <GroupMemberManager
      v-model:visible="showMemberManager"
      :group-id="activeGroupId"
    />

    <GroupValidationManager
      v-model:visible="showValidationManager"
      :group-id="activeGroupId"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { AddIcon, RefreshIcon } from 'tdesign-icons-vue-next';
import { useGroupStore } from '@/stores/group';
import {
  GroupList,
  GroupFormDialog,
  GroupMemberManager,
  GroupValidationManager,
} from '@/components/groups';
import type {
  GroupInfo,
  CreateGroupRequest,
  UpdateGroupRequest,
} from '@/types/group';

const groupStore = useGroupStore();

// Dialog state
const showCreateDialog = ref(false);
const showFormDialog = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingGroup = ref<GroupInfo | null>(null);
const activeGroupId = ref('');
const showMemberManager = ref(false);
const showValidationManager = ref(false);

function editGroup(group: GroupInfo) {
  editingGroup.value = group;
  formMode.value = 'edit';
  showFormDialog.value = true;
}

function openToolManager(groupId: string) {
  activeGroupId.value = groupId;
  showMemberManager.value = true;
}

function openValidationManager(groupId: string) {
  activeGroupId.value = groupId;
  showValidationManager.value = true;
}

async function handleSubmit(data: CreateGroupRequest | UpdateGroupRequest) {
  try {
    if (formMode.value === 'create') {
      const createData = data as CreateGroupRequest;
      await groupStore.createGroup(createData);
      MessagePlugin.success('组创建成功');
    } else if (editingGroup.value) {
      const updateData = data as UpdateGroupRequest;
      await groupStore.updateGroup(editingGroup.value.id, updateData);
      MessagePlugin.success('组更新成功');
    }
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '操作失败');
  }
}

async function handleDelete(id: string) {
  try {
    await groupStore.deleteGroup(id);
    MessagePlugin.success('组已删除');
  } catch (err: unknown) {
    MessagePlugin.error(err instanceof Error ? err.message : '删除失败');
  }
}

// Watch showCreateDialog to open the form dialog
watch(showCreateDialog, (val) => {
  if (val) {
    editingGroup.value = null;
    formMode.value = 'create';
    showFormDialog.value = true;
    showCreateDialog.value = false;
  }
});

onMounted(() => {
  groupStore.fetchGroups();
});
</script>

<style scoped>
.group-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
</style>
