<template>
  <t-dialog
    :visible="visible"
    header="导入API配置"
    width="600px"
    :confirm-btn="{ content: '导入', theme: 'primary', loading }"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
    @update:visible="emit('update:visible', $event)"
  >
    <template #body>
      <t-form
        ref="formRef"
        :data="formData"
        :rules="formRules"
        label-width="100px"
      >
        <t-form-item label="导入格式" name="format">
          <t-select
            v-model="formData.format"
            placeholder="选择导入格式"
            @change="handleFormatChange"
          >
            <t-option value="openapi">OpenAPI (Swagger)</t-option>
            <t-option value="postman">Postman Collection</t-option>
            <t-option value="manual">手动输入JSON</t-option>
          </t-select>
        </t-form-item>

        <t-form-item
          v-if="formData.format !== 'manual'"
          label="导入文件"
          name="file"
        >
          <t-upload
            v-model="fileList"
            :format="getFileFormat"
            :max="1"
            :disabled="loading"
            theme="file"
            accept=".json,.yaml,.yml"
            @change="handleFileChange"
          />
        </t-form-item>

        <t-form-item
          v-if="formData.format === 'manual'"
          label="配置数据"
          name="configData"
        >
          <t-textarea
            v-model="formData.configData"
            placeholder="请输入API配置的JSON数据"
            :rows="10"
            class="config-editor"
          />
        </t-form-item>

        <t-form-item
          v-if="formData.format === 'openapi' || formData.format === 'postman'"
          label="或输入URL"
          name="sourceUrl"
        >
          <t-input
            v-model="formData.sourceUrl"
            placeholder="https://example.com/openapi.json"
          />
        </t-form-item>

        <t-divider>导入选项</t-divider>

        <t-form-item label="包含参数" name="options.includeParameters">
          <t-switch
            v-model="formData.options.includeParameters"
            :disabled="loading"
          />
          <span class="option-hint">是否导入API参数配置</span>
        </t-form-item>

        <t-form-item label="包含安全" name="options.includeSecurity">
          <t-switch
            v-model="formData.options.includeSecurity"
            :disabled="loading"
          />
          <span class="option-hint">是否导入安全配置</span>
        </t-form-item>

        <t-form-item label="生成工具" name="options.generateTools">
          <t-switch
            v-model="formData.options.generateTools"
            :disabled="loading"
          />
          <span class="option-hint">是否自动生成MCP工具</span>
        </t-form-item>
      </t-form>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiImportConfig, ApiToolConfig } from '@/types/api-to-mcp';

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'submit', result: { configs: ApiToolConfig[]; message: string }): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
});

const emit = defineEmits<Emits>();

const formRef = ref();
const loading = ref(false);
const fileList = ref([]);

// 表单数据
const formData = reactive<ApiImportConfig>({
  format: 'openapi',
  source: '',
  options: {
    includeParameters: true,
    includeSecurity: false,
    generateTools: true,
  },
  configData: '',
  sourceUrl: '',
});

// 表单验证规则
const formRules = {
  format: [
    { required: true, message: '请选择导入格式', trigger: 'change' },
  ],
  file: [
    { 
      required: true, 
      message: '请选择导入文件', 
      trigger: 'change',
      validator: (rule: any, value: any) => {
        if (formData.format === 'manual') return true;
        return fileList.value.length > 0;
      }
    },
  ],
  configData: [
    { 
      required: true, 
      message: '请输入配置数据', 
      trigger: 'blur',
      validator: (rule: any, value: any) => {
        if (formData.format !== 'manual') return true;
        return value && value.trim().length > 0;
      }
    },
  ],
};

// 获取文件格式
const getFileFormat = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension || 'unknown';
};

// 格式变更处理
const handleFormatChange = () => {
  fileList.value = [];
  formData.configData = '';
  formData.sourceUrl = '';
};

// 文件变更处理
const handleFileChange = (files: any[]) => {
  fileList.value = files;
};

// 提交表单
const handleSubmit = async () => {
  try {
    const valid = await formRef.value?.validate();
    if (!valid) return;

    loading.value = true;

    let importConfig: ApiImportConfig;

    if (formData.format === 'manual') {
      // 手动输入JSON
      if (!formData.configData.trim()) {
        MessagePlugin.error('请输入配置数据');
        return;
      }

      try {
        // 验证JSON格式
        JSON.parse(formData.configData);
      } catch (error) {
        MessagePlugin.error('配置数据格式错误，请检查JSON格式');
        return;
      }

      importConfig = {
        format: formData.format,
        source: formData.configData,
        options: formData.options,
      };
    } else if (formData.sourceUrl) {
      // 从URL导入
      importConfig = {
        format: formData.format,
        source: formData.sourceUrl,
        options: formData.options,
      };
    } else if (fileList.value.length > 0) {
      // 从文件导入
      importConfig = {
        format: formData.format,
        source: fileList.value[0].raw,
        options: formData.options,
      };
    } else {
      MessagePlugin.error('请选择导入文件或输入URL');
      return;
    }

    // 调用导入API
    const result = await apiToMcpService.importConfig(importConfig);
    
    MessagePlugin.success(`成功导入 ${result.configs.length} 个API配置`);
    emit('submit', result);
  } catch (error) {
    console.error('导入失败:', error);
    MessagePlugin.error('导入失败: ' + (error as Error).message);
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
.option-hint {
  margin-left: 8px;
  color: var(--td-text-color-secondary);
  font-size: 14px;
}

.config-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}
</style>