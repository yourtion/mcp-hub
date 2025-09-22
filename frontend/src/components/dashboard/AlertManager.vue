<template>
  <t-card title="系统告警管理" class="alert-manager">
    <template #actions>
      <div class="alert-actions">
        <!-- 告警级别过滤 -->
        <t-select 
          v-model="alertFilter.severity" 
          size="small"
          placeholder="告警级别"
          clearable
          style="width: 100px;"
          @change="handleFilterChange"
        >
          <t-option value="info" label="信息" />
          <t-option value="warning" label="警告" />
          <t-option value="error" label="错误" />
        </t-select>
        
        <!-- 状态过滤 -->
        <t-select 
          v-model="alertFilter.status" 
          size="small"
          placeholder="状态"
          clearable
          style="width: 100px;"
          @change="handleFilterChange"
        >
          <t-option value="active" label="活跃" />
          <t-option value="acknowledged" label="已确认" />
          <t-option value="resolved" label="已解决" />
        </t-select>
        
        <!-- 操作按钮 -->
        <t-button 
          theme="primary" 
          size="small"
          :loading="loading"
          @click="refreshAlerts"
        >
          <template #icon>
            <t-icon name="refresh" />
          </template>
          刷新
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          @click="showTestDialog = true"
        >
          <template #icon>
            <t-icon name="add" />
          </template>
          测试告警
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          :disabled="selectedAlerts.length === 0"
          @click="batchAcknowledge"
        >
          批量确认
        </t-button>
        
        <t-button 
          theme="default" 
          size="small"
          :disabled="selectedAlerts.length === 0"
          @click="batchResolve"
        >
          批量解决
        </t-button>
      </div>
    </template>

    <div class="alert-content">
      <!-- 告警统计 -->
      <div class="alert-stats">
        <div class="stat-card stat-card--error">
          <div class="stat-icon">
            <t-icon name="close-circle" size="20px" />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ errorAlerts.length }}</div>
            <div class="stat-label">错误告警</div>
          </div>
        </div>
        
        <div class="stat-card stat-card--warning">
          <div class="stat-icon">
            <t-icon name="error-circle" size="20px" />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ warningAlerts.length }}</div>
            <div class="stat-label">警告告警</div>
          </div>
        </div>
        
        <div class="stat-card stat-card--info">
          <div class="stat-icon">
            <t-icon name="info-circle" size="20px" />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ infoAlerts.length }}</div>
            <div class="stat-label">信息告警</div>
          </div>
        </div>
        
        <div class="stat-card stat-card--active">
          <div class="stat-icon">
            <t-icon name="notification" size="20px" />
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ activeAlerts.length }}</div>
            <div class="stat-label">活跃告警</div>
          </div>
        </div>
      </div>

      <!-- 告警列表 -->
      <div class="alert-list-container">
        <div v-if="loading && alerts.length === 0" class="alert-loading">
          <t-loading size="small" />
          <span>加载中...</span>
        </div>
        
        <div v-else-if="filteredAlerts.length === 0" class="alert-empty">
          <t-icon name="check-circle" size="32px" />
          <span>暂无告警</span>
        </div>
        
        <div v-else class="alert-list">
          <div class="alert-header">
            <t-checkbox 
              v-model="selectAll"
              :indeterminate="indeterminate"
              @change="handleSelectAll"
            >
              全选
            </t-checkbox>
            <span class="selected-count">已选择 {{ selectedAlerts.length }} 项</span>
          </div>
          
          <div class="alert-items">
            <div 
              v-for="alert in filteredAlerts" 
              :key="alert.id"
              class="alert-item"
              :class="[
                `alert--${alert.severity}`,
                `alert--${alert.status}`,
                { 'alert--selected': selectedAlerts.includes(alert.id) }
              ]"
            >
              <div class="alert-checkbox">
                <t-checkbox 
                  :value="selectedAlerts.includes(alert.id)"
                  @change="(checked) => handleSelectAlert(alert.id, checked)"
                />
              </div>
              
              <div class="alert-content-main">
                <div class="alert-header-row">
                  <div class="alert-severity">
                    <t-tag 
                      :theme="getSeverityTheme(alert.severity)" 
                      size="small"
                      variant="light"
                    >
                      {{ getSeverityText(alert.severity) }}
                    </t-tag>
                  </div>
                  
                  <div class="alert-status">
                    <t-tag 
                      :theme="getStatusTheme(alert.status)" 
                      size="small"
                    >
                      {{ getStatusText(alert.status) }}
                    </t-tag>
                  </div>
                  
                  <div class="alert-time">{{ formatTime(alert.timestamp) }}</div>
                </div>
                
                <div class="alert-message">{{ alert.message }}</div>
                
                <div class="alert-category">分类: {{ alert.category }}</div>
                
                <div v-if="alert.metadata" class="alert-metadata">
                  <t-collapse>
                    <t-collapse-panel header="详细信息">
                      <pre class="metadata-json">{{ JSON.stringify(alert.metadata, null, 2) }}</pre>
                    </t-collapse-panel>
                  </t-collapse>
                </div>
              </div>
              
              <div class="alert-actions-column">
                <t-button 
                  v-if="alert.status === 'active'"
                  theme="default" 
                  size="small"
                  @click="acknowledgeAlert(alert.id)"
                >
                  确认
                </t-button>
                
                <t-button 
                  v-if="alert.status !== 'resolved'"
                  theme="primary" 
                  size="small"
                  @click="resolveAlert(alert.id)"
                >
                  解决
                </t-button>
                
                <t-button 
                  theme="default" 
                  size="small"
                  @click="deleteAlert(alert.id)"
                >
                  删除
                </t-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试告警对话框 -->
    <t-dialog
      v-model:visible="showTestDialog"
      title="发送测试告警"
      width="500px"
      @confirm="sendTestAlert"
    >
      <t-form :data="testAlertForm" label-width="80px">
        <t-form-item label="级别">
          <t-select v-model="testAlertForm.severity">
            <t-option value="info" label="信息" />
            <t-option value="warning" label="警告" />
            <t-option value="error" label="错误" />
          </t-select>
        </t-form-item>
        
        <t-form-item label="消息">
          <t-input v-model="testAlertForm.message" placeholder="请输入告警消息" />
        </t-form-item>
        
        <t-form-item label="分类">
          <t-input v-model="testAlertForm.category" placeholder="请输入告警分类" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-card>
</template><sc
ript setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { dashboardService } from '@/services/dashboard';
import { sseService } from '@/services/sse';

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  category: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface AlertFilter {
  severity?: string;
  status?: string;
}

// 响应式数据
const loading = ref(false);
const alerts = ref<Alert[]>([]);
const selectedAlerts = ref<string[]>([]);
const showTestDialog = ref(false);

// 过滤条件
const alertFilter = ref<AlertFilter>({});

// 测试告警表单
const testAlertForm = ref({
  severity: 'info' as const,
  message: '这是一个测试告警',
  category: 'test',
});

// 计算属性
const filteredAlerts = computed(() => {
  let filtered = alerts.value;
  
  if (alertFilter.value.severity) {
    filtered = filtered.filter(alert => alert.severity === alertFilter.value.severity);
  }
  
  if (alertFilter.value.status) {
    filtered = filtered.filter(alert => alert.status === alertFilter.value.status);
  }
  
  return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
});

const errorAlerts = computed(() => alerts.value.filter(alert => alert.severity === 'error'));
const warningAlerts = computed(() => alerts.value.filter(alert => alert.severity === 'warning'));
const infoAlerts = computed(() => alerts.value.filter(alert => alert.severity === 'info'));
const activeAlerts = computed(() => alerts.value.filter(alert => alert.status === 'active'));

const selectAll = computed({
  get: () => selectedAlerts.value.length === filteredAlerts.value.length && filteredAlerts.value.length > 0,
  set: (value: boolean) => {
    if (value) {
      selectedAlerts.value = filteredAlerts.value.map(alert => alert.id);
    } else {
      selectedAlerts.value = [];
    }
  }
});

const indeterminate = computed(() => {
  return selectedAlerts.value.length > 0 && selectedAlerts.value.length < filteredAlerts.value.length;
});

// 获取严重程度主题
const getSeverityTheme = (severity: string): string => {
  const themeMap: Record<string, string> = {
    info: 'primary',
    warning: 'warning',
    error: 'danger',
  };
  return themeMap[severity] || 'default';
};

// 获取严重程度文本
const getSeverityText = (severity: string): string => {
  const textMap: Record<string, string> = {
    info: '信息',
    warning: '警告',
    error: '错误',
  };
  return textMap[severity] || severity;
};

// 获取状态主题
const getStatusTheme = (status: string): string => {
  const themeMap: Record<string, string> = {
    active: 'danger',
    acknowledged: 'warning',
    resolved: 'success',
  };
  return themeMap[status] || 'default';
};

// 获取状态文本
const getStatusText = (status: string): string => {
  const textMap: Record<string, string> = {
    active: '活跃',
    acknowledged: '已确认',
    resolved: '已解决',
  };
  return textMap[status] || status;
};

// 格式化时间
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else {
    return date.toLocaleString('zh-CN');
  }
};

// 生成模拟告警数据
const generateMockAlerts = (): Alert[] => {
  const mockAlerts: Alert[] = [
    {
      id: '1',
      severity: 'error',
      message: '服务器连接失败',
      category: 'server',
      status: 'active',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      metadata: { serverId: 'server-1', error: 'Connection timeout' },
    },
    {
      id: '2',
      severity: 'warning',
      message: 'CPU使用率过高',
      category: 'system',
      status: 'acknowledged',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      metadata: { cpuUsage: 85, threshold: 80 },
    },
    {
      id: '3',
      severity: 'info',
      message: '系统启动完成',
      category: 'system',
      status: 'resolved',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    },
  ];
  
  return mockAlerts;
};

// 刷新告警
const refreshAlerts = async () => {
  loading.value = true;
  
  try {
    // 这里应该调用实际的API，现在使用模拟数据
    await new Promise(resolve => setTimeout(resolve, 500));
    alerts.value = generateMockAlerts();
  } catch (error) {
    console.error('获取告警失败:', error);
    MessagePlugin.error('获取告警失败');
  } finally {
    loading.value = false;
  }
};

// 处理过滤变更
const handleFilterChange = () => {
  selectedAlerts.value = [];
};

// 处理全选
const handleSelectAll = (checked: boolean) => {
  selectAll.value = checked;
};

// 处理单个选择
const handleSelectAlert = (alertId: string, checked: boolean) => {
  if (checked) {
    if (!selectedAlerts.value.includes(alertId)) {
      selectedAlerts.value.push(alertId);
    }
  } else {
    const index = selectedAlerts.value.indexOf(alertId);
    if (index > -1) {
      selectedAlerts.value.splice(index, 1);
    }
  }
};

// 确认告警
const acknowledgeAlert = (alertId: string) => {
  const alert = alerts.value.find(a => a.id === alertId);
  if (alert) {
    alert.status = 'acknowledged';
    MessagePlugin.success('告警已确认');
  }
};

// 解决告警
const resolveAlert = (alertId: string) => {
  const alert = alerts.value.find(a => a.id === alertId);
  if (alert) {
    alert.status = 'resolved';
    MessagePlugin.success('告警已解决');
  }
};

// 删除告警
const deleteAlert = (alertId: string) => {
  const index = alerts.value.findIndex(a => a.id === alertId);
  if (index > -1) {
    alerts.value.splice(index, 1);
    MessagePlugin.success('告警已删除');
  }
};

// 批量确认
const batchAcknowledge = () => {
  selectedAlerts.value.forEach(alertId => {
    const alert = alerts.value.find(a => a.id === alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged';
    }
  });
  selectedAlerts.value = [];
  MessagePlugin.success('批量确认成功');
};

// 批量解决
const batchResolve = () => {
  selectedAlerts.value.forEach(alertId => {
    const alert = alerts.value.find(a => a.id === alertId);
    if (alert && alert.status !== 'resolved') {
      alert.status = 'resolved';
    }
  });
  selectedAlerts.value = [];
  MessagePlugin.success('批量解决成功');
};

// 发送测试告警
const sendTestAlert = async () => {
  try {
    await dashboardService.sendTestAlert(
      testAlertForm.value.severity,
      testAlertForm.value.message,
      testAlertForm.value.category
    );
    
    // 添加到本地列表
    const newAlert: Alert = {
      id: `test_${Date.now()}`,
      severity: testAlertForm.value.severity,
      message: testAlertForm.value.message,
      category: testAlertForm.value.category,
      status: 'active',
      timestamp: new Date().toISOString(),
      metadata: { test: true },
    };
    
    alerts.value.unshift(newAlert);
    showTestDialog.value = false;
    MessagePlugin.success('测试告警已发送');
  } catch (error) {
    console.error('发送测试告警失败:', error);
    MessagePlugin.error('发送测试告警失败');
  }
};

// 设置SSE事件监听
const setupSSEListener = () => {
  sseService.onSystemAlert((data) => {
    const newAlert: Alert = {
      id: `sse_${Date.now()}_${Math.random()}`,
      severity: data.severity,
      message: data.message,
      category: data.category,
      status: 'active',
      timestamp: new Date().toISOString(),
      metadata: data.metadata,
    };
    
    alerts.value.unshift(newAlert);
    
    // 限制告警数量
    if (alerts.value.length > 100) {
      alerts.value = alerts.value.slice(0, 100);
    }
  });
};

// 生命周期
onMounted(() => {
  refreshAlerts();
  setupSSEListener();
});

onUnmounted(() => {
  // 清理SSE监听器
  sseService.removeEventListener('system_alert', () => {});
});
</script>

<style scoped>
.alert-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.alert-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.alert-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 6px;
  background-color: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
}

.stat-card--error {
  border-left: 4px solid #f56c6c;
}

.stat-card--warning {
  border-left: 4px solid #ff9f40;
}

.stat-card--info {
  border-left: 4px solid #409eff;
}

.stat-card--active {
  border-left: 4px solid #909399;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--td-bg-color-container-hover);
}

.stat-card--error .stat-icon {
  color: #f56c6c;
}

.stat-card--warning .stat-icon {
  color: #ff9f40;
}

.stat-card--info .stat-icon {
  color: #409eff;
}

.stat-card--active .stat-icon {
  color: #909399;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.alert-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.alert-loading,
.alert-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--td-text-color-placeholder);
}

.alert-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--td-bg-color-container-hover);
  border-radius: 6px;
  margin-bottom: 12px;
}

.selected-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.alert-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 500px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid;
  background-color: var(--td-bg-color-container);
  transition: all 0.2s ease;
}

.alert-item:hover {
  background-color: var(--td-bg-color-container-hover);
}

.alert--info {
  border-left-color: #409eff;
}

.alert--warning {
  border-left-color: #ff9f40;
  background-color: rgba(255, 159, 64, 0.03);
}

.alert--error {
  border-left-color: #f56c6c;
  background-color: rgba(245, 108, 108, 0.03);
}

.alert--selected {
  background-color: rgba(64, 158, 255, 0.1);
}

.alert-checkbox {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content-main {
  flex: 1;
  min-width: 0;
}

.alert-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.alert-severity {
  flex-shrink: 0;
}

.alert-status {
  flex-shrink: 0;
}

.alert-time {
  flex: 1;
  text-align: right;
  font-size: 11px;
  color: var(--td-text-color-placeholder);
}

.alert-message {
  font-size: 14px;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
  word-break: break-word;
}

.alert-category {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 8px;
}

.alert-metadata {
  margin-top: 8px;
}

.metadata-json {
  font-size: 11px;
  color: var(--td-text-color-secondary);
  background-color: var(--td-bg-color-container-hover);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 150px;
  overflow-y: auto;
}

.alert-actions-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .alert-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .alert-stats {
    grid-template-columns: 1fr;
  }
  
  .alert-item {
    flex-direction: column;
    align-items: stretch;
  }
  
  .alert-actions-column {
    flex-direction: row;
    justify-content: flex-end;
  }
  
  .alert-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .alert-time {
    text-align: left;
  }
}
</style>