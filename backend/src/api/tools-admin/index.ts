/**
 * 工具管理API
 * 提供工具监控、性能分析、健康检查等管理功能
 */

import { Hono } from 'hono';

import { getHubService } from '../../services/service-registry.js';
import { errorResponse, successResponse } from '../../utils/api-response.js';
import { logger } from '../../utils/logger.js';

export const toolsAdminApi = new Hono();

// GET /api/tools/history - 获取工具执行历史记录
export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  serverId: string;
  groupId: string;
  arguments: Record<string, unknown>;
  result: Record<string, unknown>;
  isError: boolean;
  executionTime: number;
  timestamp: string;
}

// 内存中的执行历史记录
const executionHistory: ToolExecutionRecord[] = [];
const MAX_HISTORY_SIZE = 1000;

// 添加执行记录
function addExecutionRecord(record: ToolExecutionRecord): void {
  executionHistory.unshift(record);

  if (executionHistory.length > MAX_HISTORY_SIZE) {
    executionHistory.splice(MAX_HISTORY_SIZE);
  }

  logger.debug('添加工具执行记录', {
    executionId: record.id,
    toolName: record.toolName,
    totalRecords: executionHistory.length,
  });
}

// 导出此函数供tools API使用
export { addExecutionRecord };

// GET /api/tools/history - 获取工具执行历史记录
toolsAdminApi.get('/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const toolName = c.req.query('toolName');
    const serverId = c.req.query('serverId');
    const groupId = c.req.query('groupId');

    let filteredHistory = [...executionHistory];

    if (toolName) {
      filteredHistory = filteredHistory.filter((record) => record.toolName === toolName);
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter((record) => record.serverId === serverId);
    }
    if (groupId) {
      filteredHistory = filteredHistory.filter((record) => record.groupId === groupId);
    }

    const total = filteredHistory.length;
    const paginatedHistory = filteredHistory.slice(offset, offset + limit);

    logger.info('获取工具执行历史记录', {
      total,
      limit,
      offset,
      returned: paginatedHistory.length,
      filters: { toolName, serverId, groupId },
    });

    return successResponse(c, {
      history: paginatedHistory.map((record) => ({
        id: record.id,
        toolName: record.toolName,
        serverId: record.serverId,
        groupId: record.groupId,
        isError: record.isError,
        executionTime: record.executionTime,
        timestamp: record.timestamp,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

toolsAdminApi.get('/monitoring', async (c) => {
  try {
    const groupId = c.req.query('groupId') || 'default';
    const service = getHubService();

    const allTools = await service.listTools(groupId);
    const serverHealth = service.getServerHealth();

    const toolsByServer = new Map<
      string,
      {
        serverId: string;
        serverStatus: string;
        tools: Array<{
          name: string;
          description?: string;
          serverId: string;
          inputSchema: Record<string, unknown>;
          status: 'available' | 'unavailable';
        }>;
      }
    >();

    allTools.forEach((tool) => {
      if (!toolsByServer.has(tool.serverId)) {
        toolsByServer.set(tool.serverId, {
          serverId: tool.serverId,
          serverStatus: serverHealth.get(tool.serverId) || 'unknown',
          tools: [],
        });
      }
    });

    allTools.forEach((tool) => {
      const serverGroup = toolsByServer.get(tool.serverId);
      if (!serverGroup) return;

      serverGroup.tools.push({
        name: tool.name,
        description: tool.description,
        serverId: tool.serverId,
        inputSchema: tool.inputSchema,
        status: serverGroup.serverStatus === 'connected' ? 'available' : 'unavailable',
      });
    });

    const totalTools = allTools.length;
    const availableTools = allTools.filter(
      (tool) => serverHealth.get(tool.serverId) === 'connected',
    ).length;
    const totalServers = toolsByServer.size;
    const connectedServers = Array.from(toolsByServer.values()).filter(
      (server) => server.serverStatus === 'connected',
    ).length;

    logger.info('获取工具状态监控信息', {
      groupId,
      totalTools,
      availableTools,
      totalServers,
      connectedServers,
    });

    return successResponse(c, {
      overview: {
        totalTools,
        availableTools,
        unavailableTools: totalTools - availableTools,
        totalServers,
        connectedServers,
        disconnectedServers: totalServers - connectedServers,
        availabilityRate: totalTools > 0 ? (availableTools / totalTools) * 100 : 0,
      },
      toolsByServer: Object.fromEntries(toolsByServer),
      groupId,
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

toolsAdminApi.get('/health', async (c) => {
  try {
    const groupId = c.req.query('groupId') || 'default';
    const service = getHubService();

    const diagnostics = await service.getServiceDiagnostics();
    const allTools = await service.listTools(groupId);

    const toolHealthChecks = allTools.map((tool) => {
      const serverDetail = diagnostics.servers.details.find((s) => s.id === tool.serverId);
      const serverStatus = serverDetail?.status || 'unknown';
      const isHealthy = serverStatus === 'connected';

      const recentExecutions = executionHistory
        .filter((record) => record.toolName === tool.name && record.serverId === tool.serverId)
        .slice(0, 10);

      const recentErrors = recentExecutions.filter((record) => record.isError);
      const errorRate =
        recentExecutions.length > 0 ? (recentErrors.length / recentExecutions.length) * 100 : 0;

      const lastError = recentErrors.length > 0 ? recentErrors[0] : null;

      return {
        toolName: tool.name,
        serverId: tool.serverId,
        serverStatus,
        isHealthy,
        isAvailable: isHealthy,
        recentExecutions: recentExecutions.length,
        recentErrors: recentErrors.length,
        errorRate: Math.round(errorRate),
        lastError: lastError
          ? {
              timestamp: lastError.timestamp,
              executionId: lastError.id,
              error: lastError.result,
            }
          : null,
        issues: [
          ...(serverStatus !== 'connected' ? [`服务器 ${tool.serverId} 未连接`] : []),
          ...(errorRate > 50 ? [`错误率过高: ${errorRate}%`] : []),
        ],
      };
    });

    const healthyTools = toolHealthChecks.filter((check) => check.isHealthy).length;
    const totalTools = toolHealthChecks.length;
    const overallHealthy = totalTools > 0 && healthyTools / totalTools >= 0.8;

    logger.info('获取工具健康检查信息', {
      groupId,
      totalTools,
      healthyTools,
      overallHealthy,
    });

    return successResponse(c, {
      overall: {
        isHealthy: overallHealthy,
        totalTools,
        healthyTools,
        unhealthyTools: totalTools - healthyTools,
        healthRate: totalTools > 0 ? (healthyTools / totalTools) * 100 : 0,
      },
      tools: toolHealthChecks,
      groupId,
      serverDiagnostics: diagnostics.servers,
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

toolsAdminApi.get('/performance', async (c) => {
  try {
    const groupId = c.req.query('groupId');
    const serverId = c.req.query('serverId');
    const timeRange = c.req.query('timeRange') || '1h';

    const now = new Date();
    let startTime: Date;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    let filteredHistory = executionHistory.filter((record) => {
      const recordTime = new Date(record.timestamp);
      return recordTime >= startTime && recordTime <= now;
    });

    if (groupId) {
      filteredHistory = filteredHistory.filter((record) => record.groupId === groupId);
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter((record) => record.serverId === serverId);
    }

    const totalExecutions = filteredHistory.length;
    const successfulExecutions = filteredHistory.filter((r) => !r.isError).length;
    const failedExecutions = filteredHistory.filter((r) => r.isError).length;

    const executionTimes = filteredHistory.map((r) => r.executionTime);
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
        : 0;

    const minExecutionTime = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
    const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    const p50 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.5)] : 0;
    const p95 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.95)] : 0;
    const p99 = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length * 0.99)] : 0;

    const toolPerformance = new Map<
      string,
      {
        executions: number;
        successes: number;
        failures: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
      }
    >();

    filteredHistory.forEach((record) => {
      const toolName = record.toolName;
      if (!toolPerformance.has(toolName)) {
        toolPerformance.set(toolName, {
          executions: 0,
          successes: 0,
          failures: 0,
          averageTime: 0,
          minTime: Number.MAX_VALUE,
          maxTime: 0,
        });
      }

      const perf = toolPerformance.get(toolName);
      if (!perf) return;
      perf.executions++;
      if (record.isError) {
        perf.failures++;
      } else {
        perf.successes++;
      }

      perf.minTime = Math.min(perf.minTime, record.executionTime);
      perf.maxTime = Math.max(perf.maxTime, record.executionTime);
    });

    toolPerformance.forEach((perf, toolName) => {
      const toolExecutions = filteredHistory.filter((r) => r.toolName === toolName);
      perf.averageTime =
        toolExecutions.reduce((sum, r) => sum + r.executionTime, 0) / toolExecutions.length;
      if (perf.minTime === Number.MAX_VALUE) perf.minTime = 0;
    });

    const timeSeriesData = new Map<
      string,
      { executions: number; errors: number; averageTime: number }
    >();

    filteredHistory.forEach((record) => {
      const hour = `${new Date(record.timestamp).toISOString().slice(0, 13)}:00:00.000Z`;
      if (!timeSeriesData.has(hour)) {
        timeSeriesData.set(hour, { executions: 0, errors: 0, averageTime: 0 });
      }

      const data = timeSeriesData.get(hour);
      if (!data) return;
      data.executions++;
      if (record.isError) data.errors++;
    });

    timeSeriesData.forEach((data, hour) => {
      const hourExecutions = filteredHistory.filter(
        (r) => `${new Date(r.timestamp).toISOString().slice(0, 13)}:00:00.000Z` === hour,
      );
      data.averageTime =
        hourExecutions.length > 0
          ? hourExecutions.reduce((sum, r) => sum + r.executionTime, 0) / hourExecutions.length
          : 0;
    });

    logger.info('获取工具性能分析信息', {
      timeRange,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      toolCount: toolPerformance.size,
      filters: { groupId, serverId },
    });

    return successResponse(c, {
      timeRange,
      period: {
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      },
      overview: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
        averageExecutionTime: Math.round(averageExecutionTime),
        minExecutionTime,
        maxExecutionTime,
      },
      percentiles: {
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99),
      },
      toolPerformance: Object.fromEntries(
        Array.from(toolPerformance.entries()).map(([toolName, perf]) => [
          toolName,
          {
            ...perf,
            averageTime: Math.round(perf.averageTime),
            successRate: perf.executions > 0 ? (perf.successes / perf.executions) * 100 : 0,
          },
        ]),
      ),
      timeSeries: Array.from(timeSeriesData.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([timestamp, data]) => ({
          timestamp,
          executions: data.executions,
          errors: data.errors,
          averageTime: Math.round(data.averageTime),
          errorRate: data.executions > 0 ? (data.errors / data.executions) * 100 : 0,
        })),
      filters: { groupId, serverId },
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

toolsAdminApi.get('/errors', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const toolName = c.req.query('toolName');
    const serverId = c.req.query('serverId');
    const groupId = c.req.query('groupId');
    const severity = c.req.query('severity');

    let errorRecords = executionHistory.filter((record) => record.isError);

    if (toolName) {
      errorRecords = errorRecords.filter((record) => record.toolName === toolName);
    }
    if (serverId) {
      errorRecords = errorRecords.filter((record) => record.serverId === serverId);
    }
    if (groupId) {
      errorRecords = errorRecords.filter((record) => record.groupId === groupId);
    }

    const errorAnalysis = new Map<
      string,
      {
        count: number;
        tools: Set<string>;
        servers: Set<string>;
        lastOccurrence: string;
        examples: Array<{
          executionId: string;
          timestamp: string;
          toolName: string;
        }>;
      }
    >();

    errorRecords.forEach((record) => {
      let errorMessage = '未知错误';
      if (record.result && Array.isArray(record.result)) {
        const textContent = (record.result as Array<{ type: string; text?: string }>).find(
          (content) => content.type === 'text',
        );
        if (textContent?.text) {
          errorMessage = textContent.text;
        }
      }

      const errorKey =
        errorMessage.length > 100 ? `${errorMessage.substring(0, 100)}...` : errorMessage;

      if (!errorAnalysis.has(errorKey)) {
        errorAnalysis.set(errorKey, {
          count: 0,
          tools: new Set(),
          servers: new Set(),
          lastOccurrence: record.timestamp,
          examples: [],
        });
      }

      const analysis = errorAnalysis.get(errorKey);
      if (!analysis) return;
      analysis.count++;
      analysis.tools.add(record.toolName);
      analysis.servers.add(record.serverId);

      if (record.timestamp > analysis.lastOccurrence) {
        analysis.lastOccurrence = record.timestamp;
      }

      if (analysis.examples.length < 3) {
        analysis.examples.push({
          executionId: record.id,
          timestamp: record.timestamp,
          toolName: record.toolName,
        });
      }
    });

    const total = errorRecords.length;
    const paginatedErrors = errorRecords.slice(offset, offset + limit);

    const errorSummary = Array.from(errorAnalysis.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([errorMessage, analysis]) => ({
        errorMessage,
        count: analysis.count,
        affectedTools: Array.from(analysis.tools),
        affectedServers: Array.from(analysis.servers),
        lastOccurrence: analysis.lastOccurrence,
        examples: analysis.examples,
      }));

    logger.info('获取工具错误日志', {
      total,
      returned: paginatedErrors.length,
      uniqueErrors: errorSummary.length,
      filters: { toolName, serverId, groupId, severity },
    });

    return successResponse(c, {
      errors: paginatedErrors.map((record) => ({
        executionId: record.id,
        toolName: record.toolName,
        serverId: record.serverId,
        groupId: record.groupId,
        timestamp: record.timestamp,
        executionTime: record.executionTime,
        arguments: record.arguments,
        result: record.result,
      })),
      errorSummary,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filters: { toolName, serverId, groupId, severity },
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});

toolsAdminApi.get('/stats', async (c) => {
  try {
    const groupId = c.req.query('groupId');
    const serverId = c.req.query('serverId');

    let filteredHistory = [...executionHistory];

    if (groupId) {
      filteredHistory = filteredHistory.filter((record) => record.groupId === groupId);
    }
    if (serverId) {
      filteredHistory = filteredHistory.filter((record) => record.serverId === serverId);
    }

    const totalExecutions = filteredHistory.length;
    const successfulExecutions = filteredHistory.filter((r) => !r.isError).length;
    const failedExecutions = filteredHistory.filter((r) => r.isError).length;
    const averageExecutionTime =
      filteredHistory.length > 0
        ? filteredHistory.reduce((sum, r) => sum + r.executionTime, 0) / filteredHistory.length
        : 0;

    const toolStats = new Map<
      string,
      {
        executions: number;
        successes: number;
        failures: number;
        totalTime: number;
        averageTime: number;
      }
    >();

    filteredHistory.forEach((record) => {
      const toolName = record.toolName;
      if (!toolStats.has(toolName)) {
        toolStats.set(toolName, {
          executions: 0,
          successes: 0,
          failures: 0,
          totalTime: 0,
          averageTime: 0,
        });
      }

      const stats = toolStats.get(toolName);
      if (!stats) return;
      stats.executions++;
      if (record.isError) {
        stats.failures++;
      } else {
        stats.successes++;
      }
      stats.totalTime += record.executionTime;
      stats.averageTime = stats.totalTime / stats.executions;
    });

    const topTools = Array.from(toolStats.entries())
      .sort((a, b) => b[1].executions - a[1].executions)
      .slice(0, 10)
      .map(([toolName, stats]) => ({
        toolName,
        ...stats,
      }));

    logger.info('获取工具执行统计信息', {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      topToolsCount: topTools.length,
      filters: { groupId, serverId },
    });

    return successResponse(c, {
      overview: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
        averageExecutionTime: Math.round(averageExecutionTime),
      },
      topTools,
      filters: { groupId, serverId },
    });
  } catch (error) {
    return errorResponse(c, error as Error, 500);
  }
});
