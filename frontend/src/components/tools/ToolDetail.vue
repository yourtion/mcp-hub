<template>
  <div class="tool-detail">
    <t-loading :loading="loading" size="large">
      <div v-if="tool" class="tool-content">
        <!-- 工具基本信息 -->
        <t-card title="基本信息" class="tool-info-card">
          <template #actions>
            <t-space>
              <t-button
                theme="primary"
                :disabled="tool.status !== 'available'"
                @click="handleTestTool"
              >
                测试工具
              </t-button>
              
              <t-button
                theme="success"
                :disabled="tool.status !== 'available'"
                @click="handleExecuteTool"
              >
                执行工具
              </t-button>

              <t-dropdown :options="moreActions" @click="handleMoreAction">
                <t-button variant="outline">
                  更多操作
                  <chevron-down-icon />
                </t-button>
              </t-dropdown>
            </t-space>
          </template>

          <div class="tool-basic-info">
            <t-row :gutter="24">
              <t-col :span="12">
                <div class="info-item">
                  <label class="info-label">工具名称</label>
                  <div class="info-value">{{ tool.name }}</div>
                </div>
                
                <div class="info-item">
                  <label class="info-label">所属服务器</label>
                  <div class="info-value">
                    <t-tag variant="outline">{{ tool.serverId }}</t-tag>
                  </div>
                </div>

                <div class="info-item">
                  <label class="info-label">工具状态</label>
                  <div class="info-value">
                    <status-tag :status="tool.status" />
                  </div>
                </div>
              </t-col>

              <t-col :span="12">
                <div class="info-item">
                  <label class="info-label">工具描述</label>
                  <div class="info-value description">
                    {{ tool.description || '暂无描述' }}
                  </div>
                </div>

                <div v-if="toolStats" class="info-item">
                  <label class="info-label">使用统计</label>
                  <div class="info-value">
                    <t-space>
                      <span>执行次数: {{ toolStats.executions }}</span>
                      <span>成功率: {{ toolStats.successRate }}%</span>
                      <span>平均耗时: {{ toolStats.averageTime }}ms</span>
                    </t-space>
                  </div>
                </div>
              </t-col>
            </t-row>
          </div>
        </t-card>

        <!-- 参数定义 -->
        <t-card title="参数定义" class="tool-schema-card">
          <template #actions>
            <t-space>
              <t-button
                variant="text"
                size="small"
                @click="toggleSchemaView"
              >
                {{ schemaViewMode === 'visual' ? '查看JSON' : '可视化视图' }}
              </t-button>
              
              <t-button
                variant="text"
                size="small"
                @click="copySchema"
              >
                复制Schema
              </t-button>
            </t-space>
          </template>

          <div class="tool-schema">
            <!-- 可视化参数视图 -->
            <div v-if="schemaViewMode === 'visual'" class="schema-visual">
              <div v-if="!tool.inputSchema || !tool.inputSchema.properties" class="no-params">
                该工具无需参数
              </div>
              
              <div v-else class="params-list">
                <div
                  v-for="(param, paramName) in tool.inputSchema.properties"
                  :key="paramName"
                  class="param-item"
                >
                  <div class="param-header">
                    <div class="param-name">
                      {{ paramName }}
                      <t-tag
                        v-if="isRequired(paramName)"
                        size="small"
                        theme="danger"
                        variant="light"
                      >
                        必需
                      </t-tag>
                    </div>
                    <div class="param-type">
                      <t-tag size="small" variant="outline">
                        {{ param.type }}
                      </t-tag>
                    </div>
                  </div>
                  
                  <div v-if="param.description" class="param-description">
                    {{ param.description }}
                  </div>

                  <div class="param-details">
                    <t-descriptions size="small" :column="2">
                      <t-descriptions-item
                        v-if="param.default !== undefined"
                        label="默认值"
                      >
                        <code>{{ JSON.stringify(param.default) }}</code>
                      </t-descriptions-item>
                      
                      <t-descriptions-item
                        v-if="param.enum"
                        label="可选值"
                      >
                        <t-space>
                          <t-tag
                            v-for="value in param.enum"
                            :key="value"
                            size="small"
                            variant="outline"
                          >
                            {{ value }}
                          </t-tag>
                        </t-space>
                      </t-descriptions-item>

                      <t-descriptions-item
                        v-if="param.minimum !== undefined"
                        label="最小值"
                      >
                        {{ param.minimum }}
                      </t-descriptions-item>

                      <t-descriptions-item
                        v-if="param.maximum !== undefined"
                        label="最大值"
                      >
                        {{ param.maximum }}
                      </t-descriptions-item>

                      <t-descriptions-item
                        v-if="param.minLength !== undefined"
                        label="最小长度"
                      >
                        {{ param.minLength }}
                      </t-descriptions-item>

                      <t-descriptions-item
                        v-if="param.maxLength !== undefined"
                        label="最大长度"
                      >
                        {{ param.maxLength }}
                      </t-descriptions-item>

                      <t-descriptions-item
                        v-if="param.pattern"
                        label="格式"
                      >
                        <code>{{ param.pattern }}</code>
                      </t-descriptions-item>
                    </t-descriptions>
                  </div>
                </div>
              </div>
            </div>

            <!-- JSON Schema视图 -->
            <div v-else class="schema-json">
              <t-textarea
                :value="formattedSchema"
                readonly
                :autosize="{ minRows: 10, maxRows: 30 }"
                class="schema-textarea"
              />
            </div>
          </div>
        </t-card>

        <!-- 执行历史 -->
        <t-card title="执行历史" class="tool-history-card">
          <template #actions>
            <t-space>
              <t-button
                variant="text"
                size="small"
                @click="refreshHistory"
              >
                刷新
              </t-button>
              
              <t-button
                variant="text"
                size="small"
                @click="clearHistory"
              >
                清空历史
              </t-button>
            </t-space>
          </template>

          <div class="tool-history">
            <t-table
              :data="executionHistory"
              :columns="historyColumns"
              :pagination="historyPagination"
              row-key="executionId"
              stripe
              @page-change="handleHistoryPageChange"
            >
              <template #status="{ row }">
                <t-tag
                  :theme="row.isError ? 'danger' : 'success'"
                  variant="light"
                >
                  {{ row.isError ? '失败' : '成功' }}
                </t-tag>
              </template>

              <template #executionTime="{ row }">
                {{ row.executionTime }}ms
              </template>

              <template #timestamp="{ row }">
                {{ formatTime(row.timestamp) }}
              </template>

              <template #actions="{ row }">
                <t-space>
                  <t-button
                    size="small"
                    variant="text"
                    @click="viewExecutionDetail(row)"
                  >
                    查看详情
                  </t-button>
                  
                  <t-button
                    size="small"
                    variant="text"
                    theme="primary"
                    @click="rerunExecution(row)"
                  >
                    重新执行
                  </t-button>
                </t-space>
              </template>
            </t-table>
          </div>
        </t-card>

        <!-- 相关工具推荐 -->
        <t-card v-if="relatedTools.length > 0" title="相关工具" class="related-tools-card">
          <div class="related-tools">
            <t-row :gutter="16">
              <t-col
                v-for="relatedTool in relatedTools"
                :key="relatedTool.name"
                :span="8"
              >
                <t-card
                  :title="relatedTool.name"
                  :subtitle="relatedTool.serverId"
                  size="small"
                  hover
                  class="related-tool-card"
                  @click="viewRelatedTool(relatedTool)"
                >
                  <div class="related-tool-content">
                    <div class="related-tool-description">
                      {{ relatedTool.description || '暂无描述' }}
                    </div>
                    <status-tag :status="relatedTool.status" />
                  </div>
                </t-card>
              </t-col>
            </t-row>
          </div>
        </t-card>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-state">
        <t-result
          theme="error"
          title="加载失败"
          :description="error"
        >
          <template #extra>
            <t-button theme="primary" @click="loadToolDetail">
              重新加载
            </t-button>
          </template>
        </t-result>
      </div>
    </t-loading>

    <!-- 执行详情对话框 -->
    <t-dialog
      v-model:visible="showExecutionDetail"
      title="执行详情"
      width="800px"
      :footer="false"
    >
      <execution-detail
        v-if="selectedExecution"
        :execution="selectedExecution"
        @close="showExecutionDetail = false"
      />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import StatusTag from '@/components/common/StatusTag.vue';
import ExecutionDetail from './ExecutionDetail.vue';
import type { ToolInfo, ToolExecution } from '@/types/tool';

// 路由
const route = useRoute();
const router = useRouter();

// Store
const toolStore = useToolStore();

// 响应式数据
const tool = ref<ToolInfo | null>(null);
const toolStats = ref<any>(null);
const executionHistory = ref<ToolExecution[]>([]);
const relatedTools = ref<ToolInfo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const schemaViewMode = ref<'visual' | 'json'>('visual');
const showExecutionDetail = ref(false);
const selectedExecution = ref<ToolExecution | null>(null);

// 分页配置
const historyPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 计算属性
const toolName = computed(() => route.params.toolName as string);
const serverId = computed(() => route.query.serverId as string);
const groupId = computed(() => (route.query.groupId as string) || 'default');

const formattedSchema = computed(() => {
  if (!tool.value?.inputSchema) return '{}';
  return JSON.stringify(tool.value.inputSchema, null, 2);
});

// 表格列配置
const historyColumns = [
  {
    colKey: 'executionId',
    title: '执行ID',
    width: 200,
    ellipsis: true,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 80,
    cell: 'status',
  },
  {
    colKey: 'executionTime',
    title: '执行时间',
    width: 100,
    cell: 'executionTime',
  },
  {
    colKey: 'timestamp',
    title: '执行时间',
    width: 160,
    cell: 'timestamp',
  },
  {
    colKey: 'actions',
    title: '操作',
    width: 150,
    cell: 'actions',
  },
];

// 更多操作选项
const moreActions = [
  { content: '复制工具信息', value: 'copy' },
  { content: '导出执行历史', value: 'export' },
  { content: '查看服务器详情', value: 'server' },
  { content: '添加到收藏', value: 'favorite' },
];

// 方法
const loadToolDetail = async () => {
  try {
    loading.value = true;
    error.value = null;

    // 加载工具详情
    const toolDetail = await toolStore.fetchToolDetail(toolName.value, groupId.value);
    tool.value = toolDetail;

    // 加载工具统计
    await loadToolStats();

    // 加载执行历史
    await loadExecutionHistory();

    // 加载相关工具
    await loadRelatedTools();

  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载工具详情失败';
  } finally {
    loading.value = false;
  }
};

const loadToolStats = async () => {
  try {
    const stats = await toolStore.fetchStats(groupId.value, serverId.value);
    const toolStat = stats.topTools.find(t => t.toolName === toolName.value);
    if (toolStat) {
      toolStats.value = {
        executions: toolStat.executions,
        successRate: ((toolStat.successes / toolStat.executions) * 100).toFixed(1),
        averageTime: Math.round(toolStat.averageTime),
      };
    }
  } catch (err) {
    console.error('Failed to load tool stats:', err);
  }
};

const loadExecutionHistory = async () => {
  try {
    const response = await toolStore.fetchExecutionHistory({
      toolName: toolName.value,
      serverId: serverId.value,
      groupId: groupId.value,
      limit: historyPagination.value.pageSize,
      offset: (historyPagination.value.current - 1) * historyPagination.value.pageSize,
    });

    executionHistory.value = response.executions;
    historyPagination.value.total = response.pagination.total;
  } catch (err) {
    console.error('Failed to load execution history:', err);
  }
};

const loadRelatedTools = async () => {
  try {
    // 获取同一服务器的其他工具
    const response = await toolStore.fetchToolsByServer(serverId.value, groupId.value);
    relatedTools.value = response.tools
      .filter(t => t.name !== toolName.value)
      .slice(0, 6);
  } catch (err) {
    console.error('Failed to load related tools:', err);
  }
};

const isRequired = (paramName: string): boolean => {
  return tool.value?.inputSchema?.required?.includes(paramName) || false;
};

const toggleSchemaView = () => {
  schemaViewMode.value = schemaViewMode.value === 'visual' ? 'json' : 'visual';
};

const copySchema = async () => {
  try {
    await navigator.clipboard.writeText(formattedSchema.value);
    MessagePlugin.success('Schema已复制到剪贴板');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const handleTestTool = () => {
  router.push({
    name: 'ToolTest',
    params: { toolName: toolName.value },
    query: { serverId: serverId.value, groupId: groupId.value },
  });
};

const handleExecuteTool = () => {
  router.push({
    name: 'ToolExecute',
    params: { toolName: toolName.value },
    query: { serverId: serverId.value, groupId: groupId.value },
  });
};

const handleMoreAction = (option: any) => {
  switch (option.value) {
    case 'copy':
      copyToolInfo();
      break;
    case 'export':
      exportExecutionHistory();
      break;
    case 'server':
      viewServerDetail();
      break;
    case 'favorite':
      addToFavorites();
      break;
  }
};

const copyToolInfo = async () => {
  if (!tool.value) return;
  
  const info = {
    name: tool.value.name,
    description: tool.value.description,
    serverId: tool.value.serverId,
    status: tool.value.status,
    schema: tool.value.inputSchema,
  };

  try {
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    MessagePlugin.success('工具信息已复制');
  } catch (err) {
    MessagePlugin.error('复制失败');
  }
};

const exportExecutionHistory = () => {
  // 实现导出执行历史功能
  MessagePlugin.info('导出功能开发中...');
};

const viewServerDetail = () => {
  router.push({
    name: 'ServerDetail',
    params: { serverId: serverId.value },
  });
};

const addToFavorites = () => {
  // 实现添加到收藏功能
  MessagePlugin.success('已添加到收藏');
};

const refreshHistory = () => {
  loadExecutionHistory();
};

const clearHistory = async () => {
  const confirmed = await DialogPlugin.confirm({
    header: '清空历史',
    body: '确定要清空该工具的执行历史吗？',
    confirmBtn: '清空',
    cancelBtn: '取消',
  });

  if (confirmed) {
    executionHistory.value = [];
    MessagePlugin.success('执行历史已清空');
  }
};

const handleHistoryPageChange = (page: number) => {
  historyPagination.value.current = page;
  loadExecutionHistory();
};

const viewExecutionDetail = (execution: ToolExecution) => {
  selectedExecution.value = execution;
  showExecutionDetail.value = true;
};

const rerunExecution = async (execution: ToolExecution) => {
  try {
    await toolStore.executeTool(execution.toolName, {
      arguments: execution.arguments,
      serverId: execution.serverId,
      groupId: execution.groupId,
    });
    
    MessagePlugin.success('工具重新执行成功');
    loadExecutionHistory();
  } catch (err) {
    MessagePlugin.error('工具执行失败');
  }
};

const viewRelatedTool = (relatedTool: ToolInfo) => {
  router.push({
    name: 'ToolDetail',
    params: { toolName: relatedTool.name },
    query: { serverId: relatedTool.serverId, groupId: groupId.value },
  });
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 监听路由参数变化
watch(
  () => [toolName.value, serverId.value, groupId.value],
  () => {
    loadToolDetail();
  }
);

// 组件挂载时加载数据
onMounted(() => {
  loadToolDetail();
});
</script>

<style scoped>
.tool-detail {
  padding: 16px;
}

.tool-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-info-card,
.tool-schema-card,
.tool-history-card,
.related-tools-card {
  margin-bottom: 16px;
}

.tool-basic-info {
  padding: 16px 0;
}

.info-item {
  margin-bottom: 16px;
}

.info-label {
  display: block;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: var(--td-text-color-primary);
}

.info-value.description {
  line-height: 1.5;
  max-height: 60px;
  overflow-y: auto;
}

.tool-schema {
  margin-top: 16px;
}

.schema-visual {
  padding: 16px 0;
}

.no-params {
  text-align: center;
  color: var(--td-text-color-secondary);
  padding: 32px;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-item {
  padding: 16px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  background: var(--td-bg-color-container-hover);
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.param-name {
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.param-description {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  margin-bottom: 12px;
  line-height: 1.4;
}

.param-details {
  margin-top: 12px;
}

.schema-json {
  margin-top: 16px;
}

.schema-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.tool-history {
  margin-top: 16px;
}

.related-tools {
  margin-top: 16px;
}

.related-tool-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.related-tool-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--td-shadow-3);
}

.related-tool-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 60px;
}

.related-tool-description {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.error-state {
  padding: 32px;
  text-align: center;
}

:deep(.t-descriptions-item__label) {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

:deep(.t-descriptions-item__content) {
  font-size: 12px;
}

:deep(code) {
  background: var(--td-bg-color-component);
  padding: 2px 4px;
  border-radius: 2px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
}
</style>