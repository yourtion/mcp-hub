// 组管理API服务

import type {
  ConfigureGroupToolsRequest,
  CreateGroupRequest,
  GroupAvailableToolsResponse,
  GroupDetailInfo,
  GroupHealthResponse,
  GroupKeyValidationRequest,
  GroupKeyValidationResponse,
  GroupListResponse,
  GroupOperationResponse,
  GroupServersResponse,
  GroupToolAccessValidationRequest,
  GroupToolAccessValidationResponse,
  GroupToolsConfigResponse,
  GroupToolsResponse,
  GroupValidationKeyDeleteResponse,
  GroupValidationKeyGenerateResponse,
  GroupValidationKeyResponse,
  GroupValidationKeyStatusResponse,
  SetGroupValidationKeyRequest,
  UpdateGroupRequest,
} from '@/types/group';
import api, { handleApiResponse } from './api';

/**
 * 获取组列表
 */
export async function getGroups(): Promise<GroupListResponse> {
  const response = await api.get('/groups');
  return handleApiResponse<GroupListResponse>(response);
}

/**
 * 获取特定组详细信息
 */
export async function getGroup(groupId: string): Promise<GroupDetailInfo> {
  const response = await api.get(`/groups/${groupId}`);
  return handleApiResponse<GroupDetailInfo>(response);
}

/**
 * 创建新组
 */
export async function createGroup(
  data: CreateGroupRequest,
): Promise<GroupOperationResponse> {
  const response = await api.post('/groups', data);
  return handleApiResponse<GroupOperationResponse>(response);
}

/**
 * 更新组配置
 */
export async function updateGroup(
  groupId: string,
  data: UpdateGroupRequest,
): Promise<GroupOperationResponse> {
  const response = await api.put(`/groups/${groupId}`, data);
  return handleApiResponse<GroupOperationResponse>(response);
}

/**
 * 删除组
 */
export async function deleteGroup(groupId: string): Promise<{
  success: true;
  data: { id: string; name: string; deleted: boolean };
  timestamp: string;
}> {
  const response = await api.delete(`/groups/${groupId}`);
  return handleApiResponse(response);
}

/**
 * 获取组的健康检查状态
 */
export async function getGroupHealth(
  groupId: string,
): Promise<GroupHealthResponse> {
  const response = await api.get(`/groups/${groupId}/health`);
  return handleApiResponse<GroupHealthResponse>(response);
}

/**
 * 获取组的工具列表
 */
export async function getGroupTools(
  groupId: string,
): Promise<GroupToolsResponse> {
  const response = await api.get(`/groups/${groupId}/tools`);
  return handleApiResponse<GroupToolsResponse>(response);
}

/**
 * 获取组的服务器列表
 */
export async function getGroupServers(
  groupId: string,
): Promise<GroupServersResponse> {
  const response = await api.get(`/groups/${groupId}/servers`);
  return handleApiResponse<GroupServersResponse>(response);
}

/**
 * 配置组工具过滤
 */
export async function configureGroupTools(
  groupId: string,
  data: ConfigureGroupToolsRequest,
): Promise<GroupToolsConfigResponse> {
  const response = await api.post(`/groups/${groupId}/tools`, data);
  return handleApiResponse<GroupToolsConfigResponse>(response);
}

/**
 * 获取组可用工具（支持过滤）
 */
export async function getGroupAvailableTools(
  groupId: string,
): Promise<GroupAvailableToolsResponse> {
  const response = await api.get(`/groups/${groupId}/available-tools`);
  return handleApiResponse<GroupAvailableToolsResponse>(response);
}

/**
 * 验证工具访问权限
 */
export async function validateGroupToolAccess(
  groupId: string,
  data: GroupToolAccessValidationRequest,
): Promise<GroupToolAccessValidationResponse> {
  const response = await api.post(
    `/groups/${groupId}/validate-tool-access`,
    data,
  );
  return handleApiResponse<GroupToolAccessValidationResponse>(response);
}

/**
 * 设置组验证密钥
 */
export async function setGroupValidationKey(
  groupId: string,
  data: SetGroupValidationKeyRequest,
): Promise<GroupValidationKeyResponse> {
  const response = await api.post(`/groups/${groupId}/validation-key`, data);
  return handleApiResponse<GroupValidationKeyResponse>(response);
}

/**
 * 获取组验证密钥状态
 */
export async function getGroupValidationKeyStatus(
  groupId: string,
): Promise<GroupValidationKeyStatusResponse> {
  const response = await api.get(`/groups/${groupId}/validation-key`);
  return handleApiResponse<GroupValidationKeyStatusResponse>(response);
}

/**
 * 验证组密钥
 */
export async function validateGroupKey(
  groupId: string,
  data: GroupKeyValidationRequest,
): Promise<GroupKeyValidationResponse> {
  const response = await api.post(`/groups/${groupId}/validate-key`, data);
  return handleApiResponse<GroupKeyValidationResponse>(response);
}

/**
 * 删除组验证密钥
 */
export async function deleteGroupValidationKey(
  groupId: string,
): Promise<GroupValidationKeyDeleteResponse> {
  const response = await api.delete(`/groups/${groupId}/validation-key`);
  return handleApiResponse<GroupValidationKeyDeleteResponse>(response);
}

/**
 * 生成新的验证密钥
 */
export async function generateGroupValidationKey(
  groupId: string,
): Promise<GroupValidationKeyGenerateResponse> {
  const response = await api.post(`/groups/${groupId}/generate-validation-key`);
  return handleApiResponse<GroupValidationKeyGenerateResponse>(response);
}
