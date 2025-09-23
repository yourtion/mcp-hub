// 配置管理API服务

import type { ApiResponse } from '@/types/api';
import type {
  ConfigBackup,
  ConfigBackupRequest,
  ConfigData,
  ConfigHistoryResponse,
  ConfigPreview,
  ConfigRestoreRequest,
  ConfigTestResult,
  ConfigType,
  ConfigUpdateRequest,
  ConfigValidationRequest,
  ConfigValidationResponse,
} from '@/types/config';
import api, { handleApiResponse } from './api';

/**
 * 配置管理服务类
 */
export class ConfigService {
  /**
   * 获取当前系统配置
   */
  async getCurrentConfig(): Promise<ConfigData> {
    const response = await api.get<ApiResponse<ConfigData>>('/config');
    return handleApiResponse(response);
  }

  /**
   * 更新系统配置
   */
  async updateConfig(request: ConfigUpdateRequest): Promise<void> {
    const response = await api.put<ApiResponse<void>>('/config', request);
    return handleApiResponse(response);
  }

  /**
   * 验证配置
   */
  async validateConfig(
    request: ConfigValidationRequest,
  ): Promise<ConfigValidationResponse> {
    const response = await api.post<ApiResponse<ConfigValidationResponse>>(
      '/config/validate',
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 获取配置历史
   */
  async getConfigHistory(
    limit = 50,
    offset = 0,
    configType?: ConfigType,
  ): Promise<ConfigHistoryResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (configType) {
      params.append('configType', configType);
    }

    const response = await api.get<ApiResponse<ConfigHistoryResponse>>(
      `/config/history?${params.toString()}`,
    );
    return handleApiResponse(response);
  }

  /**
   * 创建配置备份
   */
  async createBackup(
    request: ConfigBackupRequest,
  ): Promise<{ backupId: string; message: string }> {
    const response = await api.post<
      ApiResponse<{ backupId: string; message: string }>
    >('/config/backup', request);
    return handleApiResponse(response);
  }

  /**
   * 恢复配置
   */
  async restoreFromBackup(request: ConfigRestoreRequest): Promise<void> {
    const response = await api.post<ApiResponse<void>>(
      '/config/restore',
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 测试配置
   */
  async testConfig(
    request: ConfigValidationRequest,
  ): Promise<ConfigTestResult> {
    const response = await api.post<ApiResponse<ConfigTestResult>>(
      '/config/test',
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 预览配置更改
   */
  async previewConfigChanges(
    request: ConfigValidationRequest,
  ): Promise<ConfigPreview> {
    const response = await api.post<ApiResponse<ConfigPreview>>(
      '/config/preview',
      request,
    );
    return handleApiResponse(response);
  }

  /**
   * 获取备份列表
   */
  async getBackupList(
    limit = 50,
    offset = 0,
  ): Promise<{
    backups: ConfigBackup[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await api.get<
      ApiResponse<{
        backups: ConfigBackup[];
        total: number;
        limit: number;
        offset: number;
      }>
    >(`/config/backups?${params.toString()}`);
    return handleApiResponse(response);
  }
}

// 导出配置服务实例
export const configService = new ConfigService();

// 导出默认实例
export default configService;
