<template>
  <t-breadcrumb class="app-breadcrumb">
    <t-breadcrumb-item
      v-for="(item, index) in breadcrumbItems"
      :key="index"
      :to="item.path"
      :disabled="!item.path || index === breadcrumbItems.length - 1"
    >
      <component v-if="item.icon" :is="item.icon" class="breadcrumb-icon" />
      {{ item.title }}
    </t-breadcrumb-item>
  </t-breadcrumb>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Breadcrumb as TBreadcrumb, BreadcrumbItem as TBreadcrumbItem } from 'tdesign-vue-next';
import {
  DashboardIcon,
  ServerIcon,
  ToolsIcon,
  FolderIcon,
  FileIcon,
  BugIcon,
  SettingIcon,
  ApiIcon,
  FileCopyIcon,
} from 'tdesign-icons-vue-next';

interface BreadcrumbItem {
  title: string;
  path?: string;
  icon?: Component;
}

const route = useRoute();
const router = useRouter();

// 路由图标映射
const routeIconMap: Record<string, Component> = {
  '/dashboard': markRaw(DashboardIcon),
  '/servers': markRaw(ServerIcon),
  '/tools': markRaw(ToolsIcon),
  '/groups': markRaw(FolderIcon),
  '/api-to-mcp': markRaw(ApiIcon),
  '/debug': markRaw(BugIcon),
  '/config': markRaw(SettingIcon),
};

// 获取父路由信息
const getParentRouteInfo = (path: string): { title: string; path: string; icon?: Component } | null => {
  // 工具相关的子路由
  if (path.startsWith('/tools/') && path.includes('/detail')) {
    return {
      title: '工具管理',
      path: '/tools',
      icon: routeIconMap['/tools'],
    };
  }

  if (path.startsWith('/tools/') && (path.includes('/test') || path.includes('/execute'))) {
    return {
      title: '工具管理',
      path: '/tools',
      icon: routeIconMap['/tools'],
    };
  }

  return null;
};

// 生成面包屑导航项
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    {
      title: '首页',
      path: '/dashboard',
      icon: routeIconMap['/dashboard'],
    },
  ];

  const currentPath = route.path;
  const toolName = route.params.toolName as string;

  // 处理工具详情/测试/执行页面的特殊面包屑
  if (currentPath.startsWith('/tools/') && toolName) {
    // 添加工具管理
    items.push({
      title: '工具管理',
      path: '/tools',
      icon: routeIconMap['/tools'],
    });

    // 根据子路由类型添加对应的面包屑
    if (currentPath.includes('/detail')) {
      items.push({
        title: `${toolName} 详情`,
        path: currentPath,
        icon: markRaw(FileCopyIcon),
      });
    } else if (currentPath.includes('/test')) {
      items.push({
        title: `${toolName} 测试`,
        path: currentPath,
        icon: markRaw(FileIcon),
      });
    } else if (currentPath.includes('/execute')) {
      items.push({
        title: `${toolName} 执行`,
        path: currentPath,
        icon: markRaw(FileIcon),
      });
    }
  } else {
    // 常规页面的面包屑
    const currentTitle = route.meta.title as string;

    // 如果不是首页，添加当前页面
    if (currentPath !== '/dashboard' && currentTitle) {
      // 检查是否有父路由
      const parentInfo = getParentRouteInfo(currentPath);

      if (parentInfo) {
        items.push({
          title: parentInfo.title,
          path: parentInfo.path,
          icon: parentInfo.icon,
        });
      }

      items.push({
        title: currentTitle,
        path: currentPath,
        icon: routeIconMap[currentPath] || markRaw(FileIcon),
      });
    }
  }

  return items;
});
</script>

<style lang="less" scoped>
@import '../../design-system/tokens/spacing.less';

.app-breadcrumb {
  font-size: var(--font-size-sm);
}

.breadcrumb-icon {
  margin-right: 4px;
  font-size: 16px;
  vertical-align: text-bottom;
}

:deep(.t-breadcrumb__item) {
  color: var(--td-text-color-secondary);
  transition: color 0.2s;

  &:hover {
    color: var(--td-brand-color);
  }
}

:deep(.t-breadcrumb__item:last-child) {
  color: var(--td-text-color-primary);
  font-weight: var(--font-weight-medium);

  &:hover {
    color: var(--td-text-color-primary);
  }
}

:deep(.t-breadcrumb__separator) {
  color: var(--td-text-color-placeholder);
  margin: 0 @spacing-xs;
}

// 响应式设计
@media (max-width: 768px) {
  .app-breadcrumb {
    font-size: var(--font-size-xs);
  }

  .breadcrumb-icon {
    font-size: 14px;
  }
}
</style>
