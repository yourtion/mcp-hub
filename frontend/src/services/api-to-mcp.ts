import api, { handleApiResponse } from './api';
import type {
  ApiConfigListResponse,
  ApiToolConfig,
  CreateApiConfigRequest,
  UpdateApiConfigRequest,
  TestApiConfigRequest,
  TestApiConfigResponse,
  ApiImportConfig,
  ApiExportConfig,
} from '@/types/api-to-mcp';
import type { ApiResponse } from '@/types/api';

/**
 * API到MCP服务类
 */
export class ApiToMcpService {
  /**
   * 获取API配置列表
   */
  async getConfigs(): Promise<ApiConfigListResponse> {
    const response = await api.get<ApiResponse<ApiConfigListResponse>>('/api-to-mcp/configs');
    return handleApiResponse(response);
  }

  /**
   * 获取API配置详情
   */
  async getConfigDetails(configId: string): Promise<ApiToolConfig> {
    const response = await api.get<ApiResponse<ApiToolConfig>>(`/api-to-mcp/configs/${configId}`);
    return handleApiResponse(response);
  }

  /**
   * 创建API配置
   */
  async createConfig(config: ApiToolConfig): Promise<{ id: string; message: string; config?: ApiToolConfig }> {
    const request: CreateApiConfigRequest = { config };
    const response = await api.post<ApiResponse<{ id: string; message: string; config?: ApiToolConfig }>>(
      '/api-to-mcp/configs',
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 更新API配置
   */
  async updateConfig(configId: string, config: ApiToolConfig): Promise<{ id: string; message: string; config?: ApiToolConfig }> {
    const request: UpdateApiConfigRequest = { config };
    const response = await api.put<ApiResponse<{ id: string; message: string; config?: ApiToolConfig }>>(
      `/api-to-mcp/configs/${configId}`,
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 删除API配置
   */
  async deleteConfig(configId: string): Promise<{ id: string; message: string }> {
    const response = await api.delete<ApiResponse<{ id: string; message: string }>>(`/api-to-mcp/configs/${configId}`);
    return handleApiResponse(response);
  }

  /**
   * 测试API配置
   */
  async testConfig(configId: string, parameters: Record<string, unknown>): Promise<TestApiConfigResponse> {
    const request: TestApiConfigRequest = { parameters };
    const response = await api.post<TestApiConfigResponse>(`/api-to-mcp/configs/${configId}/test`, request);
    return response.data; // 测试响应直接返回，不通过handleApiResponse处理
  }

  /**
   * 导入API配置
   */
  async importConfig(importConfig: ApiImportConfig): Promise<{ configs: ApiToolConfig[]; message: string }> {
    const formData = new FormData();
    
    if (importConfig.source instanceof File) {
      formData.append('file', importConfig.source);
      formData.append('format', importConfig.format);
      
      if (importConfig.options) {
        formData.append('options', JSON.stringify(importConfig.options));
      }
      
      const response = await api.post<ApiResponse<{ configs: ApiToolConfig[]; message: string }>>(
        '/api-to-mcp/configs/import',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return handleApiResponse(response);
    } else {
      // 字符串源（如URL或JSON）
      const response = await api.post<ApiResponse<{ configs: ApiToolConfig[]; message: string }>>(
        '/api-to-mcp/configs/import',
        {
          source: importConfig.source,
          format: importConfig.format,
          options: importConfig.options,
        }
      );
      return handleApiResponse(response);
    }
  }

  /**
   * 导出API配置
   */
  async exportConfig(exportConfig: ApiExportConfig): Promise<{ data: string; filename: string; message: string }> {
    const response = await api.post<ApiResponse<{ data: string; filename: string; message: string }>>(
      '/api-to-mcp/configs/export',
      exportConfig,
    );
    return handleApiResponse(response);
  }

  /**
   * 验证API配置
   */
  async validateConfig(config: ApiToolConfig): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const response = await api.post<ApiResponse<{ valid: boolean; errors: string[]; warnings: string[] }>>(
      '/api-to-mcp/configs/validate',
      { config }
    );
    return handleApiResponse(response);
  }

  /**
   * 生成MCP工具预览
   */
  async generateToolPreview(configId: string): Promise<{ tools: any[]; message: string }> {
    const response = await api.post<ApiResponse<{ tools: any[]; message: string }>>(
      `/api/to-mcp/configs/${configId}/preview`,
      {}
    );
    return handleApiResponse(response);
  }

  /**
   * 批量测试API配置
   */
  async batchTestConfigs(configIds: string[]): Promise<{ results: Record<string, TestApiConfigResponse>; message: string }> {
    const response = await api.post<ApiResponse<{ results: Record<string, TestApiConfigResponse>; message: string }>>(
      '/api-to-mcp/configs/batch-test',
      { configIds }
    );
    return handleApiResponse(response);
  }

  /**
   * 获取API配置统计信息
   */
  async getConfigStats(): Promise<{ totalConfigs: number; activeConfigs: number; totalTools: number; lastUpdated: string }> {
    const response = await api.get<ApiResponse<{ totalConfigs: number; activeConfigs: number; totalTools: number; lastUpdated: string }>>(
      '/api-to-mcp/configs/stats'
    );
    return handleApiResponse(response);
  }
}

// 创建单例实例
export const apiToMcpService = new ApiToMcpService();