<template>
  <div class="api-to-mcp-management">
    <div class="page-header">
      <h1>API到MCP管理</h1>
      <div class="header-actions">
        <t-button
          theme="primary"
          @click="handleCreate"
        >
          <template #icon><add-icon /></template>
          新建API配置
        </t-button>
      </div>
    </div>

    <div class="content">
      <!-- API配置列表 -->
      <api-config-list
        ref="configListRef"
        @edit="handleEdit"
        @test="handleTest"
        @view="handleView"
      />
    </div>

    <!-- API配置表单对话框 -->
    <api-config-form-dialog
      v-model:visible="showFormDialog"
      :config="currentConfig"
      @submit="handleFormSubmit"
    />

    <!-- 参数映射编辑器对话框 -->
    <t-dialog
      v-model:visible="showMappingDialog"
      header="参数映射编辑器"
      width="1200px"
      :confirm-btn="{ content: '保存映射', theme: 'primary' }"
      :cancel-btn="{ content: '取消' }"
      @confirm="saveMappings"
      @cancel="showMappingDialog = false"
    >
      <template #body>
        <parameter-mapping-editor
          v-model:mappings="currentMappings"
          :source-schema="mappingSourceSchema"
          @update:mappings="updateMappings"
        />
      </template>
    </t-dialog>

    <!-- API测试对话框 -->
    <t-dialog
      v-model:visible="showTestDialog"
      header="API测试"
      width="1000px"
      :confirm-btn="false"
      :cancel-btn="{ content: '关闭' }"
    >
      <template #body>
        <api-tester
          v-if="currentConfig"
          :config-id="currentConfig.id"
        />
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { AddIcon } from 'tdesign-icons-vue-next';
import { apiToMcpService } from '@/services/api-to-mcp';
import type { ApiToolConfig, ParameterMapping } from '@/types/api-to-mcp';
import ApiConfigList from '@/components/api-to-mcp/ApiConfigList.vue';
import ApiConfigFormDialog from '@/components/api-to-mcp/ApiConfigFormDialog.vue';
import ParameterMappingEditor from '@/components/api-to-mcp/ParameterMappingEditor.vue';
import ApiTester from '@/components/api-to-mcp/ApiTester.vue';

const configListRef = ref();
const showFormDialog = ref(false);
const showMappingDialog = ref(false);
const showTestDialog = ref(false);

const currentConfig = ref<ApiToolConfig | undefined>();
const currentMappings = ref<ParameterMapping[]>([]);
const mappingSourceSchema = ref({});

// 创建配置
const handleCreate = () => {
  currentConfig.value = undefined;
  showFormDialog.value = true;
};

// 编辑配置
const handleEdit = (config: any) => {
  currentConfig.value = config;
  showFormDialog.value = true;
};

// 查看配置
const handleView = async (config: any) => {
  try {
    const details = await apiToMcpService.getConfigDetails(config.id);
    currentConfig.value = details;
    showFormDialog.value = true;
  } catch (error) {
    MessagePlugin.error('获取配置详情失败');
    console.error('获取配置详情失败:', error);
  }
};

// 测试配置
const handleTest = (config: any) => {
  currentConfig.value = config;
  showTestDialog.value = true;
};

// 表单提交处理
const handleFormSubmit = async (config: ApiToolConfig) => {
  try {
    if (config.id) {
      // 更新配置
      await apiToMcpService.updateConfig(config.id, config);
      MessagePlugin.success('配置更新成功');
    } else {
      // 创建配置
      await apiToMcpService.createConfig(config);
      MessagePlugin.success('配置创建成功');
    }
    
    showFormDialog.value = false;
    
    // 刷新列表
    if (configListRef.value) {
      await configListRef.value.loadConfigs();
    }
  } catch (error) {
    MessagePlugin.error('配置保存失败');
    console.error('配置保存失败:', error);
  }
};

// 打开参数映射编辑器
const openMappingEditor = (config: ApiToolConfig) => {
  currentConfig.value = config;
  mappingSourceSchema.value = config.parameters;
  currentMappings.value = []; // 这里可以从配置中加载现有映射
  showMappingDialog.value = true;
};

// 更新映射
const updateMappings = (mappings: ParameterMapping[]) => {
  currentMappings.value = mappings;
};

// 保存映射
const saveMappings = () => {
  if (currentConfig.value) {
    // 这里应该保存映射到配置中
    MessagePlugin.success('参数映射保存成功');
  }
  showMappingDialog.value = false;
};
</script>

<style scoped>
.api-to-mcp-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}
</style>