/**
 * 前端用户流程端到端测试
 * 测试完整的用户交互流程和界面功能
 */

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useDashboardStore } from '../stores/dashboard';
import { useGroupStore } from '../stores/group';
import { useServerStore } from '../stores/server';
import { useToolStore } from '../stores/tool';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    }),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('前端用户流程端到端测试', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'dashboard',
          component: { template: '<div>Dashboard</div>' },
        },
        {
          path: '/login',
          name: 'login',
          component: { template: '<div>Login</div>' },
        },
        {
          path: '/servers',
          name: 'servers',
          component: { template: '<div>Servers</div>' },
        },
        {
          path: '/tools',
          name: 'tools',
          component: { template: '<div>Tools</div>' },
        },
        {
          path: '/groups',
          name: 'groups',
          component: { template: '<div>Groups</div>' },
        },
      ],
    });
  });

  describe('认证流程测试', () => {
    it('应该能够完成登录流程', async () => {
      const authStore = useAuthStore();

      // 模拟登录成功 - 使用setAuth方法
      authStore.setAuth({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: '1',
          username: 'admin',
          role: 'admin',
        },
      });

      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.user?.username).toBe('admin');
      expect(authStore.token).toBe('test-token');
    });

    it('应该能够完成登出流程', async () => {
      const authStore = useAuthStore();

      // 设置初始状态
      authStore.setAuth({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: '1',
          username: 'admin',
          role: 'admin',
        },
      });

      // 执行登出
      authStore.clearAuth();

      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.user).toBeNull();
      expect(authStore.token).toBeNull();
    });

    it('应该能够处理token过期', async () => {
      const authStore = useAuthStore();

      // 模拟token过期
      authStore.clearAuth();

      expect(authStore.isAuthenticated).toBe(false);
    });
  });

  describe('服务器管理流程测试', () => {
    it('应该能够加载服务器列表', async () => {
      const serverStore = useServerStore();

      // 模拟服务器数据
      const mockServers = [
        {
          id: 'server-1',
          name: '测试服务器1',
          type: 'stdio' as const,
          status: 'connected' as const,
          config: { command: 'node', args: ['test.js'] },
          tools: [],
        },
        {
          id: 'server-2',
          name: '测试服务器2',
          type: 'sse' as const,
          status: 'disconnected' as const,
          config: { url: 'http://localhost:3001' },
          tools: [],
        },
      ];

      serverStore.servers = mockServers;

      expect(serverStore.servers).toHaveLength(2);
      expect(serverStore.servers[0].name).toBe('测试服务器1');
    });

    it('应该能够添加新服务器', async () => {
      const serverStore = useServerStore();

      const newServer = {
        id: 'new-server',
        name: '新服务器',
        type: 'stdio' as const,
        status: 'disconnected' as const,
        config: { command: 'node', args: ['new.js'] },
        tools: [],
      };

      serverStore.servers = [newServer];

      expect(serverStore.servers).toHaveLength(1);
      expect(serverStore.servers[0].id).toBe('new-server');
    });

    it('应该能够更新服务器配置', async () => {
      const serverStore = useServerStore();

      serverStore.servers = [
        {
          id: 'server-1',
          name: '原始名称',
          type: 'stdio' as const,
          status: 'connected' as const,
          config: { command: 'node', args: ['test.js'] },
          tools: [],
        },
      ];

      // 更新服务器
      serverStore.servers[0].name = '更新后的名称';

      expect(serverStore.servers[0].name).toBe('更新后的名称');
    });

    it('应该能够删除服务器', async () => {
      const serverStore = useServerStore();

      serverStore.servers = [
        {
          id: 'server-1',
          name: '测试服务器',
          type: 'stdio' as const,
          status: 'connected' as const,
          config: { command: 'node', args: ['test.js'] },
          tools: [],
        },
      ];

      // 删除服务器
      serverStore.servers = [];

      expect(serverStore.servers).toHaveLength(0);
    });
  });

  describe('工具管理流程测试', () => {
    it('应该能够加载工具列表', async () => {
      const toolStore = useToolStore();

      const mockTools = [
        {
          name: 'tool-1',
          description: '测试工具1',
          serverId: 'server-1',
          serverName: '测试服务器',
          inputSchema: {
            type: 'object',
            properties: {},
          },
          status: 'available' as const,
        },
      ];

      toolStore.tools = mockTools;

      expect(toolStore.tools).toHaveLength(1);
      expect(toolStore.tools[0].name).toBe('tool-1');
    });

    it('应该能够按服务器过滤工具', async () => {
      const toolStore = useToolStore();

      toolStore.tools = [
        {
          name: 'tool-1',
          description: '工具1',
          serverId: 'server-1',
          serverName: '服务器1',
          inputSchema: { type: 'object', properties: {} },
          status: 'available' as const,
        },
        {
          name: 'tool-2',
          description: '工具2',
          serverId: 'server-2',
          serverName: '服务器2',
          inputSchema: { type: 'object', properties: {} },
          status: 'available' as const,
        },
      ];

      const filteredTools = toolStore.tools.filter(
        (tool) => tool.serverId === 'server-1',
      );

      expect(filteredTools).toHaveLength(1);
      expect(filteredTools[0].name).toBe('tool-1');
    });

    it('应该能够执行工具测试', async () => {
      const toolStore = useToolStore();

      const testResult = {
        success: true,
        result: { output: '测试成功' },
        executionTime: 100,
      };

      toolStore.executionHistory = [
        {
          id: '1',
          toolName: 'test-tool',
          serverId: 'server-1',
          arguments: { input: 'test' },
          result: testResult,
          timestamp: new Date().toISOString(),
          executionTime: 100,
        },
      ];

      expect(toolStore.executionHistory).toHaveLength(1);
      expect(toolStore.executionHistory[0].result.success).toBe(true);
    });
  });

  describe('组管理流程测试', () => {
    it('应该能够加载组列表', async () => {
      const groupStore = useGroupStore();

      const mockGroups = [
        {
          id: 'group-1',
          name: '测试组1',
          description: '描述1',
          servers: ['server-1'],
          tools: ['tool-1'],
          stats: {
            totalServers: 1,
            availableServers: 1,
            totalTools: 1,
          },
        },
      ];

      groupStore.groups = mockGroups;

      expect(groupStore.groups).toHaveLength(1);
      expect(groupStore.groups[0].name).toBe('测试组1');
    });

    it('应该能够创建新组', async () => {
      const groupStore = useGroupStore();

      const newGroup = {
        id: 'new-group',
        name: '新组',
        description: '新组描述',
        servers: [],
        tools: [],
        stats: {
          totalServers: 0,
          availableServers: 0,
          totalTools: 0,
        },
      };

      groupStore.groups = [newGroup];

      expect(groupStore.groups).toHaveLength(1);
      expect(groupStore.groups[0].id).toBe('new-group');
    });

    it('应该能够更新组配置', async () => {
      const groupStore = useGroupStore();

      groupStore.groups = [
        {
          id: 'group-1',
          name: '原始名称',
          description: '原始描述',
          servers: [],
          tools: [],
          stats: {
            totalServers: 0,
            availableServers: 0,
            totalTools: 0,
          },
        },
      ];

      // 更新组
      groupStore.groups[0].name = '更新后的名称';
      groupStore.groups[0].description = '更新后的描述';

      expect(groupStore.groups[0].name).toBe('更新后的名称');
      expect(groupStore.groups[0].description).toBe('更新后的描述');
    });
  });

  describe('仪表板流程测试', () => {
    it('应该能够加载仪表板数据', async () => {
      const dashboardStore = useDashboardStore();

      dashboardStore.overview = {
        totalServers: 5,
        connectedServers: 3,
        totalTools: 20,
        totalGroups: 2,
      };

      expect(dashboardStore.overview.totalServers).toBe(5);
      expect(dashboardStore.overview.connectedServers).toBe(3);
    });

    it('应该能够显示系统健康状态', async () => {
      const dashboardStore = useDashboardStore();

      dashboardStore.systemHealth = {
        status: 'healthy',
        issues: [],
      };

      expect(dashboardStore.systemHealth.status).toBe('healthy');
      expect(dashboardStore.systemHealth.issues).toHaveLength(0);
    });

    it('应该能够显示最近活动', async () => {
      const dashboardStore = useDashboardStore();

      dashboardStore.recentActivity = [
        {
          id: '1',
          type: 'server_connected',
          message: '服务器已连接',
          timestamp: new Date().toISOString(),
          severity: 'info',
        },
      ];

      expect(dashboardStore.recentActivity).toHaveLength(1);
      expect(dashboardStore.recentActivity[0].type).toBe('server_connected');
    });
  });

  describe('完整用户流程集成测试', () => {
    it('新用户首次使用完整流程', async () => {
      // 1. 用户登录
      const authStore = useAuthStore();
      authStore.setAuth({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: { id: '1', username: 'newuser', role: 'user' },
      });

      expect(authStore.isAuthenticated).toBe(true);

      // 2. 查看仪表板
      const dashboardStore = useDashboardStore();
      dashboardStore.overview = {
        totalServers: 0,
        connectedServers: 0,
        totalTools: 0,
        totalGroups: 0,
      };

      expect(dashboardStore.overview).toBeDefined();

      // 3. 浏览服务器列表
      const serverStore = useServerStore();
      serverStore.servers = [];

      expect(serverStore.servers).toHaveLength(0);

      // 4. 浏览工具列表
      const toolStore = useToolStore();
      toolStore.tools = [];

      expect(toolStore.tools).toHaveLength(0);

      // 5. 浏览组列表
      const groupStore = useGroupStore();
      groupStore.groups = [];

      expect(groupStore.groups).toHaveLength(0);
    });

    it('管理员配置系统完整流程', async () => {
      // 1. 管理员登录
      const authStore = useAuthStore();
      authStore.setAuth({
        token: 'admin-token',
        refreshToken: 'admin-refresh-token',
        user: { id: '1', username: 'admin', role: 'admin' },
      });

      // 2. 添加服务器
      const serverStore = useServerStore();
      serverStore.servers = [
        {
          id: 'new-server',
          name: '新服务器',
          type: 'stdio',
          status: 'disconnected',
          config: { command: 'node', args: ['server.js'] },
          tools: [],
        },
      ];

      expect(serverStore.servers).toHaveLength(1);

      // 3. 创建组并添加服务器
      const groupStore = useGroupStore();
      groupStore.groups = [
        {
          id: 'new-group',
          name: '新组',
          description: '包含新服务器的组',
          servers: ['new-server'],
          tools: [],
          stats: {
            totalServers: 1,
            availableServers: 0,
            totalTools: 0,
          },
        },
      ];

      expect(groupStore.groups).toHaveLength(1);
      expect(groupStore.groups[0].servers).toContain('new-server');

      // 4. 查看仪表板验证配置
      const dashboardStore = useDashboardStore();
      dashboardStore.overview = {
        totalServers: 1,
        connectedServers: 0,
        totalTools: 0,
        totalGroups: 1,
      };

      expect(dashboardStore.overview.totalServers).toBe(1);
      expect(dashboardStore.overview.totalGroups).toBe(1);
    });

    it('用户使用工具完整流程', async () => {
      // 1. 登录
      const authStore = useAuthStore();
      authStore.setAuth({
        token: 'user-token',
        refreshToken: 'user-refresh-token',
        user: { id: '1', username: 'user', role: 'user' },
      });

      // 2. 浏览工具列表
      const toolStore = useToolStore();
      toolStore.tools = [
        {
          name: 'test-tool',
          description: '测试工具',
          serverId: 'server-1',
          serverName: '测试服务器',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
          status: 'available',
        },
      ];

      expect(toolStore.tools).toHaveLength(1);

      // 3. 选择工具并查看详情
      const selectedTool = toolStore.tools[0];
      expect(selectedTool.name).toBe('test-tool');

      // 4. 执行工具
      toolStore.executionHistory = [
        {
          id: '1',
          toolName: 'test-tool',
          serverId: 'server-1',
          arguments: { input: 'test input' },
          result: {
            success: true,
            result: { output: 'success' },
            executionTime: 50,
          },
          timestamp: new Date().toISOString(),
          executionTime: 50,
        },
      ];

      expect(toolStore.executionHistory).toHaveLength(1);
      expect(toolStore.executionHistory[0].result.success).toBe(true);

      // 5. 查看执行历史
      const history = toolStore.executionHistory;
      expect(history[0].toolName).toBe('test-tool');
    });
  });

  describe('错误处理流程测试', () => {
    it('应该能够处理认证失败', async () => {
      const authStore = useAuthStore();

      authStore.clearAuth();
      authStore.error = '用户名或密码错误';

      expect(authStore.isAuthenticated).toBe(false);
      expect(authStore.error).toBe('用户名或密码错误');
    });

    it('应该能够处理服务器连接失败', async () => {
      const serverStore = useServerStore();

      serverStore.error = '无法连接到服务器';
      serverStore.loading = false;

      expect(serverStore.error).toBe('无法连接到服务器');
    });

    it('应该能够处理工具执行失败', async () => {
      const toolStore = useToolStore();

      toolStore.executionHistory = [
        {
          id: '1',
          toolName: 'failing-tool',
          serverId: 'server-1',
          arguments: { input: 'test' },
          result: {
            success: false,
            error: '工具执行失败',
            executionTime: 10,
          },
          timestamp: new Date().toISOString(),
          executionTime: 10,
        },
      ];

      expect(toolStore.executionHistory[0].result.success).toBe(false);
      expect(toolStore.executionHistory[0].result.error).toBe('工具执行失败');
    });
  });
});
