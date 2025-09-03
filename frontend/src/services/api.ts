import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types/api';

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

// 响应拦截器 - 处理token刷新
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

          const { token } = response.data;
          localStorage.setItem('auth_token', token);

          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (_refreshError) {
        // 刷新失败，清除token并跳转到登录页
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
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
