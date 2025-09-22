<template>
  <t-card title="实时事件监控" class="sse-monitor">
    <template #actions>
      <div class="monitor-actions">
        <!-- 连接状态 -->
        <div class="connection-status" :class="[`status--${connectionState}`]">
          <t-icon :name="statusIcon" size="14px" />
          <span>{{ statusText }}</span>
        </div>
        
        <!-- 事件过滤 -->
        <t-select 
          v-model="eventFilter" 
          size="small"
          style="width: 120px;"
          @change="handleFilterChange"
        >
          <t-option value="all" label="所有事件" />
          <t-option value="server_status" label="服务器状态" />
          <t-option value="tool_execution" label="工具执行" />
          <t-option value="system_alert" label="系统告警" />
          <t-option value="health_check" label="健康检查" />
        </t-select>
        
        <!-- 控制按钮 -->
        <t-button 
          v-if="connectionState === 'closed'"
          theme="primary" 
          size="small"
          @click="connect"
        >
          <template #icon>
            <t-icon name="play" />
          </template>
          连接
        </t-button>
        
        <t-button 
          v-else
          theme="default" 
          size="small"
          @click="disconnect"
        >
          <template #icon>
            <t-icon name="stop" />
          </template>
          断开
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          @click="clearEvents"
        >
          <template #icon>
            <t-icon name="delete" />
          </template>
          清空
        </t-button>
      </div>
    </template>

    <div class="monitor-content">
      <!-- 事件统计 -->
      <div class="event-stats">
        <div class="stat-item">
          <span class="stat-label">总事件数:</span>
          <span class="stat-value">{{ totalEvents }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">过滤后:</span>
          <span class="stat-value">{{ filteredEvents.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">错误事件:</span>
          <span class="stat-value error">{{ errorEvents }}</span>
        </div>
      </div>

      <!-- 事件列表 -->
      <div class="events-container">
        <div v-if="filteredEvents.length === 0" class="events-empty">
          <t-icon name="inbox" size="32px" />
          <span>暂无事件</span>
        </div>
        
        <div v-else class="events-list" ref="eventsListRef">
          <div 
            v-for="event in displayEvents" 
            :key="event.id"
            class="event-item"
            :class="[`event--${event.severity}`]"
          >
            <div class="event-header">
              <div class="event-type">
                <t-icon :name="getEventIcon(event.type)" size="16px" />
                <span>{{ getEventTypeText(event.type) }}</span>
              </div>
              <div class="event-time">{{ formatTime(event.timestamp) }}</div>
            </div>
            
            <div class="event-content">
              <div class="event-message">{{ event.message }}</div>
              <div v-if="event.details" class="event-details">
                <t-collapse>
                  <t-collapse-panel header="详细信息">
                    <pre class="event-json">{{ JSON.stringify(event.details, null, 2) }}</pre>
                  </t-collapse-panel>
                </t-collapse>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 加载更多 -->
        <div v-if="hasMoreEvents" class="load-more">
          <t-button 
            theme="default" 
            variant="text" 
            size="small"
            @click="loadMoreEvents"
          >
            加载更多事件
          </t-button>
        </div>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { sseService } from '@/services/sse';
import type { SSEEvent } from '@/types/dashboard';

interface SSEEventWithId extends SSEEvent {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface Props {
  maxEvents?: number;
  autoScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxEvents: 100,
  autoScroll: true,
});

// 响应式数据
const events = ref<SSEEventWithId[]>([]);
const eventFilter = ref('all');
const displayLimit = ref(20);
const eventsListRef = ref<HTMLElement>();

// 连接状态
const connectionState = computed(() => sseService.getConnectionState());

// 计算属性
const totalEvents = computed(() => events.value.length);

const errorEvents = computed(() => {
  return events.value.filter(e => e.severity === 'error').length;
});

const filteredEvents = computed(() => {
  if (eventFilter.value === 'all') {
    return events.value;
  }
  return events.value.filter(e => e.type === eventFilter.value);
});

const displayEvents = computed(() => {
  return filteredEvents.value.slice(0, displayLimit.value);
});

const hasMoreEvents = computed(() => {
  return filteredEvents.value.length > displayLimit.value;
});

const statusIcon = computed(() => {
  const iconMap: Record<string, string> = {
    connecting: 'loading',
    open: 'check-circle',
    closed: 'close-circle',
  };
  return iconMap[connectionState.value] || 'close-circle';
});

const statusText = computed(() => {
  const textMap: Record<string, string> = {
    connecting: '连接中',
    open: '已连接',
    closed: '未连接',
  };
  return textMap[connectionState.value] || '未连接';
});

// 获取事件图标
const getEventIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    server_status: 'server',
    tool_execution: 'tools',
    system_alert: 'error-circle',
    health_check: 'heart',
  };
  return iconMap[type] || 'info-circle';
};

// 获取事件类型文本
const getEventTypeText = (type: string): string => {
  const textMap: Record<string, string> = {
    server_status: '服务器状态',
    tool_execution: '工具执行',
    system_alert: '系统告警',
    health_check: '健康检查',
  };
  return textMap[type] || '未知事件';
};

// 格式化时间
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

// 添加事件
const addEvent = (event: SSEEvent) => {
  const eventWithId: SSEEventWithId = {
    ...event,
    id: `${event.type}_${Date.now()}_${Math.random()}`,
    severity: determineSeverity(event),
    message: extractMessage(event),
    details: event.data,
  };
  
  events.value.unshift(eventWithId);
  
  // 限制事件数量
  if (events.value.length > props.maxEvents) {
    events.value = events.value.slice(0, props.maxEvents);
  }
  
  // 自动滚动到顶部
  if (props.autoScroll) {
    nextTick(() => {
      if (eventsListRef.value) {
        eventsListRef.value.scrollTop = 0;
      }
    });
  }
};

// 确定事件严重程度
const determineSeverity = (event: SSEEvent): 'info' | 'warning' | 'error' => {
  if (event.type === 'system_alert') {
    const alertData = event.data as any;
    return alertData.severity || 'info';
  }
  
  if (event.type === 'tool_execution') {
    const toolData = event.data as any;
    return toolData.success === false ? 'error' : 'info';
  }
  
  if (event.type === 'server_status') {
    const serverData = event.data as any;
    return serverData.status === 'error' ? 'error' : 
           serverData.status === 'disconnected' ? 'warning' : 'info';
  }
  
  if (event.type === 'health_check') {
    const healthData = event.data as any;
    return healthData.status === 'error' ? 'error' :
           healthData.status === 'warning' ? 'warning' : 'info';
  }
  
  return 'info';
};

// 提取事件消息
const extractMessage = (event: SSEEvent): string => {
  const data = event.data as any;
  
  switch (event.type) {
    case 'server_status':
      return `服务器 ${data.serverId} 状态变更为 ${data.status}`;
    
    case 'tool_execution':
      return `工具 ${data.toolName} ${data.success ? '执行成功' : '执行失败'}`;
    
    case 'system_alert':
      return data.message || '系统告警';
    
    case 'health_check':
      return `系统健康检查: ${data.status}`;
    
    default:
      return `${event.type} 事件`;
  }
};

// 连接SSE
const connect = async () => {
  try {
    await sseService.connect([
      'server_status',
      'tool_execution',
      'system_alert',
      'health_check'
    ]);
    
    // 设置事件监听器
    setupEventListeners();
    
    MessagePlugin.success('SSE连接成功');
  } catch (error) {
    console.error('SSE连接失败:', error);
    MessagePlugin.error('SSE连接失败');
  }
};

// 断开SSE
const disconnect = () => {
  sseService.disconnect();
  MessagePlugin.info('SSE连接已断开');
};

// 设置事件监听器
const setupEventListeners = () => {
  // 监听所有事件类型
  sseService.addEventListener('server_status', (event) => {
    addEvent({
      type: 'server_status',
      data: event,
      timestamp: new Date().toISOString(),
    });
  });
  
  sseService.addEventListener('tool_execution', (event) => {
    addEvent({
      type: 'tool_execution',
      data: event,
      timestamp: new Date().toISOString(),
    });
  });
  
  sseService.addEventListener('system_alert', (event) => {
    addEvent({
      type: 'system_alert',
      data: event,
      timestamp: new Date().toISOString(),
    });
  });
  
  sseService.addEventListener('health_check', (event) => {
    addEvent({
      type: 'health_check',
      data: event,
      timestamp: new Date().toISOString(),
    });
  });
};

// 处理过滤变更
const handleFilterChange = (filter: string) => {
  eventFilter.value = filter;
  displayLimit.value = 20; // 重置显示限制
};

// 清空事件
const clearEvents = () => {
  events.value = [];
  MessagePlugin.success('事件列表已清空');
};

// 加载更多事件
const loadMoreEvents = () => {
  displayLimit.value += 20;
};

// 生命周期
onMounted(() => {
  // 如果SSE已连接，设置监听器
  if (connectionState.value === 'open') {
    setupEventListeners();
  }
});

onUnmounted(() => {
  // 清理事件监听器
  sseService.removeAllEventListeners();
});
</script>

<style scoped>
.sse-monitor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.monitor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status--connecting {
  background-color: rgba(255, 159, 64, 0.1);
  color: #ff9f40;
}

.status--open {
  background-color: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.status--closed {
  background-color: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.monitor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.event-stats {
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

.events-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.events-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--td-text-color-placeholder);
}

.events-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
}

.event-item {
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid;
  background-color: var(--td-bg-color-container);
}

.event--info {
  border-left-color: #409eff;
}

.event--warning {
  border-left-color: #ff9f40;
  background-color: rgba(255, 159, 64, 0.05);
}

.event--error {
  border-left-color: #f56c6c;
  background-color: rgba(245, 108, 108, 0.05);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.event-time {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
  font-family: monospace;
}

.event-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-message {
  font-size: 13px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}

.event-details {
  margin-top: 4px;
}

.event-json {
  font-size: 11px;
  color: var(--td-text-color-secondary);
  background-color: var(--td-bg-color-container-hover);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.load-more {
  text-align: center;
  padding: 12px;
  border-top: 1px solid var(--td-border-level-1-color);
}
</style>