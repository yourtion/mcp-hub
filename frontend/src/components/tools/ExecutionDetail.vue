<template>
  <div class="execution-detail">
    <div class="execution-header">
      <t-descriptions :column="2" size="small">
        <t-descriptions-item label="执行ID">
          {{ execution.executionId }}
        </t-descriptions-item>
        
        <t-descriptions-item label="工具名称">
          {{ execution.toolName }}
        </t-descriptions-item>
        
        <t-descriptions-item label="服务器">
          {{ execution.serverId }}
        </t-descriptions-item>
        
        <t-descriptions-item label="组ID">
          {{ execution.groupId }}
        </t-descriptions-item>
        
        <t-descriptions-item label="执行状态">
          <t-tag
            :theme="execution.isError ? 'danger' : 'success'"
            variant="light"
          >
            {{ execution.isError ? '执行失败' : '执行成功' }}
          </t-tag>
        </t-descriptions-item>
        
        <t-descriptions-item label="执行时间">
          {{ execution.executionTime }}ms
        </t-descriptions-item>
        
        <t-descriptions-item label="时间戳">
          {{ formatTime(execution.timestamp) }}
        </t-descriptions-item>
      </t-descriptions>
    </div>

    <t-divider />

    <div class="execution-content">
      <t-tabs v-model="activeTab">
        <!-- 执行参数 -->
        <t-tab-panel value="arguments" label="执行参数">
          <div class="arguments-content">
            <div class="content-header">
              <h4>输入参数</h4>
              <t-button
                variant="text"
                size="small"
                @click="copyArguments"
              >
                复制参数
              </t-button>
            </div>
            
            <t-textarea
              :value="formattedArguments"
              readonly
              :autosize="{ minRows: 5, maxRows: 15 }"
              class="json-content"
            />
          </div>
        </t-tab-panel>

        <!-- 执行结果 -->
        <t-tab-panel value="result" label="执行结果">
          <div class="result-content">
            <div class="content-header">
              <h4>执行结果</h4>
              <t-space>
                <t-button
                  variant="text"
                  size="small"
                  @click="copyResult"
                >
                  复制结果
                </t-button>
                
                <t-button
                  variant="text"
                  size="small"
                  @click="exportResult"
                >
                  导出结果
                </t-button>
              </t-space>
            </div>

            <!-- 格式化结果显示 -->
            <div class="formatted-results">
              <div
                v-for="(item, index) in execution.result"
                :key="index"
                class="result-item"
              >
                <div class="result-item-header">
                  <t-tag size="small" variant="outline">
                    {{ item.type }}
                  </t-tag>
                  <span class="result-index">#{{ index + 1 }}</span>
                </div>

                <!-- 文本结果 -->
                <div v-if="item.type === 'text'" class="text-result">
                  <pre>{{ item.text }}</pre>
                </div>

                <!-- 图片结果 -->
                <div v-else-if="item.type === 'image'" class="image-result">
                  <img 
                    :src="item.data" 
                    :alt="`Result image ${index + 1}`"
                    @click="previewImage(item.data)"
                  />
                  <div class="image-info">
                    <span>MIME类型: {{ item.mimeType || '未知' }}</span>
                  </div>
                </div>

                <!-- 资源结果 -->
                <div v-else-if="item.type === 'resource'" class="resource-result">
                  <div class="resource-info">
                    <t-link :href="item.uri" target="_blank">
                      {{ item.uri }}
                    </t-link>
                    <span v-if="item.mimeType" class="mime-type">
                      ({{ item.mimeType }})
                    </span>
                  </div>
                </div>

                <!-- 其他类型结果 -->
                <div v-else class="unknown-result">
                  <pre>{{ JSON.stringify(item, null, 2) }}</pre>
                </div>
              </div>
            </div>

            <!-- 原始JSON结果 -->
            <t-collapse class="raw-result-collapse">
              <t-collapse-panel header="查看原始JSON" value="raw">
                <t-textarea
                  :value="formattedResult"
                  readonly
                  :autosize="{ minRows: 10, maxRows: 30 }"
                  class="json-content"
                />
              </t-collapse-panel>
            </t-collapse>
          </div>
        </t-tab-panel>

        <!-- 执行日志 -->
        <t-tab-panel value="logs" label="执行日志">
          <div class="logs-content">
            <div class="content-header">
              <h4>执行日志</h4>
              <t-button
                variant="text"
                size="small"
                @click="refreshLogs"
              >
                刷新日志
              </t-button>
            </div>

            <div v-if="executionLogs.length > 0" class="logs-list">
              <div
                v-for="(log, index) in executionLogs"
                :key="index"
                class="log-item"
                :class="`log-${log.level}`"
              >
                <div class="log-header">
                  <span class="log-timestamp">{{ formatTime(log.timestamp) }}</span>
                  <t-tag
                    :theme="getLogTheme(log.level)"
                    size="small"
                    variant="light"
                  >
                    {{ log.level.toUpperCase() }}
                  </t-tag>
                </div>
                <div class="log-message">{{ log.message }}</div>
                <div v-if="log.details" class="log-details">
                  <t-collapse>
                    <t-collapse-panel header="查看详情" value="details">
                      <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
                    </t-collapse-panel>
                  </t-collapse>
                </div>
              </div>
            </div>

            <div v-else class="no-logs">
              <t-empty description="暂无执行日志" />
            </div>
          </div>
        </t-tab-panel>

        <!-- 性能分析 -->
        <t-tab-panel value="performance" label="性能分析">
          <div class="performance-content">
            <div class="content-header">
              <h4>性能指标</h4>
            </div>

            <div class="performance-metrics">
              <t-row :gutter="16">
                <t-col :span="6">
                  <t-card size="small">
                    <div class="metric-item">
                      <div class="metric-value">{{ execution.executionTime }}ms</div>
                      <div class="metric-label">总执行时间</div>
                    </div>
                  </t-card>
                </t-col>
                
                <t-col :span="6">
                  <t-card size="small">
                    <div class="metric-item">
                      <div class="metric-value">{{ performanceMetrics.networkTime }}ms</div>
                      <div class="metric-label">网络耗时</div>
                    </div>
                  </t-card>
                </t-col>
                
                <t-col :span="6">
                  <t-card size="small">
                    <div class="metric-item">
                      <div class="metric-value">{{ performanceMetrics.processingTime }}ms</div>
                      <div class="metric-label">处理耗时</div>
                    </div>
                  </t-card>
                </t-col>
                
                <t-col :span="6">
                  <t-card size="small">
                    <div class="metric-item">
                      <div class="metric-value">{{ performanceMetrics.resultSize }}</div>
                      <div class="metric-label">结果大小</div>
                    </div>
                  </t-card>
                </t-col>
              </t-row>
            </div>

            <!-- 性能时间线 -->
            <div class="performance-timeline">
              <h5>执行时间线</h5>
              <div class="timeline-chart">
                <div
                  v-for="(phase, index) in performanceTimeline"
                  :key="index"
                  class="timeline-phase"
                  :style="{ width: `${phase.percentage}%` }"
                >
                  <div class="phase-bar" :class="`phase-${phase.type}`"></div>
                  <div class="phase-label">
                    {{ phase.name }} ({{ phase.duration }}ms)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </div>

    <!-- 操作按钮 -->
    <div class="execution-actions">
      <t-space>
        <t-button
          theme="primary"
          @click="rerunExecution"
        >
          重新执行
        </t-button>
        
        <t-button
          variant="outline"
          @click="copyExecutionInfo"
        >
          复制执行信息
        </t-button>
        
        <t-button
          variant="outline"
          @click="exportExecution"
        >
          导出执行记录
        </t-button>
        
        <t-button
          variant="text"
          @click="$emit('close')"
        >
          关闭
        </t-button>
      </t-space>
    </div>

    <!-- 图片预览对话框 -->
    <t-dialog
      v-model:visible="showImagePreview"
      title="图片预览"
      width="80%"
      :footer="false"
    >
      <div class="image-preview">
        <img :src="previewImageUrl" alt="Preview" />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import type { ToolExecution } from '@/types/tool';

// Props
interface Props {
  execution: ToolExecution;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  close: [];
  rerun: [execution: ToolExecution];
}>();

// Store
const toolStore = useToolStore();

// 响应式数据
const activeTab = ref('arguments');
const executionLogs = ref<Array<{
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
}>>([]);
const showImagePreview = ref(false);
const previewImageUrl = ref('');

// 计算属性
const formattedArguments = computed(() => {
  return JSON.stringify(props.execution.arguments, null, 2);
});

const formattedResult = computed(() => {
  return JSON.stringify(props.execution.result, null, 2);
});

const performanceMetrics = computed(() => {
  const totalTime = props.execution.executionTime;
  
  // 模拟性能指标分解
  const networkTime = Math.round(totalTime * 0.3);
  const processingTime = totalTime - networkTime;
  const resultSize = formatBytes(JSON.stringify(props.execution.result).length);
  
  return {
    networkTime,
    processingTime,
    resultSize,
  };
});

const performanceTimeline = computed(() => {
  const totalTime = props.execution.executionTime;
  
  return [
    {
      name: '请求发送',
      type: 'request',
      duration: Math.round(totalTime * 0.1),
      percentage: 10,
    },
    {
      name: '网络传输',
      type: 'network',
      duration: Math.round(totalTime * 0.2),
      percentage: 20,
    },
    {
      name: '服务器处理',
      type: 'processing',
      duration: Math.round(totalTime * 0.6),
      percentage: 60,
    },
    {
      name: '响应接收',
      type: 'response',
      duration: Math.round(totalTime * 0.1),
      percentage: 10,
    },
  ];
});

// 方法
const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

const copyArguments = async () => {
  try {
    await navigator.clipboard.writeText(formattedArguments.value);
    MessagePlugin.success('参数已复制到剪贴板');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const copyResult = async () => {
  try {
    await navigator.clipboard.writeText(formattedResult.value);
    MessagePlugin.success('结果已复制到剪贴板');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const exportResult = () => {
  const data = {
    executionId: props.execution.executionId,
    toolName: props.execution.toolName,
    timestamp: props.execution.timestamp,
    result: props.execution.result,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `execution-result-${props.execution.executionId}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  MessagePlugin.success('结果已导出');
};

const previewImage = (imageUrl: string) => {
  previewImageUrl.value = imageUrl;
  showImagePreview.value = true;
};

const refreshLogs = async () => {
  // 模拟加载执行日志
  executionLogs.value = [
    {
      timestamp: props.execution.timestamp,
      level: 'info',
      message: '开始执行工具',
      details: {
        toolName: props.execution.toolName,
        serverId: props.execution.serverId,
      },
    },
    {
      timestamp: new Date(Date.now() - 1000).toISOString(),
      level: 'debug',
      message: '参数验证通过',
      details: props.execution.arguments,
    },
    {
      timestamp: new Date(Date.now() - 500).toISOString(),
      level: props.execution.isError ? 'error' : 'info',
      message: props.execution.isError ? '执行失败' : '执行成功',
      details: props.execution.result,
    },
  ];
};

const rerunExecution = async () => {
  try {
    await toolStore.executeTool(props.execution.toolName, {
      arguments: props.execution.arguments,
      serverId: props.execution.serverId,
      groupId: props.execution.groupId,
    });
    
    MessagePlugin.success('工具重新执行成功');
    emit('rerun', props.execution);
  } catch (err) {
    MessagePlugin.error('工具执行失败');
  }
};

const copyExecutionInfo = async () => {
  const info = {
    executionId: props.execution.executionId,
    toolName: props.execution.toolName,
    serverId: props.execution.serverId,
    groupId: props.execution.groupId,
    timestamp: props.execution.timestamp,
    executionTime: props.execution.executionTime,
    isError: props.execution.isError,
    arguments: props.execution.arguments,
    result: props.execution.result,
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    MessagePlugin.success('执行信息已复制');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const exportExecution = () => {
  const data = {
    executionId: props.execution.executionId,
    toolName: props.execution.toolName,
    serverId: props.execution.serverId,
    groupId: props.execution.groupId,
    timestamp: props.execution.timestamp,
    executionTime: props.execution.executionTime,
    isError: props.execution.isError,
    arguments: props.execution.arguments,
    result: props.execution.result,
    logs: executionLogs.value,
    performance: performanceMetrics.value,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `execution-${props.execution.executionId}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  MessagePlugin.success('执行记录已导出');
};

// 组件挂载时加载日志
onMounted(() => {
  refreshLogs();
});
</script>

<style scoped>
.execution-detail {
  padding: 16px;
}

.execution-header {
  margin-bottom: 16px;
}

.execution-content {
  margin-bottom: 24px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.content-header h4 {
  margin: 0;
  font-size: 16px;
}

.json-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.formatted-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.result-item {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  overflow: hidden;
}

.result-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--td-bg-color-container-hover);
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.result-index {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.text-result {
  padding: 12px;
}

.text-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.image-result {
  padding: 12px;
  text-align: center;
}

.image-result img {
  max-width: 100%;
  max-height: 300px;
  cursor: pointer;
  border-radius: var(--td-radius-default);
  transition: transform 0.2s ease;
}

.image-result img:hover {
  transform: scale(1.02);
}

.image-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.resource-result {
  padding: 12px;
}

.resource-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mime-type {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.unknown-result {
  padding: 12px;
}

.unknown-result pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.raw-result-collapse {
  margin-top: 16px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  padding: 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  border-left-width: 4px;
}

.log-item.log-info {
  border-left-color: var(--td-primary-color);
}

.log-item.log-warn {
  border-left-color: var(--td-warning-color);
}

.log-item.log-error {
  border-left-color: var(--td-error-color);
}

.log-item.log-debug {
  border-left-color: var(--td-gray-color-6);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-timestamp {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.log-message {
  font-size: 14px;
  line-height: 1.4;
}

.log-details {
  margin-top: 8px;
}

.log-details pre {
  margin: 0;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.no-logs {
  padding: 32px;
  text-align: center;
}

.performance-metrics {
  margin-bottom: 24px;
}

.metric-item {
  text-align: center;
}

.metric-value {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.performance-timeline {
  margin-top: 24px;
}

.performance-timeline h5 {
  margin-bottom: 16px;
  font-size: 14px;
}

.timeline-chart {
  display: flex;
  height: 40px;
  border-radius: var(--td-radius-default);
  overflow: hidden;
  border: 1px solid var(--td-border-level-1-color);
}

.timeline-phase {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.phase-bar.phase-request {
  background: var(--td-primary-color-1);
}

.phase-bar.phase-network {
  background: var(--td-warning-color-1);
}

.phase-bar.phase-processing {
  background: var(--td-success-color-1);
}

.phase-bar.phase-response {
  background: var(--td-info-color-1);
}

.phase-label {
  position: relative;
  z-index: 1;
  font-size: 10px;
  color: var(--td-text-color-primary);
  text-align: center;
  padding: 0 4px;
}

.execution-actions {
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.image-preview {
  text-align: center;
}

.image-preview img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

:deep(.t-descriptions-item__label) {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

:deep(.t-descriptions-item__content) {
  font-size: 12px;
}
</style>