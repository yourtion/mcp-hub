<template>
  <div class="error-analyzer">
    <t-row :gutter="[16, 16]">
      <!-- 错误统计 -->
      <t-col :span="12">
        <t-card title="错误统计" :bordered="false">
          <t-row :gutter="[16, 16]">
            <t-col :span="4">
              <t-statistic
                title="总错误数"
                :value="errorAnalysis.totalErrors"
                :value-style="{ color: '#ff4d4f' }"
              />
            </t-col>
            <t-col :span="4">
              <t-statistic
                title="错误率"
                :value="errorAnalysis.errorRate"
                :suffix="'%'"
                :value-style="{ color: errorAnalysis.errorRate > 10 ? '#ff4d4f' : '#fa8c16' }"
              />
            </t-col>
            <t-col :span="4">
              <t-statistic
                title="常见错误类型"
                :value="Object.keys(errorAnalysis.mostCommonErrors).length"
                :value-style="{ color: '#722ed1' }"
              />
            </t-col>
          </t-row>
        </t-card>
      </t-col>
      
      <!-- 常见错误 -->
      <t-col :span="12">
        <t-card title="常见错误分析" :bordered="false">
          <t-table
            :data="commonErrors"
            :columns="errorColumns"
            row-key="error"
            size="small"
          >
            <template #error="{ row }">
              <div class="error-message">{{ row.error }}</div>
            </template>
            
            <template #count="{ row }">
              <t-progress
                :percentage="row.percentage"
                :color="getErrorProgressColor(row.percentage)"
                size="small"
              />
              <span class="count-text">{{ row.count }}</span>
            </template>
          </t-table>
        </t-card>
      </t-col>
      
      <!-- 最近错误 -->
      <t-col :span="12">
        <t-card title="最近错误消息" :bordered="false">
          <t-table
            :data="recentErrors"
            :columns="messageColumns"
            :loading="loading"
            row-key="id"
            size="small"
          >
            <template #type="{ row }">
              <t-tag theme="danger" variant="light">错误</t-tag>
            </template>
            
            <template #timestamp="{ row }">
              {{ formatTime(row.timestamp) }}
            </template>
            
            <template #serverId="{ row }">
              <t-tag variant="outline">{{ row.serverId }}</t-tag>
            </template>
            
            <template #method="{ row }">
              <t-tag variant="outline">{{ row.method }}</t-tag>
            </template>
            
            <template #content="{ row }">
              <div class="content-preview" @click="showMessageDetail(row)">
                {{ getErrorMessage(row.content) }}
              </div>
            </template>
            
            <template #action="{ row }">
              <t-button
                size="small"
                variant="outline"
                @click="showMessageDetail(row)"
              >
                详情
              </t-button>
            </template>
          </t-table>
        </t-card>
      </t-col>
    </t-row>
    
    <div class="actions-bar">
      <t-space>
        <t-button @click="refreshAnalysis" variant="outline">
          <template #icon>
            <refresh-icon />
          </template>
          刷新分析
        </t-button>
        <t-button @click="clearErrors" theme="danger" variant="outline">
          <template #icon>
            <delete-icon />
          </template>
          清空错误
        </t-button>
      </t-space>
    </div>
    
    <!-- 错误详情对话框 -->
    <t-dialog
      v-model:visible="showDetailDialog"
      header="错误详情"
      width="600px"
      :footer="false"
    >
      <div v-if="selectedMessage" class="message-detail">
        <t-descriptions
          :column="1"
          size="small"
          bordered
        >
          <t-descriptions-item label="ID">{{ selectedMessage.id }}</t-descriptions-item>
          <t-descriptions-item label="时间">{{ formatTime(selectedMessage.timestamp) }}</t-descriptions-item>
          <t-descriptions-item label="服务器">{{ selectedMessage.serverId }}</t-descriptions-item>
          <t-descriptions-item label="类型">
            <t-tag theme="danger" variant="light">错误</t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="方法">{{ selectedMessage.method }}</t-descriptions-item>
        </t-descriptions>
        
        <div class="content-section">
          <h4>错误内容</h4>
          <pre class="content-json">{{ formatJson(selectedMessage.content) }}</pre>
        </div>
        
        <div class="suggestion-section" v-if="errorSuggestion">
          <h4>修复建议</h4>
          <t-alert theme="info" :message="errorSuggestion" />
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RefreshIcon, DeleteIcon } from 'tdesign-icons-vue-next';
import { getErrorAnalysis } from '@/services/debug';
import type { McpMessage, ErrorAnalysis } from '@/types/debug';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// Reactive data
const errorAnalysis = ref<ErrorAnalysis>({
  totalErrors: 0,
  errorRate: 0,
  mostCommonErrors: {},
  recentErrors: [],
});

const loading = ref(false);
const showDetailDialog = ref(false);
const selectedMessage = ref<McpMessage | null>(null);
const errorSuggestion = ref<string | null>(null);

// Computed properties
const commonErrors = computed(() => {
  return Object.entries(errorAnalysis.value.mostCommonErrors)
    .map(([error, count]) => {
      const percentage = errorAnalysis.value.totalErrors > 0 
        ? Math.round((count / errorAnalysis.value.totalErrors) * 100)
        : 0;
      return {
        error,
        count,
        percentage,
      };
    })
    .sort((a, b) => b.count - a.count);
});

const recentErrors = computed(() => {
  return errorAnalysis.value.recentErrors;
});

// Table columns
const errorColumns = [
  {
    title: '错误信息',
    colKey: 'error',
  },
  {
    title: '出现次数',
    colKey: 'count',
    width: 200,
  },
];

const messageColumns = [
  {
    title: '类型',
    colKey: 'type',
    width: 80,
  },
  {
    title: '时间',
    colKey: 'timestamp',
    width: 180,
  },
  {
    title: '服务器',
    colKey: 'serverId',
    width: 120,
  },
  {
    title: '方法',
    colKey: 'method',
    width: 150,
  },
  {
    title: '错误信息',
    colKey: 'content',
  },
  {
    title: '操作',
    colKey: 'action',
    width: 80,
    fixed: 'right',
  },
];

// Methods
const loadAnalysis = async () => {
  loading.value = true;
  try {
    const response = await getErrorAnalysis();
    errorAnalysis.value = response.analysis;
  } catch (error) {
    console.error('Failed to load error analysis:', error);
  } finally {
    loading.value = false;
  }
};

const refreshAnalysis = () => {
  loadAnalysis();
};

const clearErrors = () => {
  errorAnalysis.value = {
    totalErrors: 0,
    errorRate: 0,
    mostCommonErrors: {},
    recentErrors: [],
  };
};

const showMessageDetail = (message: McpMessage) => {
  selectedMessage.value = message;
  errorSuggestion.value = getErrorSuggestion(message);
  showDetailDialog.value = true;
};

const getErrorMessage = (content: unknown) => {
  if (typeof content === 'object' && content !== null) {
    const obj = content as { error?: string };
    if (obj.error) {
      return obj.error;
    }
  }
  return String(content);
};

const getErrorSuggestion = (message: McpMessage) => {
  const errorMessage = getErrorMessage(message.content);
  
  // Provide suggestions based on common error patterns
  if (errorMessage.includes('timeout')) {
    return '建议检查服务器连接状态和网络延迟，或增加超时时间设置。';
  }
  if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
    return '建议检查认证配置和凭证是否正确。';
  }
  if (errorMessage.includes('permission') || errorMessage.includes('access')) {
    return '建议检查权限配置和访问控制设置。';
  }
  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return '建议检查请求的资源路径或参数是否正确。';
  }
  if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
    return '建议检查请求参数格式和内容是否符合要求。';
  }
  
  return '请检查错误详情并根据具体情况进行处理。';
};

const getErrorProgressColor = (percentage: number) => {
  if (percentage > 50) return '#ff4d4f';
  if (percentage > 20) return '#fa8c16';
  return '#1890ff';
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

// Lifecycle
onMounted(() => {
  loadAnalysis();
});
</script>

<style scoped>
.error-analyzer {
  height: 100%;
}

.error-message {
  max-width: 400px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.count-text {
  margin-left: 8px;
  font-weight: 500;
}

.content-preview {
  cursor: pointer;
  color: var(--td-brand-color);
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-detail {
  max-height: 500px;
  overflow-y: auto;
}

.content-section,
.suggestion-section {
  margin-top: 16px;
}

.content-section h4,
.suggestion-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
}

.content-json {
  background: var(--td-bg-color-page);
  border: 1px solid var(--td-border-level-2-color);
  border-radius: var(--td-radius-default);
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.actions-bar {
  margin-top: 16px;
  text-align: center;
}
</style>