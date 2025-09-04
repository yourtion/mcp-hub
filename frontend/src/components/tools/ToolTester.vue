<template>
  <div class="tool-tester">
    <t-loading :loading="loading" size="large">
      <div v-if="tool" class="tester-content">
        <!-- 工具信息头部 -->
        <t-card class="tool-header">
          <div class="tool-info">
            <div class="tool-title">
              <h2>{{ tool.name }}</h2>
              <status-tag :status="tool.status" />
            </div>
            <div class="tool-meta">
              <t-tag variant="outline">{{ tool.serverId }}</t-tag>
              <span class="tool-description">{{ tool.description || '暂无描述' }}</span>
            </div>
          </div>
        </t-card>

        <t-row :gutter="16">
          <!-- 参数输入区域 -->
          <t-col :span="12">
            <t-card title="参数配置" class="params-card">
              <template #actions>
                <t-space>
                  <t-button
                    variant="text"
                    size="small"
                    @click="loadPreset"
                  >
                    加载预设
                  </t-button>
                  
                  <t-button
                    variant="text"
                    size="small"
                    @click="savePreset"
                  >
                    保存预设
                  </t-button>

                  <t-button
                    variant="text"
                    size="small"
                    @click="clearParams"
                  >
                    清空参数
                  </t-button>
                </t-space>
              </template>

              <div class="params-form">
                <div v-if="!hasParams" class="no-params">
                  该工具无需参数，可直接执行
                </div>

                <div v-else class="params-inputs">
                  <div
                    v-for="(param, paramName) in tool.inputSchema.properties"
                    :key="paramName"
                    class="param-input"
                  >
                    <div class="param-label">
                      <label>
                        {{ paramName }}
                        <span v-if="isRequired(paramName)" class="required">*</span>
                      </label>
                      <t-tooltip v-if="param.description" :content="param.description">
                        <help-circle-icon class="param-help" />
                      </t-tooltip>
                    </div>

                    <!-- 字符串类型输入 -->
                    <t-input
                      v-if="param.type === 'string' && !param.enum"
                      v-model="paramValues[paramName]"
                      :placeholder="getParamPlaceholder(param)"
                      :status="getParamStatus(paramName)"
                      :tips="getParamTips(paramName, param)"
                      clearable
                    />

                    <!-- 枚举选择 -->
                    <t-select
                      v-else-if="param.type === 'string' && param.enum"
                      v-model="paramValues[paramName]"
                      :placeholder="getParamPlaceholder(param)"
                      :status="getParamStatus(paramName)"
                      clearable
                    >
                      <t-option
                        v-for="option in param.enum"
                        :key="option"
                        :value="option"
                        :label="option"
                      />
                    </t-select>

                    <!-- 数字类型输入 -->
                    <t-input-number
                      v-else-if="param.type === 'number' || param.type === 'integer'"
                      v-model="paramValues[paramName]"
                      :placeholder="getParamPlaceholder(param)"
                      :status="getParamStatus(paramName)"
                      :min="param.minimum"
                      :max="param.maximum"
                      :decimal-places="param.type === 'integer' ? 0 : undefined"
                    />

                    <!-- 布尔类型输入 -->
                    <t-switch
                      v-else-if="param.type === 'boolean'"
                      v-model="paramValues[paramName]"
                    />

                    <!-- 数组类型输入 -->
                    <div v-else-if="param.type === 'array'" class="array-input">
                      <t-tag-input
                        v-model="paramValues[paramName]"
                        :placeholder="getParamPlaceholder(param)"
                        clearable
                      />
                    </div>

                    <!-- 对象类型输入 -->
                    <t-textarea
                      v-else-if="param.type === 'object'"
                      v-model="paramValues[paramName]"
                      :placeholder="'输入JSON格式的对象'"
                      :autosize="{ minRows: 3, maxRows: 8 }"
                      :status="getParamStatus(paramName)"
                    />

                    <!-- 其他类型 -->
                    <t-input
                      v-else
                      v-model="paramValues[paramName]"
                      :placeholder="getParamPlaceholder(param)"
                      :status="getParamStatus(paramName)"
                    />
                  </div>
                </div>

                <!-- 参数验证结果 -->
                <div v-if="validationResult" class="validation-result">
                  <t-alert
                    :theme="validationResult.isValid ? 'success' : 'error'"
                    :title="validationResult.isValid ? '参数验证通过' : '参数验证失败'"
                    :close="false"
                  >
                    <div v-if="!validationResult.isValid" class="validation-errors">
                      <ul>
                        <li v-for="error in validationResult.errors" :key="error">
                          {{ error }}
                        </li>
                      </ul>
                    </div>
                    
                    <div v-if="validationResult.warnings.length > 0" class="validation-warnings">
                      <h5>警告：</h5>
                      <ul>
                        <li v-for="warning in validationResult.warnings" :key="warning">
                          {{ warning }}
                        </li>
                      </ul>
                    </div>
                  </t-alert>
                </div>

                <!-- 操作按钮 -->
                <div class="test-actions">
                  <t-space>
                    <t-button
                      theme="primary"
                      :loading="testing"
                      :disabled="tool.status !== 'available'"
                      @click="validateParams"
                    >
                      验证参数
                    </t-button>
                    
                    <t-button
                      theme="success"
                      :loading="executing"
                      :disabled="tool.status !== 'available' || (validationResult && !validationResult.isValid)"
                      @click="executeTool"
                    >
                      执行工具
                    </t-button>

                    <t-button
                      variant="outline"
                      @click="generateExample"
                    >
                      生成示例
                    </t-button>
                  </t-space>
                </div>
              </div>
            </t-card>
          </t-col>

          <!-- 结果显示区域 -->
          <t-col :span="12">
            <t-card title="执行结果" class="result-card">
              <template #actions>
                <t-space>
                  <t-button
                    variant="text"
                    size="small"
                    :disabled="!executionResult"
                    @click="copyResult"
                  >
                    复制结果
                  </t-button>
                  
                  <t-button
                    variant="text"
                    size="small"
                    :disabled="!executionResult"
                    @click="exportResult"
                  >
                    导出结果
                  </t-button>

                  <t-button
                    variant="text"
                    size="small"
                    @click="clearResult"
                  >
                    清空结果
                  </t-button>
                </t-space>
              </template>

              <div class="result-content">
                <!-- 执行状态 -->
                <div v-if="executionResult" class="execution-status">
                  <t-descriptions :column="2" size="small">
                    <t-descriptions-item label="执行状态">
                      <t-tag
                        :theme="executionResult.isError ? 'danger' : 'success'"
                        variant="light"
                      >
                        {{ executionResult.isError ? '执行失败' : '执行成功' }}
                      </t-tag>
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="执行时间">
                      {{ executionResult.executionTime }}ms
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="执行ID">
                      {{ executionResult.executionId }}
                    </t-descriptions-item>
                    
                    <t-descriptions-item label="时间戳">
                      {{ formatTime(executionResult.timestamp) }}
                    </t-descriptions-item>
                  </t-descriptions>
                </div>

                <!-- 结果内容 -->
                <div v-if="executionResult" class="result-data">
                  <t-tabs v-model="resultViewMode" class="result-tabs">
                    <t-tab-panel value="formatted" label="格式化视图">
                      <div class="formatted-result">
                        <div
                          v-for="(item, index) in executionResult.result"
                          :key="index"
                          class="result-item"
                        >
                          <!-- 文本结果 -->
                          <div v-if="item.type === 'text'" class="text-result">
                            <pre>{{ item.text }}</pre>
                          </div>

                          <!-- 图片结果 -->
                          <div v-else-if="item.type === 'image'" class="image-result">
                            <img :src="item.data" :alt="'Result image ' + index" />
                          </div>

                          <!-- 资源结果 -->
                          <div v-else-if="item.type === 'resource'" class="resource-result">
                            <t-link :href="item.uri" target="_blank">
                              {{ item.uri }}
                            </t-link>
                          </div>

                          <!-- 其他类型 -->
                          <div v-else class="unknown-result">
                            <pre>{{ JSON.stringify(item, null, 2) }}</pre>
                          </div>
                        </div>
                      </div>
                    </t-tab-panel>

                    <t-tab-panel value="raw" label="原始数据">
                      <t-textarea
                        :value="JSON.stringify(executionResult.result, null, 2)"
                        readonly
                        :autosize="{ minRows: 10, maxRows: 30 }"
                        class="raw-result"
                      />
                    </t-tab-panel>
                  </t-tabs>
                </div>

                <!-- 空状态 -->
                <div v-else class="empty-result">
                  <t-empty description="暂无执行结果">
                    <template #image>
                      <play-circle-icon size="48px" />
                    </template>
                  </t-empty>
                </div>
              </div>
            </t-card>
          </t-col>
        </t-row>

        <!-- 执行历史 -->
        <t-card title="测试历史" class="history-card">
          <template #actions>
            <t-button
              variant="text"
              size="small"
              @click="clearTestHistory"
            >
              清空历史
            </t-button>
          </template>

          <div class="test-history">
            <t-timeline>
              <t-timeline-item
                v-for="(record, index) in testHistory"
                :key="index"
                :dot-color="record.success ? 'green' : 'red'"
              >
                <div class="history-item">
                  <div class="history-header">
                    <span class="history-time">{{ formatTime(record.timestamp) }}</span>
                    <t-tag
                      :theme="record.success ? 'success' : 'danger'"
                      size="small"
                      variant="light"
                    >
                      {{ record.success ? '成功' : '失败' }}
                    </t-tag>
                  </div>
                  
                  <div class="history-params">
                    <t-collapse>
                      <t-collapse-panel header="查看参数" value="params">
                        <pre>{{ JSON.stringify(record.params, null, 2) }}</pre>
                      </t-collapse-panel>
                    </t-collapse>
                  </div>

                  <div class="history-actions">
                    <t-space>
                      <t-button
                        size="small"
                        variant="text"
                        @click="loadHistoryParams(record)"
                      >
                        重新加载
                      </t-button>
                      
                      <t-button
                        size="small"
                        variant="text"
                        theme="primary"
                        @click="rerunHistory(record)"
                      >
                        重新执行
                      </t-button>
                    </t-space>
                  </div>
                </div>
              </t-timeline-item>
            </t-timeline>
          </div>
        </t-card>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <t-result
          theme="error"
          title="加载失败"
          :description="error"
        >
          <template #extra>
            <t-button theme="primary" @click="loadTool">
              重新加载
            </t-button>
          </template>
        </t-result>
      </div>
    </t-loading>

    <!-- 预设管理对话框 -->
    <t-dialog
      v-model:visible="showPresetDialog"
      title="参数预设管理"
      width="600px"
    >
      <div class="preset-management">
        <!-- 预设列表 -->
        <div class="preset-list">
          <h4>已保存的预设</h4>
          <div
            v-for="preset in paramPresets"
            :key="preset.id"
            class="preset-item"
          >
            <div class="preset-info">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-description">{{ preset.description }}</div>
            </div>
            <div class="preset-actions">
              <t-button
                size="small"
                variant="text"
                @click="loadPresetParams(preset)"
              >
                加载
              </t-button>
              <t-button
                size="small"
                variant="text"
                theme="danger"
                @click="deletePreset(preset)"
              >
                删除
              </t-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <t-button @click="showPresetDialog = false">关闭</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  HelpCircleIcon,
  PlayCircleIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import type { 
  ToolInfo, 
  ToolExecuteResponse, 
  ToolTestResponse,
  JsonSchemaProperty 
} from '@/types/tool';

// 路由
const route = useRoute();
const router = useRouter();

// Store
const toolStore = useToolStore();

// 响应式数据
const tool = ref<ToolInfo | null>(null);
const paramValues = ref<Record<string, any>>({});
const validationResult = ref<ToolTestResponse | null>(null);
const executionResult = ref<ToolExecuteResponse | null>(null);
const loading = ref(false);
const testing = ref(false);
const executing = ref(false);
const error = ref<string | null>(null);
const resultViewMode = ref<'formatted' | 'raw'>('formatted');
const showPresetDialog = ref(false);

// 测试历史
const testHistory = ref<Array<{
  id: string;
  timestamp: string;
  params: Record<string, any>;
  success: boolean;
  result?: any;
}>>([]);

// 参数预设
const paramPresets = ref<Array<{
  id: string;
  name: string;
  description: string;
  params: Record<string, any>;
}>>([]);

// 计算属性
const toolName = computed(() => route.params.toolName as string);
const serverId = computed(() => route.query.serverId as string);
const groupId = computed(() => (route.query.groupId as string) || 'default');

const hasParams = computed(() => {
  return tool.value?.inputSchema?.properties && 
         Object.keys(tool.value.inputSchema.properties).length > 0;
});

// 方法
const loadTool = async () => {
  try {
    loading.value = true;
    error.value = null;

    const toolDetail = await toolStore.fetchToolDetail(toolName.value, groupId.value);
    tool.value = toolDetail;

    // 初始化参数值
    initializeParams();

  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载工具失败';
  } finally {
    loading.value = false;
  }
};

const initializeParams = () => {
  if (!tool.value?.inputSchema?.properties) return;

  const params: Record<string, any> = {};
  
  Object.entries(tool.value.inputSchema.properties).forEach(([name, schema]) => {
    if (schema.default !== undefined) {
      params[name] = schema.default;
    } else {
      // 根据类型设置默认值
      switch (schema.type) {
        case 'string':
          params[name] = '';
          break;
        case 'number':
        case 'integer':
          params[name] = undefined;
          break;
        case 'boolean':
          params[name] = false;
          break;
        case 'array':
          params[name] = [];
          break;
        case 'object':
          params[name] = '';
          break;
        default:
          params[name] = '';
      }
    }
  });

  paramValues.value = params;
};

const isRequired = (paramName: string): boolean => {
  return tool.value?.inputSchema?.required?.includes(paramName) || false;
};

const getParamPlaceholder = (param: JsonSchemaProperty): string => {
  if (param.default !== undefined) {
    return `默认值: ${JSON.stringify(param.default)}`;
  }
  
  switch (param.type) {
    case 'string':
      return param.enum ? '请选择' : '请输入字符串';
    case 'number':
      return '请输入数字';
    case 'integer':
      return '请输入整数';
    case 'boolean':
      return '选择真/假';
    case 'array':
      return '输入数组项，按回车添加';
    case 'object':
      return '输入JSON格式的对象';
    default:
      return '请输入值';
  }
};

const getParamStatus = (paramName: string): 'default' | 'success' | 'warning' | 'error' => {
  if (validationResult.value && !validationResult.value.isValid) {
    const hasError = validationResult.value.errors.some(error => 
      error.includes(paramName)
    );
    if (hasError) return 'error';
  }
  
  return 'default';
};

const getParamTips = (paramName: string, param: JsonSchemaProperty): string => {
  const tips = [];
  
  if (param.minimum !== undefined) {
    tips.push(`最小值: ${param.minimum}`);
  }
  
  if (param.maximum !== undefined) {
    tips.push(`最大值: ${param.maximum}`);
  }
  
  if (param.minLength !== undefined) {
    tips.push(`最小长度: ${param.minLength}`);
  }
  
  if (param.maxLength !== undefined) {
    tips.push(`最大长度: ${param.maxLength}`);
  }
  
  if (param.pattern) {
    tips.push(`格式: ${param.pattern}`);
  }
  
  return tips.join(', ');
};

const validateParams = async () => {
  if (!tool.value) return;

  try {
    testing.value = true;
    
    const processedParams = processParamValues();
    
    const result = await toolStore.testTool(toolName.value, {
      arguments: processedParams,
      groupId: groupId.value,
    });
    
    validationResult.value = result;
    
    if (result.isValid) {
      MessagePlugin.success('参数验证通过');
    } else {
      MessagePlugin.error('参数验证失败');
    }
    
  } catch (err) {
    MessagePlugin.error('参数验证失败');
    validationResult.value = null;
  } finally {
    testing.value = false;
  }
};

const executeTool = async () => {
  if (!tool.value) return;

  try {
    executing.value = true;
    
    const processedParams = processParamValues();
    
    const result = await toolStore.executeTool(toolName.value, {
      arguments: processedParams,
      serverId: serverId.value,
      groupId: groupId.value,
    });
    
    executionResult.value = result;
    
    // 添加到测试历史
    addToTestHistory(processedParams, true, result);
    
    MessagePlugin.success('工具执行成功');
    
  } catch (err) {
    MessagePlugin.error('工具执行失败');
    
    // 添加失败记录到历史
    addToTestHistory(processParamValues(), false);
  } finally {
    executing.value = false;
  }
};

const processParamValues = (): Record<string, any> => {
  const processed: Record<string, any> = {};
  
  Object.entries(paramValues.value).forEach(([name, value]) => {
    if (value === '' || value === undefined || value === null) {
      // 跳过空值，除非是必需参数
      if (isRequired(name)) {
        processed[name] = value;
      }
      return;
    }
    
    const param = tool.value?.inputSchema?.properties?.[name];
    if (!param) {
      processed[name] = value;
      return;
    }
    
    // 根据参数类型处理值
    switch (param.type) {
      case 'number':
        processed[name] = Number(value);
        break;
      case 'integer':
        processed[name] = parseInt(value, 10);
        break;
      case 'boolean':
        processed[name] = Boolean(value);
        break;
      case 'array':
        processed[name] = Array.isArray(value) ? value : [value];
        break;
      case 'object':
        try {
          processed[name] = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          processed[name] = value;
        }
        break;
      default:
        processed[name] = value;
    }
  });
  
  return processed;
};

const generateExample = () => {
  if (!tool.value?.inputSchema?.properties) return;

  const example: Record<string, any> = {};
  
  Object.entries(tool.value.inputSchema.properties).forEach(([name, param]) => {
    switch (param.type) {
      case 'string':
        if (param.enum) {
          example[name] = param.enum[0];
        } else {
          example[name] = `示例${name}`;
        }
        break;
      case 'number':
        example[name] = param.minimum || 1;
        break;
      case 'integer':
        example[name] = param.minimum || 1;
        break;
      case 'boolean':
        example[name] = true;
        break;
      case 'array':
        example[name] = ['示例项1', '示例项2'];
        break;
      case 'object':
        example[name] = JSON.stringify({ key: 'value' }, null, 2);
        break;
      default:
        example[name] = '示例值';
    }
  });

  paramValues.value = { ...paramValues.value, ...example };
  MessagePlugin.success('已生成示例参数');
};

const clearParams = () => {
  initializeParams();
  validationResult.value = null;
  MessagePlugin.success('参数已清空');
};

const clearResult = () => {
  executionResult.value = null;
  validationResult.value = null;
};

const copyResult = async () => {
  if (!executionResult.value) return;

  try {
    await navigator.clipboard.writeText(
      JSON.stringify(executionResult.value.result, null, 2)
    );
    MessagePlugin.success('结果已复制到剪贴板');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const exportResult = () => {
  if (!executionResult.value) return;

  const data = {
    tool: tool.value?.name,
    executionId: executionResult.value.executionId,
    timestamp: executionResult.value.timestamp,
    params: processParamValues(),
    result: executionResult.value.result,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tool-result-${executionResult.value.executionId}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  MessagePlugin.success('结果已导出');
};

const addToTestHistory = (
  params: Record<string, any>, 
  success: boolean, 
  result?: any
) => {
  const record = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    params: { ...params },
    success,
    result,
  };
  
  testHistory.value.unshift(record);
  
  // 限制历史记录数量
  if (testHistory.value.length > 20) {
    testHistory.value = testHistory.value.slice(0, 20);
  }
  
  saveTestHistoryToStorage();
};

const loadHistoryParams = (record: any) => {
  paramValues.value = { ...record.params };
  MessagePlugin.success('参数已加载');
};

const rerunHistory = async (record: any) => {
  paramValues.value = { ...record.params };
  await executeTool();
};

const clearTestHistory = async () => {
  const confirmed = await DialogPlugin.confirm({
    header: '清空测试历史',
    body: '确定要清空所有测试历史记录吗？',
    confirmBtn: '清空',
    cancelBtn: '取消',
  });

  if (confirmed) {
    testHistory.value = [];
    saveTestHistoryToStorage();
    MessagePlugin.success('测试历史已清空');
  }
};

const loadPreset = () => {
  showPresetDialog.value = true;
};

const savePreset = async () => {
  const name = await DialogPlugin.prompt({
    header: '保存参数预设',
    body: '请输入预设名称',
    confirmBtn: '保存',
    cancelBtn: '取消',
  });

  if (name) {
    const description = await DialogPlugin.prompt({
      header: '预设描述',
      body: '请输入预设描述（可选）',
      confirmBtn: '保存',
      cancelBtn: '跳过',
    });

    const preset = {
      id: Date.now().toString(),
      name,
      description: description || '',
      params: { ...paramValues.value },
    };

    paramPresets.value.push(preset);
    savePresetsToStorage();
    MessagePlugin.success('参数预设已保存');
  }
};

const loadPresetParams = (preset: any) => {
  paramValues.value = { ...preset.params };
  showPresetDialog.value = false;
  MessagePlugin.success(`已加载预设: ${preset.name}`);
};

const deletePreset = async (preset: any) => {
  const confirmed = await DialogPlugin.confirm({
    header: '删除预设',
    body: `确定要删除预设 "${preset.name}" 吗？`,
    confirmBtn: '删除',
    cancelBtn: '取消',
  });

  if (confirmed) {
    const index = paramPresets.value.findIndex(p => p.id === preset.id);
    if (index > -1) {
      paramPresets.value.splice(index, 1);
      savePresetsToStorage();
      MessagePlugin.success('预设已删除');
    }
  }
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

const saveTestHistoryToStorage = () => {
  const key = `tool-test-history-${toolName.value}`;
  localStorage.setItem(key, JSON.stringify(testHistory.value));
};

const loadTestHistoryFromStorage = () => {
  const key = `tool-test-history-${toolName.value}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      testHistory.value = JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load test history:', err);
    }
  }
};

const savePresetsToStorage = () => {
  const key = `tool-param-presets-${toolName.value}`;
  localStorage.setItem(key, JSON.stringify(paramPresets.value));
};

const loadPresetsFromStorage = () => {
  const key = `tool-param-presets-${toolName.value}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      paramPresets.value = JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }
};

// 监听路由参数变化
watch(
  () => [toolName.value, serverId.value, groupId.value],
  () => {
    loadTool();
    loadTestHistoryFromStorage();
    loadPresetsFromStorage();
  }
);

// 组件挂载时加载数据
onMounted(() => {
  loadTool();
  loadTestHistoryFromStorage();
  loadPresetsFromStorage();
});
</script>

<style scoped>
.tool-tester {
  padding: 16px;
}

.tester-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-header {
  margin-bottom: 16px;
}

.tool-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-title h2 {
  margin: 0;
  font-size: 20px;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.params-card,
.result-card,
.history-card {
  margin-bottom: 16px;
}

.params-form {
  padding: 16px 0;
}

.no-params {
  text-align: center;
  color: var(--td-text-color-secondary);
  padding: 32px;
}

.params-inputs {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
}

.required {
  color: var(--td-error-color);
}

.param-help {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  cursor: help;
}

.array-input {
  width: 100%;
}

.validation-result {
  margin: 16px 0;
}

.validation-errors ul,
.validation-warnings ul {
  margin: 8px 0;
  padding-left: 20px;
}

.test-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.result-content {
  padding: 16px 0;
}

.execution-status {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border-radius: var(--td-radius-default);
}

.result-data {
  margin-top: 16px;
}

.result-tabs {
  margin-top: 16px;
}

.formatted-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  padding: 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container-hover);
}

.text-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.image-result img {
  max-width: 100%;
  height: auto;
  border-radius: var(--td-radius-default);
}

.resource-result {
  font-size: 14px;
}

.unknown-result pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.raw-result {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.empty-result {
  padding: 32px;
  text-align: center;
}

.test-history {
  margin-top: 16px;
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-time {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.history-params pre {
  margin: 0;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.history-actions {
  margin-top: 8px;
}

.error-state {
  padding: 32px;
  text-align: center;
}

.preset-management {
  padding: 16px 0;
}

.preset-list h4 {
  margin-bottom: 16px;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  margin-bottom: 8px;
}

.preset-info {
  flex: 1;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
}

.preset-description {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.preset-actions {
  display: flex;
  gap: 8px;
}

:deep(.t-descriptions-item__label) {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

:deep(.t-descriptions-item__content) {
  font-size: 12px;
}
</style>