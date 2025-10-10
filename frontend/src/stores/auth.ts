import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authService from '@/services/auth';
import type { LoginRequest, User } from '@/types/auth';

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // 从本地存储初始化状态
  const initializeAuth = () => {
    const storedToken = localStorage.getItem('auth_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user_info');

    if (storedToken && storedRefreshToken && storedUser) {
      token.value = storedToken;
      refreshToken.value = storedRefreshToken;
      try {
        user.value = JSON.parse(storedUser);
      } catch {
        // 如果解析失败，清除所有存储的数据
        clearAuth();
      }
    }
  };

  // 清除认证状态
  const clearAuth = () => {
    user.value = null;
    token.value = null;
    refreshToken.value = null;
    error.value = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  };

  // 设置认证状态
  const setAuth = (authData: {
    token: string;
    refreshToken: string;
    user: User;
  }) => {
    token.value = authData.token;
    refreshToken.value = authData.refreshToken;
    user.value = authData.user;

    // 持久化到本地存储
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('refresh_token', authData.refreshToken);
    localStorage.setItem('user_info', JSON.stringify(authData.user));
  };

  // 登录
  const login = async (credentials: LoginRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await authService.login(credentials);
      setAuth(response);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 登出
  const logout = async (): Promise<void> => {
    loading.value = true;

    try {
      await authService.logout();
    } catch (err) {
      console.error('登出请求失败:', err);
    } finally {
      clearAuth();
      loading.value = false;
    }
  };

  // 验证token有效性
  const validateToken = async (): Promise<boolean> => {
    if (!token.value) {
      return false;
    }

    try {
      const isValid = await authService.validateToken();
      if (!isValid) {
        clearAuth();
      }
      return isValid;
    } catch {
      clearAuth();
      return false;
    }
  };

  // 刷新token
  const refreshAuthToken = async (): Promise<boolean> => {
    if (!refreshToken.value) {
      return false;
    }

    try {
      const response = await authService.refreshToken(refreshToken.value);
      token.value = response.token;
      localStorage.setItem('auth_token', response.token);
      return true;
    } catch {
      clearAuth();
      return false;
    }
  };

  return {
    // 状态
    user,
    token,
    refreshToken,
    loading,
    error,

    // 计算属性
    isAuthenticated,

    // 方法
    initializeAuth,
    login,
    logout,
    validateToken,
    refreshAuthToken,
    clearAuth,
    setAuth, // 导出setAuth方法供测试使用
  };
});
