<template>
  <div class="auto-reconnect-manager">
    <div class="manager-header">
      <h4>自动重连设置</h4>
      <t-switch
        v-model="autoReconnectEnabled"
        @change="handleToggleAutoReconnect"
      />
    </div>

    <div v-if="autoReconnectEnabled" class="reconnect-config">
      <div class="config-item">
        <label>重连间隔 (秒)</label>
        <t-input-number
          v-model="reconnectInterval"
          :min="5"
          :max="300"
          :step="5"
          @change="handleConfigChange"
        />
      </div>

      <div class="config-item">
        <label>最大重连次数</label>
        <t-input-number
          v-model="maxReconnectAttempts"
          :min="1"
          :max="50"
          @change="handleConfigChange"
        />
      </div>

      <div class="config-item">
        <label>重连条件</label>
        <t-checkbox-group v-model="reconnectConditions" @change="handleConfigChange">
          <t-checkbox value="on_error">连接错误时</t-checkbox>
          <t-checkbox value="on_disconnect">意外断开时</t-checkbox>
          <t-checkbox value="on_startup">启动时</t-checkbox>
        </t-checkbox-group>
      </div>
    </div>

    <div v-if="reconnectStatus.isReconnecting" class="reconnect-status">
      <div class="status-header">
        <LoadingIcon class="spinning" />
        <span>正在重连...</span>
      </div>
      <div class="status-details">
        <div>尝试次数: {{ reconnectStatus.currentAttempt }} / {{ maxReconnectAttempts }}</div>
        <div>下次重连: {{ reconnectStatus.nextAttemptIn }}秒</div>
      </div>
      <t-button
        theme="danger"
        variant="text"
        size="small"
        @click="handleStopReconnect"
      >
        停止重连
      </t-button>
    </div>

    <div v-if="reconnectHistory.length" class="reconnect-history">
      <h5>重连历史</h5>
      <div class="history-list">
        <div 
          v-for="(record, index) in reconnectHistory" 
          :key="index"
          class="history-item"
        >
          <div class="history-time">{{ formatTime(record.timestamp) }}</div>
          <div class="history-info">
            <t-tag 
              :theme="record.success ? 'success' : 'danger'"
              size="small"
            >
              {{ record.success ? '成功' : '失败' }}
            </t-tag>
            <span class="history-message">{{ record.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { LoadingIcon } from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import type { ServerInfo, ServerStatus } from '@/types/server';

interface Props {
  server: ServerInfo;
}

interface ReconnectRecord {
  timestamp: string;
  success: boolean;
  message: string;
  attempt: number;
}

interface ReconnectStatus {
  isReconnecting: boolean;
  currentAttempt: number;
  nextAttemptIn: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  reconnectSuccess: [];
  reconnectFailed: [];
}>();

// 状态管理
const serverStore = useServerStore();
const { connectServer } = serverStore;

// 本地状态
const autoReconnectEnabled = ref(false);
const reconnectInterval = ref(30); // 秒
const maxReconnectAttempts = ref(5);
const reconnectConditions = ref<string[]>(['on_error', 'on_disconnect']);
const reconnectStatus = ref<ReconnectStatus>({
  isReconnecting: false,
  currentAttempt: 0,
  nextAttemptIn: 0,
});
const reconnectHistory = ref<ReconnectRecord[]>([]);

// 定时器
let reconnectTimer: NodeJS.Timeout | null = null;
let countdownTimer: NodeJS.Timeout | null = null;

// 工具函数
const formatTime = (timeStr: string): string => {
  return new Date(timeStr).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const addReconnectRecord = (success: boolean, message: string, attempt: number) => {
  reconnectHistory.value.unshift({
    timestamp: new Date().toISOString(),
    success,
    message,
    attempt,
  });
  
  // 保持最多20条记录
  if (reconnectHistory.value.length > 20) {
    reconnectHistory.value = reconnectHistory.value.slice(0, 20);
  }
};

const shouldReconnect = (status: ServerStatus): boolean => {
  if (!autoReconnectEnabled.value) return false;
  
  if (status === 'error' && reconnectConditions.value.includes('on_error')) {
    return true;
  }
  
  if (status === 'disconnected' && reconnectConditions.value.includes('on_disconnect')) {
    return true;
  }
  
  return false;
};

const startReconnect = () => {
  if (reconnectStatus.value.isReconnecting) return;
  
  reconnectStatus.value.isReconnecting = true;
  reconnectStatus.value.currentAttempt = 0;
  
  scheduleNextReconnect();
};

const scheduleNextReconnect = () => {
  if (reconnectStatus.value.currentAttempt >= maxReconnectAttempts.value) {
    stopReconnect();
    addReconnectRecord(
      false, 
      `达到最大重连次数 (${maxReconnectAttempts.value})，停止重连`, 
      reconnectStatus.value.currentAttempt
    );
    MessagePlugin.warning('自动重连已停止：达到最大重连次数');
    emit('reconnectFailed');
    return;
  }
  
  reconnectStatus.value.nextAttemptIn = reconnectInterval.value;
  
  // 倒计时
  countdownTimer = setInterval(() => {
    reconnectStatus.value.nextAttemptIn--;
    
    if (reconnectStatus.value.nextAttemptIn <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      attemptReconnect();
    }
  }, 1000);
};

const attemptReconnect = async () => {
  reconnectStatus.value.currentAttempt++;
  
  try {
    addReconnectRecord(
      false, 
      `第 ${reconnectStatus.value.currentAttempt} 次重连尝试...`, 
      reconnectStatus.value.currentAttempt
    );
    
    await connectServer(props.server.id);
    
    // 等待连接结果
    setTimeout(() => {
      const currentServer = serverStore.servers.get(props.server.id);
      if (currentServer?.status === 'connected') {
        addReconnectRecord(
          true, 
          `第 ${reconnectStatus.value.currentAttempt} 次重连成功`, 
          reconnectStatus.value.currentAttempt
        );
        stopReconnect();
        MessagePlugin.success('自动重连成功');
        emit('reconnectSuccess');
      } else {
        // 继续重连
        scheduleNextReconnect();
      }
    }, 3000);
  } catch (err) {
    addReconnectRecord(
      false, 
      `第 ${reconnectStatus.value.currentAttempt} 次重连失败: ${err instanceof Error ? err.message : '未知错误'}`, 
      reconnectStatus.value.currentAttempt
    );
    
    // 继续重连
    scheduleNextReconnect();
  }
};

const stopReconnect = () => {
  reconnectStatus.value.isReconnecting = false;
  reconnectStatus.value.currentAttempt = 0;
  reconnectStatus.value.nextAttemptIn = 0;
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

// 事件处理
const handleToggleAutoReconnect = (enabled: boolean) => {
  if (!enabled) {
    stopReconnect();
  }
  
  // 保存配置到本地存储
  localStorage.setItem(`autoReconnect_${props.server.id}`, JSON.stringify({
    enabled,
    interval: reconnectInterval.value,
    maxAttempts: maxReconnectAttempts.value,
    conditions: reconnectConditions.value,
  }));
};

const handleConfigChange = () => {
  // 保存配置
  handleToggleAutoReconnect(autoReconnectEnabled.value);
};

const handleStopReconnect = () => {
  stopReconnect();
  MessagePlugin.info('已停止自动重连');
};

// 加载保存的配置
const loadConfig = () => {
  try {
    const saved = localStorage.getItem(`autoReconnect_${props.server.id}`);
    if (saved) {
      const config = JSON.parse(saved);
      autoReconnectEnabled.value = config.enabled || false;
      reconnectInterval.value = config.interval || 30;
      maxReconnectAttempts.value = config.maxAttempts || 5;
      reconnectConditions.value = config.conditions || ['on_error', 'on_disconnect'];
    }
  } catch (err) {
    console.error('加载自动重连配置失败:', err);
  }
};

// 监听服务器状态变化
watch(() => props.server.status, (newStatus, oldStatus) => {
  if (oldStatus && shouldReconnect(newStatus)) {
    // 延迟启动重连，避免频繁重连
    setTimeout(() => {
      if (shouldReconnect(props.server.status)) {
        startReconnect();
      }
    }, 2000);
  } else if (newStatus === 'connected') {
    // 连接成功时停止重连
    stopReconnect();
  }
});

// 生命周期
onMounted(() => {
  loadConfig();
  
  // 如果启动时需要重连且服务器未连接
  if (autoReconnectEnabled.value && 
      reconnectConditions.value.includes('on_startup') &&
      (props.server.status === 'disconnected' || props.server.status === 'error')) {
    setTimeout(() => {
      startReconnect();
    }, 5000); // 延迟5秒启动
  }
});

onUnmounted(() => {
  stopReconnect();
});
</script>

<style scoped>
.auto-reconnect-manager {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.manager-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.reconnect-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-item label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  font-weight: 500;
}

.reconnect-status {
  background: var(--td-warning-color-1);
  border: 1px solid var(--td-warning-color-3);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-warning-color);
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--td-warning-color-7);
}

.reconnect-history h5 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
}

.history-list {
  max-height: 150px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.history-item:last-child {
  border-bottom: none;
}

.history-time {
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.history-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-message {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>