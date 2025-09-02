/**
 * 前端状态管理相关的类型定义
 */

import type {
  User,
  ServerInfo,
  ToolInfo,
  ToolExecution,
  GroupInfo,
  ApiConfigInfo,
  Activity,
  McpMessage,
} from './web-api.d.js';

// ============================================================================
// 认证状态类型
// ============================================================================

/**
 * 认证状态
 */
export interface AuthState {
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 当前用户信息 */
  user: User | null;
  /** 访问token */
  token: string | null;
  /** 刷新token */
  refreshToken: string | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 认证操作
 */
export interface AuthActions {
  /** 登录 */
  login(username: string, password: string): Promise<void>;
  /** 登出 */
  logout(): Promise<void>;
  /** 刷新token */
  refreshToken(): Promise<void>;
  /** 清除错误 */
  clearError(): void;
  /** 初始化认证状态 */
  initialize(): void;
}

// ============================================================================
// 服务器状态类型
// ============================================================================

/**
 * 服务器状态
 */
export interface ServerState {
  /** 服务器映射表 */
  servers: Map<string, ServerInfo>;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前选中的服务器ID */
  selectedServerId: string | null;
}

/**
 * 服务器操作
 */
export interface ServerActions {
  /** 获取服务器列表 */
  fetchServers(): Promise<void>;
  /** 创建服务器 */
  createServer(server: {
    id: string;
    name: string;
    config: any;
  }): Promise<void>;
  /** 更新服务器 */
  updateServer(
    id: string,
    updates: { name?: string; config: any },
  ): Promise<void>;
  /** 删除服务器 */
  deleteServer(id: string): Promise<void>;
  /** 连接服务器 */
  connectServer(id: string): Promise<void>;
  /** 断开服务器连接 */
  disconnectServer(id: string): Promise<void>;
  /** 测试服务器连接 */
  testServer(config: any): Promise<boolean>;
  /** 设置选中的服务器 */
  setSelectedServer(id: string | null): void;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// 工具状态类型
// ============================================================================

/**
 * 工具状态
 */
export interface ToolState {
  /** 工具映射表 */
  tools: Map<string, ToolInfo>;
  /** 按服务器分组的工具 */
  toolsByServer: Map<string, ToolInfo[]>;
  /** 执行历史 */
  executionHistory: ToolExecution[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前选中的工具名称 */
  selectedToolName: string | null;
  /** 过滤条件 */
  filters: {
    /** 服务器ID过滤 */
    serverId?: string;
    /** 搜索关键词 */
    search?: string;
    /** 状态过滤 */
    status?: 'available' | 'unavailable';
  };
}

/**
 * 工具操作
 */
export interface ToolActions {
  /** 获取工具列表 */
  fetchTools(): Promise<void>;
  /** 按服务器获取工具 */
  fetchToolsByServer(serverId: string): Promise<void>;
  /** 执行工具 */
  executeTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: { serverId?: string; groupId?: string },
  ): Promise<any>;
  /** 获取工具详情 */
  getToolDetails(toolName: string): Promise<ToolInfo | null>;
  /** 设置过滤条件 */
  setFilters(filters: Partial<ToolState['filters']>): void;
  /** 设置选中的工具 */
  setSelectedTool(toolName: string | null): void;
  /** 清除执行历史 */
  clearExecutionHistory(): void;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// 组状态类型
// ============================================================================

/**
 * 组状态
 */
export interface GroupState {
  /** 组映射表 */
  groups: Map<string, GroupInfo>;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前选中的组ID */
  selectedGroupId: string | null;
}

/**
 * 组操作
 */
export interface GroupActions {
  /** 获取组列表 */
  fetchGroups(): Promise<void>;
  /** 创建组 */
  createGroup(group: {
    id: string;
    name: string;
    description?: string;
    servers: string[];
    tools: string[];
  }): Promise<void>;
  /** 更新组 */
  updateGroup(
    id: string,
    updates: {
      name?: string;
      description?: string;
      servers?: string[];
      tools?: string[];
    },
  ): Promise<void>;
  /** 删除组 */
  deleteGroup(id: string): Promise<void>;
  /** 获取组的可用工具 */
  getGroupTools(id: string): Promise<ToolInfo[]>;
  /** 设置组验证密钥 */
  setGroupValidationKey(id: string, key: string): Promise<void>;
  /** 设置选中的组 */
  setSelectedGroup(id: string | null): void;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// API到MCP状态类型
// ============================================================================

/**
 * 测试结果
 */
export interface TestResult {
  /** 配置ID */
  configId: string;
  /** 测试是否成功 */
  success: boolean;
  /** 响应数据 */
  response?: unknown;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: string;
  /** 执行时间（毫秒） */
  executionTime: number;
}

/**
 * API到MCP状态
 */
export interface ApiToMcpState {
  /** API配置映射表 */
  configs: Map<string, ApiConfigInfo>;
  /** 测试结果映射表 */
  testResults: Map<string, TestResult>;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前选中的配置ID */
  selectedConfigId: string | null;
}

/**
 * API到MCP操作
 */
export interface ApiToMcpActions {
  /** 获取API配置列表 */
  fetchConfigs(): Promise<void>;
  /** 创建API配置 */
  createConfig(config: any): Promise<void>;
  /** 更新API配置 */
  updateConfig(id: string, config: any): Promise<void>;
  /** 删除API配置 */
  deleteConfig(id: string): Promise<void>;
  /** 测试API配置 */
  testConfig(id: string, parameters: Record<string, unknown>): Promise<void>;
  /** 获取测试结果 */
  getTestResult(configId: string): TestResult | null;
  /** 设置选中的配置 */
  setSelectedConfig(id: string | null): void;
  /** 清除测试结果 */
  clearTestResults(): void;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// 仪表板状态类型
// ============================================================================

/**
 * 仪表板状态
 */
export interface DashboardState {
  /** 系统概览统计 */
  overview: {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    totalGroups: number;
  };
  /** 最近活动 */
  recentActivity: Activity[];
  /** 系统健康状态 */
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
  };
  /** 性能统计 */
  performanceStats: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topTools: Array<{
      name: string;
      calls: number;
      avgTime: number;
    }>;
  };
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最后更新时间 */
  lastUpdated: string | null;
}

/**
 * 仪表板操作
 */
export interface DashboardActions {
  /** 获取仪表板统计 */
  fetchStats(): Promise<void>;
  /** 获取性能统计 */
  fetchPerformanceStats(): Promise<void>;
  /** 刷新数据 */
  refresh(): Promise<void>;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// 调试状态类型
// ============================================================================

/**
 * 调试状态
 */
export interface DebugState {
  /** MCP消息列表 */
  mcpMessages: McpMessage[];
  /** 消息过滤条件 */
  messageFilters: {
    /** 服务器ID过滤 */
    serverId?: string;
    /** 消息类型过滤 */
    type?: 'request' | 'response' | 'notification';
    /** 方法名过滤 */
    method?: string;
    /** 搜索关键词 */
    search?: string;
  };
  /** 工具测试结果 */
  toolTestResults: Map<string, any>;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否实时监控 */
  isMonitoring: boolean;
}

/**
 * 调试操作
 */
export interface DebugActions {
  /** 获取MCP消息 */
  fetchMcpMessages(): Promise<void>;
  /** 开始实时监控 */
  startMonitoring(): void;
  /** 停止实时监控 */
  stopMonitoring(): void;
  /** 设置消息过滤条件 */
  setMessageFilters(filters: Partial<DebugState['messageFilters']>): void;
  /** 执行工具测试 */
  testTool(
    toolName: string,
    args: Record<string, unknown>,
    options?: { serverId?: string; groupId?: string },
  ): Promise<void>;
  /** 获取工具测试结果 */
  getToolTestResult(testId: string): any;
  /** 清除消息 */
  clearMessages(): void;
  /** 清除测试结果 */
  clearTestResults(): void;
  /** 清除错误 */
  clearError(): void;
}

// ============================================================================
// 全局状态类型
// ============================================================================

/**
 * 全局应用状态
 */
export interface AppState {
  /** 应用主题 */
  theme: 'light' | 'dark' | 'auto';
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 当前语言 */
  locale: string;
  /** 全局加载状态 */
  globalLoading: boolean;
  /** 全局通知列表 */
  notifications: Notification[];
  /** SSE连接状态 */
  sseConnected: boolean;
}

/**
 * 通知类型
 */
export interface Notification {
  /** 通知ID */
  id: string;
  /** 通知类型 */
  type: 'success' | 'warning' | 'error' | 'info';
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  message: string;
  /** 是否自动关闭 */
  autoClose: boolean;
  /** 自动关闭延迟（毫秒） */
  duration: number;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 全局应用操作
 */
export interface AppActions {
  /** 设置主题 */
  setTheme(theme: 'light' | 'dark' | 'auto'): void;
  /** 切换侧边栏折叠状态 */
  toggleSidebar(): void;
  /** 设置语言 */
  setLocale(locale: string): void;
  /** 设置全局加载状态 */
  setGlobalLoading(loading: boolean): void;
  /** 添加通知 */
  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): void;
  /** 移除通知 */
  removeNotification(id: string): void;
  /** 清除所有通知 */
  clearNotifications(): void;
  /** 设置SSE连接状态 */
  setSseConnected(connected: boolean): void;
}

// ============================================================================
// Store组合类型
// ============================================================================

/**
 * 根Store类型
 */
export interface RootStore {
  /** 认证状态 */
  auth: AuthState & AuthActions;
  /** 服务器状态 */
  server: ServerState & ServerActions;
  /** 工具状态 */
  tool: ToolState & ToolActions;
  /** 组状态 */
  group: GroupState & GroupActions;
  /** API到MCP状态 */
  apiToMcp: ApiToMcpState & ApiToMcpActions;
  /** 仪表板状态 */
  dashboard: DashboardState & DashboardActions;
  /** 调试状态 */
  debug: DebugState & DebugActions;
  /** 全局应用状态 */
  app: AppState & AppActions;
}
