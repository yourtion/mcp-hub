import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from '@/types/auth';
import api, { handleApiResponse } from './api';

/**
 * 用户登录
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', credentials);
  return handleApiResponse(response);
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    // 无论请求是否成功，都清除本地存储的token
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  }
}

/**
 * 刷新token
 */
export async function refreshToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const response = await api.post<RefreshResponse>('/auth/refresh', {
    refreshToken,
  });
  return handleApiResponse(response);
}

/**
 * 检查token是否有效
 */
export async function validateToken(): Promise<boolean> {
  try {
    await api.get('/auth/validate');
    return true;
  } catch {
    return false;
  }
}
