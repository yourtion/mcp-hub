<template>
  <t-dialog
    v-model:visible="dialogVisible"
    :header="dialogTitle"
    width="800px"
    :confirm-btn="confirmBtnProps"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
    @close="handleCancel"
  >
    <div class="server-form">
      <t-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-align="top"
        @submit="handleSubmit"
      >
        <!-- 基本信息 -->
        <div class="form-section">
          <h4 class="section-title">基本信息</h4>
          
          <t-form-item label="服务器ID" name="id">
            <t-input
              v-model="formData.id"
              placeholder="请输入服务器ID，如: my-mcp-server"
              :disabled="mode === 'edit'"
            />
            <template #help>
              服务器的唯一标识符，创建后不可修改
            </template>
          </t-form-item>

          <t-form-item label="服务器类型" name="type">
            <t-radio-group v-model="formData.type" @change="handleTypeChange">
              <t-radio value="stdio">Stdio</t-radio>
              <t-radio value="sse">SSE</t-radio>
              <t-radio value="websocket">WebSocket</t-radio>
            </t-radio-group>
            <template #help>
              选择MCP服务器的连接类型
            </template>
          </t-form-item>

          <t-form-item label="启用状态" name="enabled">
            <t-switch v-model="formData.enabled" />
            <template #help>
              是否启用此服务器
            </template>
          </t-form-item>
        </div>

        <!-- Stdio配置 -->
        <div v-if="formData.type === 'stdio'" class="form-section">
          <h4 class="section-title">Stdio配置</h4>
          
          <t-form-item label="执行命令" name="command">
            <t-input
              v-model="formData.command"
              placeholder="请输入命令，如: npx, uvx, node"
            />
            <template #help>
              用于启动MCP服务器的命令
            </template>
          </t-form-item>

          <t-form-item label="命令参数" name="args">
            <div class="args-input">
              <div 
                v-for="(arg, index) in formData.args" 
                :key="index"
                class="arg-item"
              >
                <t-input
                  v-model="formData.args[index]"
                  :placeholder="`参数 ${index + 1}`"
                />
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click="removeArg(index)"
                >
                  <DeleteIcon />
                </t-button>
              </div>
              <t-button
                theme="default"
                variant="dashed"
                size="small"
                @click="addArg"
              >
                <template #icon>
                  <AddIcon />
                </template>
                添加参数
              </t-button>
            </div>
            <template #help>
              传递给命令的参数列表
            </template>
          </t-form-item>
        </div>

        <!-- SSE/WebSocket配置 -->
        <div v-if="formData.type === 'sse' || formData.type === 'websocket'" class="form-section">
          <h4 class="section-title">{{ formData.type === 'sse' ? 'SSE' : 'WebSocket' }}配置</h4>
          
          <t-form-item label="服务器URL" name="url">
            <t-input
              v-model="formData.url"
              :placeholder="`请输入${formData.type === 'sse' ? 'SSE' : 'WebSocket'}服务器地址`"
            />
            <template #help>
              {{ formData.type === 'sse' ? 'SSE' : 'WebSocket' }}服务器的完整URL地址
            </template>
          </t-form-item>

          <t-form-item label="请求头" name="headers">
            <div class="headers-input">
              <div 
                v-for="(header, index) in formData.headers" 
                :key="index"
                class="header-item"
              >
                <t-input
                  v-model="header.key"
                  placeholder="Header名称"
                  class="header-key"
                />
                <t-input
                  v-model="header.value"
                  placeholder="Header值"
                  class="header-value"
                />
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click="removeHeader(index)"
                >
                  <DeleteIcon />
                </t-button>
              </div>
              <t-button
                theme="default"
                variant="dashed"
                size="small"
                @click="addHeader"
              >
                <template #icon>
                  <AddIcon />
                </template>
                添加请求头
              </t-button>
            </div>
            <template #help>
              发送请求时包含的HTTP头部信息
            </template>
          </t-form-item>
        </div>

        <!-- 环境变量 -->
        <div class="form-section">
          <h4 class="section-title">环境变量</h4>
          
          <t-form-item name="env">
            <div class="env-input">
              <div 
                v-for="(envVar, index) in formData.env" 
                :key="index"
                class="env-item"
              >
                <t-input
                  v-model="envVar.key"
                  placeholder="变量名"
                  class="env-key"
                />
                <t-input
                  v-model="envVar.value"
                  placeholder="变量值"
                  class="env-value"
                  :type="isPasswordField(envVar.key) ? 'password' : 'text'"
                />
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click="removeEnv(index)"
                >
                  <DeleteIcon />
                </t-button>
              </div>
              <t-button
                theme="default"
                variant="dashed"
                size="small"
                @click="addEnv"
              >
                <template #icon>
                  <AddIcon />
                </template>
                添加环境变量
              </t-button>
            </div>
            <template #help>
              传递给MCP服务器的环境变量
            </template>
          </t-form-item>
        </div>

        <!-- 配置预览 -->
        <div class="form-section">
          <h4 class="section-title">配置预览</h4>
          <div class="config-preview">
            <pre>{{ configPreview }}</pre>
          </div>
        </div>

        <!-- 测试按钮 -->
        <div class="form-section">
          <div class="test-actions">
            <t-button
              theme="default"
              variant="outline"
              :loading="validating"
              @click="handleValidate"
            >
              <template #icon>
                <CheckCircleIcon />
              </template>
              验证配置
            </t-button>
            <t-button
              theme="primary"
              variant="outline"
              :loading="testing"
              @click="handleTest"
            >
              <template #icon>
                <PlayCircleIcon />
              </template>
              测试连接
            </t-button>
          </div>
        </div>

        <!-- 验证结果 -->
        <div v-if="validationResult" class="form-section">
          <h4 class="section-title">验证结果</h4>
          <div class="validation-result">
            <div class="validation-status">
              <t-tag :theme="validationResult.isValid ? 'success' : 'danger'">
                {{ validationResult.isValid ? '配置有效' : '配置无效' }}
              </t-tag>
            </div>

            <div v-if="validationResult.errors.length" class="validation-errors">
              <h5>错误信息:</h5>
              <div 
                v-for="error in validationResult.errors" 
                :key="error.code"
                class="validation-item error"
              >
                <ErrorCircleIcon />
                <span>{{ error.message }}</span>
              </div>
            </div>

            <div v-if="validationResult.warnings.length" class="validation-warnings">
              <h5>警告信息:</h5>
              <div 
                v-for="warning in validationResult.warnings" 
                :key="warning.code"
                class="validation-item warning"
              >
                <ErrorCircleIcon />
                <span>{{ warning.message }}</span>
              </div>
            </div>

            <div v-if="validationResult.suggestions.length" class="validation-suggestions">
              <h5>建议:</h5>
              <div 
                v-for="suggestion in validationResult.suggestions" 
                :key="suggestion.field"
                class="validation-item suggestion"
              >
                <InfoCircleIcon />
                <span>{{ suggestion.message }}</span>
                <t-button
                  theme="primary"
                  variant="text"
                  size="small"
                  @click="applySuggestion(suggestion)"
                >
                  应用
                </t-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 测试结果 -->
        <div v-if="testResult" class="form-section">
          <h4 class="section-title">测试结果</h4>
          <div class="test-result">
            <div class="test-status">
              <t-tag :theme="testResult.success ? 'success' : 'danger'">
                {{ testResult.success ? '连接成功' : '连接失败' }}
              </t-tag>
              <span class="test-time">执行时间: {{ testResult.executionTime }}ms</span>
            </div>
            
            <div class="test-message">
              {{ testResult.message }}
            </div>

            <div v-if="testResult.success && testResult.details" class="test-details">
              <h5>连接详情:</h5>
              <div class="test-info">
                <div>状态: <t-tag theme="success">{{ testResult.details.status }}</t-tag></div>
                <div>工具数量: {{ testResult.details.toolCount }}</div>
                <div>连接时间: {{ formatTime(testResult.details.lastConnected) }}</div>
              </div>
              
              <div v-if="testResult.details.tools.length" class="test-tools">
                <h6>可用工具:</h6>
                <div class="tools-list">
                  <t-tag 
                    v-for="tool in testResult.details.tools" 
                    :key="tool.name"
                    variant="light"
                  >
                    {{ tool.name }}
                  </t-tag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </t-form>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import {
  AddIcon,
  DeleteIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  ErrorCircleIcon,
  InfoCircleIcon,
} from 'tdesign-icons-vue-next';
import { useServerStore } from '@/stores/server';
import type { 
  ServerInfo, 
  ServerConfig, 
  ServerType,
  ValidateServerResponse,
  TestServerResponse,
  ValidationSuggestion,
} from '@/types/server';

interface Props {
  visible: boolean;
  server?: ServerInfo | null;
  mode: 'create' | 'edit';
}

interface KeyValuePair {
  key: string;
  value: string;
}

interface FormData {
  id: string;
  type: ServerType;
  enabled: boolean;
  command: string;
  args: string[];
  url: string;
  headers: KeyValuePair[];
  env: KeyValuePair[];
}

const props = withDefaults(defineProps<Props>(), {
  server: null,
});

const emit = defineEmits<{
  'update:visible': [visible: boolean];
  success: [];
}>();

// 状态管理
const serverStore = useServerStore();
const { createServer, updateServer, validateServer, testServer } = serverStore;

// 本地状态
const formRef = ref<FormInstanceFunctions>();
const loading = ref(false);
const validating = ref(false);
const testing = ref(false);
const validationResult = ref<ValidateServerResponse | null>(null);
const testResult = ref<TestServerResponse | null>(null);

// 表单数据
const formData = ref<FormData>({
  id: '',
  type: 'stdio',
  enabled: true,
  command: '',
  args: [],
  url: '',
  headers: [],
  env: [],
});

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const dialogTitle = computed(() => {
  return props.mode === 'create' ? '添加服务器' : '编辑服务器';
});

const confirmBtnProps = computed(() => ({
  content: props.mode === 'create' ? '创建' : '保存',
  loading: loading.value,
}));

const configPreview = computed(() => {
  const config: Partial<ServerConfig> = {
    type: formData.value.type,
    enabled: formData.value.enabled,
  };

  if (formData.value.type === 'stdio') {
    if (formData.value.command) config.command = formData.value.command;
    if (formData.value.args.length) config.args = formData.value.args.filter(arg => arg.trim());
  } else {
    if (formData.value.url) config.url = formData.value.url;
    if (formData.value.headers.length) {
      config.headers = formData.value.headers
        .filter(h => h.key.trim() && h.value.trim())
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
    }
  }

  if (formData.value.env.length) {
    config.env = formData.value.env
      .filter(e => e.key.trim() && e.value.trim())
      .reduce((acc, e) => ({ ...acc, [e.key]: e.value }), {});
  }

  return JSON.stringify(config, null, 2);
});

// 表单验证规则
const formRules: Record<string, FormRule[]> = {
  id: [
    { required: true, message: '请输入服务器ID' },
    { 
      pattern: /^[a-zA-Z0-9-_]+$/, 
      message: '服务器ID只能包含字母、数字、连字符和下划线' 
    },
  ],
  type: [
    { required: true, message: '请选择服务器类型' },
  ],
  command: [
    { 
      required: true, 
      message: '请输入执行命令',
      trigger: 'blur',
    },
  ],
  url: [
    { 
      required: true, 
      message: '请输入服务器URL',
      trigger: 'blur',
    },
    {
      pattern: /^https?:\/\/.+/,
      message: '请输入有效的URL地址',
      trigger: 'blur',
    },
  ],
};

// 工具函数
const isPasswordField = (key: string): boolean => {
  const passwordKeys = ['password', 'token', 'key', 'secret', 'auth'];
  return passwordKeys.some(k => key.toLowerCase().includes(k));
};

const formatTime = (timeStr: string): string => {
  return new Date(timeStr).toLocaleString('zh-CN');
};

// 数组操作
const addArg = () => {
  formData.value.args.push('');
};

const removeArg = (index: number) => {
  formData.value.args.splice(index, 1);
};

const addHeader = () => {
  formData.value.headers.push({ key: '', value: '' });
};

const removeHeader = (index: number) => {
  formData.value.headers.splice(index, 1);
};

const addEnv = () => {
  formData.value.env.push({ key: '', value: '' });
};

const removeEnv = (index: number) => {
  formData.value.env.splice(index, 1);
};

// 事件处理
const handleTypeChange = () => {
  // 清除验证和测试结果
  validationResult.value = null;
  testResult.value = null;
  
  // 重置相关字段
  if (formData.value.type === 'stdio') {
    formData.value.url = '';
    formData.value.headers = [];
  } else {
    formData.value.command = '';
    formData.value.args = [];
  }
};

const handleValidate = async () => {
  try {
    validating.value = true;
    validationResult.value = null;
    
    const config = buildServerConfig();
    const result = await validateServer(config);
    validationResult.value = result;
    
    if (result.isValid) {
      MessagePlugin.success('配置验证通过');
    } else {
      MessagePlugin.warning('配置验证发现问题，请查看详细信息');
    }
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '验证失败');
  } finally {
    validating.value = false;
  }
};

const handleTest = async () => {
  try {
    testing.value = true;
    testResult.value = null;
    
    const config = buildServerConfig();
    const result = await testServer(config);
    testResult.value = result;
    
    if (result.success) {
      MessagePlugin.success('连接测试成功');
    } else {
      MessagePlugin.error('连接测试失败');
    }
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '测试失败');
  } finally {
    testing.value = false;
  }
};

const applySuggestion = (suggestion: ValidationSuggestion) => {
  // 应用建议的值
  const field = suggestion.field as keyof FormData;
  if (field in formData.value) {
    (formData.value as any)[field] = suggestion.suggestedValue;
  }
  MessagePlugin.success('已应用建议');
};

const buildServerConfig = (): ServerConfig => {
  const config: ServerConfig = {
    type: formData.value.type,
    enabled: formData.value.enabled,
  };

  if (formData.value.type === 'stdio') {
    config.command = formData.value.command;
    config.args = formData.value.args.filter(arg => arg.trim());
  } else {
    config.url = formData.value.url;
    if (formData.value.headers.length) {
      config.headers = formData.value.headers
        .filter(h => h.key.trim() && h.value.trim())
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
    }
  }

  if (formData.value.env.length) {
    config.env = formData.value.env
      .filter(e => e.key.trim() && e.value.trim())
      .reduce((acc, e) => ({ ...acc, [e.key]: e.value }), {});
  }

  return config;
};

const resetForm = () => {
  formData.value = {
    id: '',
    type: 'stdio',
    enabled: true,
    command: '',
    args: [],
    url: '',
    headers: [],
    env: [],
  };
  
  validationResult.value = null;
  testResult.value = null;
  
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

const loadServerData = (server: ServerInfo) => {
  formData.value.id = server.id;
  formData.value.type = server.config.type;
  formData.value.enabled = server.config.enabled;
  
  if (server.config.type === 'stdio') {
    formData.value.command = server.config.command || '';
    formData.value.args = server.config.args || [];
  } else {
    formData.value.url = server.config.url || '';
    formData.value.headers = server.config.headers 
      ? Object.entries(server.config.headers).map(([key, value]) => ({ key, value }))
      : [];
  }
  
  formData.value.env = server.config.env 
    ? Object.entries(server.config.env).map(([key, value]) => ({ key, value }))
    : [];
};

const handleSubmit = async () => {
  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;
    
    loading.value = true;
    
    const config = buildServerConfig();
    
    if (props.mode === 'create') {
      await createServer({
        id: formData.value.id,
        config,
      });
      MessagePlugin.success('服务器创建成功');
    } else {
      await updateServer(formData.value.id, { config });
      MessagePlugin.success('服务器更新成功');
    }
    
    emit('success');
  } catch (err) {
    MessagePlugin.error(err instanceof Error ? err.message : '操作失败');
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  dialogVisible.value = false;
};

// 监听器
watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.server && props.mode === 'edit') {
      loadServerData(props.server);
    } else {
      resetForm();
    }
  }
});

// 监听表单类型变化，动态设置验证规则
watch(() => formData.value.type, (type) => {
  nextTick(() => {
    if (type === 'stdio') {
      formRules.command = [{ required: true, message: '请输入执行命令' }];
      delete formRules.url;
    } else {
      formRules.url = [
        { required: true, message: '请输入服务器URL' },
        { pattern: /^https?:\/\/.+/, message: '请输入有效的URL地址' },
      ];
      delete formRules.command;
    }
  });
});
</script>

<style scoped>
.server-form {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

.form-section {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.args-input,
.headers-input,
.env-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arg-item,
.header-item,
.env-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-key,
.env-key {
  flex: 1;
}

.header-value,
.env-value {
  flex: 2;
}

.config-preview {
  background: var(--td-bg-color-code);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  max-height: 200px;
  overflow-y: auto;
}

.config-preview pre {
  margin: 0;
  color: var(--td-text-color-primary);
}

.test-actions {
  display: flex;
  gap: 12px;
}

.validation-result,
.test-result {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  padding: 16px;
}

.validation-status,
.test-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.test-time {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.validation-errors,
.validation-warnings,
.validation-suggestions {
  margin-bottom: 16px;
}

.validation-errors:last-child,
.validation-warnings:last-child,
.validation-suggestions:last-child {
  margin-bottom: 0;
}

.validation-errors h5,
.validation-warnings h5,
.validation-suggestions h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.validation-item:last-child {
  margin-bottom: 0;
}

.validation-item.error {
  background: var(--td-error-color-1);
  color: var(--td-error-color-7);
}

.validation-item.warning {
  background: var(--td-warning-color-1);
  color: var(--td-warning-color-7);
}

.validation-item.suggestion {
  background: var(--td-brand-color-1);
  color: var(--td-brand-color-7);
}

.test-message {
  margin-bottom: 16px;
  color: var(--td-text-color-secondary);
}

.test-details h5,
.test-details h6 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.test-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.test-tools {
  margin-top: 16px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-item,
  .env-item {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-key,
  .header-value,
  .env-key,
  .env-value {
    flex: none;
  }
  
  .test-actions {
    flex-direction: column;
  }
  
  .validation-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>