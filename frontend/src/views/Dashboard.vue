<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1>欢迎使用 MCP Hub 管理系统</h1>
      <div class="user-info">
        <span>欢迎，{{ user?.username }}</span>
        <t-button theme="default" @click="handleLogout">
          退出登录
        </t-button>
      </div>
    </div>
    
    <div class="dashboard-content">
      <t-card title="系统概览" class="overview-card">
        <p>这里是系统仪表板，后续会添加更多功能。</p>
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);

const handleLogout = async () => {
  try {
    await authStore.logout();
    MessagePlugin.success('已退出登录');
    router.push('/login');
  } catch (error) {
    console.error('退出登录失败:', error);
    MessagePlugin.error('退出登录失败');
  }
};
</script>

<style scoped>
.dashboard-container {
  padding: 24px;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dashboard-header h1 {
  margin: 0;
  color: #1f2937;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dashboard-content {
  display: grid;
  gap: 24px;
}

.overview-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>