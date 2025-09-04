import type { ApiResponse } from '@/types/api';
import type {
  ToolErrorResponse,
  ToolExecuteRequest,
  ToolExecuteResponse,
  ToolFilterParams,
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

export class ToolService {
  /**
   * 获取工具列表
   */
  static async getTools(params?: ToolFilterParams): Promise<ToolListResponse> {
    const response = await api.get<ApiResponse<ToolListResponse>>('/tools', {
      params,
    });
    return handleApiResponse(response);
  }

  /**
   * 获取指定服务器的工具
   */
  static async getToolsByServer(
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
  static async getToolDetail(
    toolName: string,
    groupId?: string,
  ): Promise<ToolInfo> {
    const response = await api.get<ApiResponse<ToolInfo>>(
      `/tools/${toolName}`,
      {
        params: { groupId },
      },
    );
    return handleApiResponse(response);
  }

  /**
   * 执行工具
   */
  static async executeTool(
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
  static async testTool(
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
  static async getToolHistory(
    params?: ToolHistoryFilterParams,
  ): Promise<ToolHistoryResponse> {
    const response = await api.get<ApiResponse<ToolHistoryResponse>>(
      '/tools/history',
      {
        params,
      },
    );
    return handleApiResponse(response);
  }

  /**
   * 获取特定执行记录详情
   */
  static async getExecutionDetail(executionId: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(
      `/tools/history/${executionId}`,
    );
    return handleApiResponse(response);
  }

  /**
   * 获取工具统计信息
   */
  static async getToolStats(
    groupId?: string,
    serverId?: string,
  ): Promise<ToolStats> {
    const response = await api.get<ApiResponse<ToolStats>>('/tools/stats', {
      params: { groupId, serverId },
    });
    return handleApiResponse(response);
  }

  /**
   * 获取工具监控信息
   */
  static async getToolMonitoring(groupId?: string): Promise<ToolMonitoring> {
    const response = await api.get<ApiResponse<ToolMonitoring>>(
      '/tools/monitoring',
      {
        params: { groupId },
      },
    );
    return handleApiResponse(response);
  }

  /**
   * 获取工具健康检查信息
   */
  static async getToolHealth(groupId?: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>('/tools/health', {
      params: { groupId },
    });
    return handleApiResponse(response);
  }

  /**
   * 获取工具性能分析
   */
  static async getToolPerformance(
    timeRange?: string,
    groupId?: string,
    serverId?: string,
  ): Promise<ToolPerformance> {
    const response = await api.get<ApiResponse<ToolPerformance>>(
      '/tools/performance',
      {
        params: { timeRange, groupId, serverId },
      },
    );
    return handleApiResponse(response);
  }

  /**
   * 获取工具错误日志
   */
  static async getToolErrors(params?: {
    limit?: number;
    offset?: number;
    toolName?: string;
    serverId?: string;
    groupId?: string;
    severity?: string;
  }): Promise<ToolErrorResponse> {
    const response = await api.get<ApiResponse<ToolErrorResponse>>(
      '/tools/errors',
      {
        params,
      },
    );
    return handleApiResponse(response);
  }
}
