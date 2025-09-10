<template>
  <div class="api-tester">
    <div class="tester-header">
      <h3>API测试与MCP工具预览</h3>
      <t-space>
        <t-button
          variant="outline"
          size="small"
          @click="loadConfig"
        >
          <template #icon><refresh-icon /></template>
          刷新配置
        </t-button>
        <t-button
          theme="primary"
          size="small"
          @click="generateToolPreview"
        >
          <template #icon><tool-icon /></template>
          生成工具预览
        </t-button>
      </t-space>
    </div>

    <div class="tester-content">
      <!-- 配置信息 -->
      <t-card class="config-info" title="配置信息">
        <t-descriptions :column="2">
          <t-descriptions-item label="配置名称">
            {{ configInfo.name }}
          </t-descriptions-item>
          <t-descriptions-item label="配置ID">
            {{ configInfo.id }}
          </t-descriptions-item>
          <t-descriptions-item label="描述">
            {{ configInfo.description }}
          </t-descriptions-item>
          <t-descriptions-item label="状态">
            <t-tag :variant="getStatusVariant(configInfo.status)">
              {{ getStatusText(configInfo.status) }}
            </t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="API URL">
            <div class="api-info">
              <t-tag variant="outline">{{ configInfo.api.method }}</t-tag>
              <span class="api-url">{{ configInfo.api.url }}</span>
            </div>
          </t-descriptions-item>
          <t-descriptions-item label="工具数">
            {{ configInfo.toolsGenerated }}
          </t-descriptions-item>
        </t-descriptions>
      </t-card>

      <!-- API测试区域 -->
      <t-card class="test-section" title="API测试">
        <template #actions>
          <t-button
            variant="outline"
            size="small"
            @click="loadSampleData"
          >
            加载示例数据
          </t-button>
        </template>
        
        <div class="test-content">
          <!-- 参数输入 -->
          <div class="parameters-section">
            <div class="section-header">
              <span>请求参数</span>
              <t-button
                variant="text"
                size="small"
                @click="addParameter"
              >
                <template #icon><add-icon /></template>
              </t-button>
            </div>
            
            <div class="parameters-list">
              <div
                v-for="(param, index) in testParameters"
                :key="index"
                class="parameter-item"
              >
                <div class="parameter-name">
                  <t-input
                    v-model="param.name"
                    placeholder="参数名"
                    size="small"
                    class="name-input"
                  />
                </div>
                <div class="parameter-value">
                  <t-input
                    v-model="param.value"
                    placeholder="参数值"
                    size="small"
                    class="value-input"
                  />
                </div>
                <div class="parameter-type">
                  <t-select
                    v-model="param.type"
                    size="small"
                    class="type-select"
                  >
                    <t-option value="string">字符串</t-option>
                    <t-option value="number">数字</t-option>
                    <t-option value="boolean">布尔值</t-option>
                    <t-option value="object">对象</t-option>
                    <t-option value="array">数组</t-option>
                  </t-select>
                </div>
                <div class="parameter-actions">
                  <t-button
                    variant="text"
                    size="small"
                    theme="danger"
                    @click="removeParameter(index)"
                  >
                    <template #icon><delete-icon /></template>
                  </t-button>
                </div>
              </div>
            </div>
          </div>

          <!-- JSON输入 -->
          <div class="json-section">
            <div class="section-header">
              <span>JSON数据输入</span>
              <t-switch
                v-model="useJsonInput"
                size="small"
                label="使用JSON输入"
              />
            </div>
            <t-textarea
              v-if="useJsonInput"
              v-model="jsonInput"
              placeholder="输入JSON格式的请求数据"
              :rows="6"
              class="json-input"
            />
          </div>

          <!-- 测试按钮 -->
          <div class="test-actions">
            <t-button
              theme="primary"
              :loading="testing"
              @click="runApiTest"
            >
              <template #icon><play-icon /></template>
              {{ testing ? '测试中...' : '测试API' }}
            </t-button>
          </div>
        </div>
      </t-card>

      <!-- 测试结果 -->
      <t-card v-if="testResult" class="result-section" title="测试结果">
        <template #actions>
          <t-button
            variant="outline"
            size="small"
            @click="clearResult"
          >
            清除结果
          </t-button>
        </template>
        
        <div class="result-content">
          <div class="result-summary">
            <t-row :gutter="16">
              <t-col :span="6">
                <div class="summary-item">
                  <div class="summary-label">执行时间</div>
                  <div class="summary-value">{{ testResult.executionTime }}ms</div>
                </div>
              </t-col>
              <t-col :span="6">
                <div class="summary-item">
                  <div class="summary-label">状态</div>
                  <div class="summary-value">
                    <t-tag :variant="testResult.success ? 'success' : 'error'">
                      {{ testResult.success ? '成功' : '失败' }}
                    </t-tag>
                  </div>
                </div>
              </t-col>
              <t-col :span="12">
                <div class="summary-item">
                  <div class="summary-label">时间戳</div>
                  <div class="summary-value">{{ new Date().toLocaleString() }}</div>
                </div>
              </t-col>
            </t-row>
          </div>

          <div class="result-details">
            <t-tabs v-model="activeTab" theme="card">
              <t-tab-panel value="response" label="响应数据">
                <div class="tab-content">
                  <t-textarea
                    :value="formatJson(testResult.response)"
                    readonly
                    :rows="10"
                    class="result-json"
                  />
                </div>
              </t-tab-panel>
              <t-tab-panel v-if="testResult.error" value="error" label="错误信息">
                <div class="tab-content">
                  <t-alert
                    theme="error"
                    :message="testResult.error"
                    class="error-alert"
                  />
                </div>
              </t-tab-panel>
              <t-tab-panel value="raw" label="原始数据">
                <div class="tab-content">
                  <t-textarea
                    :value="JSON.stringify(testResult, null, 2)"
                    readonly
                    :rows="10"
                    class="result-json"
                  />
                </div>
              </t-tab-panel>
            </t-tabs>
          </div>
        </div>
      </t-card>

      <!-- MCP工具预览 -->
      <t-card class="tool-preview" title="MCP工具预览">
        <template #actions>
          <t-button
            variant="outline"
            size="small"
            @click="copyToolDefinition"
          >
            <template #icon><copy-icon /></template>
            复制定义
          </t-button>
        </template>
        
        <div class="tool-content">
          <div v-if="toolPreview.loading" class="loading-state">
            <t-loading size="large" />
            <p>正在生成工具预览...</p>
          </div>
          
          <div v-else-if="toolPreview.tools.length > 0" class="tools-list">
            <div
              v-for="(tool, index) in toolPreview.tools"
              :key="index"
              class="tool-item"
            >
              <div class="tool-header">
                <div class="tool-name">{{ tool.name }}</div>
                <div class="tool-description">{{ tool.description }}</div>
              </div>
              
              <div class="tool-details">
                <div class="detail-section">
                  <div class="detail-title">输入Schema</div>
                  <t-textarea
                    :value="formatJson(tool.inputSchema)"
                    readonly
                    :rows="4"
                    class="schema-json"
                  />
                </div>
                
                <div class="detail-section">
                  <div class="detail-title">服务器</div>
                  <div class="server-info">
                    <t-tag variant="outline">{{ tool.serverName }}</t-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-state">
            <t-empty description="暂无工具预览" />
            <t-button
              theme="primary"
              @click="generateToolPreview"
            >
              生成工具预览
            </t-button>
          </div>
        </div>
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  ToolIcon,
  AddIcon,
  DeleteIcon,
  PlayIcon,
  CopyIcon,
} from 'tdesign-icons-vue-next';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiConfigInfo, TestApiConfigResponse, McpToolPreview } from '@/types/api-to-mcp';

interface Props {
  configId: string;
}

const props = defineProps<Props>();

const configInfo = ref<ApiConfigInfo>({
  id: '',
  name: '',
  description: '',
  status: 'inactive',
  api: {
    url: '',
    method: 'GET',
  },
  toolsGenerated: 0,
  lastUpdated: '',
});

const testing = ref(false);
const testResult = ref<TestApiConfigResponse | null>(null);
const activeTab = ref('response');
const useJsonInput = ref(false);
const jsonInput = ref('');
const toolPreview = reactive({
  loading: false,
  tools: [] as McpToolPreview[],
});

const testParameters = ref<Array<{ name: string; value: string; type: string }>>([]);

// 组件挂载时加载配置
onMounted(async () => {
  await loadConfig();
});

// 加载配置信息
const loadConfig = async () => {
  try {
    const configs = await apiToMcpService.getConfigs();
    const config = configs.configs.find(c => c.id === props.configId);
    if (config) {
      configInfo.value = config;
    }
  } catch (error) {
    MessagePlugin.error('加载配置失败');
    console.error('加载配置失败:', error);
  }
};

// 获取状态变体
const getStatusVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
};

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'active':
      return '活跃';
    case 'inactive':
      return '非活跃';
    case 'error':
      return '错误';
    default:
      return '未知';
  }
};

// 添加参数
const addParameter = () => {
  testParameters.value.push({
    name: '',
    value: '',
    type: 'string',
  });
};

// 移除参数
const removeParameter = (index: number) => {
  testParameters.value.splice(index, 1);
};

// 加载示例数据
const loadSampleData = () => {
  if (useJsonInput.value) {
    jsonInput.value = JSON.stringify({
      param1: 'value1',
      param2: 42,
      param3: true,
      param4: { nested: 'object' },
      param5: [1, 2, 3],
    }, null, 2);
  } else {
    testParameters.value = [
      { name: 'param1', value: 'value1', type: 'string' },
      { name: 'param2', value: '42', type: 'number' },
      { name: 'param3', value: 'true', type: 'boolean' },
    ];
  }
  MessagePlugin.success('示例数据已加载');
};

// 运行API测试
const runApiTest = async () => {
  try {
    let parameters: Record<string, unknown> = {};
    
    if (useJsonInput.value) {
      if (!jsonInput.value.trim()) {
        MessagePlugin.error('请输入JSON数据');
        return;
      }
      parameters = JSON.parse(jsonInput.value);
    } else {
      if (testParameters.value.length === 0) {
        MessagePlugin.error('请添加测试参数');
        return;
      }
      
      testParameters.value.forEach(param => {
        if (!param.name.trim() || !param.value.trim()) {
          return;
        }
        
        let value: unknown = param.value;
        
        switch (param.type) {
          case 'number':
            value = Number(param.value);
            break;
          case 'boolean':
            value = param.value.toLowerCase() === 'true';
            break;
          case 'object':
            try {
              value = JSON.parse(param.value);
            } catch {
              value = param.value;
            }
            break;
          case 'array':
            try {
              value = JSON.parse(param.value);
            } catch {
              value = [param.value];
            }
            break;
          default:
            value = param.value;
        }
        
        parameters[param.name] = value;
      });
    }
    
    testing.value = true;
    const result = await apiToMcpService.testConfig(props.configId, parameters);
    testResult.value = result;
    
    if (result.success) {
      MessagePlugin.success('API测试成功');
    } else {
      MessagePlugin.error('API测试失败');
    }
  } catch (error) {
    testResult.value = {
      success: false,
      error: (error as Error).message,
      executionTime: 0,
    };
    MessagePlugin.error('API测试失败: ' + (error as Error).message);
  } finally {
    testing.value = false;
  }
};

// 清除结果
const clearResult = () => {
  testResult.value = null;
  activeTab.value = 'response';
};

// 格式化JSON
const formatJson = (data: unknown) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

// 生成工具预览
const generateToolPreview = async () => {
  try {
    toolPreview.loading = true;
    toolPreview.tools = [];
    
    const result = await apiToMcpService.generateToolPreview(props.configId);
    toolPreview.tools = result.tools;
    
    MessagePlugin.success(`成功生成 ${result.tools.length} 个工具预览`);
  } catch (error) {
    MessagePlugin.error('生成工具预览失败: ' + (error as Error).message);
    console.error('生成工具预览失败:', error);
  } finally {
    toolPreview.loading = false;
  }
};

// 复制工具定义
const copyToolDefinition = async () => {
  try {
    const text = JSON.stringify(toolPreview.tools, null, 2);
    await navigator.clipboard.writeText(text);
    MessagePlugin.success('工具定义已复制到剪贴板');
  } catch (error) {
    MessagePlugin.error('复制失败');
    console.error('复制失败:', error);
  }
};
</script>

<style scoped>
.api-tester {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.tester-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tester-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.tester-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.api-info {
  margin-bottom: 0;
}

.api-info .api-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-info .api-url {
  font-family: monospace;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.test-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 12px;
}

.parameters-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.parameter-item {
  display: grid;
  grid-template-columns: 2fr 3fr 1fr auto;
  gap: 8px;
  align-items: center;
}

.name-input,
.value-input,
.type-select {
  width: 100%;
}

.json-section {
  margin-bottom: 16px;
}

.json-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.test-actions {
  display: flex;
  justify-content: flex-start;
}

.result-summary {
  margin-bottom: 16px;
}

.summary-item {
  text-align: center;
}

.summary-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.result-details {
  border-top: 1px solid var(--td-border-level-1-color);
  padding-top: 16px;
}

.tab-content {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 4px;
  overflow: hidden;
}

.result-json,
.schema-json {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: none;
  resize: none;
}

.error-alert {
  margin-bottom: 0;
}

.tool-content {
  min-height: 200px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-item {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
}

.tool-header {
  margin-bottom: 12px;
}

.tool-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.tool-description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.tool-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-title {
  font-weight: 600;
  color: var(--td-text-color-primary);
  font-size: 14px;
}

.server-info {
  display: flex;
  align-items: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
}
</style>