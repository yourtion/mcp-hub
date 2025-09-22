import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardStore } from '../dashboard';

// Mock services
vi.mock('@/services/dashboard', () => ({
  dashboardService: {
    getDashboardStats: vi.fn(),
    getSystemHealth: vi.fn(),
    getPerformanceStats: vi.fn(),
    getSystemInfo: vi.fn(),
    queryLogs: vi.fn(),
    getRecentActivities: vi.fn(),
  },
}));

vi.mock('@/services/sse', () => ({
  sseService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getConnectionState: vi.fn(() => 'closed'),
    addEventListener: vi.fn(),
    removeAllEventListeners: vi.fn(),
    onServerStatus: vi.fn(),
    onToolExecution: vi.fn(),
    onSystemAlert: vi.fn(),
    onHealthCheck: vi.fn(),
  },
}));

describe('Dashboard Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应该正确初始化状态', () => {
    const store = useDashboardStore();

    expect(store.stats).toBeNull();
    expect(store.systemHealth).toBeNull();
    expect(store.performanceStats).toBeNull();
    expect(store.activities).toEqual([]);
    expect(store.logs).toEqual([]);
  });

  it('应该正确计算健康状态', () => {
    const store = useDashboardStore();

    // 初始状态
    expect(store.isHealthy).toBe(false);
    expect(store.hasWarnings).toBe(false);
    expect(store.hasErrors).toBe(false);

    // 设置健康状态
    store.systemHealth = {
      status: 'healthy',
      issues: [],
    };

    expect(store.isHealthy).toBe(true);
    expect(store.hasWarnings).toBe(false);
    expect(store.hasErrors).toBe(false);
  });

  it('应该正确计算统计卡片数据', () => {
    const store = useDashboardStore();

    // 设置模拟数据
    store.stats = {
      overview: {
        totalServers: 5,
        connectedServers: 4,
        totalTools: 20,
        totalGroups: 3,
      },
      recentActivity: [],
      systemHealth: {
        status: 'healthy',
        issues: [],
      },
    };

    const cards = store.statCards;
    expect(cards).toHaveLength(4);
    expect(cards[0].value).toBe(5);
    expect(cards[0].label).toBe('总服务器数');
    expect(cards[1].value).toBe(4);
    expect(cards[1].label).toBe('已连接服务器');
  });

  it('应该正确计算服务器连接率', () => {
    const store = useDashboardStore();

    // 设置模拟数据
    store.stats = {
      overview: {
        totalServers: 10,
        connectedServers: 8,
        totalTools: 20,
        totalGroups: 3,
      },
      recentActivity: [],
      systemHealth: {
        status: 'healthy',
        issues: [],
      },
    };

    expect(store.serverConnectionRate).toBe(80);
  });

  it('应该正确计算错误事件数量', () => {
    const store = useDashboardStore();

    const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();

    store.activities = [
      {
        id: '1',
        type: 'error',
        message: '最近错误',
        timestamp: oneHourAgo,
        severity: 'error',
      },
      {
        id: '2',
        type: 'error',
        message: '较早错误',
        timestamp: twoHoursAgo,
        severity: 'error',
      },
    ];

    expect(store.recentErrorCount).toBe(1);
  });
});
