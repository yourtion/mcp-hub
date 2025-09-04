<template>
  <div class="connection-monitor">
    <div class="monitor-header">
      <h4>连接监控</h4>
      <div class="monitor-actions">
        <t-switch
          v-model="autoRefresh"
          size="small"
        />
        <span class="auto-refresh-label">自动刷新</span>
        <t-button
          theme="default"
          variant="text"
          size="small"
          :loading="refreshing"
          @click="handleManualRefresh"
        >
          <RefreshIcon />
        </t-button>
      </div>
    </div>

    <div class="connection-status">
      <div class="status-item">
        <div class="status-label">连接状态</div>
        <StatusTag :status="server.status" />
      </div>

      <div v-if="server.lastConnected" class="status-item">
        <div class="status-label">最后连接</div>
        <div class="status-value">{{ formatTime(server.lastConnected) }}</div>
      </div>

      <div v-if="server.reconnectAttempts" class="status-item">
        <div class="status-label">重连次数</div>
        <div class="status-value">{{ server.reconnectAttempts }}</div>
      </div>

      <div class="status-item">
        <div class="status-label">工具数量</div>
        <div class="status-value">{{ server.toolCount }}</div>
      </div>
    </div>

    <div class="connection-actions">
      <t-button
        v-if="server.status === 'disconnected' || server.status === 'error'"
        theme="success"
        :loading="connecting"
        @click="handleConnect"
      >
        <template #icon>
          <LinkIcon />
        </template>
        连接服务器
      </t-button>

      <t-button
        v-else-if="server.status === 'connected'"
        theme="danger"
        :loading="disconnecting"
        @click="handleDisconnect"
      >
        <template #icon>
          <LinkUnlinkIcon />
        </template>
        断开连接
      </t-button>

      <t-button
        v-else-if="server.status === 'connecting'"
        theme="warning"
        disabled
      >
        <template #icon>
          <LoadingIcon />
        </template>
        连接中...
      </t-button>

      <t-button
        v-if="server.status === 'error'"
        theme="default"
        variant="outline"
        @click="handleRetry"
      >
        <template #icon>
          <RefreshIcon />
        </template>
        重试连接
      </t-button>
    </div>

    <div v-if="server.lastError" class="error-info">
      <div class="error-header">
        <ErrorCircleIcon />
        <span>连接错误</span>
      </div>
      <div class="error-message">{{ server.lastError }}</div>
    </div>

    <!-- 连接历史 -->
    <div v-if="connectionHistory.length" class="connection-history">
      <h5>连接历史</h5>
      <div class="history-list">
        <div 
          v-for="(record, index) in connectionHistory" 
          :key="index"
          class="history-item"
        >
          <div class="history-time">{{ formatTime(record.timestamp) }}</div>
          <div class="history-action">
            <StatusTag :status="record.status" />
            <span class="history-message">{{ record.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  LinkIcon,
  LinkUnlinkIcon,
  LoadingIcon,
  ErrorCircleIcon,
} from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import StatusTag from '@/components/common/StatusTag.vue';
import type { ServerInfo, ServerStatus } from '@/types/server';

interface Props {
  server: ServerInfo;
}

interface ConnectionRecord {
  timestamp: string;
  status: ServerStatus;
  message: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  statusChange: [status: ServerStatus];
}>();

// 状态管理
const serverStore = useServerStore();
const { connectServer, disconnectServer, refreshServerStatus } = serverStore;

// 本地状态
const autoRefresh = ref(true);
const refreshing = ref(false);
const connecting = ref(false);
const disconnecting = ref(false);
const connectionHistory = ref<ConnectionRecord[]>([]);

// 定时器
let refreshTimer: NodeJS.Timeout | null = null;

// 工具函数
const formatTime = (timeStr: string): string => {
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const addConnectionRecord = (status: ServerStatus, message: string) => {
  connectionHistory.value.unshift({
    timestamp: new Date().toISOString(),
    status,
    message,
  });
  
  // 保持最多10条记录
  if (connectionHistory.value.length > 10) {
    connectionHistory.value = connectionHistory.value.slice(0, 10);
  }
};

// 事件处理
const handleConnect = async () => {
  try {
    connecting.value = true;
    addConnectionRecord('connecting', '开始连接服务器...');
    
    await connectServer(props.server.id);
    
    // 等待状态更新
    setTimeout(async () => {
      await handleManualRefresh();
      const currentStatus = serverStore.servers.get(props.server.id)?.status;
      
      if (currentStatus === 'connected') {
        addConnectionRecord('connected', '服务器连接成功');
        MessagePlugin.success('服务器连接成功');
      } else if (currentStatus === 'error') {
        addConnectionRecord('error', '服务器连接失败');
        MessagePlugin.error('服务器连接失败');
      }
      
      emit('statusChange', currentStatus || 'error');
    }, 2000);
  } catch (err) {
    addConnectionRecord('error', err instanceof Error ? err.message : '连接失败');
    MessagePlugin.error(err instanceof Error ? err.message : '连接失败');
  } finally {
    connecting.value = false;
  }
};

const handleDisconnect = async () => {
  try {
    disconnecting.value = true;
    addConnectionRecord('disconnected', '断开服务器连接...');
    
    await disconnectServer(props.server.id);
    
    // 等待状态更新
    setTimeout(async () => {
      await handleManualRefresh();
      addConnectionRecord('disconnected', '服务器已断开连接');
      MessagePlugin.success('服务器已断开连接');
      emit('statusChange', 'disconnected');
    }, 1000);
  } catch (err) {
    addConnectionRecord('error', err instanceof Error ? err.message : '断开连接失败');
    MessagePlugin.error(err instanceof Error ? err.message : '断开连接失败');
  } finally {
    disconnecting.value = false;
  }
};

const handleRetry = async () => {
  await handleConnect();
};

const handleManualRefresh = async () => {
  try {
    refreshing.value = true;
    await refreshServerStatus(props.server.id);
  } catch (err) {
    console.error('刷新服务器状态失败:', err);
  } finally {
    refreshing.value = false;
  }
};

const startAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  if (autoRefresh.value) {
    refreshTimer = setInterval(() => {
      handleManualRefresh();
    }, 10000); // 10秒刷新一次
  }
};

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 监听器
watch(() => autoRefresh.value, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

watch(() => props.server.status, (newStatus, oldStatus) => {
  if (oldStatus && newStatus !== oldStatus) {
    emit('statusChange', newStatus);
  }
});

// 生命周期
onMounted(() => {
  // 初始化连接记录
  if (props.server.lastConnected) {
    addConnectionRecord(
      props.server.status, 
      `服务器状态: ${props.server.status}`
    );
  }
  
  // 开始自动刷新
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.connection-monitor {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.monitor-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.monitor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-refresh-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.connection-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 13px;
  color: var(--td-text-color-secondary);
}

.status-value {
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.connection-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.error-info {
  background: var(--td-error-color-1);
  border: 1px solid var(--td-error-color-3);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-error-color);
}

.error-message {
  font-size: 12px;
  color: var(--td-error-color-7);
  line-height: 1.4;
}

.connection-history h5 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.history-item:last-child {
  border-bottom: none;
}

.history-time {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.history-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-message {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>