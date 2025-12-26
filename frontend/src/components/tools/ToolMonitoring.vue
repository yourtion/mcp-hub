<template>
  <div class="tool-monitoring">
    <!-- 顶部统计卡片 -->
    <div class="monitoring-stats">
      <div class="stat-item">
        <div class="stat-icon">
          <api-icon size="20px" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitoringData?.overview.totalTools || 0 }}</div>
          <div class="stat-label">总工具数</div>
        </div>
      </div>

      <div class="stat-item stat-success">
        <div class="stat-icon">
          <check-circle-icon size="20px" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitoringData?.overview.availableTools || 0 }}</div>
          <div class="stat-label">可用</div>
        </div>
      </div>

      <div class="stat-item stat-error">
        <div class="stat-icon">
          <close-circle-icon size="20px" />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitoringData?.overview.unavailableTools || 0 }}</div>
          <div class="stat-label">不可用</div>
        </div>
      </div>

      <div class="stat-item">
        <div class="stat-icon">
          <server-icon size="20px" />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ monitoringData?.overview.connectedServers || 0 }}/{{ monitoringData?.overview.totalServers || 0 }}
          </div>
          <div class="stat-label">服务器</div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域：左右两栏布局 -->
    <div class="monitoring-content">
      <!-- 左侧：服务器状态 -->
      <div class="monitoring-main">
        <t-card title="服务器状态" class="server-status-card" bordered>
          <template #actions>
            <t-space size="small">
              <t-button size="small" variant="text" @click="refreshServerStatus">刷新</t-button>
            </t-space>
          </template>

          <t-loading :loading="loading" size="small">
            <div v-if="serversList.length > 0" class="server-list">
              <div
                v-for="server in serversList"
                :key="server.id"
                class="server-item"
                :class="`server-${server.status}`"
              >
                <div class="server-header">
                  <div class="server-info">
                    <div class="server-name">{{ server.name }}</div>
                    <div class="server-meta">
                      <span>{{ server.statusText }}</span>
                      <span class="separator">·</span>
                      <span>{{ server.toolCount }} 个工具</span>
                    </div>
                  </div>
                  <StatusTag :status="server.status" size="small" />
                </div>

                <div v-if="server.tools.length > 0" class="server-tools">
                  <div
                    v-for="tool in server.tools"
                    :key="tool.name"
                    class="server-tool-item"
                    :class="{ 'tool-unavailable': server.status !== 'connected' }"
                  >
                    <div class="tool-dot"></div>
                    <span class="tool-name">{{ tool.name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              <t-empty description="暂无服务器数据" size="small" />
            </div>
          </t-loading>
        </t-card>
      </div>

      <!-- 右侧：性能指标和日志 -->
      <div class="monitoring-sidebar">
        <!-- 性能指标 -->
        <t-card title="性能指标" class="performance-card" bordered>
          <template #actions>
            <t-select v-model="performanceTimeRange" size="small" auto-width>
              <t-option value="1h" label="1小时" />
              <t-option value="6h" label="6小时" />
              <t-option value="24h" label="24小时" />
            </t-select>
          </template>

          <div v-if="performanceData" class="performance-metrics">
            <div class="metric-row">
              <span class="metric-label">执行次数</span>
              <span class="metric-value">{{ performanceData.overview.totalExecutions }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">成功率</span>
              <span class="metric-value text-success">{{ performanceData.overview.successRate.toFixed(1) }}%</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">平均响应</span>
              <span class="metric-value">{{ performanceData.overview.averageExecutionTime }}ms</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">错误率</span>
              <span class="metric-value text-error">{{ (100 - performanceData.overview.successRate).toFixed(1) }}%</span>
            </div>
          </div>

          <div v-else class="empty-state">
            <t-empty description="暂无性能数据" size="small" />
          </div>
        </t-card>

        <!-- 实时日志 -->
        <t-card title="实时日志" class="logs-card" bordered>
          <template #actions>
            <t-space size="small">
              <t-switch v-model="autoRefresh" size="small" />
              <t-button size="small" variant="text" @click="clearLogs">清空</t-button>
            </t-space>
          </template>

          <div class="logs-list">
            <div
              v-for="(log, index) in realtimeLogs.slice(0, 8)"
              :key="index"
              class="log-item"
              :class="`log-${log.level}`"
            >
              <span class="log-time">{{ formatTimeShort(log.timestamp) }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>

          <div v-if="realtimeLogs.length === 0" class="empty-state">
            <t-empty description="暂无日志" size="small" />
          </div>
        </t-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  ApiIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  ServerIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import type { ToolMonitoring, ToolPerformance } from '@/types/tool';

// Store
const toolStore = useToolStore();

// 响应式数据
const monitoringData = ref<ToolMonitoring | null>(null);
const performanceData = ref<ToolPerformance | null>(null);
const realtimeLogs = ref<Array<{
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}>>([]);

const performanceTimeRange = ref('1h');
const showServerDetails = ref(false);
const autoRefresh = ref(true);
const loading = ref(false);

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性：处理服务器列表
const serversList = computed(() => {
  if (!monitoringData.value?.toolsByServer) {
    return [];
  }

  return Object.entries(monitoringData.value.toolsByServer)
    .map(([serverId, serverData]) => {
      const toolCount = serverData.tools?.length || 0;
      const status = serverData.serverStatus || 'disconnected';
      const statusText = status === 'connected' ? '已连接'
                   : status === 'connecting' ? '连接中'
                   : status === 'disconnected' ? '未连接'
                   : '';

      return {
        id: serverId,
        name: serverData.serverId || serverId,
        status: status,
        statusText: statusText,
        toolCount: toolCount,
        tools: serverData.tools || [],
      };
    })
    .filter(server => server.toolCount > 0 || server.status === 'connected');
});

// 初始化
onMounted(async () => {
  await refreshMonitoringData();
  await refreshPerformanceData();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});

// 刷新监控数据
const refreshMonitoringData = async () => {
  try {
    loading.value = true;
    const data = await toolStore.fetchMonitoring();
    monitoringData.value = data;
    addLog('info', '监控数据已刷新');
  } catch (err) {
    console.error('获取监控数据失败:', err);
    addLog('error', '获取监控数据失败');
    MessagePlugin.error('获取监控数据失败');
  } finally {
    loading.value = false;
  }
};

// 刷新性能数据
const refreshPerformanceData = async () => {
  try {
    const data = await toolStore.fetchPerformance(performanceTimeRange.value);
    performanceData.value = data;
  } catch (err) {
    addLog('error', '获取性能数据失败');
  }
};

// 刷新服务器状态
const refreshServerStatus = async () => {
  await refreshMonitoringData();
  MessagePlugin.success('服务器状态已刷新');
};

// 格式化时间（短格式）
const formatTimeShort = (timestamp: string): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// 添加日志
const addLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string) => {
  realtimeLogs.value.unshift({
    timestamp: new Date().toISOString(),
    level,
    message,
  });

  // 保持最多50条日志
  if (realtimeLogs.value.length > 50) {
    realtimeLogs.value = realtimeLogs.value.slice(0, 50);
  }
};

// 清空日志
const clearLogs = () => {
  realtimeLogs.value = [];
  MessagePlugin.success('日志已清空');
};

// 自动刷新
const startAutoRefresh = () => {
  if (!autoRefresh.value) return;

  refreshTimer = setInterval(async () => {
    await refreshMonitoringData();
  }, 30000); // 每30秒刷新一次
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 监听自动刷新开关变化
const handleAutoRefreshChange = (value: boolean) => {
  if (value) {
    startAutoRefresh();
    addLog('info', '自动刷新已开启');
  } else {
    stopAutoRefresh();
    addLog('info', '自动刷新已关闭');
  }
};

// 监听性能时间范围变化
const handlePerformanceTimeRangeChange = async () => {
  await refreshPerformanceData();
  addLog('info', `性能时间范围已更新为 ${performanceTimeRange.value}`);
};

// 监听自动刷新开关变化
watch(autoRefresh, (newValue) => {
  handleAutoRefreshChange(newValue);
});

// 监听性能时间范围变化
watch(performanceTimeRange, () => {
  handlePerformanceTimeRangeChange();
});
</script>

<style scoped>
.tool-monitoring {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: var(--td-bg-color-container);
  min-height: 100%;
  border-radius: var(--td-radius-default);
}

/* 顶部统计卡片 */
.monitoring-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
  background: var(--td-bg-color-page);
  border-radius: var(--td-radius-large);
  border: 1px solid var(--td-border-level-1-color);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  transition: all 0.2s ease;
}

.stat-item:hover {
  background: var(--td-bg-color-container-hover);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--td-radius-default);
  background: var(--td-brand-color-1);
  color: var(--td-brand-color);
  flex-shrink: 0;
}

.stat-item.stat-success .stat-icon {
  background: var(--td-success-color-1);
  color: var(--td-success-color);
}

.stat-item.stat-error .stat-icon {
  background: var(--td-error-color-1);
  color: var(--td-error-color);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.2;
}

/* 主内容区域 */
.monitoring-content {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  align-items: start;
}

.monitoring-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitoring-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 服务器状态卡片 */
.server-status-card {
  height: 100%;
}

.action-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
  overflow-y: auto;
}

.server-item {
  padding: 12px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  border-left: 3px solid var(--td-brand-color);
  transition: all 0.2s ease;
}

.server-item.server-connected {
  border-left-color: var(--td-success-color);
}

.server-item.server-disconnected {
  border-left-color: var(--td-error-color);
}

.server-item.server-connecting {
  border-left-color: var(--td-warning-color);
}

.server-item:hover {
  background: var(--td-bg-color-container-hover);
  border-color: var(--td-brand-color);
}

.server-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.server-info {
  flex: 1;
  min-width: 0;
}

.server-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--td-text-color-primary);
}

.server-meta {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  display: flex;
  gap: 8px;
  align-items: center;
}

.server-meta .separator {
  opacity: 0.5;
}

.server-tools {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--td-border-level-1-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.server-tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--td-radius-small);
  font-size: 12px;
  transition: background 0.2s ease;
}

.server-tool-item:hover {
  background: var(--td-bg-color-container-hover);
}

.tool-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--td-success-color);
  flex-shrink: 0;
}

.server-tool-item.tool-unavailable .tool-dot {
  background: var(--td-error-color);
}

.tool-name {
  flex: 1;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 性能指标卡片 */
.performance-card {
  margin-bottom: 0;
}

.performance-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--td-border-level-2-color);
}

.metric-row:last-child {
  border-bottom: none;
}

.metric-label {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.metric-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.metric-value.text-success {
  color: var(--td-success-color);
}

.metric-value.text-error {
  color: var(--td-error-color);
}

/* 日志卡片 */
.logs-card {
  margin-bottom: 0;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--td-radius-small);
  font-size: 12px;
  line-height: 1.5;
  background: var(--td-bg-color-container);
  transition: background 0.2s ease;
}

.log-item:hover {
  background: var(--td-bg-color-container-hover);
}

.log-item.log-error {
  background: var(--td-error-color-1);
}

.log-item.log-warn {
  background: var(--td-warning-color-1);
}

.log-time {
  color: var(--td-text-color-secondary);
  flex-shrink: 0;
  font-family: monospace;
}

.log-message {
  flex: 1;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 空状态 */
.empty-state {
  padding: 32px 16px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .monitoring-content {
    grid-template-columns: 1fr;
  }

  .monitoring-sidebar {
    order: -1;
  }
}

@media (max-width: 768px) {
  .tool-monitoring {
    padding: 12px;
  }

  .monitoring-stats {
    grid-template-columns: repeat(2, 1fr);
    padding: 12px;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
  }
}

/* 文本颜色 */
.text-success {
  color: var(--td-success-color);
}

.text-error {
  color: var(--td-error-color);
}

.text-warning {
  color: var(--td-warning-color);
}
</style>
