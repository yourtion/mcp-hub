// Debug相关的类型定义

export interface McpMessage {
  id: string;
  timestamp: string;
  serverId: string;
  type: 'request' | 'response' | 'notification';
  method: string;
  content: unknown;
}

export interface DebugMcpMessagesResponse {
  messages: McpMessage[];
}

export interface ToolTestRequest {
  toolName: string;
  serverId?: string;
  groupId?: string;
  arguments: Record<string, unknown>;
}

export interface ToolTestResponse {
  toolName: string;
  serverId?: string;
  groupId?: string;
  arguments: Record<string, unknown>;
  result: unknown;
  executionTime: number;
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

export interface DebugPerformanceStatsResponse {
  stats: PerformanceStats;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorRate: number;
  mostCommonErrors: Record<string, number>;
  recentErrors: McpMessage[];
}

export interface DebugErrorAnalysisResponse {
  errors: McpMessage[];
  analysis: ErrorAnalysis;
}
