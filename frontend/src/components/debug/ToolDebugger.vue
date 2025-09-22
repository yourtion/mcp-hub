<template>
  <div class="tool-debugger">
    <t-row :gutter="[16, 16]">
      <t-col :span="8">
        <t-card title="工具测试" :bordered="false">
          <t-form
            ref="formRef"
            :data="formData"
            :rules="formRules"
            @submit="handleTestTool"
            label-width="100px"
          >
            <t-form-item label="工具名称" name="toolName">
              <t-select
                v-model="formData.toolName"
                placeholder="选择要测试的工具"
                :options="toolOptions"
                clearable
                filterable
              />
            </t-form-item>
            
            <t-form-item label="服务器" name="serverId">
              <t-select
                v-model="formData.serverId"
                placeholder="选择服务器（可选）"
                :options="serverOptions"
                clearable
                filterable
              />
            </t-form-item>
            
            <t-form-item label="组" name="groupId">
              <t-select
                v-model="formData.groupId"
                placeholder="选择组（可选）"
                :options="groupOptions"
                clearable
                filterable
              />
            </t-form-item>
            
            <t-form-item label="参数" name="arguments">
              <t-textarea
                v-model="argumentsJson"
                placeholder='输入工具参数的JSON格式，例如：{"param1": "value1", "param2": 123}'
                :autosize="{ minRows: 4, maxRows: 8 }"
              />
            </t-form-item>
            
            <t-form-item>
              <t-space>
                <t-button theme="primary" type="submit" :loading="testing">
                  执行测试
                </t-button>
                <t-button variant="outline" @click="clearForm">
                  清空
                </t-button>
              </t-space>
            </t-form-item>
          </t-form>
        </t-card>
      </t-col>
      
      <t-col :span="4">
        <t-card title="测试历史" :bordered="false">
          <t-list :split="true" size="small">
            <t-list-item
              v-for="record in testHistory"
              :key="record.id"
              @click="loadTestRecord(record)"
            >
              <t-list-item-meta
                :title="record.toolName"
                :description="`${formatTime(record.timestamp)} (${record.executionTime}ms)`"
              />
              <template #action>
                <t-tag
                  :theme="record.success ? 'success' : 'danger'"
                  variant="light"
                >
                  {{ record.success ? '成功' : '失败' }}
                </t-tag>
              </template>
            </t-list-item>
          </t-list>
        </t-card>
      </t-col>
    </t-row>
    
    <!-- 测试结果 -->
    <t-card
      v-if="testResult"
      title="测试结果"
      :bordered="false"
      class="result-card"
    >
      <template #actions>
        <t-button
          size="small"
          variant="outline"
          @click="copyResult"
        >
          复制结果
        </t-button>
      </template>
      
      <t-row :gutter="[16, 16]">
        <t-col :span="6">
          <t-descriptions
            title="执行信息"
            :column="1"
            size="small"
            bordered
          >
            <t-descriptions-item label="工具名称">{{ testResult.toolName }}</t-descriptions-item>
            <t-descriptions-item label="执行时间">{{ testResult.executionTime }}ms</t-descriptions-item>
            <t-descriptions-item label="服务器">{{ testResult.serverId || 'N/A' }}</t-descriptions-item>
            <t-descriptions-item label="组">{{ testResult.groupId || 'N/A' }}</t-descriptions-item>
            <t-descriptions-item label="时间">{{ formatTime(testResult.timestamp) }}</t-descriptions-item>
          </t-descriptions>
        </t-col>
        
        <t-col :span="6">
          <div class="result-content">
            <h4>参数</h4>
            <pre class="json-display">{{ formatJson(testResult.arguments) }}</pre>
            
            <h4>结果</h4>
            <pre class="json-display">{{ formatJson(testResult.result) }}</pre>
          </div>
        </t-col>
      </t-row>
    </t-card>
    
    <!-- 错误信息 -->
    <t-alert
      v-if="testError"
      theme="error"
      :message="testError"
      class="error-alert"
      closable
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { testTool } from '@/services/debug';
import type { ToolTestRequest, ToolTestResponse } from '@/types/debug';
import { useToolStore } from '@/stores/tool';
import { useServerStore } from '@/stores/server';
import { useGroupStore } from '@/stores/group';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// Stores
const toolStore = useToolStore();
const serverStore = useServerStore();
const groupStore = useGroupStore();

// Reactive data
const formData = ref({
  toolName: '',
  serverId: '',
  groupId: '',
  arguments: '{}',
});

const argumentsJson = ref('{}');
const testing = ref(false);
const testResult = ref<ToolTestResponse | null>(null);
const testError = ref<string | null>(null);
const testHistory = ref<Array<ToolTestResponse & { id: string; timestamp: string; success: boolean }>>([]);

// Form validation rules
const formRules = {
  toolName: [{ required: true, message: '请选择工具名称', trigger: 'change' }],
};

// Computed properties
const toolOptions = computed(() => {
  return Array.from(toolStore.tools.values()).map(tool => ({
    label: `${tool.name} (${tool.serverId})`,
    value: tool.name,
  }));
});

const serverOptions = computed(() => {
  return Array.from(serverStore.servers.values()).map(server => ({
    label: server.name || server.id,
    value: server.id,
  }));
});

const groupOptions = computed(() => {
  return Array.from(groupStore.groups.values()).map(group => ({
    label: group.name,
    value: group.id,
  }));
});

// Methods
const handleTestTool = async ({ validateResult, firstError }: { validateResult: any; firstError: any }) => {
  if (validateResult !== true) {
    return;
  }
  
  testing.value = true;
  testError.value = null;
  
  try {
    // Parse arguments
    let args = {};
    if (argumentsJson.value.trim()) {
      args = JSON.parse(argumentsJson.value);
    }
    
    const request: ToolTestRequest = {
      toolName: formData.value.toolName,
      serverId: formData.value.serverId || undefined,
      groupId: formData.value.groupId || undefined,
      arguments: args,
    };
    
    const result = await testTool(request);
    
    testResult.value = {
      ...result,
      timestamp: new Date().toISOString(),
    };
    
    // Add to history
    testHistory.value.unshift({
      ...result,
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      success: true,
    });
    
    // Keep only last 20 records
    if (testHistory.value.length > 20) {
      testHistory.value = testHistory.value.slice(0, 20);
    }
  } catch (error: any) {
    testError.value = error.message || '测试执行失败';
    
    // Add error to history
    testHistory.value.unshift({
      toolName: formData.value.toolName,
      serverId: formData.value.serverId,
      groupId: formData.value.groupId,
      arguments: JSON.parse(argumentsJson.value || '{}'),
      result: null,
      executionTime: 0,
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      success: false,
    });
    
    // Keep only last 20 records
    if (testHistory.value.length > 20) {
      testHistory.value = testHistory.value.slice(0, 20);
    }
  } finally {
    testing.value = false;
  }
};

const clearForm = () => {
  formData.value = {
    toolName: '',
    serverId: '',
    groupId: '',
    arguments: '{}',
  };
  argumentsJson.value = '{}';
  testResult.value = null;
  testError.value = null;
};

const loadTestRecord = (record: any) => {
  formData.value.toolName = record.toolName;
  formData.value.serverId = record.serverId || '';
  formData.value.groupId = record.groupId || '';
  argumentsJson.value = JSON.stringify(record.arguments, null, 2);
  testResult.value = record;
};

const copyResult = () => {
  if (testResult.value) {
    const resultText = JSON.stringify(testResult.value, null, 2);
    navigator.clipboard.writeText(resultText);
  }
};

const formatTime = (timestamp: string) => {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
};

const formatJson = (content: unknown) => {
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
};

// Watch for changes in form data
const updateArgumentsJson = () => {
  try {
    const args = JSON.parse(formData.value.arguments);
    argumentsJson.value = JSON.stringify(args, null, 2);
  } catch {
    // Keep current value if parsing fails
  }
};

const updateFormDataArguments = () => {
  formData.value.arguments = argumentsJson.value;
};

// Lifecycle
onMounted(() => {
  // Load tools, servers, and groups
  toolStore.fetchTools();
  serverStore.fetchServers();
  groupStore.fetchGroups();
});
</script>

<style scoped>
.tool-debugger {
  height: 100%;
}

.result-card {
  margin-top: 16px;
}

.result-content {
  max-height: 400px;
  overflow-y: auto;
}

.result-content h4 {
  margin: 16px 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.json-display {
  background: var(--td-bg-color-page);
  border: 1px solid var(--td-border-level-2-color);
  border-radius: var(--td-radius-default);
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-alert {
  margin-top: 16px;
}
</style>