<template>
  <div class="mcp-page">
    <div class="mcp-page__header">
      <div class="test-header">
        <div>
          <t-button variant="text" size="small" @click="goBack">
            <template #icon><ChevronLeftIcon /></template>
            返回工具详情
          </t-button>
          <h2 class="mcp-page__title test-title">
            测试工具: {{ tool?.name || toolName }}
          </h2>
          <p class="mcp-page__desc">{{ tool?.description || '加载中...' }}</p>
        </div>
      </div>
    </div>

    <t-loading :loading="loading" />

    <template v-if="tool && !loading">
      <div class="mcp-grid mcp-grid--2">
        <!-- Dynamic Form -->
        <div class="mcp-card test-form-card">
          <h3 class="test-form-card__title">参数输入</h3>
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

          <div class="test-form-card__actions">
            <t-button
              theme="primary"
              :loading="testing"
              @click="handleTest"
            >
              <template #icon><CheckCircleIcon /></template>
              验证参数
            </t-button>
          </div>
        </div>

        <!-- Test Results -->
        <div class="test-result-card">
          <h3 class="test-result-card__title">验证结果</h3>
          <template v-if="testResponse">
            <div class="test-result-card__content">
              <!-- Validation Status -->
              <div class="test-result-status">
                <span
                  class="test-result-status__badge"
                  :class="testResponse.validation.isValid
                    ? 'test-result-status__badge--valid'
                    : 'test-result-status__badge--invalid'"
                >
                  {{ testResponse.validation.isValid ? '参数有效' : '参数无效' }}
                </span>
                <span
                  class="test-result-status__badge"
                  :class="testResponse.canExecute
                    ? 'test-result-status__badge--valid'
                    : 'test-result-status__badge--invalid'"
                >
                  {{ testResponse.canExecute ? '可执行' : '不可执行' }}
                </span>
              </div>

              <!-- Server Status -->
              <div class="test-result-meta">
                <span class="test-result-meta__label">服务器状态</span>
                <span>{{ testResponse.serverStatus }}</span>
              </div>
              <div class="test-result-meta">
                <span class="test-result-meta__label">服务器 ID</span>
                <span>{{ testResponse.serverId }}</span>
              </div>

              <!-- Errors -->
              <template v-if="testResponse.validation.errors.length > 0">
                <div class="test-result-errors">
                  <h4 class="test-result-errors__title">错误</h4>
                  <ul class="test-result-errors__list">
                    <li
                      v-for="(err, index) in testResponse.validation.errors"
                      :key="index"
                      class="test-result-errors__item test-result-errors__item--error"
                    >
                      {{ err }}
                    </li>
                  </ul>
                </div>
              </template>

              <!-- Warnings -->
              <template v-if="testResponse.validation.warnings.length > 0">
                <div class="test-result-errors">
                  <h4 class="test-result-errors__title">警告</h4>
                  <ul class="test-result-errors__list">
                    <li
                      v-for="(warn, index) in testResponse.validation.warnings"
                      :key="index"
                      class="test-result-errors__item test-result-errors__item--warning"
                    >
                      {{ warn }}
                    </li>
                  </ul>
                </div>
              </template>
            </div>
          </template>
          <template v-else>
            <div class="mcp-empty">
              <div class="mcp-empty__desc">点击 "验证参数" 查看验证结果</div>
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
import { ChevronLeftIcon, CheckCircleIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import type { ToolInfo, ToolTestResponse, JsonSchemaProperty } from '@/types/tool';

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
const testing = ref(false);
const tool = ref<ToolInfo | null>(null);
const testResponse = ref<ToolTestResponse | null>(null);
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

const handleTest = async () => {
  testing.value = true;
  try {
    const args = buildArguments();
    const result = await toolStore.testTool(toolName.value, { arguments: args });
    testResponse.value = result;

    if (result.validation.isValid) {
      MessagePlugin.success('参数验证通过');
    } else {
      MessagePlugin.warning('参数验证未通过');
    }
  } catch {
    MessagePlugin.error('参数验证失败');
  } finally {
    testing.value = false;
  }
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
          formData[name] = p.default;
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
.test-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.test-title {
  margin-top: var(--space-2);
}

.test-form-card {
  padding: var(--space-5);
}

.test-form-card__title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.test-form-card__actions {
  margin-top: var(--space-5);
  display: flex;
  gap: var(--space-3);
}

.test-result-card {
  padding: var(--space-5);
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.test-result-card__title {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.test-result-card__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.test-result-status {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.test-result-status__badge {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.test-result-status__badge--valid {
  color: var(--success);
  background: var(--success-light);
}

.test-result-status__badge--invalid {
  color: var(--danger);
  background: var(--danger-light);
}

.test-result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-light);
  font-size: var(--text-sm);
}

.test-result-meta__label {
  color: var(--text-secondary);
}

.test-result-errors {
  margin-top: var(--space-2);
}

.test-result-errors__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  margin-bottom: var(--space-2);
}

.test-result-errors__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.test-result-errors__item {
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
}

.test-result-errors__item--error {
  color: var(--danger);
  background: var(--danger-light);
}

.test-result-errors__item--warning {
  color: var(--warning);
  background: var(--warning-light);
}
</style>
