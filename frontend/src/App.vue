<template>
  <div id="app">
    <!-- 已登录：显示主布局 -->
    <MainLayout v-if="authStore.isAuthenticated" />
    <!-- 未登录：显示登录页面 -->
    <router-view v-else />
    
    <!-- 全局加载指示器 -->
    <GlobalLoading />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTheme, usePageTitle } from '@/composables';
import MainLayout from '@/components/layout/MainLayout.vue';
import GlobalLoading from '@/components/common/GlobalLoading.vue';

const authStore = useAuthStore();
const { loadTheme } = useTheme();
const { updateTitleFromRoute } = usePageTitle();

// 应用启动时初始化
onMounted(() => {
  // 初始化认证状态
  authStore.initializeAuth();
  
  // 加载主题设置
  loadTheme();
  
  // 初始化页面标题
  updateTitleFromRoute();
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
</style>
