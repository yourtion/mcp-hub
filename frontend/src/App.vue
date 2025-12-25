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
  // 禁用 TDesign CDN 图标字体加载（项目已使用 tdesign-icons-vue-next 组件）
  disableTDesignIconFont();

  // 初始化认证状态
  authStore.initializeAuth();

  // 加载主题设置
  loadTheme();

  // 初始化页面标题
  updateTitleFromRoute();
});

// 禁用 TDesign 图标字体 CDN 加载
const disableTDesignIconFont = () => {
  // 阻止 TDesign 动态加载字体文件
  const originalFetch = window.fetch;
  window.fetch = function fetch(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('tdesign.gtimg.com')) {
      console.warn('[MCP Hub] 已阻止 TDesign CDN 字体加载:', url);
      return Promise.reject(new Error('TDesign CDN 字体加载已被禁用'));
    }
    return originalFetch.apply(this, args);
  };

  // 移除所有指向 TDesign CDN 的 link 标签
  const removeTDesignFontLinks = () => {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (href && href.includes('tdesign.gtimg.com')) {
        console.warn('[MCP Hub] 移除 TDesign CDN 字体链接:', href);
        link.remove();
      }
    });
  };

  // 立即执行一次
  removeTDesignFontLinks();

  // 使用 MutationObserver 监听并移除后续动态添加的字体链接
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const link = node as HTMLElement;
          if (link.tagName === 'LINK' &&
              (link as HTMLLinkElement).href &&
              (link as HTMLLinkElement).href.includes('tdesign.gtimg.com')) {
            console.warn('[MCP Hub] 阻止动态添加的 TDesign CDN 字体链接');
            link.remove();
          }
        }
      });
    });
  });

  observer.observe(document.head, {
    childList: true,
    subtree: true
  });
};
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
