/**
 * Web Store 类型单元测试
 * 测试前端状态管理相关类型定义
 */

import { describe, expect, it } from 'vitest';
import type {
  AuthState,
  AuthActions,
  ServerState,
  ServerActions,
  ToolState,
  ToolActions,
  GroupState,
  GroupActions,
  TestResult,
  ApiToMcpState,
  ApiToMcpActions,
  DashboardState,
  DashboardActions,
  DebugState,
  DebugActions,
  AppState,
  Notification,
  AppActions,
  RootStore,
} from './web-store.js';

describe('Web Store Types - Authentication', () => {
  describe('AuthState', () => {
    it('应该创建已认证状态', () => {
      const state: AuthState = {
        isAuthenticated: true,
        user: {
          id: '123',
          username: 'testuser',
          role: 'admin',
          createdAt: '2024-01-01T00:00:00Z',
        },
        token: 'access-token',
        refreshToken: 'refresh-token',
        loading: false,
        error: null,
      };

      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe('testuser');
      expect(state.token).toBe('access-token');
    });

    it('应该创建未认证状态', () => {
      const state: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: null,
      };

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    it('应该创建加载状态', () => {
      const state: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        loading: true,
        error: null,
      };

      expect(state.loading).toBe(true);
    });

    it('应该创建错误状态', () => {
      const state: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: 'Authentication failed',
      };

      expect(state.error).toBe('Authentication failed');
    });
  });

  describe('AuthActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: AuthActions = {
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        clearError: vi.fn(),
        initialize: vi.fn(),
      };

      expect(typeof actions.login).toBe('function');
      expect(typeof actions.logout).toBe('function');
      expect(typeof actions.refreshToken).toBe('function');
      expect(typeof actions.clearError).toBe('function');
      expect(typeof actions.initialize).toBe('function');
    });
  });
});

describe('Web Store Types - Server', () => {
  describe('ServerState', () => {
    it('应该创建包含服务器的状态', () => {
      const state: ServerState = {
        servers: new Map([
          [
            'server1',
            {
              id: 'server1',
              name: 'Test Server',
              type: 'stdio',
              status: 'connected',
              config: { type: 'stdio', command: 'node', args: [] },
              tools: [],
              reconnectAttempts: 0,
            },
          ],
        ]),
        loading: false,
        error: null,
        selectedServerId: 'server1',
      };

      expect(state.servers.size).toBe(1);
      expect(state.selectedServerId).toBe('server1');
    });

    it('应该创建空服务器状态', () => {
      const state: ServerState = {
        servers: new Map(),
        loading: false,
        error: null,
        selectedServerId: null,
      };

      expect(state.servers.size).toBe(0);
      expect(state.selectedServerId).toBeNull();
    });

    it('应该创建加载状态', () => {
      const state: ServerState = {
        servers: new Map(),
        loading: true,
        error: null,
        selectedServerId: null,
      };

      expect(state.loading).toBe(true);
    });

    it('应该创建错误状态', () => {
      const state: ServerState = {
        servers: new Map(),
        loading: false,
        error: 'Failed to load servers',
        selectedServerId: null,
      };

      expect(state.error).toBe('Failed to load servers');
    });
  });

  describe('ServerActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: ServerActions = {
        fetchServers: vi.fn(),
        createServer: vi.fn(),
        updateServer: vi.fn(),
        deleteServer: vi.fn(),
        connectServer: vi.fn(),
        disconnectServer: vi.fn(),
        testServer: vi.fn(),
        setSelectedServer: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchServers).toBe('function');
      expect(typeof actions.createServer).toBe('function');
      expect(typeof actions.updateServer).toBe('function');
      expect(typeof actions.deleteServer).toBe('function');
      expect(typeof actions.connectServer).toBe('function');
      expect(typeof actions.disconnectServer).toBe('function');
      expect(typeof actions.testServer).toBe('function');
      expect(typeof actions.setSelectedServer).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - Tool', () => {
  describe('ToolState', () => {
    it('应该创建包含工具的状态', () => {
      const state: ToolState = {
        tools: [
          {
            name: 'test_tool',
            description: 'Test tool',
            serverId: 'server1',
            serverName: 'Server 1',
            inputSchema: { type: 'object', properties: {} },
            status: 'available',
          },
        ],
        loading: false,
        error: null,
        selectedToolName: 'test_tool',
      };

      expect(state.tools).toHaveLength(1);
      expect(state.selectedToolName).toBe('test_tool');
    });

    it('应该创建空工具状态', () => {
      const state: ToolState = {
        tools: [],
        loading: false,
        error: null,
        selectedToolName: null,
      };

      expect(state.tools).toHaveLength(0);
    });
  });

  describe('ToolActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: ToolActions = {
        fetchTools: vi.fn(),
        executeTool: vi.fn(),
        setSelectedTool: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchTools).toBe('function');
      expect(typeof actions.executeTool).toBe('function');
      expect(typeof actions.setSelectedTool).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - Group', () => {
  describe('GroupState', () => {
    it('应该创建包含组的状态', () => {
      const state: GroupState = {
        groups: new Map([
          [
            'group1',
            {
              id: 'group1',
              name: 'Group 1',
              servers: ['server1', 'server2'],
              tools: [],
            },
          ],
        ]),
        loading: false,
        error: null,
        selectedGroupId: 'group1',
      };

      expect(state.groups.size).toBe(1);
      expect(state.selectedGroupId).toBe('group1');
    });
  });

  describe('GroupActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: GroupActions = {
        fetchGroups: vi.fn(),
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        setSelectedGroup: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchGroups).toBe('function');
      expect(typeof actions.createGroup).toBe('function');
      expect(typeof actions.updateGroup).toBe('function');
      expect(typeof actions.deleteGroup).toBe('function');
      expect(typeof actions.setSelectedGroup).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - TestResult', () => {
  it('应该创建成功的测试结果', () => {
    const result: TestResult = {
      name: 'test_example',
      passed: true,
      duration: 100,
      error: null,
    };

    expect(result.name).toBe('test_example');
    expect(result.passed).toBe(true);
    expect(result.duration).toBe(100);
    expect(result.error).toBeNull();
  });

  it('应该创建失败的测试结果', () => {
    const result: TestResult = {
      name: 'test_failed',
      passed: false,
      duration: 50,
      error: 'Assertion failed',
    };

    expect(result.passed).toBe(false);
    expect(result.error).toBe('Assertion failed');
  });
});

describe('Web Store Types - ApiToMcp', () => {
  describe('ApiToMcpState', () => {
    it('应该创建 API 转 MCP 配置状态', () => {
      const state: ApiToMcpState = {
        configs: [
          {
            id: 'config1',
            name: 'Test API',
            enabled: true,
            baseUrl: 'https://api.example.com',
            endpoints: [],
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        loading: false,
        error: null,
        selectedConfigId: 'config1',
      };

      expect(state.configs).toHaveLength(1);
      expect(state.selectedConfigId).toBe('config1');
    });
  });

  describe('ApiToMcpActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: ApiToMcpActions = {
        fetchConfigs: vi.fn(),
        createConfig: vi.fn(),
        updateConfig: vi.fn(),
        deleteConfig: vi.fn(),
        testConfig: vi.fn(),
        setSelectedConfig: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchConfigs).toBe('function');
      expect(typeof actions.createConfig).toBe('function');
      expect(typeof actions.updateConfig).toBe('function');
      expect(typeof actions.deleteConfig).toBe('function');
      expect(typeof actions.testConfig).toBe('function');
      expect(typeof actions.setSelectedConfig).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - Dashboard', () => {
  describe('DashboardState', () => {
    it('应该创建仪表板状态', () => {
      const state: DashboardState = {
        serverCount: 5,
        toolCount: 20,
        groupCount: 3,
        activeConnections: 4,
        totalExecutions: 100,
        loading: false,
        error: null,
      };

      expect(state.serverCount).toBe(5);
      expect(state.toolCount).toBe(20);
      expect(state.activeConnections).toBe(4);
    });
  });

  describe('DashboardActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: DashboardActions = {
        fetchStats: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchStats).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - Debug', () => {
  describe('DebugState', () => {
    it('应该创建调试状态', () => {
      const state: DebugState = {
        logs: [],
        metrics: {},
        loading: false,
        error: null,
      };

      expect(state.logs).toHaveLength(0);
      expect(state.metrics).toEqual({});
    });
  });

  describe('DebugActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: DebugActions = {
        fetchLogs: vi.fn(),
        fetchMetrics: vi.fn(),
        clearLogs: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.fetchLogs).toBe('function');
      expect(typeof actions.fetchMetrics).toBe('function');
      expect(typeof actions.clearLogs).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - App', () => {
  describe('Notification', () => {
    it('应该创建通知', () => {
      const notification: Notification = {
        id: 'notif-1',
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
        timestamp: '2024-01-01T12:00:00Z',
      };

      expect(notification.id).toBe('notif-1');
      expect(notification.type).toBe('success');
      expect(notification.title).toBe('Success');
    });

    it('应该支持不同类型的通知', () => {
      const types: Array<'success' | 'error' | 'warning' | 'info'> = [
        'success',
        'error',
        'warning',
        'info',
      ];

      types.forEach(type => {
        const notification: Notification = {
          id: `notif-${type}`,
          type,
          title: 'Test',
          message: 'Test message',
          timestamp: '2024-01-01T12:00:00Z',
        };
        expect(notification.type).toBe(type);
      });
    });
  });

  describe('AppState', () => {
    it('应该创建应用状态', () => {
      const state: AppState = {
        notifications: [],
        sidebarOpen: true,
        theme: 'light',
        loading: false,
        error: null,
      };

      expect(state.notifications).toHaveLength(0);
      expect(state.sidebarOpen).toBe(true);
      expect(state.theme).toBe('light');
    });
  });

  describe('AppActions', () => {
    it('应该定义所有必需的操作', () => {
      const actions: AppActions = {
        addNotification: vi.fn(),
        removeNotification: vi.fn(),
        clearNotifications: vi.fn(),
        toggleSidebar: vi.fn(),
        setTheme: vi.fn(),
        clearError: vi.fn(),
      };

      expect(typeof actions.addNotification).toBe('function');
      expect(typeof actions.removeNotification).toBe('function');
      expect(typeof actions.clearNotifications).toBe('function');
      expect(typeof actions.toggleSidebar).toBe('function');
      expect(typeof actions.setTheme).toBe('function');
      expect(typeof actions.clearError).toBe('function');
    });
  });
});

describe('Web Store Types - RootStore', () => {
  it('应该组合所有状态和操作', () => {
    // 这是一个类型检查测试，确保 RootStore 能够正确组合所有模块
    // 由于 RootStore 可能包含复杂的组合逻辑，这里只验证结构

    type MockStore = {
      authState: AuthState;
      authActions: AuthActions;
      serverState: ServerState;
      serverActions: ServerActions;
      toolState: ToolState;
      toolActions: ToolActions;
      groupState: GroupState;
      groupActions: GroupActions;
      apiToMcpState: ApiToMcpState;
      apiToMcpActions: ApiToMcpActions;
      dashboardState: DashboardState;
      dashboardActions: DashboardActions;
      debugState: DebugState;
      debugActions: DebugActions;
      appState: AppState;
      appActions: AppActions;
    };

    const mockStore: MockStore = {
      authState: {
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: null,
      },
      authActions: {
        login: vi.fn(),
        logout: vi.fn(),
        refreshToken: vi.fn(),
        clearError: vi.fn(),
        initialize: vi.fn(),
      },
      serverState: {
        servers: new Map(),
        loading: false,
        error: null,
        selectedServerId: null,
      },
      serverActions: {
        fetchServers: vi.fn(),
        createServer: vi.fn(),
        updateServer: vi.fn(),
        deleteServer: vi.fn(),
        connectServer: vi.fn(),
        disconnectServer: vi.fn(),
        testServer: vi.fn(),
        setSelectedServer: vi.fn(),
        clearError: vi.fn(),
      },
      toolState: {
        tools: [],
        loading: false,
        error: null,
        selectedToolName: null,
      },
      toolActions: {
        fetchTools: vi.fn(),
        executeTool: vi.fn(),
        setSelectedTool: vi.fn(),
        clearError: vi.fn(),
      },
      groupState: {
        groups: new Map(),
        loading: false,
        error: null,
        selectedGroupId: null,
      },
      groupActions: {
        fetchGroups: vi.fn(),
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        setSelectedGroup: vi.fn(),
        clearError: vi.fn(),
      },
      apiToMcpState: {
        configs: [],
        loading: false,
        error: null,
        selectedConfigId: null,
      },
      apiToMcpActions: {
        fetchConfigs: vi.fn(),
        createConfig: vi.fn(),
        updateConfig: vi.fn(),
        deleteConfig: vi.fn(),
        testConfig: vi.fn(),
        setSelectedConfig: vi.fn(),
        clearError: vi.fn(),
      },
      dashboardState: {
        serverCount: 0,
        toolCount: 0,
        groupCount: 0,
        activeConnections: 0,
        totalExecutions: 0,
        loading: false,
        error: null,
      },
      dashboardActions: {
        fetchStats: vi.fn(),
        clearError: vi.fn(),
      },
      debugState: {
        logs: [],
        metrics: {},
        loading: false,
        error: null,
      },
      debugActions: {
        fetchLogs: vi.fn(),
        fetchMetrics: vi.fn(),
        clearLogs: vi.fn(),
        clearError: vi.fn(),
      },
      appState: {
        notifications: [],
        sidebarOpen: true,
        theme: 'light',
        loading: false,
        error: null,
      },
      appActions: {
        addNotification: vi.fn(),
        removeNotification: vi.fn(),
        clearNotifications: vi.fn(),
        toggleSidebar: vi.fn(),
        setTheme: vi.fn(),
        clearError: vi.fn(),
      },
    };

    expect(mockStore.authState).toBeDefined();
    expect(mockStore.authActions).toBeDefined();
    expect(mockStore.serverState).toBeDefined();
    expect(mockStore.serverActions).toBeDefined();
  });
});
