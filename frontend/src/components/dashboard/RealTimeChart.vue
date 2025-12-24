<template>
  <div class="chart-container">
    <div class="chart-header">
      <h4>{{ title }}</h4>
      <div class="chart-controls">
        <t-select 
          v-model="timeRange" 
          size="small"
          style="width: 120px;"
          @change="handleTimeRangeChange"
        >
          <t-option value="5m" label="5分钟" />
          <t-option value="15m" label="15分钟" />
          <t-option value="1h" label="1小时" />
          <t-option value="6h" label="6小时" />
          <t-option value="24h" label="24小时" />
        </t-select>
        
        <t-button
          theme="default"
          size="small"
          :disabled="!autoRefresh"
          @click="toggleAutoRefresh"
        >
          <template #icon>
            <component :is="autoRefresh ? PauseIcon : PlayIcon" />
          </template>
          {{ autoRefresh ? '暂停' : '开始' }}
        </t-button>
      </div>
    </div>
    
    <div class="chart-content" :style="{ height: `${height}px` }">
      <div v-if="loading" class="chart-loading">
        <t-loading size="small" />
        <span>加载中...</span>
      </div>
      
      <div v-else-if="error" class="chart-error">
        <CloseCircleIcon size="24px" />
        <span>{{ error }}</span>
      </div>
      
      <canvas 
        v-else
        ref="chartCanvas" 
        class="chart-canvas"
        :width="canvasWidth"
        :height="canvasHeight"
      />
    </div>
    
    <div v-if="showLegend && series.length > 1" class="chart-legend">
      <div 
        v-for="(serie, index) in series" 
        :key="serie.name"
        class="legend-item"
        @click="toggleSeries(index)"
      >
        <div 
          class="legend-color" 
          :style="{ backgroundColor: serie.color }"
          :class="{ 'legend-color--disabled': serie.hidden }"
        />
        <span 
          class="legend-label"
          :class="{ 'legend-label--disabled': serie.hidden }"
        >
          {{ serie.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { CloseCircleIcon, PauseIcon, PlayIcon } from 'tdesign-icons-vue-next';
import type { TimeSeriesData, ChartDataPoint } from '@/types/dashboard';

interface Props {
  title: string;
  series: TimeSeriesData[];
  height?: number;
  loading?: boolean;
  error?: string;
  showLegend?: boolean;
  autoRefreshInterval?: number; // 毫秒
}

interface Emits {
  (e: 'refresh'): void;
  (e: 'time-range-change', range: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  loading: false,
  error: '',
  showLegend: true,
  autoRefreshInterval: 30000, // 30秒
});

const emit = defineEmits<Emits>();

// 响应式数据
const chartCanvas = ref<HTMLCanvasElement>();
const timeRange = ref('15m');
const autoRefresh = ref(true);
const canvasWidth = ref(800);
const canvasHeight = ref(300);

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 图表配置
const chartConfig = {
  padding: { top: 20, right: 20, bottom: 40, left: 60 },
  gridColor: '#e5e7eb',
  textColor: '#6b7280',
  fontSize: 12,
  lineWidth: 2,
  pointRadius: 3,
};

// 处理后的系列数据
const processedSeries = computed(() => {
  return props.series.map((serie, index) => ({
    ...serie,
    color: serie.color || getDefaultColor(index),
    hidden: serie.hidden || false,
  }));
});

// 获取默认颜色
const getDefaultColor = (index: number): string => {
  const colors = [
    '#409eff', '#67c23a', '#e6a23c', '#f56c6c', 
    '#909399', '#c71585', '#ff6347', '#32cd32'
  ];
  return colors[index % colors.length];
};

// 绘制图表
const drawChart = () => {
  if (!chartCanvas.value) return;
  
  const canvas = chartCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 获取可见的系列数据
  const visibleSeries = processedSeries.value.filter(s => !s.hidden);
  if (visibleSeries.length === 0) return;
  
  // 计算绘图区域
  const plotArea = {
    x: chartConfig.padding.left,
    y: chartConfig.padding.top,
    width: canvas.width - chartConfig.padding.left - chartConfig.padding.right,
    height: canvas.height - chartConfig.padding.top - chartConfig.padding.bottom,
  };
  
  // 获取数据范围
  const allData = visibleSeries.flatMap(s => s.data);
  if (allData.length === 0) return;
  
  const timeRange = getTimeRange(allData);
  const valueRange = getValueRange(allData);
  
  // 绘制网格和坐标轴
  drawGrid(ctx, plotArea, timeRange, valueRange);
  
  // 绘制数据线
  visibleSeries.forEach(serie => {
    drawLine(ctx, plotArea, serie, timeRange, valueRange);
  });
};

// 获取时间范围
const getTimeRange = (data: ChartDataPoint[]) => {
  const timestamps = data.map(d => new Date(d.timestamp).getTime());
  return {
    min: Math.min(...timestamps),
    max: Math.max(...timestamps),
  };
};

// 获取数值范围
const getValueRange = (data: ChartDataPoint[]) => {
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1;
  
  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  };
};

// 绘制网格和坐标轴
const drawGrid = (
  ctx: CanvasRenderingContext2D, 
  plotArea: any, 
  timeRange: any, 
  valueRange: any
) => {
  ctx.strokeStyle = chartConfig.gridColor;
  ctx.lineWidth = 1;
  ctx.font = `${chartConfig.fontSize}px sans-serif`;
  ctx.fillStyle = chartConfig.textColor;
  
  // 绘制垂直网格线（时间轴）
  const timeSteps = 6;
  for (let i = 0; i <= timeSteps; i++) {
    const x = plotArea.x + (plotArea.width / timeSteps) * i;
    const time = timeRange.min + ((timeRange.max - timeRange.min) / timeSteps) * i;
    
    // 网格线
    ctx.beginPath();
    ctx.moveTo(x, plotArea.y);
    ctx.lineTo(x, plotArea.y + plotArea.height);
    ctx.stroke();
    
    // 时间标签
    const timeLabel = formatTimeLabel(new Date(time));
    const textWidth = ctx.measureText(timeLabel).width;
    ctx.fillText(
      timeLabel, 
      x - textWidth / 2, 
      plotArea.y + plotArea.height + 20
    );
  }
  
  // 绘制水平网格线（数值轴）
  const valueSteps = 5;
  for (let i = 0; i <= valueSteps; i++) {
    const y = plotArea.y + plotArea.height - (plotArea.height / valueSteps) * i;
    const value = valueRange.min + ((valueRange.max - valueRange.min) / valueSteps) * i;
    
    // 网格线
    ctx.beginPath();
    ctx.moveTo(plotArea.x, y);
    ctx.lineTo(plotArea.x + plotArea.width, y);
    ctx.stroke();
    
    // 数值标签
    const valueLabel = formatValueLabel(value);
    ctx.fillText(valueLabel, plotArea.x - 10 - ctx.measureText(valueLabel).width, y + 4);
  }
};

// 绘制数据线
const drawLine = (
  ctx: CanvasRenderingContext2D,
  plotArea: any,
  serie: TimeSeriesData & { color: string; hidden?: boolean },
  timeRange: any,
  valueRange: any
) => {
  if (serie.data.length === 0) return;
  
  ctx.strokeStyle = serie.color;
  ctx.lineWidth = chartConfig.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 绘制线条
  ctx.beginPath();
  serie.data.forEach((point, index) => {
    const x = plotArea.x + ((new Date(point.timestamp).getTime() - timeRange.min) / (timeRange.max - timeRange.min)) * plotArea.width;
    const y = plotArea.y + plotArea.height - ((point.value - valueRange.min) / (valueRange.max - valueRange.min)) * plotArea.height;
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  
  // 绘制数据点
  ctx.fillStyle = serie.color;
  serie.data.forEach(point => {
    const x = plotArea.x + ((new Date(point.timestamp).getTime() - timeRange.min) / (timeRange.max - timeRange.min)) * plotArea.width;
    const y = plotArea.y + plotArea.height - ((point.value - valueRange.min) / (valueRange.max - valueRange.min)) * plotArea.height;
    
    ctx.beginPath();
    ctx.arc(x, y, chartConfig.pointRadius, 0, 2 * Math.PI);
    ctx.fill();
  });
};

// 格式化时间标签
const formatTimeLabel = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// 格式化数值标签
const formatValueLabel = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
};

// 切换系列显示/隐藏
const toggleSeries = (index: number) => {
  const serie = processedSeries.value[index];
  serie.hidden = !serie.hidden;
  nextTick(() => {
    drawChart();
  });
};

// 处理时间范围变更
const handleTimeRangeChange = (range: string) => {
  emit('time-range-change', range);
};

// 切换自动刷新
const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;
  
  if (autoRefresh.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
};

// 开始自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    emit('refresh');
  }, props.autoRefreshInterval);
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 更新画布尺寸
const updateCanvasSize = () => {
  if (!chartCanvas.value) return;
  
  const container = chartCanvas.value.parentElement;
  if (container) {
    canvasWidth.value = container.clientWidth;
    canvasHeight.value = props.height;
  }
};

// 监听数据变化
watch(() => props.series, () => {
  nextTick(() => {
    drawChart();
  });
}, { deep: true });

// 监听画布尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    drawChart();
  });
});

// 生命周期
onMounted(() => {
  updateCanvasSize();
  
  // 监听窗口大小变化
  window.addEventListener('resize', updateCanvasSize);
  
  // 开始自动刷新
  if (autoRefresh.value) {
    startAutoRefresh();
  }
  
  nextTick(() => {
    drawChart();
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize);
  stopAutoRefresh();
});
</script>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-content {
  position: relative;
  flex: 1;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
}

.chart-loading,
.chart-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--td-text-color-secondary);
}

.chart-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
  padding: 8px 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  transition: opacity 0.2s ease;
}

.legend-color--disabled {
  opacity: 0.3;
}

.legend-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  transition: opacity 0.2s ease;
}

.legend-label--disabled {
  opacity: 0.5;
  text-decoration: line-through;
}
</style>