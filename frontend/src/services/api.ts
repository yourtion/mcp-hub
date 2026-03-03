import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types/api';

// 错误消息映射表
const errorMessages: Record<number, string> = {
  400: '请求参数错误，请检查输入',
  401: '用户名或密码错误',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  409: '数据冲突，请刷新后重试',
  500: '服务器错误，请稍后重试',
  502: '网关错误，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
};

// 创建axios实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器 - 处理token刷新和错误消息
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          localStorage.setItem('auth_token', accessToken);

          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (_refreshError) {
        // 刷新失败，清除token并跳转到登录页
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    // 添加用户友好的错误消息
    if (error.response) {
      const status = error.response.status;
      const message = errorMessages[status] || `请求失败 (${status})`;
      error.userMessage = message;
    } else if (error.request) {
      error.userMessage = '网络错误，请检查网络连接';
    } else {
      error.userMessage = '请求配置错误';
    }

    return Promise.reject(error);
  },
);

export default api;

// 通用API响应处理函数
export const handleApiResponse = <T>(
  response: AxiosResponse<ApiResponse<T>>,
): T => {
  if (response.data.success && response.data.data !== undefined) {
    return response.data.data;
  }
  throw new Error(response.data.error?.message || '请求失败');
};
