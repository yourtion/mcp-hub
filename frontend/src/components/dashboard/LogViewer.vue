<template>
  <t-card title="系统日志" class="log-viewer">
    <template #actions>
      <div class="log-actions">
        <!-- 日志级别过滤 -->
        <t-select 
          v-model="logQuery.level" 
          size="small"
          placeholder="日志级别"
          clearable
          style="width: 100px;"
          @change="handleQueryChange"
        >
          <t-option value="debug" label="Debug" />
          <t-option value="info" label="Info" />
          <t-option value="warn" label="Warn" />
          <t-option value="error" label="Error" />
        </t-select>
        
        <!-- 分类过滤 -->
        <t-select 
          v-model="logQuery.category" 
          size="small"
          placeholder="分类"
          clearable
          style="width: 120px;"
          @change="handleQueryChange"
        >
          <t-option value="server" label="服务器" />
          <t-option value="tool" label="工具" />
          <t-option value="auth" label="认证" />
          <t-option value="api" label="API" />
          <t-option value="system" label="系统" />
        </t-select>
        
        <!-- 搜索框 -->
        <t-input 
          v-model="logQuery.search"
          size="small"
          placeholder="搜索日志..."
          clearable
          style="width: 200px;"
          @change="handleQueryChange"
        >
          <template #prefix-icon>
            <t-icon name="search" />
          </template>
        </t-input>
        
        <!-- 时间范围 -->
        <t-date-range-picker
          v-model="dateRange"
          size="small"
          format="YYYY-MM-DD HH:mm:ss"
          @change="handleDateRangeChange"
        />
        
        <!-- 操作按钮 -->
        <t-button 
          theme="primary" 
          size="small"
          :loading="loading"
          @click="refreshLogs"
        >
          <template #icon>
            <t-icon name="refresh" />
          </template>
          刷新
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          @click="exportLogs"
        >
          <template #icon>
            <t-icon name="download" />
          </template>
          导出
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          @click="clearLogs"
        >
          <template #icon>
            <t-icon name="delete" />
          </template>
          清空
        </t-button>
      </div>
    </template>

    <div class="log-content">
      <!-- 日志统计 -->
      <div class="log-stats">
        <div class="stat-item">
          <span class="stat-label">总计:</span>
          <span class="stat-value">{{ logResult?.total || 0 }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">当前页:</span>
          <span class="stat-value">{{ logs.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">错误:</span>
          <span class="stat-value error">{{ errorCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">警告:</span>
          <span class="stat-value warning">{{ warningCount }}</span>
        </div>
      </div>

      <!-- 日志列表 -->
      <div class="log-list-container">
        <div v-if="loading && logs.length === 0" class="log-loading">
          <t-loading size="small" />
          <span>加载中...</span>
        </div>
        
        <div v-else-if="logs.length === 0" class="log-empty">
          <t-icon name="inbox" size="32px" />
          <span>暂无日志记录</span>
        </div>
        
        <div v-else class="log-list" ref="logListRef">
          <div 
            v-for="log in logs" 
            :key="log.id"
            class="log-item"
            :class="[`log--${log.level}`]"
          >
            <div class="log-header">
              <div class="log-level">
                <t-tag 
                  :theme="getLevelTheme(log.level)" 
                  size="small"
                  variant="light"
                >
                  {{ log.level.toUpperCase() }}
                </t-tag>
              </div>
              <div class="log-category">{{ log.category }}</div>
              <div class="log-time">{{ formatTime(log.timestamp) }}</div>
            </div>
            
            <div class="log-message">{{ log.message }}</div>
            
            <div v-if="log.metadata" class="log-metadata">
              <t-collapse>
                <t-collapse-panel header="详细信息">
                  <pre class="metadata-json">{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                </t-collapse-panel>
              </t-collapse>
            </div>
          </div>
        </div>
        
        <!-- 分页 -->
        <div v-if="logResult && logResult.total > pageSize" class="log-pagination">
          <t-pagination
            v-model="currentPage"
            :total="logResult.total"
            :page-size="pageSize"
            :show-sizer="true"
            :page-size-options="[20, 50, 100, 200]"
            @change="handlePageChange"
            @page-size-change="handlePageSizeChange"
          />
        </div>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { dashboardService } from '@/services/dashboard';
import type { LogEntry, LogQuery, LogQueryResult } from '@/types/dashboard';

interface Props {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: false,
  refreshInterval: 30000,
});

// 响应式数据
const loading = ref(false);
const logs = ref<LogEntry[]>([]);
const logResult = ref<LogQueryResult | null>(null);
const currentPage = ref(1);
const pageSize = ref(50);
const dateRange = ref<string[]>([]);
const logListRef = ref<HTMLElement>();

// 查询参数
const logQuery = ref<LogQuery>({
  level: undefined,
  category: undefined,
  search: undefined,
  limit: pageSize.value,
  offset: 0,
});

// 自动刷新定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 计算属性
const errorCount = computed(() => {
  return logs.value.filter(log => log.level === 'error').length;
});

const warningCount = computed(() => {
  return logs.value.filter(log => log.level === 'warn').length;
});

// 获取日志级别主题
const getLevelTheme = (level: string): string => {
  const themeMap: Record<string, string> = {
    debug: 'default',
    info: 'primary',
    warn: 'warning',
    error: 'danger',
  };
  return themeMap[level] || 'default';
};

// 格式化时间
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

// 获取日志
const fetchLogs = async () => {
  loading.value = true;
  
  try {
    const query = {
      ...logQuery.value,
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
    };
    
    const result = await dashboardService.queryLogs(query);
    logResult.value = result;
    logs.value = result.logs;
  } catch (error) {
    console.error('获取日志失败:', error);
    MessagePlugin.error('获取日志失败');
  } finally {
    loading.value = false;
  }
};

// 刷新日志
const refreshLogs = () => {
  fetchLogs();
};

// 处理查询变更
const handleQueryChange = () => {
  currentPage.value = 1; // 重置到第一页
  fetchLogs();
};

// 处理日期范围变更
const handleDateRangeChange = (dates: string[]) => {
  if (dates && dates.length === 2) {
    logQuery.value.startTime = dates[0];
    logQuery.value.endTime = dates[1];
  } else {
    logQuery.value.startTime = undefined;
    logQuery.value.endTime = undefined;
  }
  handleQueryChange();
};

// 处理分页变更
const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchLogs();
};

// 处理页面大小变更
const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
  logQuery.value.limit = size;
  currentPage.value = 1;
  fetchLogs();
};

// 导出日志
const exportLogs = () => {
  try {
    const csvContent = generateCSV(logs.value);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `logs_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    MessagePlugin.success('日志导出成功');
  } catch (error) {
    console.error('导出日志失败:', error);
    MessagePlugin.error('导出日志失败');
  }
};

// 生成CSV内容
const generateCSV = (logs: LogEntry[]): string => {
  const headers = ['时间', '级别', '分类', '消息', '元数据'];
  const rows = logs.map(log => [
    log.timestamp,
    log.level,
    log.category,
    `"${log.message.replace(/"/g, '""')}"`, // 转义双引号
    log.metadata ? `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"` : '',
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// 清空日志
const clearLogs = async () => {
  try {
    await dashboardService.clearLogs();
    logs.value = [];
    logResult.value = null;
    MessagePlugin.success('日志已清空');
  } catch (error) {
    console.error('清空日志失败:', error);
    MessagePlugin.error('清空日志失败');
  }
};

// 开始自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    fetchLogs();
  }, props.refreshInterval);
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 监听查询参数变化
watch(() => logQuery.value, () => {
  // 防抖处理
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  refreshTimer = setTimeout(() => {
    handleQueryChange();
  }, 500);
}, { deep: true });

// 生命周期
onMounted(() => {
  fetchLogs();
  
  if (props.autoRefresh) {
    startAutoRefresh();
  }
});

// 清理
const cleanup = () => {
  stopAutoRefresh();
};

// 暴露清理方法
defineExpose({
  cleanup,
  refreshLogs,
});
</script>

<style scoped>
.log-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.log-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log-stats {
  display: flex;
  gap: 16px;
  padding: 12px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 6px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  gap: 4px;
  font-size: 12px;
}

.stat-label {
  color: var(--td-text-color-secondary);
}

.stat-value {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.stat-value.error {
  color: #f56c6c;
}

.stat-value.warning {
  color: #ff9f40;
}

.log-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log-loading,
.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--td-text-color-placeholder);
}

.log-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
  padding-right: 8px;
}

.log-item {
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid;
  background-color: var(--td-bg-color-container);
  transition: background-color 0.2s ease;
}

.log-item:hover {
  background-color: var(--td-bg-color-container-hover);
}

.log--debug {
  border-left-color: #909399;
}

.log--info {
  border-left-color: #409eff;
}

.log--warn {
  border-left-color: #ff9f40;
  background-color: rgba(255, 159, 64, 0.03);
}

.log--error {
  border-left-color: #f56c6c;
  background-color: rgba(245, 108, 108, 0.03);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.log-level {
  flex-shrink: 0;
}

.log-category {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  background-color: var(--td-bg-color-container-hover);
  padding: 2px 6px;
  border-radius: 4px;
}

.log-time {
  flex: 1;
  text-align: right;
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  font-family: monospace;
}

.log-message {
  font-size: 13px;
  color: var(--td-text-color-primary);
  line-height: 1.4;
  word-break: break-word;
  margin-bottom: 8px;
}

.log-metadata {
  margin-top: 8px;
}

.metadata-json {
  font-size: 11px;
  color: var(--td-text-color-secondary);
  background-color: var(--td-bg-color-container-hover);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.log-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .log-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .log-actions > * {
    width: 100%;
  }
  
  .log-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .log-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .log-time {
    text-align: left;
  }
}
</style>