<template>
  <div class="mcp-page">
    <div class="mcp-page__header">
      <div class="exec-header">
        <div>
          <t-button variant="text" size="small" @click="goBack">
            <template #icon><ChevronLeftIcon /></template>
            返回工具详情
          </t-button>
          <h2 class="mcp-page__title exec-title">
            执行工具: {{ tool?.name || toolName }}
          </h2>
          <p class="mcp-page__desc">{{ tool?.description || '加载中...' }}</p>
        </div>
      </div>
    </div>

    <t-loading :loading="loading" />

    <template v-if="tool && !loading">
      <div class="mcp-grid mcp-grid--2">
        <!-- Dynamic Form -->
        <div class="mcp-card exec-form-card">
          <h3 class="exec-form-card__title">参数输入</h3>
          <template v-if="schemaProperties.length > 0">
            <t-form
              ref="formRef"
              :data="formData"
              label-align="top"
              :label-width="0"
            >
              <t-form-item
                v-for="prop in schemaProperties"
                :key="prop.name"
                :label="formLabel(prop)"
                :name="prop.name"
                :rules="formRulesForField(prop)"
              >
                <!-- String with enum -->
                <t-select
                  v-if="prop.type === 'string' && prop.enumValues.length > 0"
                  v-model="formData[prop.name]"
                  :options="prop.enumValues.map((v: string) => ({ label: v, value: v }))"
                  clearable
                  :placeholder="`请选择 ${prop.name}`"
                />

                <!-- String -->
                <t-input
                  v-else-if="prop.type === 'string'"
                  v-model="formData[prop.name]"
                  :placeholder="`请输入 ${prop.name}`"
                  clearable
                />

                <!-- Number / Integer -->
                <t-input-number
                  v-else-if="prop.type === 'number' || prop.type === 'integer'"
                  v-model="formData[prop.name]"
                  :min="prop.minimum"
                  :max="prop.maximum"
                  :placeholder="`请输入 ${prop.name}`"
                  style="width: 100%"
                />

                <!-- Boolean -->
                <t-switch
                  v-else-if="prop.type === 'boolean'"
                  v-model="formData[prop.name]"
                />

                <!-- Array / Object (JSON textarea) -->
                <t-textarea
                  v-else
                  v-model="formData[prop.name]"
                  :placeholder="`请输入 JSON 格式的 ${prop.name}`"
                  :autosize="{ minRows: 3, maxRows: 8 }"
                />
              </t-form-item>
            </t-form>
          </template>
          <template v-else>
            <div class="mcp-empty">
              <div class="mcp-empty__desc">此工具无输入参数</div>
            </div>
          </template>

          <div class="exec-form-card__actions">
            <t-button
              theme="primary"
              :loading="executing"
              @click="handleExecute"
            >
              <template #icon><PlayIcon /></template>
              执行
            </t-button>
            <t-button variant="outline" @click="handleReset">
              重置
            </t-button>
          </div>
        </div>

        <!-- Execution Result -->
        <div class="exec-result-panel">
          <h3 class="exec-result-panel__title">执行结果</h3>

          <template v-if="executing">
            <div class="exec-loading">
              <t-loading size="medium" text="正在执行..." />
            </div>
          </template>

          <template v-else-if="executionResult">
            <ExecutionDetail :execution="executionResult" />
          </template>

          <template v-else>
            <div class="mcp-empty">
              <div class="mcp-empty__icon">&#9654;</div>
              <div class="mcp-empty__title">等待执行</div>
              <div class="mcp-empty__desc">填写参数后点击 "执行" 按钮运行工具</div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeftIcon, PlayIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import { ExecutionDetail } from '@/components/tools';
import type { ToolInfo, ToolExecuteResponse, JsonSchemaProperty } from '@/types/tool';

interface SchemaPropertyEntry {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enumValues: string[];
  minimum: number | undefined;
  maximum: number | undefined;
  defaultValue: unknown;
}

const route = useRoute();
const router = useRouter();
const toolStore = useToolStore();

const toolName = computed(() => route.params.toolName as string);
const loading = ref(false);
const executing = ref(false);
const tool = ref<ToolInfo | null>(null);
const executionResult = ref<ToolExecuteResponse | null>(null);
const formData = reactive<Record<string, unknown>>({});

const schemaProperties = computed((): SchemaPropertyEntry[] => {
  if (!tool.value?.inputSchema?.properties) return [];
  const properties = tool.value.inputSchema.properties;
  const required = tool.value.inputSchema.required || [];

  return Object.entries(properties).map(([name, prop]) => {
    const p = prop as JsonSchemaProperty;
    return {
      name,
      type: p.type || 'string',
      description: p.description || '',
      required: required.includes(name),
      enumValues: p.enum || [],
      minimum: p.minimum,
      maximum: p.maximum,
      defaultValue: p.default,
    };
  });
});

const formLabel = (prop: SchemaPropertyEntry): string => {
  let label = prop.name;
  if (prop.description) {
    label = prop.description;
  }
  if (prop.required) {
    label += ' *';
  }
  return label;
};

const formRulesForField = (prop: SchemaPropertyEntry) => {
  const rules: Record<string, unknown>[] = [];
  if (prop.required) {
    rules.push({ required: true, message: `${prop.name} 是必填参数` });
  }
  return rules;
};

const buildArguments = (): Record<string, unknown> => {
  const args: Record<string, unknown> = {};

  for (const prop of schemaProperties.value) {
    const value = formData[prop.name];

    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Parse JSON fields for array/object types
    if ((prop.type === 'array' || prop.type === 'object') && typeof value === 'string') {
      try {
        args[prop.name] = JSON.parse(value);
      } catch {
        args[prop.name] = value;
      }
    } else {
      args[prop.name] = value;
    }
  }

  return args;
};

const handleExecute = async () => {
  executing.value = true;
  executionResult.value = null;
  try {
    const args = buildArguments();
    const result = await toolStore.executeTool(toolName.value, {
      arguments: args,
    });
    executionResult.value = result;

    if (result.isError) {
      MessagePlugin.error('工具执行失败');
    } else {
      MessagePlugin.success('工具执行成功');
    }
  } catch {
    MessagePlugin.error('工具执行异常');
  } finally {
    executing.value = false;
  }
};

const handleReset = () => {
  // Reset form data to defaults
  for (const key of Object.keys(formData)) {
    formData[key] = undefined;
  }
  if (tool.value?.inputSchema?.properties) {
    for (const [name, prop] of Object.entries(tool.value.inputSchema.properties)) {
      const p = prop as JsonSchemaProperty;
      if (p.default !== undefined) {
        formData[name] = typeof p.default === 'object' ? JSON.stringify(p.default, null, 2) : p.default;
      } else if (p.type === 'boolean') {
        formData[name] = false;
      } else {
        formData[name] = undefined;
      }
    }
  }
  executionResult.value = null;
};

const goBack = () => {
  router.push({ name: 'ToolDetail', params: { toolName: toolName.value } });
};

onMounted(async () => {
  loading.value = true;
  try {
    tool.value = await toolStore.fetchToolDetail(toolName.value);

    // Initialize form data with defaults
    if (tool.value?.inputSchema?.properties) {
      for (const [name, prop] of Object.entries(tool.value.inputSchema.properties)) {
        const p = prop as JsonSchemaProperty;
        if (p.default !== undefined) {
          formData[name] = typeof p.default === 'object' ? JSON.stringify(p.default, null, 2) : p.default;
        } else if (p.type === 'boolean') {
          formData[name] = false;
        } else {
          formData[name] = undefined;
        }
      }
    }
  } catch {
    MessagePlugin.error('获取工具详情失败');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.exec-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.exec-title {
  margin-top: var(--space-2);
}

.exec-form-card {
  padding: var(--space-5);
}

.exec-form-card__title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.exec-form-card__actions {
  margin-top: var(--space-5);
  display: flex;
  gap: var(--space-3);
}

.exec-result-panel {
  padding: var(--space-5);
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.exec-result-panel__title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.exec-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
}
</style>
