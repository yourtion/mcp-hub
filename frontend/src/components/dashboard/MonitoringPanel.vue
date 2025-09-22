<template>
  <t-card title="实时监控" class="monitoring-panel">
    <template #actions>
      <div class="panel-actions">
        <t-button 
          theme="default" 
          size="small"
          :loading="loading"
          @click="refreshData"
        >
          <template #icon>
            <t-icon name="refresh" />
          </template>
          刷新
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          @click="toggleFullscreen"
        >
          <template #icon>
            <t-icon :name="isFullscreen ? 'fullscreen-exit' : 'fullscreen'" />
          </template>
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </t-button>
      </div>
    </template>

    <div class="monitoring-content" :class="{ 'monitoring-content--fullscreen': isFullscreen }">
      <!-- 监控指标选择 -->
      <div class="metrics-selector">
        <t-checkbox-group v-model="selectedMetrics" @change="handleMetricsChange">
          <t-checkbox value="requests">请求数</t-checkbox>
          <t-checkbox value="response_time">响应时间</t-checkbox>
          <t-checkbox value="error_rate">错误率</t-checkbox>
          <t-checkbox value="connections">连接数</t-checkbox>
          <t-checkbox value="memory">内存使用</t-checkbox>
          <t-checkbox value="cpu">CPU使用率</t-checkbox>
        </t-checkbox-group>
      </div>

      <!-- 图表网格 -->
      <div class="charts-grid" :class="chartGridClass">
        <!-- 请求数图表 -->
        <div v-if="selectedMetrics.includes('requests')" class="chart-item">
          <RealTimeChart
            title="请求数/分钟"
            :series="requestsSeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchRequestsData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>

        <!-- 响应时间图表 -->
        <div v-if="selectedMetrics.includes('response_time')" class="chart-item">
          <RealTimeChart
            title="平均响应时间 (ms)"
            :series="responseTimeSeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchResponseTimeData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>

        <!-- 错误率图表 -->
        <div v-if="selectedMetrics.includes('error_rate')" class="chart-item">
          <RealTimeChart
            title="错误率 (%)"
            :series="errorRateSeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchErrorRateData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>

        <!-- 连接数图表 -->
        <div v-if="selectedMetrics.includes('connections')" class="chart-item">
          <RealTimeChart
            title="活跃连接数"
            :series="connectionsSeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchConnectionsData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>

        <!-- 内存使用图表 -->
        <div v-if="selectedMetrics.includes('memory')" class="chart-item">
          <RealTimeChart
            title="内存使用 (MB)"
            :series="memorySeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchMemoryData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>

        <!-- CPU使用率图表 -->
        <div v-if="selectedMetrics.includes('cpu')" class="chart-item">
          <RealTimeChart
            title="CPU使用率 (%)"
            :series="cpuSeries"
            :loading="loading"
            :height="chartHeight"
            @refresh="fetchCpuData"
            @time-range-change="handleTimeRangeChange"
          />
        </div>
      </div>

      <!-- 实时数据表格 -->
      <div v-if="showDataTable" class="data-table">
        <t-table
          :data="realtimeData"
          :columns="tableColumns"
          size="small"
          :pagination="false"
          max-height="200"
        />
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import RealTimeChart from './RealTimeChart.vue';
import type { TimeSeriesData, ChartDataPoint } from '@/types/dashboard';

interface Props {
  showDataTable?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface Emits {
  (e: 'data-update', data: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  showDataTable: false,
  autoRefresh: true,
  refreshInterval: 30000, // 30秒
});

const emit = defineEmits<Emits>();

// 响应式数据
const loading = ref(false);
const isFullscreen = ref(false);
const selectedMetrics = ref(['requests', 'response_time', 'error_rate']);
const timeRange = ref('15m');

// 图表数据
const requestsSeries = ref<TimeSeriesData[]>([]);
const responseTimeSeries = ref<TimeSeriesData[]>([]);
const errorRateSeries = ref<TimeSeriesData[]>([]);
const connectionsSeries = ref<TimeSeriesData[]>([]);
const memorySeries = ref<TimeSeriesData[]>([]);
const cpuSeries = ref<TimeSeriesData[]>([]);

// 实时数据表格
const realtimeData = ref<any[]>([]);

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性
const chartHeight = computed(() => {
  return isFullscreen.value ? 400 : 250;
});

const chartGridClass = computed(() => {
  const count = selectedMetrics.value.length;
  if (count === 1) return 'charts-grid--single';
  if (count === 2) return 'charts-grid--double';
  if (count <= 4) return 'charts-grid--quad';
  return 'charts-grid--multi';
});

// 表格列定义
const tableColumns = [
  { colKey: 'timestamp', title: '时间', width: 120 },
  { colKey: 'metric', title: '指标', width: 100 },
  { colKey: 'value', title: '数值', width: 80 },
  { colKey: 'unit', title: '单位', width: 60 },
  { colKey: 'status', title: '状态', width: 80 },
];

// 生成模拟数据
const generateMockData = (baseValue: number, variance: number, count = 20): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const now = Date.now();
  
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * 60000).toISOString(); // 每分钟一个数据点
    const value = baseValue + (Math.random() - 0.5) * variance;
    data.push({
      timestamp,
      value: Math.max(0, value),
    });
  }
  
  return data;
};

// 获取请求数据
const fetchRequestsData = async () => {
  try {
    // 模拟API调用
    const data = generateMockData(100, 50);
    requestsSeries.value = [
      {
        name: '总请求数',
        data,
        color: '#409eff',
      },
    ];
  } catch (error) {
    console.error('获取请求数据失败:', error);
  }
};

// 获取响应时间数据
const fetchResponseTimeData = async () => {
  try {
    const data = generateMockData(150, 80);
    responseTimeSeries.value = [
      {
        name: '平均响应时间',
        data,
        color: '#67c23a',
      },
    ];
  } catch (error) {
    console.error('获取响应时间数据失败:', error);
  }
};

// 获取错误率数据
const fetchErrorRateData = async () => {
  try {
    const data = generateMockData(2, 3);
    errorRateSeries.value = [
      {
        name: '错误率',
        data,
        color: '#f56c6c',
      },
    ];
  } catch (error) {
    console.error('获取错误率数据失败:', error);
  }
};

// 获取连接数据
const fetchConnectionsData = async () => {
  try {
    const data = generateMockData(50, 20);
    connectionsSeries.value = [
      {
        name: '活跃连接',
        data,
        color: '#e6a23c',
      },
    ];
  } catch (error) {
    console.error('获取连接数据失败:', error);
  }
};

// 获取内存数据
const fetchMemoryData = async () => {
  try {
    const heapData = generateMockData(256, 64);
    const rssData = generateMockData(512, 128);
    
    memorySeries.value = [
      {
        name: 'Heap Used',
        data: heapData,
        color: '#909399',
      },
      {
        name: 'RSS',
        data: rssData,
        color: '#c71585',
      },
    ];
  } catch (error) {
    console.error('获取内存数据失败:', error);
  }
};

// 获取CPU数据
const fetchCpuData = async () => {
  try {
    const data = generateMockData(25, 15);
    cpuSeries.value = [
      {
        name: 'CPU使用率',
        data,
        color: '#ff6347',
      },
    ];
  } catch (error) {
    console.error('获取CPU数据失败:', error);
  }
};

// 刷新所有数据
const refreshData = async () => {
  loading.value = true;
  
  try {
    const promises = [];
    
    if (selectedMetrics.value.includes('requests')) {
      promises.push(fetchRequestsData());
    }
    if (selectedMetrics.value.includes('response_time')) {
      promises.push(fetchResponseTimeData());
    }
    if (selectedMetrics.value.includes('error_rate')) {
      promises.push(fetchErrorRateData());
    }
    if (selectedMetrics.value.includes('connections')) {
      promises.push(fetchConnectionsData());
    }
    if (selectedMetrics.value.includes('memory')) {
      promises.push(fetchMemoryData());
    }
    if (selectedMetrics.value.includes('cpu')) {
      promises.push(fetchCpuData());
    }
    
    await Promise.all(promises);
    
    // 更新实时数据表格
    updateRealtimeDataTable();
    
    emit('data-update', {
      requests: requestsSeries.value,
      responseTime: responseTimeSeries.value,
      errorRate: errorRateSeries.value,
      connections: connectionsSeries.value,
      memory: memorySeries.value,
      cpu: cpuSeries.value,
    });
    
  } catch (error) {
    console.error('刷新监控数据失败:', error);
    MessagePlugin.error('刷新监控数据失败');
  } finally {
    loading.value = false;
  }
};

// 更新实时数据表格
const updateRealtimeDataTable = () => {
  const data: any[] = [];
  const now = new Date().toLocaleTimeString('zh-CN');
  
  if (requestsSeries.value.length > 0) {
    const latest = requestsSeries.value[0].data.slice(-1)[0];
    data.push({
      timestamp: now,
      metric: '请求数',
      value: latest?.value.toFixed(0) || '0',
      unit: '/min',
      status: '正常',
    });
  }
  
  if (responseTimeSeries.value.length > 0) {
    const latest = responseTimeSeries.value[0].data.slice(-1)[0];
    data.push({
      timestamp: now,
      metric: '响应时间',
      value: latest?.value.toFixed(1) || '0',
      unit: 'ms',
      status: (latest?.value || 0) > 500 ? '警告' : '正常',
    });
  }
  
  if (errorRateSeries.value.length > 0) {
    const latest = errorRateSeries.value[0].data.slice(-1)[0];
    data.push({
      timestamp: now,
      metric: '错误率',
      value: latest?.value.toFixed(2) || '0',
      unit: '%',
      status: (latest?.value || 0) > 5 ? '异常' : '正常',
    });
  }
  
  realtimeData.value = data;
};

// 处理指标选择变更
const handleMetricsChange = (metrics: string[]) => {
  selectedMetrics.value = metrics;
  refreshData();
};

// 处理时间范围变更
const handleTimeRangeChange = (range: string) => {
  timeRange.value = range;
  refreshData();
};

// 切换全屏
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

// 开始自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    refreshData();
  }, props.refreshInterval);
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 生命周期
onMounted(() => {
  refreshData();
  
  if (props.autoRefresh) {
    startAutoRefresh();
  }
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.monitoring-panel {
  height: 100%;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.monitoring-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: all 0.3s ease;
}

.monitoring-content--fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: var(--td-bg-color-container);
  padding: 24px;
  overflow: auto;
}

.metrics-selector {
  padding: 12px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 6px;
}

.charts-grid {
  display: grid;
  gap: 16px;
}

.charts-grid--single {
  grid-template-columns: 1fr;
}

.charts-grid--double {
  grid-template-columns: 1fr 1fr;
}

.charts-grid--quad {
  grid-template-columns: 1fr 1fr;
}

.charts-grid--multi {
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
}

.chart-item {
  min-height: 300px;
  background: var(--td-bg-color-container);
  border-radius: 6px;
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
}

.data-table {
  margin-top: 16px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .charts-grid--quad,
  .charts-grid--multi {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .charts-grid--double {
    grid-template-columns: 1fr;
  }
  
  .monitoring-content--fullscreen {
    padding: 16px;
  }
}
</style>