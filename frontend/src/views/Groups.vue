<template>
  <div class="groups-page">
    <GroupList 
      @add-group="handleAddGroup"
      @edit-group="handleEditGroup"
      @manage-members="handleManageMembers"
      @manage-validation="handleManageValidation"
      @view-detail="handleViewDetail"
    />

    <!-- 组配置对话框 -->
    <GroupFormDialog
      v-model:visible="formDialogVisible"
      :group="editingGroup"
      :mode="formMode"
      @success="handleFormSuccess"
    />

    <!-- 组成员管理对话框 -->
    <GroupMemberManager
      v-model:visible="memberManagerVisible"
      :group="editingGroup"
      @success="handleMemberManagerSuccess"
    />

    <!-- 验证密钥管理对话框 -->
    <GroupValidationManager
      v-model:visible="validationManagerVisible"
      :group="editingGroup"
      @success="handleValidationManagerSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import GroupList from '@/components/groups/GroupList.vue';
import GroupFormDialog from '@/components/groups/GroupFormDialog.vue';
import GroupMemberManager from '@/components/groups/GroupMemberManager.vue';
import GroupValidationManager from '@/components/groups/GroupValidationManager.vue';
import type { GroupInfo } from '@/types/group';

// 本地状态
const formDialogVisible = ref(false);
const memberManagerVisible = ref(false);
const validationManagerVisible = ref(false);
const editingGroup = ref<GroupInfo | null>(null);
const formMode = ref<'create' | 'edit'>('create');

// 事件处理
const handleAddGroup = () => {
  editingGroup.value = null;
  formMode.value = 'create';
  formDialogVisible.value = true;
};

const handleEditGroup = (group: GroupInfo) => {
  editingGroup.value = group;
  formMode.value = 'edit';
  formDialogVisible.value = true;
};

const handleManageMembers = (group: GroupInfo) => {
  editingGroup.value = group;
  memberManagerVisible.value = true;
};

const handleManageValidation = (group: GroupInfo) => {
  editingGroup.value = group;
  validationManagerVisible.value = true;
};

const handleViewDetail = (group: GroupInfo) => {
  // TODO: 导航到组详情页面或显示详情对话框
  console.log('View group detail:', group);
};

const handleFormSuccess = () => {
  formDialogVisible.value = false;
  editingGroup.value = null;
};

const handleMemberManagerSuccess = () => {
  memberManagerVisible.value = false;
  editingGroup.value = null;
};

const handleValidationManagerSuccess = () => {
  validationManagerVisible.value = false;
  editingGroup.value = null;
};
</script>

<style scoped>
.groups-page {
  height: 100%;
}
</style>