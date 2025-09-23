<template>
  <div class="user-config-manager">
    <!-- 用户列表 -->
    <div class="user-list-section">
      <div class="section-header">
        <h5 class="section-title">用户列表</h5>
        <t-button
          theme="primary"
          size="small"
          @click="handleAddUser"
        >
          <template #icon>
            <t-icon name="add" />
          </template>
          添加用户
        </t-button>
      </div>

      <div class="user-list">
        <div
          v-for="(user, userId) in localUsers"
          :key="userId"
          class="user-item"
          :class="{ active: selectedUserId === userId }"
          @click="handleSelectUser(userId)"
        >
          <div class="user-avatar">
            <t-icon name="user" />
          </div>
          <div class="user-info">
            <div class="user-name">{{ user.username }}</div>
            <div class="user-meta">
              <t-tag
                :theme="getRoleTheme(user.role)"
                size="small"
                variant="light"
              >
                {{ getRoleLabel(user.role) }}
              </t-tag>
              <span class="user-groups">
                {{ user.groups?.length || 0 }} 个组
              </span>
            </div>
          </div>
          <div class="user-actions">
            <t-button
              theme="default"
              variant="text"
              size="small"
              @click.stop="handleEditUser(userId)"
            >
              <t-icon name="edit" />
            </t-button>
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click.stop="handleDeleteUser(userId)"
            >
              <t-icon name="delete" />
            </t-button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="Object.keys(localUsers).length === 0" class="empty-state">
          <t-icon name="user" size="48px" />
          <p>暂无用户</p>
          <t-button theme="primary" @click="handleAddUser">
            添加第一个用户
          </t-button>
        </div>
      </div>
    </div>

    <!-- 用户详情编辑 -->
    <div v-if="selectedUser" class="user-detail-section">
      <div class="section-header">
        <h5 class="section-title">用户详情</h5>
        <t-space>
          <t-button
            theme="default"
            size="small"
            @click="handleResetPassword"
          >
            重置密码
          </t-button>
          <t-button
            theme="success"
            size="small"
            :disabled="!isUserFormValid"
            @click="handleSaveUser"
          >
            保存
          </t-button>
        </t-space>
      </div>

      <t-form
        :data="selectedUser"
        :rules="userFormRules"
        layout="vertical"
        @submit="handleSaveUser"
      >
        <t-row :gutter="16">
          <t-col :span="12">
            <t-form-item label="用户名" name="username">
              <t-input
                v-model="selectedUser.username"
                placeholder="请输入用户名"
                @change="handleUserFormChange"
              />
            </t-form-item>
          </t-col>
          <t-col :span="12">
            <t-form-item label="用户ID" name="id">
              <t-input
                v-model="selectedUser.id"
                placeholder="请输入用户ID"
                :disabled="!isNewUser"
                @change="handleUserFormChange"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="16">
          <t-col :span="12">
            <t-form-item label="角色" name="role">
              <t-select
                v-model="selectedUser.role"
                placeholder="请选择角色"
                @change="handleUserFormChange"
              >
                <t-option value="admin" label="管理员" />
                <t-option value="user" label="普通用户" />
                <t-option value="readonly" label="只读用户" />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="12">
            <t-form-item label="密码" name="password">
              <t-input
                v-model="selectedUser.password"
                type="password"
                placeholder="请输入密码"
                @change="handleUserFormChange"
              />
              <template #tips>
                留空表示不修改密码
              </template>
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="所属组" name="groups">
          <t-select
            v-model="selectedUser.groups"
            placeholder="请选择所属组"
            multiple
            @change="handleUserFormChange"
          >
            <t-option
              v-for="group in availableGroups"
              :key="group.id"
              :value="group.id"
              :label="group.name"
            />
          </t-select>
        </t-form-item>
      </t-form>
    </div>

    <!-- 用户删除确认对话框 -->
    <t-dialog
      v-model:visible="deleteDialogVisible"
      header="确认删除用户"
      :confirm-btn="{ content: '确认删除', theme: 'danger' }"
      @confirm="handleConfirmDelete"
    >
      <p>确定要删除用户 "{{ userToDelete?.username }}" 吗？此操作不可撤销。</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { UserConfig } from '@/types/config';

// Props
interface Props {
  users: Record<string, UserConfig>;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: 'change', users: Record<string, UserConfig>): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const localUsers = ref<Record<string, UserConfig>>(JSON.parse(JSON.stringify(props.users)));
const selectedUserId = ref<string | null>(null);
const isNewUser = ref(false);
const deleteDialogVisible = ref(false);
const userToDelete = ref<UserConfig | null>(null);

// 表单验证规则
const userFormRules = {
  username: [
    { required: true, message: '请输入用户名' },
    { min: 2, max: 50, message: '用户名长度应在2-50个字符之间' },
  ],
  id: [
    { required: true, message: '请输入用户ID' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户ID只能包含字母、数字、下划线和连字符' },
  ],
  role: [
    { required: true, message: '请选择角色' },
  ],
  password: [
    { min: 6, message: '密码长度不能少于6个字符' },
  ],
};

// 计算属性
const selectedUser = computed(() => {
  if (!selectedUserId.value) return null;
  return localUsers.value[selectedUserId.value];
});

const isUserFormValid = computed(() => {
  if (!selectedUser.value) return false;
  return !!(
    selectedUser.value.username &&
    selectedUser.value.id &&
    selectedUser.value.role
  );
});

// 模拟可用组数据
const availableGroups = computed(() => [
  { id: 'default', name: '默认组' },
  { id: 'admin', name: '管理员组' },
  { id: 'developers', name: '开发者组' },
]);

// 监听props变化
watch(
  () => props.users,
  (newUsers) => {
    localUsers.value = JSON.parse(JSON.stringify(newUsers));
  },
  { deep: true }
);

// 方法

/**
 * 获取角色主题
 */
const getRoleTheme = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'danger';
    case 'user':
      return 'primary';
    case 'readonly':
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * 获取角色标签
 */
const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'admin':
      return '管理员';
    case 'user':
      return '普通用户';
    case 'readonly':
      return '只读用户';
    default:
      return '未知';
  }
};

/**
 * 选择用户
 */
const handleSelectUser = (userId: string): void => {
  selectedUserId.value = userId;
  isNewUser.value = false;
};

/**
 * 添加用户
 */
const handleAddUser = (): void => {
  const newUserId = `user_${Date.now()}`;
  const newUser: UserConfig = {
    id: newUserId,
    username: '',
    password: '',
    passwordHash: '',
    role: 'user',
    groups: [],
    createdAt: new Date().toISOString(),
  };

  localUsers.value[newUserId] = newUser;
  selectedUserId.value = newUserId;
  isNewUser.value = true;
};

/**
 * 编辑用户
 */
const handleEditUser = (userId: string): void => {
  selectedUserId.value = userId;
  isNewUser.value = false;
};

/**
 * 删除用户
 */
const handleDeleteUser = (userId: string): void => {
  userToDelete.value = localUsers.value[userId];
  deleteDialogVisible.value = true;
};

/**
 * 确认删除用户
 */
const handleConfirmDelete = (): void => {
  if (userToDelete.value) {
    const userId = Object.keys(localUsers.value).find(
      id => localUsers.value[id] === userToDelete.value
    );
    
    if (userId) {
      delete localUsers.value[userId];
      
      // 如果删除的是当前选中的用户，清除选择
      if (selectedUserId.value === userId) {
        selectedUserId.value = null;
      }
      
      handleChange();
      MessagePlugin.success('用户删除成功');
    }
  }
  
  deleteDialogVisible.value = false;
  userToDelete.value = null;
};

/**
 * 保存用户
 */
const handleSaveUser = (): void => {
  if (!selectedUser.value || !isUserFormValid.value) {
    MessagePlugin.error('请填写完整的用户信息');
    return;
  }

  // 如果是新用户且用户ID已存在，提示错误
  if (isNewUser.value && selectedUser.value.id !== selectedUserId.value) {
    if (localUsers.value[selectedUser.value.id]) {
      MessagePlugin.error('用户ID已存在');
      return;
    }
    
    // 更新用户ID
    delete localUsers.value[selectedUserId.value!];
    localUsers.value[selectedUser.value.id] = selectedUser.value;
    selectedUserId.value = selectedUser.value.id;
  }

  // 如果设置了新密码，生成密码哈希（这里简化处理）
  if (selectedUser.value.password) {
    selectedUser.value.passwordHash = `hash_${selectedUser.value.password}`;
  }

  isNewUser.value = false;
  handleChange();
  MessagePlugin.success('用户保存成功');
};

/**
 * 重置密码
 */
const handleResetPassword = (): void => {
  if (!selectedUser.value) return;
  
  const newPassword = Math.random().toString(36).slice(-8);
  selectedUser.value.password = newPassword;
  selectedUser.value.passwordHash = `hash_${newPassword}`;
  
  MessagePlugin.success(`密码已重置为: ${newPassword}`);
  handleChange();
};

/**
 * 用户表单变更
 */
const handleUserFormChange = (): void => {
  // 表单变更时的处理逻辑
};

/**
 * 发出变更事件
 */
const handleChange = (): void => {
  emit('change', localUsers.value);
};
</script>

<style scoped>
.user-config-manager {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #ffffff;
}

.user-item:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.user-item.active {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f3f4f6;
  color: #6b7280;
  margin-right: 12px;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-groups {
  font-size: 12px;
  color: #6b7280;
}

.user-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: #6b7280;
}

.empty-state p {
  margin: 16px 0 24px 0;
  font-size: 14px;
}

.user-detail-section {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 20px;
  background-color: #f9fafb;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-config-manager {
    gap: 16px;
  }
  
  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .user-item {
    padding: 10px;
  }
  
  .user-avatar {
    width: 28px;
    height: 28px;
    margin-right: 8px;
  }
  
  .user-name {
    font-size: 13px;
  }
  
  .user-detail-section {
    padding: 16px;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .section-title {
    color: #e5e7eb;
  }
  
  .user-item {
    border-color: #374151;
    background-color: #1f2937;
  }
  
  .user-item:hover {
    border-color: #60a5fa;
    background-color: #111827;
  }
  
  .user-item.active {
    border-color: #60a5fa;
    background-color: #1e3a8a;
  }
  
  .user-avatar {
    background-color: #374151;
    color: #9ca3af;
  }
  
  .user-name {
    color: #f9fafb;
  }
  
  .user-groups {
    color: #9ca3af;
  }
  
  .user-detail-section {
    border-color: #374151;
    background-color: #111827;
  }
  
  .empty-state {
    color: #9ca3af;
  }
}
</style>