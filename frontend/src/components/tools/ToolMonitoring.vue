<template>
  <div class="tool-monitoring">
    <!-- 监控概览 -->
    <div class="monitoring-overview">
      <t-row :gutter="16">
        <t-col :span="6">
          <t-card size="small" class="overview-card">
            <div class="overview-item">
              <div class="overview-icon">
                <tool-icon size="24px" />
              </div>
              <div class="overview-content">
                <div class="overview-value">{{ monitoringData?.overview.totalTools || 0 }}</div>
                <div class="overview-label">总工具数</div>
              </div>
            </div>
          </t-card>
        </t-col>

        <t-col :span="6">
          <t-card size="small" class="overview-card">
            <div class="overview-item">
              <div class="overview-icon success">
                <check-circle-icon size="24px" />
              </div>
              <div class="overview-content">
                <div class="overview-value text-success">
                  {{ monitoringData?.overview.availableTools || 0 }}
                </div>
                <div class="overview-label">可用工具</div>
              </div>
            </div>
          </t-card>
        </t-col>

        <t-col :span="6">
          <t-card size="small" class="overview-card">
            <div class="overview-item">
              <div class="overview-icon error">
                <close-circle-icon size="24px" />
              </div>
              <div class="overview-content">
                <div class="overview-value text-error">
                  {{ monitoringData?.overview.unavailableTools || 0 }}
                </div>
                <div class="overview-label">不可用工具</div>
              </div>
            </div>
          </t-card>
        </t-col>

        <t-col :span="6">
          <t-card size="small" class="overview-card">
            <div class="overview-item">
              <div class="overview-icon">
                <server-icon size="24px" />
              </div>
              <div class="overview-content">
                <div class="overview-value">
                  {{ monitoringData?.overview.connectedServers || 0 }}/{{ monitoringData?.overview.totalServers || 0 }}
                </div>
                <div class="overview-label">连接服务器</div>
              </div>
            </div>
          </t-card>
        </t-col>
      </t-row>
    </div>

    <!-- 可用性趋势图 -->
    <t-card title="可用性趋势" class="availability-chart-card">
      <template #actions>
        <t-space>
          <t-select
            v-model="timeRange"
            size="small"
            @change="handleTimeRangeChange"
          >
            <t-option value="1h" label="1小时" />
            <t-option value="6h" label="6小时" />
            <t-option value="24h" label="24小时" />
            <t-option value="7d" label="7天" />
          </t-select>
          
          <t-button
            variant="text"
            size="small"
            @click="refreshAvailabilityData"
          >
            刷新
          </t-button>
        </t-space>
      </template>

      <div class="availability-chart">
        <div v-if="availabilityChartData.length > 0" class="chart-container">
          <!-- 这里可以集成图表库如 ECharts 或 Chart.js -->
          <div class="chart-placeholder">
            <div class="chart-info">
              <div class="chart-title">工具可用性趋势</div>
              <div class="chart-subtitle">时间范围: {{ timeRange }}</div>
            </div>
            
            <!-- 简单的可用性指标显示 -->
            <div class="availability-metrics">
              <t-row :gutter="16">
                <t-col :span="8">
                  <div class="metric-card">
                    <div class="metric-title">平均可用率</div>
                    <div class="metric-value">{{ averageAvailability }}%</div>
                  </div>
                </t-col>
                <t-col :span="8">
                  <div class="metric-card">
                    <div class="metric-title">最高可用率</div>
                    <div class="metric-value">{{ maxAvailability }}%</div>
                  </div>
                </t-col>
                <t-col :span="8">
                  <div class="metric-card">
                    <div class="metric-title">最低可用率</div>
                    <div class="metric-value">{{ minAvailability }}%</div>
                  </div>
                </t-col>
              </t-row>
            </div>
          </div>
        </div>
        
        <div v-else class="no-chart-data">
          <t-empty description="暂无可用性数据" />
        </div>
      </div>
    </t-card>

    <!-- 服务器状态监控 -->
    <t-card title="服务器状态监控" class="server-monitoring-card">
      <template #actions>
        <t-space>
          <t-button
            variant="text"
            size="small"
            @click="refreshServerStatus"
          >
            刷新状态
          </t-button>
          
          <t-button
            variant="text"
            size="small"
            @click="showServerDetails = !showServerDetails"
          >
            {{ showServerDetails ? '隐藏详情' : '显示详情' }}
          </t-button>
        </t-space>
      </template>

      <div class="server-monitoring">
        <t-row :gutter="16">
          <t-col
            v-for="(serverData, serverId) in monitoringData?.toolsByServer"
            :key="serverId"
            :span="12"
          >
            <t-card
              :title="serverId"
              size="small"
              class="server-card"
              :class="`server-${serverData.serverStatus}`"
            >
              <template #subtitle>
                <status-tag :status="serverData.serverStatus" />
              </template>

              <template #actions>
                <t-dropdown :options="getServerActions(serverId)" @click="handleServerAction">
                  <t-button variant="text" size="small">
                    操作
                    <chevron-down-icon />
                  </t-button>
                </t-dropdown>
              </template>

              <div class="server-info">
                <div class="server-stats">
                  <t-descriptions :column="2" size="small">
                    <t-descriptions-item label="工具总数">
                      {{ serverData.tools.length }}
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="可用工具">
                      {{ serverData.tools.filter(t => t.status === 'available').length }}
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="连接状态">
                      <status-tag :status="serverData.serverStatus" />
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="响应时间">
                      {{ getServerResponseTime(serverId) }}ms
                    </t-descriptions-item>
                  </t-descriptions>
                </div>

                <!-- 工具详情 -->
                <t-collapse-transition>
                  <div v-show="showServerDetails" class="server-tools">
                    <h5>工具列表</h5>
                    <div class="tools-grid">
                      <div
                        v-for="tool in serverData.tools"
                        :key="tool.name"
                        class="tool-item"
                        :class="`tool-${tool.status}`"
                      >
                        <div class="tool-name">{{ tool.name }}</div>
                        <status-tag :status="tool.status" size="small" />
                      </div>
                    </div>
                  </div>
                </t-collapse-transition>
              </div>
            </t-card>
          </t-col>
        </t-row>
      </div>
    </t-card>

    <!-- 性能指标 -->
    <t-card title="性能指标" class="performance-metrics-card">
      <template #actions>
        <t-space>
          <t-select
            v-model="performanceTimeRange"
            size="small"
            @change="handlePerformanceTimeRangeChange"
          >
            <t-option value="1h" label="1小时" />
            <t-option value="6h" label="6小时" />
            <t-option value="24h" label="24小时" />
            <t-option value="7d" label="7天" />
          </t-select>
          
          <t-button
            variant="text"
            size="small"
            @click="refreshPerformanceData"
          >
            刷新
          </t-button>
        </t-space>
      </template>

      <div class="performance-metrics">
        <t-loading :loading="performanceLoading">
          <div v-if="performanceData" class="metrics-content">
            <!-- 性能概览 -->
            <div class="performance-overview">
              <t-row :gutter="16">
                <t-col :span="6">
                  <div class="performance-card">
                    <div class="performance-title">总执行次数</div>
                    <div class="performance-value">
                      {{ performanceData.overview.totalExecutions }}
                    </div>
                  </div>
                </t-col>
                
                <t-col :span="6">
                  <div class="performance-card">
                    <div class="performance-title">成功率</div>
                    <div class="performance-value text-success">
                      {{ performanceData.overview.successRate.toFixed(1) }}%
                    </div>
                  </div>
                </t-col>
                
                <t-col :span="6">
                  <div class="performance-card">
                    <div class="performance-title">平均响应时间</div>
                    <div class="performance-value">
                      {{ performanceData.overview.averageExecutionTime }}ms
                    </div>
                  </div>
                </t-col>
                
                <t-col :span="6">
                  <div class="performance-card">
                    <div class="performance-title">错误率</div>
                    <div class="performance-value text-error">
                      {{ (100 - performanceData.overview.successRate).toFixed(1) }}%
                    </div>
                  </div>
                </t-col>
              </t-row>
            </div>

            <!-- 响应时间分布 -->
            <div class="response-time-distribution">
              <h5>响应时间分布</h5>
              <t-row :gutter="16">
                <t-col :span="8">
                  <div class="percentile-card">
                    <div class="percentile-label">P50</div>
                    <div class="percentile-value">{{ performanceData.percentiles.p50 }}ms</div>
                  </div>
                </t-col>
                <t-col :span="8">
                  <div class="percentile-card">
                    <div class="percentile-label">P95</div>
                    <div class="percentile-value">{{ performanceData.percentiles.p95 }}ms</div>
                  </div>
                </t-col>
                <t-col :span="8">
                  <div class="percentile-card">
                    <div class="percentile-label">P99</div>
                    <div class="percentile-value">{{ performanceData.percentiles.p99 }}ms</div>
                  </div>
                </t-col>
              </t-row>
            </div>

            <!-- 时间序列数据 -->
            <div class="time-series-chart">
              <h5>性能趋势</h5>
              <div class="chart-placeholder">
                <div class="time-series-data">
                  <t-table
                    :data="performanceData.timeSeries.slice(0, 10)"
                    :columns="timeSeriesColumns"
                    size="small"
                    stripe
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-performance-data">
            <t-empty description="暂无性能数据" />
          </div>
        </t-loading>
      </div>
    </t-card>

    <!-- 错误监控 -->
    <t-card title="错误监控" class="error-monitoring-card">
      <template #actions>
        <t-space>
          <t-button
            variant="text"
            size="small"
            @click="refreshErrorData"
          >
            刷新
          </t-button>
          
          <t-button
            variant="text"
            size="small"
            @click="showErrorDetails = !showErrorDetails"
          >
            {{ showErrorDetails ? '隐藏详情' : '显示详情' }}
          </t-button>
        </t-space>
      </template>

      <div class="error-monitoring">
        <t-loading :loading="errorLoading">
          <div v-if="errorData && errorData.errorSummary.length > 0" class="error-content">
            <!-- 错误概览 -->
            <div class="error-overview">
              <t-alert
                theme="warning"
                title="错误统计"
                :close="false"
              >
                <div class="error-stats">
                  <span>总错误数: {{ errorData.errors.length }}</span>
                  <span>错误类型: {{ errorData.errorSummary.length }}</span>
                  <span>影响工具: {{ getAffectedToolsCount() }}</span>
                </div>
              </t-alert>
            </div>

            <!-- 错误分类 -->
            <div class="error-summary">
              <h5>错误分类</h5>
              <div class="error-categories">
                <div
                  v-for="(summary, index) in errorData.errorSummary"
                  :key="index"
                  class="error-category"
                >
                  <div class="category-header">
                    <div class="category-title">{{ summary.errorMessage }}</div>
                    <t-tag theme="danger" variant="light">
                      {{ summary.count }} 次
                    </t-tag>
                  </div>
                  
                  <div class="category-info">
                    <div class="affected-info">
                      <span>影响工具: {{ summary.affectedTools.join(', ') }}</span>
                      <span>影响服务器: {{ summary.affectedServers.join(', ') }}</span>
                      <span>最近发生: {{ formatTime(summary.lastOccurrence) }}</span>
                    </div>
                  </div>

                  <!-- 错误详情 -->
                  <t-collapse-transition>
                    <div v-show="showErrorDetails" class="error-examples">
                      <h6>错误示例</h6>
                      <div
                        v-for="(example, exampleIndex) in summary.examples.slice(0, 3)"
                        :key="exampleIndex"
                        class="error-example"
                      >
                        <div class="example-header">
                          <span class="example-tool">{{ example.toolName }}</span>
                          <span class="example-time">{{ formatTime(example.timestamp) }}</span>
                        </div>
                        <div class="example-details">
                          <t-collapse>
                            <t-collapse-panel header="查看详情" value="details">
                              <pre>{{ JSON.stringify(example.result, null, 2) }}</pre>
                            </t-collapse-panel>
                          </t-collapse>
                        </div>
                      </div>
                    </div>
                  </t-collapse-transition>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-error-data">
            <t-result
              theme="success"
              title="无错误记录"
              description="系统运行正常，暂无错误记录"
            />
          </div>
        </t-loading>
      </div>
    </t-card>

    <!-- 实时日志 -->
    <t-card title="实时日志" class="realtime-logs-card">
      <template #actions>
        <t-space>
          <t-switch
            v-model="autoRefresh"
            @change="handleAutoRefreshChange"
          >
            <template #label>自动刷新</template>
          </t-switch>
          
          <t-button
            variant="text"
            size="small"
            @click="clearLogs"
          >
            清空日志
          </t-button>
        </t-space>
      </template>

      <div class="realtime-logs">
        <div class="logs-container">
          <div
            v-for="(log, index) in realtimeLogs"
            :key="index"
            class="log-entry"
            :class="`log-${log.level}`"
          >
            <div class="log-timestamp">{{ formatTime(log.timestamp) }}</div>
            <div class="log-level">
              <t-tag
                :theme="getLogTheme(log.level)"
                size="small"
                variant="light"
              >
                {{ log.level.toUpperCase() }}
              </t-tag>
            </div>
            <div class="log-message">{{ log.message }}</div>
          </div>
        </div>
        
        <div v-if="realtimeLogs.length === 0" class="no-logs">
          <t-empty description="暂无日志记录" />
        </div>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  ToolIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  ServerIcon,
  ChevronDownIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import type { ToolMonitoring, ToolPerformance, ToolErrorResponse } from '@/types/tool';

// Store
const toolStore = useToolStore();

// 响应式数据
const monitoringData = ref<ToolMonitoring | null>(null);
const performanceData = ref<ToolPerformance | null>(null);
const errorData = ref<ToolErrorResponse | null>(null);
const availabilityChartData = ref<any[]>([]);
const realtimeLogs = ref<Array<{
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}>>([]);

const loading = ref(false);
const performanceLoading = ref(false);
const errorLoading = ref(false);
const timeRange = ref('1h');
const performanceTimeRange = ref('1h');
const showServerDetails = ref(false);
const showErrorDetails = ref(false);
const autoRefresh = ref(true);

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性
const averageAvailability = computed(() => {
  if (!availabilityChartData.value.length) return 0;
  const sum = availabilityChartData.value.reduce((acc, item) => acc + item.availability, 0);
  return (sum / availabilityChartData.value.length).toFixed(1);
});

const maxAvailability = computed(() => {
  if (!availabilityChartData.value.length) return 0;
  return Math.max(...availabilityChartData.value.map(item => item.availability)).toFixed(1);
});

const minAvailability = computed(() => {
  if (!availabilityChartData.value.length) return 0;
  return Math.min(...availabilityChartData.value.map(item => item.availability)).toFixed(1);
});

// 表格列配置
const timeSeriesColumns = [
  {
    colKey: 'timestamp',
    title: '时间',
    width: 160,
    cell: (h: any, { row }: any) => formatTime(row.timestamp),
  },
  {
    colKey: 'executions',
    title: '执行次数',
    width: 100,
  },
  {
    colKey: 'errors',
    title: '错误次数',
    width: 100,
  },
  {
    colKey: 'averageTime',
    title: '平均时间(ms)',
    width: 120,
  },
  {
    colKey: 'errorRate',
    title: '错误率(%)',
    width: 100,
    cell: (h: any, { row }: any) => `${row.errorRate.toFixed(1)}%`,
  },
];

// 方法
const loadMonitoringData = async () => {
  try {
    loading.value = true;
    const data = await toolStore.fetchMonitoring();
    monitoringData.value = data;
  } catch (err) {
    MessagePlugin.error('加载监控数据失败');
  } finally {
    loading.value = false;
  }
};

const loadPerformanceData = async () => {
  try {
    performanceLoading.value = true;
    const data = await toolStore.fetchPerformance(performanceTimeRange.value);
    performanceData.value = data;
  } catch (err) {
    MessagePlugin.error('加载性能数据失败');
  } finally {
    performanceLoading.value = false;
  }
};

const loadErrorData = async () => {
  try {
    errorLoading.value = true;
    const data = await toolStore.getToolErrors({
      limit: 100,
    });
    errorData.value = data;
  } catch (err) {
    MessagePlugin.error('加载错误数据失败');
  } finally {
    errorLoading.value = false;
  }
};

const loadAvailabilityData = () => {
  // 模拟可用性数据
  const now = Date.now();
  const interval = timeRange.value === '1h' ? 5 * 60 * 1000 : 
                   timeRange.value === '6h' ? 30 * 60 * 1000 :
                   timeRange.value === '24h' ? 2 * 60 * 60 * 1000 :
                   24 * 60 * 60 * 1000;
  
  const points = timeRange.value === '1h' ? 12 : 
                 timeRange.value === '6h' ? 12 :
                 timeRange.value === '24h' ? 12 : 7;

  availabilityChartData.value = Array.from({ length: points }, (_, i) => ({
    timestamp: new Date(now - (points - 1 - i) * interval).toISOString(),
    availability: 85 + Math.random() * 15, // 85-100% 可用性
  }));
};

const getServerActions = (serverId: string) => [
  { content: '查看详情', value: `detail-${serverId}` },
  { content: '重启连接', value: `restart-${serverId}` },
  { content: '查看日志', value: `logs-${serverId}` },
];

const handleServerAction = (option: any) => {
  const [action, serverId] = option.value.split('-');
  
  switch (action) {
    case 'detail':
      // 跳转到服务器详情页
      MessagePlugin.info(`查看服务器 ${serverId} 详情`);
      break;
    case 'restart':
      // 重启服务器连接
      MessagePlugin.info(`重启服务器 ${serverId} 连接`);
      break;
    case 'logs':
      // 查看服务器日志
      MessagePlugin.info(`查看服务器 ${serverId} 日志`);
      break;
  }
};

const getServerResponseTime = (serverId: string): number => {
  // 模拟服务器响应时间
  return Math.floor(Math.random() * 200) + 50;
};

const getAffectedToolsCount = (): number => {
  if (!errorData.value) return 0;
  
  const tools = new Set<string>();
  errorData.value.errorSummary.forEach(summary => {
    summary.affectedTools.forEach(tool => tools.add(tool));
  });
  
  return tools.size;
};

const getLogTheme = (level: string) => {
  switch (level) {
    case 'error':
      return 'danger';
    case 'warn':
      return 'warning';
    case 'info':
      return 'primary';
    case 'debug':
      return 'default';
    default:
      return 'default';
  }
};

const handleTimeRangeChange = () => {
  loadAvailabilityData();
};

const handlePerformanceTimeRangeChange = () => {
  loadPerformanceData();
};

const refreshAvailabilityData = () => {
  loadAvailabilityData();
  MessagePlugin.success('可用性数据已刷新');
};

const refreshServerStatus = () => {
  loadMonitoringData();
  MessagePlugin.success('服务器状态已刷新');
};

const refreshPerformanceData = () => {
  loadPerformanceData();
};

const refreshErrorData = () => {
  loadErrorData();
};

const handleAutoRefreshChange = (enabled: boolean) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) return;
  
  refreshTimer = setInterval(() => {
    loadMonitoringData();
    loadPerformanceData();
    loadErrorData();
    addRealtimeLog();
  }, 30000); // 30秒刷新一次
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

const addRealtimeLog = () => {
  const levels = ['info', 'warn', 'error', 'debug'] as const;
  const messages = [
    '工具执行成功',
    '服务器连接正常',
    '检测到性能异常',
    '工具执行失败',
    '服务器重新连接',
    '缓存已清理',
  ];

  const log = {
    timestamp: new Date().toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
  };

  realtimeLogs.value.unshift(log);
  
  // 限制日志数量
  if (realtimeLogs.value.length > 100) {
    realtimeLogs.value = realtimeLogs.value.slice(0, 100);
  }
};

const clearLogs = () => {
  realtimeLogs.value = [];
  MessagePlugin.success('日志已清空');
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 组件挂载时加载数据
onMounted(async () => {
  await Promise.all([
    loadMonitoringData(),
    loadPerformanceData(),
    loadErrorData(),
  ]);
  
  loadAvailabilityData();
  
  if (autoRefresh.value) {
    startAutoRefresh();
  }
  
  // 添加一些初始日志
  for (let i = 0; i < 5; i++) {
    addRealtimeLog();
  }
});

// 组件卸载时清理定时器
onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.tool-monitoring {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitoring-overview {
  margin-bottom: 16px;
}

.overview-card {
  height: 100px;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.overview-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--td-bg-color-container-hover);
}

.overview-icon.success {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.overview-icon.error {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
}

.overview-content {
  flex: 1;
}

.overview-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
}

.overview-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.text-success {
  color: var(--td-success-color);
}

.text-error {
  color: var(--td-error-color);
}

.availability-chart-card,
.server-monitoring-card,
.performance-metrics-card,
.error-monitoring-card,
.realtime-logs-card {
  margin-bottom: 16px;
}

.chart-container,
.chart-placeholder {
  padding: 16px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.chart-info {
  text-align: center;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.chart-subtitle {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.availability-metrics {
  width: 100%;
}

.metric-card {
  text-align: center;
  padding: 16px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-default);
}

.metric-title {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 8px;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
}

.no-chart-data {
  padding: 32px;
  text-align: center;
}

.server-monitoring {
  margin-top: 16px;
}

.server-card {
  margin-bottom: 16px;
  border-left-width: 4px;
  border-left-style: solid;
}

.server-card.server-connected {
  border-left-color: var(--td-success-color);
}

.server-card.server-disconnected {
  border-left-color: var(--td-error-color);
}

.server-card.server-connecting {
  border-left-color: var(--td-warning-color);
}

.server-info {
  padding: 8px 0;
}

.server-stats {
  margin-bottom: 16px;
}

.server-tools h5 {
  margin-bottom: 12px;
  font-size: 14px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.tool-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-small);
  background: var(--td-bg-color-container-hover);
}

.tool-item.tool-available {
  border-left: 3px solid var(--td-success-color);
}

.tool-item.tool-unavailable {
  border-left: 3px solid var(--td-error-color);
}

.tool-name {
  font-size: 12px;
  font-weight: 500;
}

.performance-metrics {
  margin-top: 16px;
}

.metrics-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.performance-overview {
  margin-bottom: 24px;
}

.performance-card {
  text-align: center;
  padding: 16px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-default);
}

.performance-title {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 8px;
}

.performance-value {
  font-size: 20px;
  font-weight: 600;
}

.response-time-distribution h5,
.time-series-chart h5 {
  margin-bottom: 16px;
  font-size: 14px;
}

.percentile-card {
  text-align: center;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-default);
}

.percentile-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.percentile-value {
  font-size: 16px;
  font-weight: 600;
}

.time-series-data {
  width: 100%;
}

.no-performance-data {
  padding: 32px;
  text-align: center;
}

.error-monitoring {
  margin-top: 16px;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-overview {
  margin-bottom: 16px;
}

.error-stats {
  display: flex;
  gap: 24px;
  font-size: 14px;
}

.error-summary h5 {
  margin-bottom: 16px;
  font-size: 14px;
}

.error-categories {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-category {
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container-hover);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.category-title {
  font-size: 14px;
  font-weight: 500;
}

.category-info {
  margin-bottom: 12px;
}

.affected-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.error-examples h6 {
  margin-bottom: 12px;
  font-size: 12px;
}

.error-example {
  margin-bottom: 8px;
  padding: 8px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-small);
}

.example-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.example-tool {
  font-size: 12px;
  font-weight: 500;
}

.example-time {
  font-size: 11px;
  color: var(--td-text-color-secondary);
}

.example-details pre {
  margin: 0;
  font-size: 11px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.no-error-data {
  padding: 32px;
  text-align: center;
}

.realtime-logs {
  margin-top: 16px;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container);
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.log-error {
  background: var(--td-error-color-1);
}

.log-entry.log-warn {
  background: var(--td-warning-color-1);
}

.log-timestamp {
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.log-level {
  white-space: nowrap;
}

.log-message {
  flex: 1;
}

.no-logs {
  padding: 32px;
  text-align: center;
}

:deep(.t-descriptions-item__label) {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

:deep(.t-descriptions-item__content) {
  font-size: 12px;
}
</style>