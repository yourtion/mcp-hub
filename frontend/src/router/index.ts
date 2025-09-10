import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Login from '@/views/Login.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
      meta: {
        requiresAuth: false,
        title: '登录',
      },
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: {
        requiresAuth: true,
        title: '仪表板',
      },
    },
    {
      path: '/servers',
      name: 'Servers',
      component: () => import('@/views/Servers.vue'),
      meta: {
        requiresAuth: true,
        title: '服务器管理',
      },
    },
    {
      path: '/groups',
      name: 'Groups',
      component: () => import('@/views/Groups.vue'),
      meta: {
        requiresAuth: true,
        title: '组管理',
      },
    },
    {
      path: '/api-to-mcp',
      name: 'ApiToMcp',
      component: () => import('@/views/ApiToMcp.vue'),
      meta: {
        requiresAuth: true,
        title: 'API到MCP管理',
      },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/NotFound.vue'),
      meta: {
        title: '页面未找到',
      },
    },
  ],
});

// 路由守卫
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - MCP Hub`;
  }

  // 如果访问登录页面且已登录，重定向到仪表板
  if (to.name === 'Login' && authStore.isAuthenticated) {
    next('/dashboard');
    return;
  }

  // 如果路由需要认证
  if (to.meta.requiresAuth) {
    // 检查是否已登录
    if (!authStore.isAuthenticated) {
      // 尝试验证token
      const isValid = await authStore.validateToken();
      if (!isValid) {
        // token无效，跳转到登录页
        next({
          name: 'Login',
          query: { redirect: to.fullPath },
        });
        return;
      }
    }
  }

  next();
});

export default router;
