<template>
  <t-dialog
    v-model:visible="visible"
    header="导出API配置"
    width="600px"
    :confirm-btn="{ content: '导出', theme: 'primary', loading }"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #body>
      <t-form
        ref="formRef"
        :data="formData"
        :rules="formRules"
        label-width="100px"
      >
        <t-form-item label="导出格式" name="format">
          <t-select
            v-model="formData.format"
            placeholder="选择导出格式"
            @change="handleFormatChange"
          >
            <t-option value="json">JSON</t-option>
            <t-option value="yaml">YAML</t-option>
            <t-option value="postman">Postman Collection</t-option>
          </t-select>
        </t-form-item>

        <t-form-item label="选择配置" name="configs">
          <div class="config-selection">
            <t-checkbox
              :checked="allSelected"
              :indeterminate="partialSelected"
              @change="handleSelectAll"
            >
              全选
            </t-checkbox>
            <t-checkbox-group
              v-model="formData.configs"
              :options="configOptions"
              class="config-checkboxes"
            />
          </div>
        </t-form-item>

        <t-divider>导出选项</t-divider>

        <t-form-item label="包含元数据" name="options.includeMetadata">
          <t-switch
            v-model="formData.options.includeMetadata"
            :disabled="loading"
          />
          <span class="option-hint">是否包含配置名称、描述等元数据</span>
        </t-form-item>

        <t-form-item label="包含安全" name="options.includeSecurity">
          <t-switch
            v-model="formData.options.includeSecurity"
            :disabled="loading"
          />
          <span class="option-hint">是否包含安全配置（敏感信息将被脱敏）</span>
        </t-form-item>

        <t-divider>预览</t-divider>

        <t-form-item label="文件名" name="filename">
          <t-input
            v-model="formData.filename"
            placeholder="api-config-export"
            :disabled="loading"
          />
        </t-form-item>

        <div class="export-preview">
          <div class="preview-header">
            <span>导出预览</span>
            <t-button
              variant="outline"
              size="small"
              :disabled="loading"
              @click="generatePreview"
            >
              <template #icon><refresh-icon /></template>
              刷新预览
            </t-button>
          </div>
          <div class="preview-content">
            <t-textarea
              :value="previewContent"
              readonly
              :rows="8"
              class="preview-editor"
            />
          </div>
        </div>
      </t-form>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon } from 'tdesign-icons-vue-next';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiExportConfig, ApiConfigInfo } from '@/types/api-to-mcp';

interface Props {
  visible: boolean;
  configs: ApiConfigInfo[];
}

interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'submit', result: { data: string; filename: string; message: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  configs: () => [],
});

const emit = defineEmits<Emits>();

const formRef = ref();
const loading = ref(false);
const previewContent = ref('');

// 表单数据
const formData = reactive<ApiExportConfig>({
  format: 'json',
  configs: [],
  options: {
    includeMetadata: true,
    includeSecurity: false,
  },
  filename: 'api-config-export',
});

// 表单验证规则
const formRules = {
  format: [
    { required: true, message: '请选择导出格式', trigger: 'change' },
  ],
  configs: [
    { required: true, message: '请至少选择一个配置', trigger: 'change' },
  ],
  filename: [
    { required: true, message: '请输入文件名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '文件名只能包含字母、数字、下划线和连字符', trigger: 'blur' },
  ],
};

// 配置选项
const configOptions = computed(() => {
  return props.configs.map(config => ({
    label: `${config.name} (${config.api.method} ${config.api.url})`,
    value: config.id,
  }));
});

// 全选状态
const allSelected = computed(() => {
  return formData.configs.length === props.configs.length && props.configs.length > 0;
});

// 部分选择状态
const partialSelected = computed(() => {
  return formData.configs.length > 0 && formData.configs.length < props.configs.length;
});

// 监听props变化
watch(() => props.visible, (visible) => {
  if (visible) {
    // 默认选中所有配置
    formData.configs = props.configs.map(config => config.id);
    generatePreview();
  }
});

// 格式变更处理
const handleFormatChange = () => {
  // 更新文件扩展名
  const extension = formData.format === 'yaml' ? '.yaml' : '.json';
  if (formData.filename.endsWith('.json') || formData.filename.endsWith('.yaml')) {
    formData.filename = formData.filename.replace(/\.(json|yaml)$/, extension);
  } else {
    formData.filename += extension;
  }
  generatePreview();
};

// 全选处理
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    formData.configs = props.configs.map(config => config.id);
  } else {
    formData.configs = [];
  }
};

// 生成预览
const generatePreview = async () => {
  if (formData.configs.length === 0) {
    previewContent.value = '请先选择要导出的配置';
    return;
  }

  try {
    // 模拟预览数据
    const previewData = {
      format: formData.format,
      configs: formData.configs.slice(0, 2), // 只预览前两个配置
      options: formData.options,
      timestamp: new Date().toISOString(),
    };

    if (formData.format === 'json') {
      previewContent.value = JSON.stringify(previewData, null, 2);
    } else if (formData.format === 'yaml') {
      // 简单的YAML转换（实际应该使用YAML库）
      previewContent.value = `format: ${previewData.format}
configs: ${previewData.configs.length}
options:
  includeMetadata: ${previewData.options.includeMetadata}
  includeSecurity: ${previewData.options.includeSecurity}
timestamp: ${previewData.timestamp}
# 完整数据将在导出时生成`;
    } else if (formData.format === 'postman') {
      previewContent.value = JSON.stringify({
        info: {
          name: 'MCP Hub API Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: previewData.configs.map((id, index) => ({
          name: `API Config ${index + 1}`,
          request: {
            method: 'GET',
            url: 'https://api.example.com/endpoint',
          },
        })),
      }, null, 2);
    }
  } catch (error) {
    previewContent.value = '预览生成失败';
    console.error('预览生成失败:', error);
  }
};

// 提交表单
const handleSubmit = async () => {
  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;

    if (formData.configs.length === 0) {
      MessagePlugin.error('请至少选择一个配置');
      return;
    }

    loading.value = true;

    // 调用导出API
    const result = await apiToMcpService.exportConfig(formData);
    
    MessagePlugin.success('导出成功');
    emit('submit', result);
  } catch (error) {
    console.error('导出失败:', error);
    MessagePlugin.error('导出失败: ' + (error as Error).message);
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
.config-selection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-checkboxes {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 4px;
}

.option-hint {
  margin-left: 8px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.export-preview {
  margin-top: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.preview-content {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 4px;
  overflow: hidden;
}

.preview-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  border: none;
  resize: none;
}
</style>