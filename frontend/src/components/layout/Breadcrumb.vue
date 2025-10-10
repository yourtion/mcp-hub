<template>
  <t-breadcrumb class="app-breadcrumb">
    <t-breadcrumb-item
      v-for="(item, index) in breadcrumbItems"
      :key="index"
      :to="item.path"
      :disabled="!item.path || index === breadcrumbItems.length - 1"
    >
      {{ item.title }}
    </t-breadcrumb-item>
  </t-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Breadcrumb as TBreadcrumb, BreadcrumbItem as TBreadcrumbItem } from 'tdesign-vue-next';

interface BreadcrumbItem {
  title: string;
  path?: string;
}

const route = useRoute();

// 路由标题映射
const routeTitleMap: Record<string, string> = {
  '/dashboard': '仪表板',
  '/servers': '服务器管理',
  '/tools': '工具管理',
  '/groups': '组管理',
  '/api-to-mcp': 'API到MCP管理',
  '/debug': '调试工具',
  '/config': '系统配置',
};

// 生成面包屑导航项
const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const items: BreadcrumbItem[] = [
    {
      title: '首页',
      path: '/dashboard',
    },
  ];

  // 获取当前路由的标题
  const currentPath = route.path;
  const currentTitle = route.meta.title as string || routeTitleMap[currentPath];

  // 如果不是首页，添加当前页面
  if (currentPath !== '/dashboard' && currentTitle) {
    items.push({
      title: currentTitle,
      path: currentPath,
    });
  }

  // 处理子路由（如果有）
  if (route.matched.length > 1) {
    const parentRoute = route.matched[route.matched.length - 2];
    const parentPath = parentRoute.path;
    const parentTitle = parentRoute.meta?.title as string || routeTitleMap[parentPath];

    // 如果父路由不是根路由且不是当前路由
    if (parentPath !== '/' && parentPath !== currentPath && parentTitle) {
      // 在当前页面之前插入父路由
      items.splice(1, 0, {
        title: parentTitle,
        path: parentPath,
      });
    }
  }

  return items;
});
</script>

<style scoped>
.app-breadcrumb {
  font-size: 14px;
}

:deep(.t-breadcrumb__item) {
  color: var(--td-text-color-secondary);
}

:deep(.t-breadcrumb__item:last-child) {
  color: var(--td-text-color-primary);
  font-weight: 500;
}

:deep(.t-breadcrumb__separator) {
  color: var(--td-text-color-placeholder);
}
</style>
