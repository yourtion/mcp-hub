<template>
  <div class="side-navigation">
    <!-- Logo 区域 -->
    <div class="nav-logo">
      <div class="logo-content">
        <span v-if="!collapsed" class="logo-text">MCP Hub</span>
        <span v-else class="logo-icon">M</span>
      </div>
    </div>

    <!-- 导航菜单 -->
    <t-menu
      :value="activeMenu"
      :collapsed="collapsed"
      :theme="menuTheme"
      class="nav-menu"
      @change="handleMenuChange"
    >
      <t-menu-item value="dashboard" @click="navigateTo('/dashboard')">
        <template #icon>
          <DashboardIcon />
        </template>
        仪表板
      </t-menu-item>

      <t-menu-item value="servers" @click="navigateTo('/servers')">
        <template #icon>
          <ServerIcon />
        </template>
        服务器管理
      </t-menu-item>

      <t-menu-item value="tools" @click="navigateTo('/tools')">
        <template #icon>
          <ToolsIcon />
        </template>
        工具管理
      </t-menu-item>

      <t-menu-item value="groups" @click="navigateTo('/groups')">
        <template #icon>
          <LayersIcon />
        </template>
        组管理
      </t-menu-item>

      <t-menu-item value="api-to-mcp" @click="navigateTo('/api-to-mcp')">
        <template #icon>
          <ApiIcon />
        </template>
        API到MCP
      </t-menu-item>

      <t-menu-item value="debug" @click="navigateTo('/debug')">
        <template #icon>
          <BugIcon />
        </template>
        调试工具
      </t-menu-item>

      <t-menu-item value="config" @click="navigateTo('/config')">
        <template #icon>
          <SettingIcon />
        </template>
        系统配置
      </t-menu-item>
    </t-menu>

    <!-- 折叠按钮 -->
    <div class="nav-footer">
      <t-button
        variant="text"
        shape="square"
        class="collapse-btn"
        @click="handleToggle"
      >
        <template #icon>
          <ChevronLeftIcon v-if="!collapsed" />
          <ChevronRightIcon v-else />
        </template>
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Menu as TMenu, MenuItem as TMenuItem, Button as TButton } from 'tdesign-vue-next';
import {
  DashboardIcon,
  ServerIcon,
  ToolsIcon,
  LayersIcon,
  ApiIcon,
  BugIcon,
  SettingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'tdesign-icons-vue-next';

interface Props {
  collapsed?: boolean;
}

interface Emits {
  (e: 'toggle-collapse'): void;
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
});

const emit = defineEmits<Emits>();

const router = useRouter();
const route = useRoute();

// 当前激活的菜单项
const activeMenu = ref('dashboard');

// 菜单主题
const menuTheme = computed(() => 'light');

// 根据当前路由更新激活菜单
watch(
  () => route.path,
  (newPath) => {
    const pathMap: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/servers': 'servers',
      '/tools': 'tools',
      '/groups': 'groups',
      '/api-to-mcp': 'api-to-mcp',
      '/debug': 'debug',
      '/config': 'config',
    };

    // 查找匹配的菜单项
    for (const [path, menu] of Object.entries(pathMap)) {
      if (newPath.startsWith(path)) {
        activeMenu.value = menu;
        break;
      }
    }
  },
  { immediate: true }
);

// 导航到指定路由
const navigateTo = (path: string) => {
  router.push(path);
};

// 菜单变化处理
const handleMenuChange = (value: string | number) => {
  activeMenu.value = value as string;
};

// 切换折叠状态
const handleToggle = () => {
  emit('toggle-collapse');
};
</script>

<style scoped>
.side-navigation {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);
}

.nav-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--td-border-level-1-color);
  padding: 0 16px;
}

.logo-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: var(--td-brand-color);
  white-space: nowrap;
}

.logo-icon {
  font-size: 24px;
  font-weight: 700;
  color: var(--td-brand-color);
}

.nav-menu {
  flex: 1;
  border: none;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 自定义滚动条样式 */
.nav-menu::-webkit-scrollbar {
  width: 4px;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: var(--td-scrollbar-color);
  border-radius: 2px;
}

.nav-menu::-webkit-scrollbar-track {
  background: transparent;
}

.nav-footer {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--td-border-level-1-color);
  padding: 8px;
}

.collapse-btn {
  width: 100%;
  height: 40px;
}

/* 菜单项图标样式 */
:deep(.t-menu__item-icon) {
  font-size: 20px;
}

/* 折叠状态下的样式调整 */
:deep(.t-menu--collapsed) {
  .t-menu__item {
    padding: 0;
    justify-content: center;
  }
}
</style>
