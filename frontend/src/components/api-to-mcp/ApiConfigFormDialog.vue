<template>
  <t-dialog
    v-model:visible="visible"
    :header="config ? '编辑API配置' : '新建API配置'"
    width="1000px"
    :confirm-btn="{ content: '保存', theme: 'primary', loading }"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #body>
      <t-form
        ref="formRef"
        :data="formData"
        :rules="formRules"
        label-width="120px"
        @submit="handleSubmit"
      >
        <t-row :gutter="16">
          <t-col :span="12">
            <t-form-item label="配置名称" name="name">
              <t-input
                v-model="formData.name"
                placeholder="请输入配置名称"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="12">
            <t-form-item label="配置ID" name="id">
              <t-input
                v-model="formData.id"
                placeholder="请输入配置ID（唯一标识）"
                :disabled="loading || !!config"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="描述" name="description">
          <t-textarea
            v-model="formData.description"
            placeholder="请输入配置描述"
            :rows="3"
            :disabled="loading"
          />
        </t-form-item>

        <t-divider>API端点配置</t-divider>

        <t-row :gutter="16">
          <t-col :span="12">
            <t-form-item label="请求URL" name="api.url">
              <t-input
                v-model="formData.api.url"
                placeholder="https://api.example.com/endpoint"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="12">
            <t-form-item label="请求方法" name="api.method">
              <t-select
                v-model="formData.api.method"
                placeholder="请选择请求方法"
                :disabled="loading"
              >
                <t-option value="GET">GET</t-option>
                <t-option value="POST">POST</t-option>
                <t-option value="PUT">PUT</t-option>
                <t-option value="DELETE">DELETE</t-option>
                <t-option value="PATCH">PATCH</t-option>
                <t-option value="HEAD">HEAD</t-option>
                <t-option value="OPTIONS">OPTIONS</t-option>
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-form-item label="请求头" name="api.headers">
          <div class="headers-section">
            <div
              v-for="(header, index) in formData.api.headers"
              :key="index"
              class="header-item"
            >
              <t-input
                v-model="header.key"
                placeholder="Header名称"
                class="header-key"
                :disabled="loading"
              />
              <t-input
                v-model="header.value"
                placeholder="Header值"
                class="header-value"
                :disabled="loading"
              />
              <t-button
                variant="text"
                theme="danger"
                size="small"
                :disabled="loading"
                @click="removeHeader(index)"
              >
                <template #icon><delete-icon /></template>
              </t-button>
            </div>
            <t-button
              variant="outline"
              size="small"
              :disabled="loading"
              @click="addHeader"
            >
              <template #icon><add-icon /></template>
              添加请求头
            </t-button>
          </div>
        </t-form-item>

        <t-form-item label="超时时间(ms)" name="api.timeout">
          <t-input-number
            v-model="formData.api.timeout"
            placeholder="请求超时时间（毫秒）"
            :min="1000"
            :max="60000"
            :disabled="loading"
          />
        </t-form-item>

        <t-divider>参数配置</t-divider>

        <div class="json-schema-section">
          <div class="schema-header">
            <span>参数JSON Schema</span>
            <t-space>
              <t-button
                variant="outline"
                size="small"
                :disabled="loading"
                @click="loadSchemaTemplate"
              >
                <template #icon><template-icon /></template>
                加载模板
              </t-button>
              <t-button
                variant="outline"
                size="small"
                :disabled="loading"
                @click="validateSchema"
              >
                <template #icon><check-icon /></template>
                验证Schema
              </t-button>
            </t-space>
          </div>
          <t-textarea
            v-model="schemaJson"
            placeholder="请输入参数的JSON Schema定义"
            :rows="8"
            :disabled="loading"
            class="schema-editor"
          />
          <div v-if="schemaError" class="schema-error">
            <t-alert theme="error" :message="schemaError" />
          </div>
        </div>

        <t-divider>响应配置</t-divider>

        <t-row :gutter="16">
          <t-col :span="8">
            <t-form-item label="状态码路径" name="response.statusCodePath">
              <t-input
                v-model="formData.response.statusCodePath"
                placeholder="例如：status"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="8">
            <t-form-item label="数据路径" name="response.dataPath">
              <t-input
                v-model="formData.response.dataPath"
                placeholder="例如：data"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="8">
            <t-form-item label="错误信息路径" name="response.errorMessagePath">
              <t-input
                v-model="formData.response.errorMessagePath"
                placeholder="例如：error.message"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
        </t-row>

        <t-row :gutter="16">
          <t-col :span="12">
            <t-form-item label="成功状态码" name="response.successCodes">
              <t-select
                v-model="formData.response.successCodes"
                multiple
                placeholder="选择成功状态码"
                :disabled="loading"
              >
                <t-option :value="200">200 OK</t-option>
                <t-option :value="201">201 Created</t-option>
                <t-option :value="204">204 No Content</t-option>
                <t-option :value="400">400 Bad Request</t-option>
                <t-option :value="500">500 Internal Server Error</t-option>
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="12">
            <t-form-item label="错误状态码" name="response.errorCodes">
              <t-select
                v-model="formData.response.errorCodes"
                multiple
                placeholder="选择错误状态码"
                :disabled="loading"
              >
                <t-option :value="400">400 Bad Request</t-option>
                <t-option :value="401">401 Unauthorized</t-option>
                <t-option :value="403">403 Forbidden</t-option>
                <t-option :value="404">404 Not Found</t-option>
                <t-option :value="500">500 Internal Server Error</t-option>
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>

        <t-divider>安全配置</t-divider>

        <t-form-item label="认证类型" name="security.type">
          <t-select
            v-model="formData.security.type"
            placeholder="选择认证类型"
            :disabled="loading"
            clearable
          >
            <t-option value="bearer">Bearer Token</t-option>
            <t-option value="basic">Basic Auth</t-option>
            <t-option value="apikey">API Key</t-option>
            <t-option value="oauth2">OAuth 2.0</t-option>
          </t-select>
        </t-form-item>

        <div v-if="formData.security.type" class="security-fields">
          <t-form-item :label="getSecurityLabel()" :name="`security.${getSecurityField()}`">
            <t-input
              v-model="formData.security[getSecurityField()]"
              :placeholder="getSecurityPlaceholder()"
              :disabled="loading"
              :type="formData.security.type === 'basic' ? 'password' : 'text'"
            />
          </t-form-item>
        </div>

        <t-divider>缓存配置</t-divider>

        <t-row :gutter="16">
          <t-col :span="8">
            <t-form-item label="启用缓存" name="cache.enabled">
              <t-switch
                v-model="formData.cache.enabled"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="8">
            <t-form-item v-if="formData.cache.enabled" label="缓存时间(秒)" name="cache.ttl">
              <t-input-number
                v-model="formData.cache.ttl"
                placeholder="缓存有效期（秒）"
                :min="1"
                :max="3600"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
          <t-col :span="8">
            <t-form-item v-if="formData.cache.enabled" label="缓存键" name="cache.key">
              <t-input
                v-model="formData.cache.key"
                placeholder="缓存键模板"
                :disabled="loading"
              />
            </t-form-item>
          </t-col>
        </t-row>
      </t-form>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { DeleteIcon, AddIcon, TemplateIcon, CheckIcon } from 'tdesign-icons-vue-next';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiToolConfig } from '@/types/api-to-mcp';

interface Props {
  visible: boolean;
  config?: ApiToolConfig;
}

interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'submit', config: ApiToolConfig): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  config: undefined,
});

const emit = defineEmits<Emits>();

const formRef = ref();
const loading = ref(false);
const schemaJson = ref('');
const schemaError = ref('');

// 表单数据
const formData = reactive<ApiToolConfig>({
  id: '',
  name: '',
  description: '',
  api: {
    url: '',
    method: 'GET',
    headers: [],
    timeout: 10000,
  },
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  response: {
    statusCodePath: '',
    dataPath: '',
    errorMessagePath: '',
    successCodes: [200, 201, 204],
    errorCodes: [400, 401, 403, 404, 500],
  },
  security: {
    type: '',
    token: '',
    username: '',
    password: '',
    apiKey: '',
    location: '',
  },
  cache: {
    enabled: false,
    ttl: 300,
    key: '',
  },
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' },
    { min: 2, max: 50, message: '配置名称长度为2-50个字符', trigger: 'blur' },
  ],
  id: [
    { required: true, message: '请输入配置ID', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '配置ID只能包含字母、数字、下划线和连字符', trigger: 'blur' },
  ],
  description: [
    { required: true, message: '请输入配置描述', trigger: 'blur' },
    { max: 500, message: '描述长度不能超过500个字符', trigger: 'blur' },
  ],
  'api.url': [
    { required: true, message: '请输入请求URL', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: '请输入有效的URL', trigger: 'blur' },
  ],
  'api.method': [
    { required: true, message: '请选择请求方法', trigger: 'change' },
  ],
};

// 监听props变化，更新表单数据
watch(() => props.visible, (visible) => {
  if (visible && props.config) {
    // 编辑模式
    Object.assign(formData, props.config);
    schemaJson.value = JSON.stringify(formData.parameters, null, 2);
  } else if (visible) {
    // 新建模式
    resetForm();
  }
});

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: '',
    name: '',
    description: '',
    api: {
      url: '',
      method: 'GET',
      headers: [],
      timeout: 10000,
    },
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    response: {
      statusCodePath: '',
      dataPath: '',
      errorMessagePath: '',
      successCodes: [200, 201, 204],
      errorCodes: [400, 401, 403, 404, 500],
    },
    security: {
      type: '',
      token: '',
      username: '',
      password: '',
      apiKey: '',
      location: '',
    },
    cache: {
      enabled: false,
      ttl: 300,
      key: '',
    },
  });
  schemaJson.value = '';
  schemaError.value = '';
};

// 添加请求头
const addHeader = () => {
  formData.api.headers.push({ key: '', value: '' });
};

// 移除请求头
const removeHeader = (index: number) => {
  formData.api.headers.splice(index, 1);
};

// 加载Schema模板
const loadSchemaTemplate = () => {
  const template = {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '第一个参数',
      },
      param2: {
        type: 'number',
        description: '第二个参数',
        minimum: 0,
      },
    },
    required: ['param1'],
  };
  schemaJson.value = JSON.stringify(template, null, 2);
};

// 验证Schema
const validateSchema = async () => {
  try {
    JSON.parse(schemaJson.value);
    schemaError.value = '';
    MessagePlugin.success('Schema格式验证通过');
    return true;
  } catch (error) {
    schemaError.value = `Schema格式错误: ${(error as Error).message}`;
    return false;
  }
};

// 获取安全配置标签
const getSecurityLabel = () => {
  switch (formData.security.type) {
    case 'bearer':
      return 'Bearer Token';
    case 'basic':
      return '用户名';
    case 'apikey':
      return 'API Key';
    case 'oauth2':
      return 'Client ID';
    default:
      return '认证信息';
  }
};

// 获取安全配置字段
const getSecurityField = () => {
  switch (formData.security.type) {
    case 'bearer':
      return 'token';
    case 'basic':
      return 'username';
    case 'apikey':
      return 'apiKey';
    case 'oauth2':
      return 'clientId';
    default:
      return '';
  }
};

// 获取安全配置占位符
const getSecurityPlaceholder = () => {
  switch (formData.security.type) {
    case 'bearer':
      return '请输入Bearer Token';
    case 'basic':
      return '请输入用户名';
    case 'apikey':
      return '请输入API Key';
    case 'oauth2':
      return '请输入Client ID';
    default:
      return '请输入认证信息';
  }
};

// 提交表单
const handleSubmit = async () => {
  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;

    // 验证Schema
    if (!schemaJson.value.trim()) {
      MessagePlugin.error('请输入参数JSON Schema');
      return;
    }

    if (!await validateSchema()) {
      return;
    }

    loading.value = true;

    // 解析Schema
    formData.parameters = JSON.parse(schemaJson.value);

    // 触发提交事件
    emit('submit', { ...formData });
  } catch (error) {
    console.error('表单提交失败:', error);
    MessagePlugin.error('表单提交失败');
  } finally {
    loading.value = false;
  }
};

// 取消操作
const handleCancel = () => {
  emit('update:visible', false);
};
</script>

<style scoped>
.headers-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-key {
  flex: 1;
}

.header-value {
  flex: 2;
}

.json-schema-section {
  margin-bottom: 16px;
}

.schema-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.schema-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.schema-error {
  margin-top: 8px;
}

.security-fields {
  margin-top: 16px;
}
</style>