// 仪表板相关类型定义

export interface DashboardStats {
  overview: {
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    totalGroups: number;
    apiTools: number;
  };
  recentActivity: Activity[];
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    uptime: number;
  };
  performance: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topTools: Array<{
      name: string;
      calls: number;
      avgTime: number;
    }>;
  };
}

export interface Activity {
  id: string;
  type:
    | 'server_connected'
    | 'server_disconnected'
    | 'tool_executed'
    | 'error'
    | 'system_start'
    | 'config_changed';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  issues: string[];
  checks: {
    servers: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      details: {
        total: number;
        connected: number;
        failed: number;
      };
    };
    groups: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      details: {
        total: number;
        healthy: number;
        unhealthy: number;
      };
    };
    apiTools: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      details: {
        initialized: boolean;
        totalTools: number;
        errors: string[];
      };
    };
    memory: {
      status: 'healthy' | 'warning' | 'error';
      message: string;
      details: {
        used: number;
        total: number;
        percentage: number;
      };
    };
  };
  uptime: number;
  timestamp: string;
}

export interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  topTools: Array<{
    name: string;
    calls: number;
    avgTime: number;
  }>;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  category: string;
  metadata?: Record<string, unknown>;
}

export interface LogQuery {
  level?: 'debug' | 'info' | 'warn' | 'error';
  category?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface LogQueryResult {
  logs: LogEntry[];
  total: number;
  query: LogQuery;
}

export interface SSEEvent {
  type:
    | 'server_status'
    | 'tool_execution'
    | 'system_alert'
    | 'activity'
    | 'health_check';
  data: unknown;
  timestamp: string;
}

export interface ServerStatusEvent extends SSEEvent {
  type: 'server_status';
  data: {
    serverId: string;
    status: string;
    previousStatus?: string;
    error?: string;
    timestamp: string;
  };
}

export interface ToolExecutionEvent extends SSEEvent {
  type: 'tool_execution';
  data: {
    toolName: string;
    serverId: string;
    groupId: string;
    success: boolean;
    executionTime: number;
    timestamp: string;
    error?: string;
  };
}

export interface SystemAlertEvent extends SSEEvent {
  type: 'system_alert';
  data: {
    severity: 'info' | 'warning' | 'error';
    message: string;
    category: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ActivityEvent extends SSEEvent {
  type: 'activity';
  data: Activity;
}

export interface HealthCheckEvent {
  type: 'health_check';
  data: {
    status: 'healthy' | 'warning' | 'error';
    timestamp: string;
    changes: Array<{
      component: string;
      previousStatus: string;
      currentStatus: string;
    }>;
  };
}

export interface SystemInfo {
  node: {
    version: string;
    platform: string;
    arch: string;
    uptime: number;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  environment: {
    nodeEnv: string;
    timezone: string;
  };
}

export interface SSEConnectionStats {
  totalClients: number;
  eventHistoryCount: number;
  subscriptionCounts: Record<string, number>;
}

// 图表数据类型
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// 仪表板卡片配置
export interface DashboardCard {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'table';
  size: 'small' | 'medium' | 'large';
  refreshInterval?: number;
  config?: Record<string, unknown>;
}

// 统计卡片数据
export interface StatCardData {
  value: number | string;
  label: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    period: string;
  };
  icon?: string;
  color?: string;
}
