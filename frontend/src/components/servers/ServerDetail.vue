<template>
  <div class="server-detail">
    <!-- 服务器基本信息 -->
    <div class="server-detail__section">
      <h3 class="section-title">基本信息</h3>
      <div class="server-info">
        <div class="info-row">
          <span class="info-label">服务器ID:</span>
          <span class="info-value">{{ server.id }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">名称:</span>
          <span class="info-value">{{ server.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">类型:</span>
          <t-tag variant="light">{{ getTypeLabel(server.type) }}</t-tag>
        </div>
        <div class="info-row">
          <span class="info-label">状态:</span>
          <StatusTag :status="server.status" />
        </div>
        <div class="info-row">
          <span class="info-label">工具数量:</span>
          <span class="info-value">{{ server.toolCount }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">最后连接:</span>
          <span class="info-value">{{ formatLastConnected(server.lastConnected) }}</span>
        </div>
        <div v-if="server.reconnectAttempts" class="info-row">
          <span class="info-label">重连次数:</span>
          <span class="info-value">{{ server.reconnectAttempts }}</span>
        </div>
        <div v-if="server.lastError" class="info-row">
          <span class="info-label">最后错误:</span>
          <span class="info-value error-text">{{ server.lastError }}</span>
        </div>
      </div>
    </div>

    <!-- 服务器配置 -->
    <div class="server-detail__section">
      <h3 class="section-title">配置信息</h3>
      <div class="config-info">
        <div v-if="server.config.command" class="info-row">
          <span class="info-label">命令:</span>
          <code class="info-code">{{ server.config.command }}</code>
        </div>
        <div v-if="server.config.args?.length" class="info-row">
          <span class="info-label">参数:</span>
          <div class="args-list">
            <t-tag 
              v-for="(arg, index) in server.config.args" 
              :key="index"
              variant="outline"
              size="small"
            >
              {{ arg }}
            </t-tag>
          </div>
        </div>
        <div v-if="server.config.url" class="info-row">
          <span class="info-label">URL:</span>
          <code class="info-code">{{ server.config.url }}</code>
        </div>
        <div v-if="server.config.env && Object.keys(server.config.env).length" class="info-row">
          <span class="info-label">环境变量:</span>
          <div class="env-list">
            <div 
              v-for="[key, value] in Object.entries(server.config.env)" 
              :key="key"
              class="env-item"
            >
              <code class="env-key">{{ key }}</code>
              <span>=</span>
              <code class="env-value">{{ maskSensitiveValue(key, value) }}</code>
            </div>
          </div>
        </div>
        <div v-if="server.config.headers && Object.keys(server.config.headers).length" class="info-row">
          <span class="info-label">请求头:</span>
          <div class="headers-list">
            <div 
              v-for="[key, value] in Object.entries(server.config.headers)" 
              :key="key"
              class="header-item"
            >
              <code class="header-key">{{ key }}</code>
              <span>:</span>
              <code class="header-value">{{ maskSensitiveValue(key, value) }}</code>
            </div>
          </div>
        </div>
        <div class="info-row">
          <span class="info-label">启用状态:</span>
          <t-tag :theme="server.config.enabled ? 'success' : 'default'">
            {{ server.config.enabled ? '已启用' : '已禁用' }}
          </t-tag>
        </div>
      </div>
    </div>

    <!-- 可用工具 -->
    <div class="server-detail__section">
      <div class="section-header">
        <h3 class="section-title">可用工具 ({{ server.tools.length }})</h3>
        <t-button 
          theme="default" 
          variant="text" 
          size="small"
          @click="handleRefreshTools"
        >
          <template #icon>
            <RefreshIcon />
          </template>
          刷新
        </t-button>
      </div>
      
      <div v-if="server.tools.length === 0" class="empty-tools">
        <div class="empty-tools__icon">
          <ToolsIcon />
        </div>
        <div class="empty-tools__text">暂无可用工具</div>
        <div class="empty-tools__description">
          {{ server.status === 'connected' ? '该服务器未提供任何工具' : '请先连接服务器以获取工具列表' }}
        </div>
      </div>

      <div v-else class="tools-list">
        <div 
          v-for="tool in server.tools" 
          :key="tool.name"
          class="tool-item"
        >
          <div class="tool-item__header">
            <div class="tool-item__name">
              <ToolsIcon class="tool-item__icon" />
              <span>{{ tool.name }}</span>
            </div>
            <t-button
              theme="primary"
              variant="text"
              size="small"
              @click="handleTestTool(tool)"
            >
              测试
            </t-button>
          </div>
          <div v-if="tool.description" class="tool-item__description">
            {{ tool.description }}
          </div>
          <div v-if="tool.inputSchema" class="tool-item__schema">
            <t-collapse>
              <t-collapse-panel header="参数结构" value="schema">
                <pre class="schema-code">{{ formatSchema(tool.inputSchema) }}</pre>
              </t-collapse-panel>
            </t-collapse>
          </div>
        </div>
      </div>
    </div>

    <!-- 连接监控 -->
    <div class="server-detail__section">
      <ConnectionMonitor 
        :server="server"
        @status-change="handleStatusChange"
      />
    </div>

    <!-- 自动重连管理 -->
    <div class="server-detail__section">
      <AutoReconnectManager 
        :server="server"
        @reconnect-success="handleReconnectSuccess"
        @reconnect-failed="handleReconnectFailed"
      />
    </div>

    <!-- 操作按钮 -->
    <div class="server-detail__actions">
      <t-button 
        theme="primary"
        @click="handleEdit"
      >
        <template #icon>
          <EditIcon />
        </template>
        编辑配置
      </t-button>

      <t-button 
        theme="default"
        @click="handleRefresh"
      >
        <template #icon>
          <RefreshIcon />
        </template>
        刷新状态
      </t-button>
    </div>

    <!-- 工具测试对话框 -->
    <t-dialog
      v-model:visible="toolTestVisible"
      :header="`测试工具 - ${selectedTool?.name}`"
      width="600px"
      :confirm-btn="{ content: '执行测试', loading: testLoading }"
      @confirm="handleExecuteTest"
    >
      <div v-if="selectedTool" class="tool-test">
        <div class="tool-test__description">
          {{ selectedTool.description }}
        </div>
        
        <div class="tool-test__params">
          <h4>参数配置</h4>
          <t-textarea
            v-model="testParams"
            placeholder="请输入JSON格式的参数，例如: {}"
            :autosize="{ minRows: 3, maxRows: 10 }"
          />
          <div class="params-hint">
            请输入符合工具参数结构的JSON数据
          </div>
        </div>

        <div v-if="testResult" class="tool-test__result">
          <h4>执行结果</h4>
          <div class="result-status">
            <t-tag :theme="testResult.success ? 'success' : 'danger'">
              {{ testResult.success ? '成功' : '失败' }}
            </t-tag>
            <span class="result-time">执行时间: {{ testResult.executionTime }}ms</span>
          </div>
          <pre class="result-content">{{ formatTestResult(testResult) }}</pre>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  EditIcon,
  LinkIcon,
  LinkUnlinkIcon,
  ToolsIcon,
} from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import StatusTag from '@/components/common/StatusTag.vue';
import ConnectionMonitor from './ConnectionMonitor.vue';
import AutoReconnectManager from './AutoReconnectManager.vue';
import type { ServerInfo, ServerType, ToolInfo, ServerStatus } from '@/types/server';

interface Props {
  server: ServerInfo;
}

interface TestResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  refresh: [serverId: string];
  edit: [server: ServerInfo];
}>();

// 状态管理
const serverStore = useServerStore();

// 本地状态
const toolTestVisible = ref(false);
const selectedTool = ref<ToolInfo | null>(null);
const testParams = ref('{}');
const testLoading = ref(false);
const testResult = ref<TestResult | null>(null);

// 工具函数
const getTypeLabel = (type: ServerType): string => {
  const labels = {
    stdio: 'Stdio',
    sse: 'SSE',
    websocket: 'WebSocket',
  };
  return labels[type] || type;
};

const formatLastConnected = (lastConnected?: string): string => {
  if (!lastConnected) return '从未连接';
  
  const date = new Date(lastConnected);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const maskSensitiveValue = (key: string, value: string): string => {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
  const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k));
  
  if (isSensitive && value.length > 4) {
    return value.substring(0, 4) + '*'.repeat(value.length - 4);
  }
  
  return value;
};

const formatSchema = (schema: Record<string, unknown>): string => {
  return JSON.stringify(schema, null, 2);
};

const formatTestResult = (result: TestResult): string => {
  if (result.success && result.result) {
    return JSON.stringify(result.result, null, 2);
  } else if (result.error) {
    return result.error;
  }
  return '无返回数据';
};

// 事件处理
const handleEdit = () => {
  emit('edit', props.server);
};

const handleRefresh = () => {
  emit('refresh', props.server.id);
};

const handleRefreshTools = () => {
  handleRefresh();
};

const handleStatusChange = (status: ServerStatus) => {
  // 状态变化时的处理逻辑
  console.log(`服务器 ${props.server.id} 状态变更为: ${status}`);
};

const handleReconnectSuccess = () => {
  MessagePlugin.success('自动重连成功');
  handleRefresh();
};

const handleReconnectFailed = () => {
  MessagePlugin.warning('自动重连失败，请检查服务器配置');
};

const handleTestTool = (tool: ToolInfo) => {
  selectedTool.value = tool;
  testParams.value = '{}';
  testResult.value = null;
  toolTestVisible.value = true;
};

const handleExecuteTest = async () => {
  if (!selectedTool.value) return;
  
  try {
    testLoading.value = true;
    
    // 解析参数
    let params: Record<string, unknown>;
    try {
      params = JSON.parse(testParams.value);
    } catch (err) {
      MessagePlugin.error('参数格式错误，请输入有效的JSON');
      return;
    }
    
    // 模拟工具执行（实际应该调用后端API）
    const startTime = Date.now();
    
    // 这里应该调用实际的工具执行API
    // const result = await ToolService.executeTool(selectedTool.value.name, params);
    
    // 模拟结果
    const executionTime = Date.now() - startTime;
    testResult.value = {
      success: true,
      result: {
        message: '工具执行成功',
        params,
        timestamp: new Date().toISOString(),
      },
      executionTime,
    };
    
    MessagePlugin.success('工具测试完成');
  } catch (err) {
    testResult.value = {
      success: false,
      error: err instanceof Error ? err.message : '执行失败',
      executionTime: 0,
    };
    MessagePlugin.error('工具测试失败');
  } finally {
    testLoading.value = false;
  }
};
</script>

<style scoped>
.server-detail {
  padding: 0;
}

.server-detail__section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.server-info,
.config-info {
  background: var(--td-bg-color-container);
  border-radius: 6px;
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
}

.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  min-width: 80px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
  flex-shrink: 0;
}

.info-value {
  color: var(--td-text-color-primary);
  flex: 1;
}

.info-code {
  background: var(--td-bg-color-code);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: var(--td-text-color-primary);
}

.error-text {
  color: var(--td-error-color);
}

.args-list,
.env-list,
.headers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.env-item,
.header-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.env-key,
.env-value,
.header-key,
.header-value {
  background: var(--td-bg-color-code);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.empty-tools {
  text-align: center;
  padding: 48px 24px;
  color: var(--td-text-color-secondary);
}

.empty-tools__icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-tools__text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.empty-tools__description {
  font-size: 14px;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-item {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
}

.tool-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tool-item__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tool-item__icon {
  font-size: 16px;
  color: var(--td-brand-color);
}

.tool-item__description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.tool-item__schema {
  margin-top: 12px;
}

.schema-code {
  background: var(--td-bg-color-code);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  margin: 0;
}

.server-detail__actions {
  display: flex;
  gap: 12px;
  padding-top: 24px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.tool-test__description {
  color: var(--td-text-color-secondary);
  margin-bottom: 16px;
  padding: 12px;
  background: var(--td-bg-color-container);
  border-radius: 4px;
}

.tool-test__params h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.params-hint {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-top: 4px;
}

.tool-test__result {
  margin-top: 16px;
}

.tool-test__result h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.result-time {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.result-content {
  background: var(--td-bg-color-code);
  padding: 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}
</style>