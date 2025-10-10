<template>
  <div class="app-header">
    <!-- 左侧：面包屑导航 -->
    <div class="header-left">
      <Breadcrumb />
    </div>

    <!-- 右侧：用户信息和操作 -->
    <div class="header-right">
      <!-- 主题切换按钮 -->
      <t-tooltip content="切换主题" placement="bottom">
        <t-button
          variant="text"
          shape="square"
          class="header-action-btn"
          @click="toggleTheme"
        >
          <template #icon>
            <MoonIcon v-if="!isDark" />
            <SunnyIcon v-else />
          </template>
        </t-button>
      </t-tooltip>

      <!-- 全屏按钮 -->
      <t-tooltip content="全屏" placement="bottom">
        <t-button
          variant="text"
          shape="square"
          class="header-action-btn"
          @click="toggleFullscreen"
        >
          <template #icon>
            <FullscreenIcon v-if="!isFullscreen" />
            <FullscreenExitIcon v-else />
          </template>
        </t-button>
      </t-tooltip>

      <!-- 用户下拉菜单 -->
      <t-dropdown
        :options="userMenuOptions"
        trigger="click"
        @click="handleUserMenuClick"
      >
        <div class="user-info">
          <t-avatar size="32px">
            {{ userInitial }}
          </t-avatar>
          <span v-if="authStore.user" class="username">
            {{ authStore.user.username }}
          </span>
          <ChevronDownIcon class="dropdown-icon" />
        </div>
      </t-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useFullscreen } from '@vueuse/core';
import { useTheme } from '@/composables';
import {
  Button as TButton,
  Tooltip as TTooltip,
  Dropdown as TDropdown,
  Avatar as TAvatar,
  MessagePlugin,
} from 'tdesign-vue-next';
import {
  MoonIcon,
  SunnyIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  ChevronDownIcon,
  UserIcon,
  LockOnIcon,
  LogoutIcon,
} from 'tdesign-icons-vue-next';
import Breadcrumb from './Breadcrumb.vue';

const router = useRouter();
const authStore = useAuthStore();

// 主题管理
const { isDark, toggleTheme: toggleThemeMode } = useTheme();

// 全屏状态
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

// 用户名首字母
const userInitial = computed(() => {
  if (authStore.user?.username) {
    return authStore.user.username.charAt(0).toUpperCase();
  }
  return 'U';
});

// 用户菜单选项
const userMenuOptions = [
  {
    content: '个人设置',
    value: 'profile',
    prefixIcon: () => h(UserIcon),
  },
  {
    content: '修改密码',
    value: 'change-password',
    prefixIcon: () => h(LockOnIcon),
  },
  {
    content: '退出登录',
    value: 'logout',
    prefixIcon: () => h(LogoutIcon),
  },
];

// 切换主题
const toggleTheme = () => {
  toggleThemeMode();
  MessagePlugin.success(isDark.value ? '已切换到暗色模式' : '已切换到亮色模式');
};

// 处理用户菜单点击
const handleUserMenuClick = async (data: { value: string }) => {
  switch (data.value) {
    case 'profile':
      MessagePlugin.info('个人设置功能开发中');
      break;
    case 'change-password':
      MessagePlugin.info('修改密码功能开发中');
      break;
    case 'logout':
      await authStore.logout();
      router.push('/login');
      MessagePlugin.success('已退出登录');
      break;
  }
};
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 24px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-action-btn {
  width: 40px;
  height: 40px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: var(--td-radius-default);
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-info:hover {
  background: var(--td-bg-color-container-hover);
}

.username {
  font-size: 14px;
  color: var(--td-text-color-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  font-size: 16px;
  color: var(--td-text-color-secondary);
  transition: transform 0.2s;
}

.user-info:hover .dropdown-icon {
  transform: rotate(180deg);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app-header {
    padding: 0 16px;
  }

  .username {
    display: none;
  }
}
</style>
