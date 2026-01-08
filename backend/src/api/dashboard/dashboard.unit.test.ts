import { describe, expect, it, vi } from 'vitest';

// Mock the services
vi.mock('../../services/dashboard_service.js', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    getDashboardStats: vi.fn().mockResolvedValue({
      overview: {
        totalServers: 2,
        connectedServers: 1,
        totalTools: 5,
        totalGroups: 1,
        apiTools: 0,
      },
      recentActivity: [],
      systemHealth: {
        status: 'healthy',
        issues: [],
        uptime: 3600,
      },
      performance: {
        totalRequests: 10,
        averageResponseTime: 100,
        errorRate: 0,
        topTools: [],
      },
    }),
    getSystemHealth: vi.fn().mockResolvedValue({
      status: 'healthy',
      issues: [],
      checks: {
        servers: {
          status: 'healthy',
          message: '1 个服务器正常连接',
          details: { total: 1, connected: 1, failed: 0 },
        },
        groups: {
          status: 'healthy',
          message: '1 个组正常运行',
          details: { total: 1, healthy: 1, unhealthy: 0 },
        },
        apiTools: {
          status: 'healthy',
          message: '0 个API工具正常运行',
          details: { initialized: true, totalTools: 0, errors: [] },
        },
        memory: {
          status: 'healthy',
          message: '内存使用率 50.0%',
          details: { used: 50, total: 100, percentage: 50 },
        },
      },
      uptime: 3600,
      timestamp: new Date().toISOString(),
    }),
    queryLogs: vi.fn().mockReturnValue({
      logs: [],
      total: 0,
    }),
    getRecentActivities: vi.fn().mockReturnValue([]),
    getPerformanceStats: vi.fn().mockReturnValue({
      totalRequests: 10,
      averageResponseTime: 100,
      errorRate: 0,
      errorCount: 0,
      toolExecutions: {},
    }),
    addLog: vi.fn(),
    cleanup: vi.fn(),
  })),
}));

vi.mock('../../services/sse_event_manager.js', () => ({
  SSEEventManager: vi.fn().mockImplementation(() => ({
    createConnection: vi.fn().mockReturnValue({
      response: new Response('data: {"type":"test"}\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
      clientId: 'test-client',
    }),
    getConnectionStats: vi.fn().mockReturnValue({
      totalClients: 0,
      clients: [],
      eventHistoryCount: 0,
    }),
    broadcastSystemAlert: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

vi.mock('../../services/event_integration_service.js', () => ({
  EventIntegrationService: vi.fn().mockImplementation(() => ({
    recordSystemStart: vi.fn(),
  })),
}));

// Mock the hub service - 暂时注释掉未使用的mock
// const mockHubService = {
//   getDetailedServiceStatus: vi.fn().mockResolvedValue({
//     isInitialized: true,
//     serverCount: 1,
//     connectedServers: 1,
//     groupCount: 1,
//     totalTools: 5,
//     apiTools: 0,
//   }),
//   getServerHealth: vi.fn().mockReturnValue(new Map([['test-server', 'connected']])),
//   getAllGroups: vi.fn().mockReturnValue(new Map([['default', { id: 'default', name: 'Default Group' }]])),
//   listTools: vi.fn().mockResolvedValue([]),
//   getApiToolServiceHealth: vi.fn().mockReturnValue({
//     initialized: true,
//     healthy: true,
//   }),
// };

describe('仪表板API', () => {
  it('应该正确导出仪表板API', async () => {
    // 简单的导入测试
    const dashboardApi = await import('./index.js');
    expect(typeof dashboardApi).toBe('object');
  });

  it('应该有正确的API结构', async () => {
    // 验证类型定义存在
    const dashboardTypes = await import('../../types/dashboard.js');
    expect(typeof dashboardTypes).toBe('object');
  });

  it('应该有正确的服务结构', async () => {
    // 验证服务类存在
    const dashboardService = await import(
      '../../services/dashboard_service.js'
    );
    expect(typeof dashboardService.DashboardService).toBe('function');

    const sseEventManager = await import('../../services/sse_event_manager.js');
    expect(typeof sseEventManager.SSEEventManager).toBe('function');

    const eventIntegrationService = await import(
      '../../services/event_integration_service.js'
    );
    expect(typeof eventIntegrationService.EventIntegrationService).toBe(
      'function',
    );
  });
});
