<template>
  <div class="performance-analyzer">
    <t-row :gutter="[16, 16]">
      <!-- 总览指标 -->
      <t-col :span="12">
        <t-card title="性能总览" :bordered="false">
          <t-row :gutter="[16, 16]">
            <t-col :span="3">
              <t-statistic
                title="总请求数"
                :value="stats.totalRequests"
                :value-style="{ color: '#1890ff' }"
              />
            </t-col>
            <t-col :span="3">
              <t-statistic
                title="平均响应时间"
                :value="stats.averageResponseTime"
                :suffix="'ms'"
                :value-style="{ color: '#52c41a' }"
              />
            </t-col>
            <t-col :span="3">
              <t-statistic
                title="错误率"
                :value="stats.errorRate"
                :suffix="'%'"
                :value-style="{ color: stats.errorRate > 5 ? '#ff4d4f' : '#1890ff' }"
              />
            </t-col>
            <t-col :span="3">
              <t-statistic
                title="热门工具数"
                :value="stats.topTools.length"
                :value-style="{ color: '#722ed1' }"
              />
            </t-col>
          </t-row>
        </t-card>
      </t-col>
      
      <!-- 热门工具 -->
      <t-col :span="12">
        <t-card title="热门工具性能" :bordered="false">
          <t-table
            :data="stats.topTools"
            :columns="toolColumns"
            row-key="name"
            size="small"
          >
            <template #name="{ row }">
              <t-tag variant="outline">{{ row.name }}</t-tag>
            </template>
            
            <template #avgTime="{ row }">
              <span :style="{ color: getResponseTimeColor(row.avgTime) }">
                {{ row.avgTime }}ms
              </span>
            </template>
          </t-table>
        </t-card>
      </t-col>
      
      <!-- 性能趋势图 -->
      <t-col :span="12">
        <t-card title="性能趋势" :bordered="false">
          <div ref="chartContainer" class="chart-container"></div>
        </t-card>
      </t-col>
    </t-row>
    
    <div class="actions-bar">
      <t-space>
        <t-button @click="refreshStats" variant="outline">
          <template #icon>
            <refresh-icon />
          </template>
          刷新数据
        </t-button>
        <t-button @click="startAutoRefresh" :disabled="isAutoRefreshing">
          {{ isAutoRefreshing ? '自动刷新中...' : '开始自动刷新' }}
        </t-button>
        <t-button @click="stopAutoRefresh" :disabled="!isAutoRefreshing">
          停止自动刷新
        </t-button>
      </t-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { RefreshIcon } from 'tdesign-icons-vue-next';
import { getPerformanceStats } from '@/services/debug';
import type { PerformanceStats } from '@/types/debug';
// @ts-ignore
import * as echarts from 'echarts';
import { frontendLogger } from '@mcp-core/mcp-hub-share';

// Reactive data
const stats = ref<PerformanceStats>({
  totalRequests: 0,
  averageResponseTime: 0,
  errorRate: 0,
  topTools: [],
});

const loading = ref(false);
const chartContainer = ref<HTMLDivElement | null>(null);
const chartInstance = ref<any>(null);
const refreshInterval = ref<number | null>(null);
const isAutoRefreshing = ref(false);

// Table columns
const toolColumns = [
  {
    title: '工具名称',
    colKey: 'name',
    width: 200,
  },
  {
    title: '调用次数',
    colKey: 'calls',
    width: 120,
    sorter: true,
  },
  {
    title: '平均响应时间',
    colKey: 'avgTime',
    width: 150,
    sorter: true,
  },
];

// Methods
const loadStats = async () => {
  loading.value = true;
  try {
    const response = await getPerformanceStats();
    stats.value = response.stats;
    updateChart();
  } catch (error) {
    frontendLogger.error('Failed to load performance stats', error as Error);
  } finally {
    loading.value = false;
  }
};

const refreshStats = () => {
  loadStats();
};

const startAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
  
  refreshInterval.value = window.setInterval(() => {
    if (!loading.value) {
      loadStats();
    }
  }, 5000);
  
  isAutoRefreshing.value = true;
};

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
  isAutoRefreshing.value = false;
};

const getResponseTimeColor = (time: number) => {
  if (time > 1000) return '#ff4d4f'; // 红色 - 很慢
  if (time > 500) return '#fa8c16';  // 橙色 - 慢
  if (time > 200) return '#1890ff';  // 蓝色 - 一般
  return '#52c41a';                  // 绿色 - 快
};

const initChart = () => {
  if (chartContainer.value) {
    chartInstance.value = echarts.init(chartContainer.value);
    updateChart();
  }
};

const updateChart = () => {
  if (!chartInstance.value || !stats.value.topTools.length) return;
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['调用次数', '平均响应时间']
    },
    xAxis: {
      type: 'category',
      data: stats.value.topTools.map(tool => tool.name)
    },
    yAxis: [
      {
        type: 'value',
        name: '调用次数',
        position: 'left',
      },
      {
        type: 'value',
        name: '响应时间(ms)',
        position: 'right',
      }
    ],
    series: [
      {
        name: '调用次数',
        type: 'bar',
        yAxisIndex: 0,
        data: stats.value.topTools.map(tool => tool.calls),
        itemStyle: {
          color: '#1890ff'
        }
      },
      {
        name: '平均响应时间',
        type: 'line',
        yAxisIndex: 1,
        data: stats.value.topTools.map(tool => tool.avgTime),
        itemStyle: {
          color: '#52c41a'
        },
        smooth: true,
      }
    ]
  };
  
  chartInstance.value.setOption(option);
};

// Lifecycle
onMounted(() => {
  loadStats();
  nextTick(() => {
    initChart();
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (chartInstance.value) {
      chartInstance.value.resize();
    }
  });
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
  
  if (chartInstance.value) {
    chartInstance.value.dispose();
  }
});
</script>

<style scoped>
.performance-analyzer {
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.actions-bar {
  margin-top: 16px;
  text-align: center;
}
</style>