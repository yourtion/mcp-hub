<template>
  <t-layout class="main-layout">
    <t-aside :width="asideWidth" class="main-aside">
      <SideNavigation
        :collapsed="collapsed"
        @toggle-collapse="handleToggleCollapse"
      />
    </t-aside>
    <t-layout>
      <t-header class="main-header">
        <AppHeader />
      </t-header>
      <t-content class="main-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Layout as TLayout, Aside as TAside, Header as THeader, Content as TContent } from 'tdesign-vue-next';
import { useResponsive } from '@/composables';
import SideNavigation from './SideNavigation.vue';
import AppHeader from './AppHeader.vue';

// 响应式设计
const { isMobile, isTablet } = useResponsive();

// 侧边栏折叠状态
const collapsed = ref(false);

// 计算侧边栏宽度
const asideWidth = computed(() => (collapsed.value ? '64px' : '240px'));

// 切换侧边栏折叠状态
const handleToggleCollapse = () => {
  collapsed.value = !collapsed.value;
};

// 响应式自动折叠
watch([isMobile, isTablet], ([mobile, tablet]) => {
  // 移动设备和平板设备默认折叠侧边栏
  if (mobile || tablet) {
    collapsed.value = true;
  }
}, { immediate: true });
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
  background: var(--td-bg-color-page);
}

.main-aside {
  background: var(--td-bg-color-container);
  border-right: 1px solid var(--td-border-level-1-color);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.main-header {
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-border-level-1-color);
  padding: 0;
  height: 64px;
  display: flex;
  align-items: center;
}

.main-content {
  padding: 24px;
  min-height: calc(100vh - 64px);
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
}
</style>
