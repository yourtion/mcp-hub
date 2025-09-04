import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ToolService } from '@/services/tool';
import type {
  ToolExecuteRequest,
  ToolExecuteResponse,
  ToolExecution,
  ToolFilterParams,
  ToolHistoryFilterParams,
  ToolInfo,
  ToolListResponse,
  ToolMonitoring,
  ToolPerformance,
  ToolStats,
  ToolTestRequest,
  ToolTestResponse,
} from '@/types/tool';

export const useToolStore = defineStore('tool', () => {
  // 状态
  const tools = ref<Map<string, ToolInfo>>(new Map());
  const toolsByServer = ref<Map<string, ToolInfo[]>>(new Map());
  const executionHistory = ref<ToolExecution[]>([]);
  const currentExecution = ref<ToolExecuteResponse | null>(null);
  const testResults = ref<Map<string, ToolTestResponse>>(new Map());
  const stats = ref<ToolStats | null>(null);
  const monitoring = ref<ToolMonitoring | null>(null);
  const performance = ref<ToolPerformance | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 过滤和搜索状态
  const filters = ref<ToolFilterParams>({
    groupId: 'default',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // 计算属性
  const toolList = computed(() => Array.from(tools.value.values()));

  const filteredTools = computed(() => {
    let result = toolList.value;

    // 按服务器过滤
    if (filters.value.serverId) {
      result = result.filter(
        (tool) => tool.serverId === filters.value.serverId,
      );
    }

    // 按状态过滤
    if (filters.value.status && filters.value.status !== 'all') {
      result = result.filter((tool) => tool.status === filters.value.status);
    }

    // 搜索过滤
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      result = result.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchTerm) ||
          tool.description.toLowerCase().includes(searchTerm) ||
          tool.serverId.toLowerCase().includes(searchTerm),
      );
    }

    // 排序
    if (filters.value.sortBy) {
      result.sort((a, b) => {
        let aValue: string;
        let bValue: string;

        switch (filters.value.sortBy) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'server':
            aValue = a.serverId;
            bValue = b.serverId;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            aValue = a.name;
            bValue = b.name;
        }

        const comparison = aValue.localeCompare(bValue);
        return filters.value.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return result;
  });

  const availableTools = computed(() =>
    toolList.value.filter((tool) => tool.status === 'available'),
  );

  const unavailableTools = computed(() =>
    toolList.value.filter((tool) => tool.status === 'unavailable'),
  );

  const serverList = computed(() => {
    const servers = new Set<string>();
    toolList.value.forEach((tool) => servers.add(tool.serverId));
    return Array.from(servers);
  });

  // 操作方法
  const setLoading = (value: boolean) => {
    loading.value = value;
  };

  const setError = (message: string | null) => {
    error.value = message;
  };

  const clearError = () => {
    error.value = null;
  };

  /**
   * 获取工具列表
   */
  const fetchTools = async (params?: ToolFilterParams) => {
    try {
      setLoading(true);
      clearError();

      const response = await ToolService.getTools(params);

      // 更新工具列表
      tools.value.clear();
      response.tools.forEach((tool) => {
        tools.value.set(tool.name, tool);
      });

      // 更新按服务器分组的工具
      toolsByServer.value.clear();
      Object.entries(response.toolsByServer).forEach(
        ([serverId, serverTools]) => {
          toolsByServer.value.set(serverId, serverTools);
        },
      );

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取工具列表失败';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取指定服务器的工具
   */
  const fetchToolsByServer = async (serverId: string, groupId?: string) => {
    try {
      setLoading(true);
      clearError();

      const response = await ToolService.getToolsByServer(serverId, groupId);

      // 更新该服务器的工具
      const serverTools = response.tools;
      toolsByServer.value.set(serverId, serverTools);

      // 更新全局工具列表
      serverTools.forEach((tool) => {
        tools.value.set(tool.name, tool);
      });

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取服务器工具失败';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取工具详情
   */
  const fetchToolDetail = async (toolName: string, groupId?: string) => {
    try {
      clearError();
      const tool = await ToolService.getToolDetail(toolName, groupId);

      // 更新工具信息
      tools.value.set(toolName, tool);

      return tool;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取工具详情失败';
      setError(message);
      throw err;
    }
  };

  /**
   * 执行工具
   */
  const executeTool = async (toolName: string, request: ToolExecuteRequest) => {
    try {
      setLoading(true);
      clearError();

      const result = await ToolService.executeTool(toolName, request);

      // 保存当前执行结果
      currentExecution.value = result;

      // 添加到执行历史
      const execution: ToolExecution = {
        executionId: result.executionId,
        toolName: result.toolName,
        serverId: result.serverId,
        groupId: result.groupId,
        arguments: request.arguments,
        result: result.result,
        isError: result.isError,
        executionTime: result.executionTime,
        timestamp: result.timestamp,
      };

      executionHistory.value.unshift(execution);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '工具执行失败';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 测试工具参数
   */
  const testTool = async (toolName: string, request: ToolTestRequest) => {
    try {
      clearError();
      const result = await ToolService.testTool(toolName, request);

      // 保存测试结果
      testResults.value.set(toolName, result);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '工具测试失败';
      setError(message);
      throw err;
    }
  };

  /**
   * 获取执行历史
   */
  const fetchExecutionHistory = async (params?: ToolHistoryFilterParams) => {
    try {
      setLoading(true);
      clearError();

      const response = await ToolService.getToolHistory(params);
      executionHistory.value = response.executions;

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取执行历史失败';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取工具统计信息
   */
  const fetchStats = async (groupId?: string, serverId?: string) => {
    try {
      clearError();
      const result = await ToolService.getToolStats(groupId, serverId);
      stats.value = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取统计信息失败';
      setError(message);
      throw err;
    }
  };

  /**
   * 获取监控信息
   */
  const fetchMonitoring = async (groupId?: string) => {
    try {
      clearError();
      const result = await ToolService.getToolMonitoring(groupId);
      monitoring.value = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取监控信息失败';
      setError(message);
      throw err;
    }
  };

  /**
   * 获取性能分析
   */
  const fetchPerformance = async (
    timeRange?: string,
    groupId?: string,
    serverId?: string,
  ) => {
    try {
      clearError();
      const result = await ToolService.getToolPerformance(
        timeRange,
        groupId,
        serverId,
      );
      performance.value = result;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取性能分析失败';
      setError(message);
      throw err;
    }
  };

  /**
   * 更新过滤条件
   */
  const updateFilters = (newFilters: Partial<ToolFilterParams>) => {
    filters.value = { ...filters.value, ...newFilters };
  };

  /**
   * 重置过滤条件
   */
  const resetFilters = () => {
    filters.value = {
      groupId: 'default',
      status: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
    };
  };

  /**
   * 清除当前执行结果
   */
  const clearCurrentExecution = () => {
    currentExecution.value = null;
  };

  /**
   * 清除测试结果
   */
  const clearTestResults = () => {
    testResults.value.clear();
  };

  /**
   * 刷新工具数据
   */
  const refresh = async () => {
    await fetchTools(filters.value);
  };

  return {
    // 状态
    tools,
    toolsByServer,
    executionHistory,
    currentExecution,
    testResults,
    stats,
    monitoring,
    performance,
    loading,
    error,
    filters,

    // 计算属性
    toolList,
    filteredTools,
    availableTools,
    unavailableTools,
    serverList,

    // 方法
    setLoading,
    setError,
    clearError,
    fetchTools,
    fetchToolsByServer,
    fetchToolDetail,
    executeTool,
    testTool,
    fetchExecutionHistory,
    fetchStats,
    fetchMonitoring,
    fetchPerformance,
    updateFilters,
    resetFilters,
    clearCurrentExecution,
    clearTestResults,
    refresh,
  };
});
