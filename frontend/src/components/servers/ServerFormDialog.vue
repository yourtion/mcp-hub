<template>
  <t-dialog
    :visible="visible"
    :header="dialogTitle"
    :width="560"
    placement="center"
    :confirm-on-enter="false"
    @close="handleClose"
    @confirm="handleConfirm"
  >
    <t-form ref="formRef" :data="formData" :rules="formRules" label-align="top" :label-width="0">
      <t-form-item label="服务器 ID" name="id">
        <t-input
          v-model="formData.id"
          placeholder="输入唯一服务器标识符"
          :disabled="mode === 'edit'"
        />
      </t-form-item>

      <t-form-item label="类型" name="type">
        <t-select v-model="formData.type" :options="typeOptions" placeholder="选择服务器类型" />
      </t-form-item>

      <t-form-item v-if="formData.type === 'stdio'" label="命令 (Command)" name="command">
        <t-input v-model="formData.command" placeholder="例如: npx, python" />
      </t-form-item>

      <t-form-item v-if="formData.type === 'stdio'" label="参数 (Args)" name="args">
        <t-input
          v-model="formData.argsText"
          placeholder="逗号分隔，例如: -y, @modelcontextprotocol/server"
        />
      </t-form-item>

      <t-form-item
        v-if="formData.type === 'sse' || formData.type === 'streaming'"
        label="URL"
        name="url"
      >
        <t-input v-model="formData.url" placeholder="例如: http://localhost:3000/sse" />
      </t-form-item>

      <t-form-item
        v-if="formData.type === 'sse' || formData.type === 'streaming'"
        label="请求头 (Headers)"
        name="headers"
      >
        <t-textarea
          v-model="formData.headersText"
          placeholder='JSON 格式，例如: {"Authorization": "Bearer xxx"}'
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </t-form-item>

      <t-form-item label="环境变量 (Env)" name="env">
        <t-textarea
          v-model="formData.envText"
          placeholder='JSON 格式，例如: {"API_KEY": "xxx"}'
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </t-form-item>

      <t-form-item label="启用" name="enabled">
        <t-switch v-model="formData.enabled" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { ref, reactive, watch, computed } from 'vue';

import type {
  ServerInfo,
  ServerType,
  CreateServerRequest,
  UpdateServerRequest,
} from '@/types/server';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';

const props = defineProps<{
  visible: boolean;
  mode: 'create' | 'edit';
  serverData: ServerInfo | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [data: CreateServerRequest | UpdateServerRequest];
}>();

const formRef = ref<FormInstanceFunctions | null>(null);

const dialogTitle = computed(() => (props.mode === 'create' ? '添加服务器' : '编辑服务器'));

const typeOptions = [
  { label: 'Stdio', value: 'stdio' },
  { label: 'SSE', value: 'sse' },
  { label: 'Streaming HTTP', value: 'streaming' },
];

interface FormState {
  id: string;
  type: ServerType;
  command: string;
  argsText: string;
  url: string;
  headersText: string;
  envText: string;
  enabled: boolean;
}

const formData = reactive<FormState>({
  id: '',
  type: 'stdio',
  command: '',
  argsText: '',
  url: '',
  headersText: '',
  envText: '',
  enabled: true,
});

const formRules: Record<string, FormRule[]> = {
  id: [{ required: true, message: '请输入服务器 ID', trigger: 'blur' }],
  type: [{ required: true, message: '请选择服务器类型', trigger: 'change' }],
  command: [{ required: true, message: '请输入命令', trigger: 'blur' }],
  url: [{ required: true, message: '请输入 URL', trigger: 'blur' }],
};

// Watch for serverData changes to populate form in edit mode
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible && props.mode === 'edit' && props.serverData) {
      const config = props.serverData.config;
      formData.id = props.serverData.id;
      formData.type = config.type;
      formData.command = config.command ?? '';
      formData.argsText = config.args?.join(', ') ?? '';
      formData.url = config.url ?? '';
      formData.headersText = config.headers ? JSON.stringify(config.headers, null, 2) : '';
      formData.envText = config.env ? JSON.stringify(config.env, null, 2) : '';
      formData.enabled = config.enabled;
    } else if (isVisible && props.mode === 'create') {
      resetForm();
    }
  },
);

function resetForm() {
  formData.id = '';
  formData.type = 'stdio';
  formData.command = '';
  formData.argsText = '';
  formData.url = '';
  formData.headersText = '';
  formData.envText = '';
  formData.enabled = true;
}

function parseJsonField(text: string): Record<string, string> | undefined {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return undefined;
  }
}

function buildConfig() {
  const isStdio = formData.type === 'stdio';
  const isRemote = formData.type === 'sse' || formData.type === 'streaming';

  return {
    type: formData.type,
    command: isStdio ? formData.command : undefined,
    args:
      isStdio && formData.argsText.trim()
        ? formData.argsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    url: isRemote ? formData.url : undefined,
    headers: isRemote ? parseJsonField(formData.headersText) : undefined,
    env: parseJsonField(formData.envText),
    enabled: formData.enabled,
  };
}

async function handleConfirm() {
  const validateResult = await formRef.value?.validate();
  if (validateResult !== true) return;

  // Validate JSON fields
  if (formData.headersText.trim()) {
    try {
      JSON.parse(formData.headersText);
    } catch {
      MessagePlugin.error('Headers 必须是有效的 JSON 格式');
      return;
    }
  }
  if (formData.envText.trim()) {
    try {
      JSON.parse(formData.envText);
    } catch {
      MessagePlugin.error('环境变量必须是有效的 JSON 格式');
      return;
    }
  }

  const config = buildConfig();

  if (props.mode === 'create') {
    emit('submit', { id: formData.id, config });
  } else {
    emit('submit', { config });
  }

  emit('update:visible', false);
}

function handleClose() {
  emit('update:visible', false);
}
</script>

<style scoped>
/* Dialog form styling handled by TDesign defaults and CSS variables */
</style>
