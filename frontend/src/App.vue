<template>
  <div id="app">
    <div v-if="authStore.isAuthenticated" class="app-layout">
      <div class="app-nav">
        <router-link to="/dashboard">仪表板</router-link>
        <router-link to="/servers">服务器管理</router-link>
        <router-link to="/groups">组管理</router-link>
        <router-link to="/api-to-mcp">API到MCP管理</router-link>
      </div>
      <div class="app-content">
        <router-view />
      </div>
    </div>
    <div v-else>
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

// 应用启动时初始化认证状态
onMounted(() => {
  authStore.initializeAuth();
});
</script>

<style>
/* 全局样式重置 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-nav {
  width: 200px;
  background: var(--td-bg-color-container);
  border-right: 1px solid var(--td-border-level-1-color);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-nav a {
  padding: 8px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: var(--td-text-color-primary);
  transition: background-color 0.2s;
}

.app-nav a:hover {
  background: var(--td-bg-color-container-hover);
}

.app-nav a.router-link-active {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
}

.app-content {
  flex: 1;
}
</style>
