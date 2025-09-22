// 仪表板API服务

import type {
  Activity,
  DashboardStats,
  LogQuery,
  LogQueryResult,
  PerformanceStats,
  SSEConnectionStats,
  SystemHealth,
  SystemInfo,
} from '@/types/dashboard';
import api, { handleApiResponse } from './api';

export class DashboardService {
  /**
   * 获取仪表板统计信息
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get('/dashboard/stats');
    return handleApiResponse(response);
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await api.get('/dashboard/health');
    return handleApiResponse(response);
  }

  /**
   * 获取详细健康检查报告
   */
  async getDetailedHealth(): Promise<
    SystemHealth & { additionalChecks: Record<string, unknown> }
  > {
    const response = await api.get('/dashboard/health-detailed');
    return handleApiResponse(response);
  }

  /**
   * 查询系统日志
   */
  async queryLogs(query: LogQuery): Promise<LogQueryResult> {
    const params = new URLSearchParams();

    if (query.level) params.append('level', query.level);
    if (query.category) params.append('category', query.category);
    if (query.startTime) params.append('startTime', query.startTime);
    if (query.endTime) params.append('endTime', query.endTime);
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.offset) params.append('offset', query.offset.toString());
    if (query.search) params.append('search', query.search);

    const response = await api.get(`/dashboard/logs?${params.toString()}`);
    return handleApiResponse(response);
  }

  /**
   * 获取最近活动
   */
  async getRecentActivities(
    limit = 50,
  ): Promise<{ activities: Activity[]; total: number }> {
    const response = await api.get(`/dashboard/activities?limit=${limit}`);
    return handleApiResponse(response);
  }

  /**
   * 获取性能统计
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    const response = await api.get('/dashboard/performance');
    return handleApiResponse(response);
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await api.get('/dashboard/system-info');
    return handleApiResponse(response);
  }

  /**
   * 获取SSE连接统计
   */
  async getSSEStats(): Promise<SSEConnectionStats> {
    const response = await api.get('/dashboard/sse-stats');
    return handleApiResponse(response);
  }

  /**
   * 清理日志
   */
  async clearLogs(): Promise<{ message: string }> {
    const response = await api.delete('/dashboard/logs');
    return handleApiResponse(response);
  }

  /**
   * 发送测试告警
   */
  async sendTestAlert(
    severity: 'info' | 'warning' | 'error',
    message: string,
    category = 'test',
  ): Promise<{ message: string }> {
    const response = await api.post('/dashboard/test-alert', {
      severity,
      message,
      category,
    });
    return handleApiResponse(response);
  }

  /**
   * 发送测试工具执行事件
   */
  async sendTestToolExecution(data: {
    toolName?: string;
    serverId?: string;
    groupId?: string;
    success?: boolean;
    executionTime?: number;
    error?: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/dashboard/test-tool-execution', data);
    return handleApiResponse(response);
  }

  /**
   * 发送测试服务器状态事件
   */
  async sendTestServerStatus(data: {
    serverId?: string;
    status?: string;
    previousStatus?: string;
    error?: string;
  }): Promise<{ message: string }> {
    const response = await api.post('/dashboard/test-server-status', data);
    return handleApiResponse(response);
  }

  /**
   * 添加自定义日志
   */
  async addLog(data: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    message?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ message: string }> {
    const response = await api.post('/dashboard/add-log', data);
    return handleApiResponse(response);
  }
}

export const dashboardService = new DashboardService();
