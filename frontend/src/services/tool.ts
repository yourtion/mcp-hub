import type { ApiResponse } from '@/types/api';
import type {
  ToolErrorResponse,
  ToolExecuteRequest,
  ToolExecuteResponse,
  ToolFilterParams,
  ToolHealthResponse,
  ToolHistoryFilterParams,
  ToolHistoryResponse,
  ToolInfo,
  ToolListResponse,
  ToolMonitoring,
  ToolPerformance,
  ToolStats,
  ToolTestRequest,
  ToolTestResponse,
} from '@/types/tool';
import api, { handleApiResponse } from './api';

/**
 * 获取工具列表
 */
export async function getTools(
  params?: ToolFilterParams,
): Promise<ToolListResponse> {
  const response = await api.get<ApiResponse<ToolListResponse>>('/tools', {
    params,
  });
  return handleApiResponse(response);
}

/**
 * 获取指定服务器的工具
 */
export async function getToolsByServer(
  serverId: string,
  groupId?: string,
): Promise<ToolListResponse> {
  const response = await api.get<ApiResponse<ToolListResponse>>(
    `/tools/server/${serverId}`,
    {
      params: { groupId },
    },
  );
  return handleApiResponse(response);
}

/**
 * 获取工具详细信息
 */
export async function getToolDetail(
  toolName: string,
  groupId?: string,
): Promise<ToolInfo> {
  const response = await api.get<ApiResponse<ToolInfo>>(`/tools/${toolName}`, {
    params: { groupId },
  });
  return handleApiResponse(response);
}

/**
 * 执行工具
 */
export async function executeTool(
  toolName: string,
  request: ToolExecuteRequest,
): Promise<ToolExecuteResponse> {
  const response = await api.post<ApiResponse<ToolExecuteResponse>>(
    `/tools/${toolName}/execute`,
    request,
  );
  return handleApiResponse(response);
}

/**
 * 测试工具参数
 */
export async function testTool(
  toolName: string,
  request: ToolTestRequest,
): Promise<ToolTestResponse> {
  const response = await api.post<ApiResponse<ToolTestResponse>>(
    `/tools/${toolName}/test`,
    request,
  );
  return handleApiResponse(response);
}

/**
 * 获取工具执行历史
 */
export async function getToolHistory(
  params?: ToolHistoryFilterParams,
): Promise<ToolHistoryResponse> {
  const response = await api.get<ApiResponse<ToolHistoryResponse>>(
    '/tools-admin/history',
    {
      params,
    },
  );
  return handleApiResponse(response);
}

/**
 * 获取特定执行记录详情
 */
export async function getExecutionDetail(
  executionId: string,
): Promise<ToolHistoryResponse> {
  const response = await api.get<ApiResponse<ToolHistoryResponse>>(
    `/tools/history/${executionId}`,
  );
  return handleApiResponse(response);
}

/**
 * 获取工具统计信息
 */
export async function getToolStats(
  groupId?: string,
  serverId?: string,
): Promise<ToolStats> {
  const response = await api.get<ApiResponse<ToolStats>>('/tools-admin/stats', {
    params: { groupId, serverId },
  });
  return handleApiResponse(response);
}

/**
 * 获取工具监控信息
 */
export async function getToolMonitoring(
  groupId?: string,
): Promise<ToolMonitoring> {
  const response = await api.get<ApiResponse<ToolMonitoring>>(
    '/tools-admin/monitoring',
    {
      params: { groupId },
    },
  );
  return handleApiResponse(response);
}

/**
 * 获取工具健康检查信息
 */
export async function getToolHealth(
  groupId?: string,
): Promise<ToolHealthResponse> {
  const response = await api.get<ApiResponse<ToolHealthResponse>>(
    '/tools-admin/health',
    {
      params: { groupId },
    },
  );
  return handleApiResponse(response);
}

/**
 * 获取工具性能分析
 */
export async function getToolPerformance(
  timeRange?: string,
  groupId?: string,
  serverId?: string,
): Promise<ToolPerformance> {
  const response = await api.get<ApiResponse<ToolPerformance>>(
    '/tools-admin/performance',
    {
      params: { timeRange, groupId, serverId },
    },
  );
  return handleApiResponse(response);
}

/**
 * 获取工具错误日志
 */
export async function getToolErrors(params?: {
  limit?: number;
  offset?: number;
  toolName?: string;
  serverId?: string;
  groupId?: string;
  severity?: string;
}): Promise<ToolErrorResponse> {
  const response = await api.get<ApiResponse<ToolErrorResponse>>(
    '/tools-admin/errors',
    {
      params,
    },
  );
  return handleApiResponse(response);
}
