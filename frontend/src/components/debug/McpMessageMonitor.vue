<template>
  <div class="mcp-message-monitor">
    <div class="monitor-header">
      <div class="header-left">
        <t-input
          v-model="searchText"
          placeholder="搜索消息内容"
          clearable
          style="width: 200px; margin-right: 16px;"
        >
          <template #prefix-icon>
            <search-icon />
          </template>
        </t-input>
        
        <t-select
          v-model="selectedServer"
          placeholder="选择服务器"
          clearable
          style="width: 150px; margin-right: 16px;"
        >
          <t-option
            v-for="server in servers"
            :key="server.id"
            :value="server.id"
            :label="server.name"
          />
        </t-select>
        
        <t-select
          v-model="selectedType"
          placeholder="消息类型"
          clearable
          style="width: 120px; margin-right: 16px;"
        >
          <t-option value="request" label="请求" />
          <t-option value="response" label="响应" />
          <t-option value="notification" label="通知" />
        </t-select>
      </div>
      
      <div class="header-right">
        <t-button @click="refreshMessages" variant="outline">
          <template #icon>
            <refresh-icon />
          </template>
          刷新
        </t-button>
        
        <t-button @click="clearMessages" variant="outline" theme="danger">
          <template #icon>
            <delete-icon />
          </template>
          清空
        </t-button>
      </div>
    </div>
    
    <t-table
      :data="filteredMessages"
      :columns="columns"
      :loading="loading"
      row-key="id"
      :pagination="pagination"
      @page-change="onPageChange"
      @change="onTableChange"
      size="small"
    >
      <template #type="{ row }">
        <t-tag
          :theme="getMessageTypeTheme(row.type)"
          variant="light"
        >
          {{ getMessageTypeLabel(row.type) }}
        </t-tag>
      </template>
      
      <template #timestamp="{ row }">
        {{ formatTime(row.timestamp) }}
      </template>
      
      <template #method="{ row }">
        <t-tag variant="outline">{{ row.method }}</t-tag>
      </template>
      
      <template #content="{ row }">
        <div class="content-preview" @click="showMessageDetail(row)">
          {{ getContentPreview(row.content) }}
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
    
    <!-- 消息详情对话框 -->
    <t-dialog
      v-model:visible="showDetailDialog"
      header="消息详情"
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
            <t-tag
              :theme="getMessageTypeTheme(selectedMessage.type)"
              variant="light"
            >
              {{ getMessageTypeLabel(selectedMessage.type) }}
            </t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="方法">{{ selectedMessage.method }}</t-descriptions-item>
        </t-descriptions>
        
        <div class="content-section">
          <h4>内容</h4>
          <pre class="content-json">{{ formatJson(selectedMessage.content) }}</pre>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { SearchIcon, RefreshIcon, DeleteIcon } from 'tdesign-icons-vue-next';
import { getMcpMessages } from '@/services/debug';
import type { McpMessage } from '@/types/debug';
import type { ServerInfo } from '@/types/server';
import { useServerStore } from '@/stores/server';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { frontendLogger } from '@mcp-core/mcp-hub-share';

// Stores
const serverStore = useServerStore();

// Reactive data
const messages = ref<McpMessage[]>([]);
const loading = ref(false);
const searchText = ref('');
const selectedServer = ref<string>('');
const selectedType = ref<'request' | 'response' | 'notification'>('');
const showDetailDialog = ref(false);
const selectedMessage = ref<McpMessage | null>(null);

// Pagination
const pagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
});

// Auto refresh
const refreshInterval = ref<number | null>(null);

// Computed properties
const servers = computed(() => {
  return Array.from(serverStore.servers.values()).map(server => ({
    id: server.id,
    name: server.name || server.id,
  }));
});

const filteredMessages = computed(() => {
  let result = messages.value;
  
  // Filter by search text
  if (searchText.value) {
    const searchLower = searchText.value.toLowerCase();
    result = result.filter(msg => 
      msg.method.toLowerCase().includes(searchLower) ||
      JSON.stringify(msg.content).toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by server
  if (selectedServer.value) {
    result = result.filter(msg => msg.serverId === selectedServer.value);
  }
  
  // Filter by type
  if (selectedType.value) {
    result = result.filter(msg => msg.type === selectedType.value);
  }
  
  // Update pagination total
  pagination.value.total = result.length;
  
  // Apply pagination
  const start = (pagination.value.current - 1) * pagination.value.pageSize;
  const end = start + pagination.value.pageSize;
  return result.slice(start, end);
});

// Table columns
const columns = [
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
    title: '内容预览',
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
const loadMessages = async () => {
  loading.value = true;
  try {
    const response = await getMcpMessages(100, selectedServer.value, selectedType.value);
    messages.value = response.messages;
    pagination.value.total = response.messages.length;
  } catch (error) {
    frontendLogger.error('Failed to load MCP messages', error as Error);
  } finally {
    loading.value = false;
  }
};

const refreshMessages = () => {
  loadMessages();
};

const clearMessages = () => {
  messages.value = [];
  pagination.value.total = 0;
};

const onPageChange = (pageInfo: { current: number; pageSize: number }) => {
  pagination.value.current = pageInfo.current;
  pagination.value.pageSize = pageInfo.pageSize;
};

const onTableChange = () => {
  pagination.value.current = 1;
};

const showMessageDetail = (message: McpMessage) => {
  selectedMessage.value = message;
  showDetailDialog.value = true;
};

const getMessageTypeTheme = (type: string) => {
  switch (type) {
    case 'request': return 'primary';
    case 'response': return 'success';
    case 'notification': return 'warning';
    default: return 'default';
  }
};

const getMessageTypeLabel = (type: string) => {
  switch (type) {
    case 'request': return '请求';
    case 'response': return '响应';
    case 'notification': return '通知';
    default: return type;
  }
};

const getContentPreview = (content: unknown) => {
  if (typeof content === 'string') {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }
  const str = JSON.stringify(content);
  return str.length > 100 ? str.substring(0, 100) + '...' : str;
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
  loadMessages();
  
  // Auto refresh every 5 seconds
  refreshInterval.value = window.setInterval(() => {
    if (!loading.value) {
      loadMessages();
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});
</script>

<style scoped>
.mcp-message-monitor {
  height: 100%;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.content-section {
  margin-top: 16px;
}

.content-section h4 {
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
</style>