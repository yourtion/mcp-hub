// 服务器管理API服务

import type {
  CreateServerRequest,
  ServerInfo,
  ServerListResponse,
  ServerOperationResponse,
  ServerStatusInfo,
  TestServerRequest,
  TestServerResponse,
  UpdateServerRequest,
  ValidateServerRequest,
  ValidateServerResponse,
} from '@/types/server';
import api, { handleApiResponse } from './api';

/**
 * 获取服务器列表
 */
export async function getServers(): Promise<ServerListResponse> {
  const response = await api.get('/servers');
  return handleApiResponse<ServerListResponse>(response);
}

/**
 * 获取特定服务器信息
 */
export async function getServer(id: string): Promise<ServerInfo> {
  const response = await api.get(`/servers/${id}`);
  return handleApiResponse<ServerInfo>(response);
}

/**
 * 创建新服务器
 */
export async function createServer(
  data: CreateServerRequest,
): Promise<ServerOperationResponse> {
  const response = await api.post('/servers', data);
  return handleApiResponse<ServerOperationResponse>(response);
}

/**
 * 更新服务器配置
 */
export async function updateServer(
  id: string,
  data: UpdateServerRequest,
): Promise<ServerOperationResponse> {
  const response = await api.put(`/servers/${id}`, data);
  return handleApiResponse<ServerOperationResponse>(response);
}

/**
 * 删除服务器
 */
export async function deleteServer(
  id: string,
): Promise<ServerOperationResponse> {
  const response = await api.delete(`/servers/${id}`);
  return handleApiResponse<ServerOperationResponse>(response);
}

/**
 * 获取服务器连接状态
 */
export async function getServerStatus(id: string): Promise<ServerStatusInfo> {
  const response = await api.get(`/servers/${id}/status`);
  return handleApiResponse<ServerStatusInfo>(response);
}

/**
 * 连接服务器
 */
export async function connectServer(
  id: string,
): Promise<ServerOperationResponse> {
  const response = await api.post(`/servers/${id}/connect`);
  return handleApiResponse<ServerOperationResponse>(response);
}

/**
 * 断开服务器连接
 */
export async function disconnectServer(
  id: string,
): Promise<ServerOperationResponse> {
  const response = await api.post(`/servers/${id}/disconnect`);
  return handleApiResponse<ServerOperationResponse>(response);
}

/**
 * 测试服务器连接
 */
export async function testServer(
  config: TestServerRequest,
): Promise<TestServerResponse> {
  const response = await api.post('/servers/test', config);
  return handleApiResponse<TestServerResponse>(response);
}

/**
 * 验证服务器配置
 */
export async function validateServer(
  config: ValidateServerRequest,
): Promise<ValidateServerResponse> {
  const response = await api.post('/servers/validate', config);
  return handleApiResponse<ValidateServerResponse>(response);
}
