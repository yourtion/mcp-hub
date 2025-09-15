import type { ApiResponse } from '@/types/api';
import type {
  DebugErrorAnalysisResponse,
  DebugMcpMessagesResponse,
  DebugPerformanceStatsResponse,
  ToolTestRequest,
  ToolTestResponse,
} from '@/types/debug';
import api, { handleApiResponse } from './api';

// 获取MCP协议消息
export const getMcpMessages = async (
  limit?: number,
  serverId?: string,
  type?: 'request' | 'response' | 'notification',
): Promise<DebugMcpMessagesResponse> => {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (serverId) params.append('serverId', serverId);
  if (type) params.append('type', type);

  const response = await api.get<ApiResponse<DebugMcpMessagesResponse>>(
    `/debug/mcp-messages?${params.toString()}`,
  );
  return handleApiResponse(response);
};

// 测试工具执行
export const testTool = async (
  request: ToolTestRequest,
): Promise<ToolTestResponse> => {
  const response = await api.post<ApiResponse<ToolTestResponse>>(
    '/debug/tool-test',
    request,
  );
  return handleApiResponse(response);
};

// 获取性能统计
export const getPerformanceStats =
  async (): Promise<DebugPerformanceStatsResponse> => {
    const response = await api.get<ApiResponse<DebugPerformanceStatsResponse>>(
      '/debug/performance-stats',
    );
    return handleApiResponse(response);
  };

// 获取错误分析
export const getErrorAnalysis =
  async (): Promise<DebugErrorAnalysisResponse> => {
    const response = await api.get<ApiResponse<DebugErrorAnalysisResponse>>(
      '/debug/error-analysis',
    );
    return handleApiResponse(response);
  };
