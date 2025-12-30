<template>
  <div class="ds-app-layout" :class="[`ds-app-layout--${props.theme}`, { 'ds-app-layout--collapsed': isCollapsed, 'ds-app-layout--mobile': isMobile }]">
    <!-- 侧边栏 -->
    <aside v-if="showSidebar" class="ds-app-layout__sidebar" :class="{ 'ds-app-layout__sidebar--collapsed': isCollapsed }">
      <!-- Logo -->
      <div v-if="props.logo" class="ds-app-layout__logo">
        <img v-if="typeof props.logo === 'string'" :src="props.logo" :alt="props.title" />
        <component v-else :is="props.logo" />
        <span v-if="!isCollapsed" class="ds-app-layout__logo-text">{{ props.title }}</span>
      </div>

      <!-- 菜单 -->
      <t-menu
        v-model="activeMenu"
        :collapsed="isCollapsed"
        :theme="props.theme"
        class="ds-app-layout__menu"
      >
        <template v-for="item in menuItems" :key="item.path">
          <!-- 有子菜单 -->
          <t-sub-menu v-if="item.children && item.children.length > 0" :value="item.path">
            <template #icon>
              <component :is="item.icon" />
            </template>
            <template #title>
              <span>{{ item.title }}</span>
            </template>
            <t-menu-item
              v-for="child in item.children"
              :key="child.path"
              :value="child.path"
              @click="handleMenuClick(child)"
            >
              <template v-if="!isCollapsed" #icon>
                <component :is="child.icon" />
              </template>
              {{ child.title }}
            </t-menu-item>
          </t-sub-menu>

          <!-- 单级菜单 -->
          <t-menu-item v-else :value="item.path" @click="handleMenuClick(item)">
            <template #icon>
              <component :is="item.icon" />
            </template>
            <span v-if="!isCollapsed">{{ item.title }}</span>
          </t-menu-item>
        </template>
      </t-menu>

      <!-- 折叠按钮 -->
      <div class="ds-app-layout__collapse-trigger" @click="toggleCollapse">
        <ChevronLeftIcon :class="{ 'ds-app-layout__collapse-icon--collapsed': isCollapsed }" />
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="ds-app-layout__main">
      <!-- 顶部导航栏 -->
      <header v-if="showHeader" class="ds-app-layout__header">
        <!-- 折叠按钮（移动端） -->
        <div v-if="isMobile" class="ds-app-layout__mobile-toggle" @click="toggleMobileSidebar">
          <MenuIcon />
        </div>

        <!-- 面包屑 -->
        <div v-if="showBreadcrumb && breadcrumbItems.length > 0" class="ds-app-layout__breadcrumb">
          <t-breadcrumb>
            <t-breadcrumb-item
              v-for="(item, index) in breadcrumbItems"
              :key="index"
              :href="item.path"
              :icon="item.icon"
            >
              {{ item.title }}
            </t-breadcrumb-item>
          </t-breadcrumb>
        </div>

        <!-- 右侧操作区 -->
        <div class="ds-app-layout__header-right">
          <!-- 用户信息 -->
          <slot name="user-info">
            <t-dropdown :options="userMenuOptions" trigger="click">
              <div class="ds-app-layout__user">
                <t-avatar :image="userAvatar" :alt="userName">
                  {{ userName.charAt(0) }}
                </t-avatar>
                <span v-if="!isMobile" class="ds-app-layout__user-name">{{ userName }}</span>
                <ChevronDownIcon size="16px" />
              </div>
            </t-dropdown>
          </slot>

          <!-- 通知 -->
          <t-dropdown v-if="showNotification" :options="notificationOptions" trigger="click">
            <t-button variant="text" shape="circle">
              <template #icon>
                <NotificationIcon />
              </template>
            </t-button>
          </t-dropdown>

          <!-- 设置 -->
          <t-button variant="text" shape="circle" @click="handleSettings">
            <template #icon>
              <SettingIcon />
            </template>
          </t-button>

          <!-- 全屏 -->
          <t-button v-if="allowFullscreen" variant="text" shape="circle" @click="toggleFullscreen">
            <template #icon>
              <FullscreenIcon />
            </template>
          </t-button>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="ds-app-layout__content">
        <!-- 标签页导航（可选） -->
        <t-tabs
          v-if="showTabs && tabs.length > 0"
          v-model="activeTab"
          :list="tabs"
          size="medium"
          class="ds-app-layout__tabs"
          @remove="handleTabRemove"
          @change="handleTabChange"
        />

        <!-- 页面内容插槽 -->
        <div class="ds-app-layout__page" :class="{ 'ds-app-layout__page--no-tabs': !showTabs || tabs.length === 0 }">
          <slot />
        </div>
      </main>

      <!-- 页脚 -->
      <footer v-if="showFooter" class="ds-app-layout__footer">
        <slot name="footer">
          <p>&copy; {{ currentYear }} {{ props.title }}. All rights reserved.</p>
        </slot>
      </footer>
    </div>

    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && showMobileSidebar"
      class="ds-app-layout__overlay"
      @click="toggleMobileSidebar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  MenuIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  NotificationIcon,
  SettingIcon,
  FullscreenIcon,
  HomeIcon,
  DesktopIcon,
  UserIcon,
  ServerIcon,
  ToolIcon,
  FolderIcon,
  ListIcon,
} from 'tdesign-icons-vue-next';

export interface MenuItem {
  path: string;
  title: string;
  icon?: any;
  children?: MenuItem[];
  visible?: boolean;
}

export interface BreadcrumbItem {
  title: string;
  path?: string;
  icon?: any;
}

export interface TabItem {
  value: string;
  label: string;
  icon?: any;
  closable?: boolean;
}

export interface AppLayoutProps {
  // 基本信息
  title?: string;
  logo?: string | Component;

  // 布局配置
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
  showBreadcrumb?: boolean;
  showTabs?: boolean;
  showNotification?: boolean;
  allowFullscreen?: boolean;

  // 侧边栏
  menuItems?: MenuItem[];
  sidebarWidth?: string;
  collapsedWidth?: string;
  defaultCollapsed?: boolean;

  // 主题
  theme?: 'light' | 'dark';

  // 用户信息
  userName?: string;
  userAvatar?: string;

  // 响应式断点
  mobileBreakpoint?: number;
}

const props = withDefaults(defineProps<AppLayoutProps>(), {
  title: 'MCP Hub',
  showHeader: true,
  showSidebar: true,
  showFooter: true,
  showBreadcrumb: true,
  showTabs: false,
  showNotification: true,
  allowFullscreen: true,
  menuItems: () => [],
  sidebarWidth: '240px',
  collapsedWidth: '64px',
  defaultCollapsed: false,
  theme: 'light',
  userName: 'Admin',
  userAvatar: '',
  mobileBreakpoint: 768,
});

// Emits
const emit = defineEmits<{
  'menu-click': [item: MenuItem];
  'tab-change': [tab: string];
  'tab-remove': [tab: string];
  'settings': [];
}>();

// 路由
const router = useRouter();

// 状态
const isCollapsed = ref(props.defaultCollapsed);
const isMobile = ref(false);
const isFullscreen = ref(false);
const showMobileSidebar = ref(false);
const activeMenu = ref('');
const activeTab = ref('');

// 计算属性
const currentYear = new Date().getFullYear();

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const currentRoute = router.currentRoute.value;
  const items: BreadcrumbItem[] = [
    { title: '首页', path: '/', icon: HomeIcon },
  ];

  // 根据路由生成面包屑
  if (currentRoute.path !== '/') {
    const matched = currentRoute.matched.filter((route) => route.meta?.title);
    matched.forEach((route) => {
      items.push({
        title: route.meta?.title as string || route.name as string,
        path: route.path,
      });
    });
  }

  return items;
});

const tabs = ref<TabItem[]>([]);

const userMenuOptions = computed(() => [
  {
    content: '个人中心',
    value: 'profile',
    onClick: () => router.push('/profile'),
  },
  {
    content: '退出登录',
    value: 'logout',
    onClick: () => handleLogout(),
  },
]);

const notificationOptions = computed(() => [
  {
    content: '查看所有通知',
    value: 'all',
  },
  {
    content: '标记为已读',
    value: 'read',
  },
  {
    content: '清空通知',
    value: 'clear',
  },
]);

// 方法
const handleMenuClick = (item: MenuItem) => {
  emit('menu-click', item);
  router.push(item.path);

  // 移动端点击菜单后关闭侧边栏
  if (isMobile.value) {
    showMobileSidebar.value = false;
  }
};

const handleTabChange = (value: string) => {
  activeTab.value = value;
  emit('tab-change', value);
};

const handleTabRemove = (value: any) => {
  const index = tabs.value.findIndex((tab) => tab.value === value);
  if (index > -1) {
    tabs.value.splice(index, 1);
    emit('tab-remove', value);
  }
};

const handleSettings = () => {
  emit('settings');
};

const handleLogout = () => {
  // 实现退出逻辑
  console.log('Logout');
};

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const toggleMobileSidebar = () => {
  showMobileSidebar.value = !showMobileSidebar.value;
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth < props.mobileBreakpoint;
  if (isMobile.value) {
    isCollapsed.value = true;
  }
};

// 生命周期
if (typeof window !== 'undefined') {
  window.addEventListener('resize', checkMobile);
  checkMobile();
}

// 暴露方法
defineExpose({
  addTab: (tab: TabItem) => {
    if (!tabs.value.find((t) => t.value === tab.value)) {
      tabs.value.push(tab);
    }
    activeTab.value = tab.value;
  },
  removeTab: (value: string) => {
    handleTabRemove(value);
  },
  setActiveMenu: (path: string) => {
    activeMenu.value = path;
  },
  collapse: () => {
    isCollapsed.value = true;
  },
  expand: () => {
    isCollapsed.value = false;
  },
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';

.ds-app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;

  &__sidebar {
    position: relative;
    z-index: 100;
    width: var(--sidebar-width, 240px);
    background: var(--td-bg-color-container);
    border-right: 1px solid var(--td-border-level-1-color);
    display: flex;
    flex-direction: column;
    transition: width var(--td-duration-normal) var(--td-easing-ease);

    &--collapsed {
      width: var(--collapsed-width, 64px);
    }
  }

  &__logo {
    display: flex;
    align-items: center;
    gap: @spacing-md;
    padding: @spacing-lg;
    height: 64px;
    border-bottom: 1px solid var(--td-border-level-1-color);
    overflow: hidden;

    img {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
    }
  }

  &__logo-text {
    font-size: @font-size-lg;
    font-weight: @font-weight-semibold;
    color: var(--td-text-color-primary);
    white-space: nowrap;
  }

  &__menu {
    flex: 1;
    overflow-y: auto;
    border: none;

    :deep(.t-menu__item) {
      margin: 0 @spacing-md;
      border-radius: var(--td-radius-default);
    }
  }

  &__collapse-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: @spacing-md;
    border-top: 1px solid var(--td-border-level-1-color);
    cursor: pointer;
    transition: background-color var(--td-duration-normal) var(--td-easing-ease);

    &:hover {
      background: var(--td-bg-color-container-hover);
    }
  }

  &__collapse-icon--collapsed {
    transform: rotate(180deg);
  }

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 @spacing-xxl;
    height: 64px;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__mobile-toggle {
    display: none;
    padding: @spacing-md;
    cursor: pointer;
  }

  &__breadcrumb {
    flex: 1;
  }

  &__header-right {
    display: flex;
    align-items: center;
    gap: @spacing-sm;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: @spacing-sm;
    cursor: pointer;
    padding: @spacing-sm @spacing-md;
    border-radius: var(--td-radius-default);
    transition: background-color var(--td-duration-normal) var(--td-easing-ease);

    &:hover {
      background: var(--td-bg-color-container-hover);
    }
  }

  &__user-name {
    font-size: @font-size-sm;
    color: var(--td-text-color-primary);
  }

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__tabs {
    padding: 0 @spacing-lg;
    background: var(--td-bg-color-container);
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__page {
    flex: 1;
    overflow-y: auto;
    padding: @spacing-xxl;

    &--no-tabs {
      padding-top: @spacing-xxl;
    }
  }

  &__footer {
    padding: @spacing-lg @spacing-xxl;
    background: var(--td-bg-color-container);
    border-top: 1px solid var(--td-border-level-1-color);
    text-align: center;

    p {
      margin: 0;
      font-size: @font-size-sm;
      color: var(--td-text-color-secondary);
    }
  }

  &__overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  // 响应式
  &--mobile {
    .ds-app-layout__sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 1000;
      transform: translateX(-100%);
      transition: transform var(--td-duration-normal) var(--td-easing-ease);
    }

    .ds-app-layout__sidebar:not(.ds-app-layout__sidebar--collapsed) {
      transform: translateX(0);
    }

    .ds-app-layout__mobile-toggle {
      display: block;
    }

    .ds-app-layout__user-name {
      display: none;
    }
  }

  // 深色主题
  &--dark {
    background: var(--td-bg-color-page);
    color: var(--td-text-color-primary);

    .ds-app-layout__sidebar,
    .ds-app-layout__header,
    .ds-app-layout__footer {
      background: var(--td-bg-color-container);
      border-color: var(--td-border-level-1-color);
    }
  }
}
</style>
