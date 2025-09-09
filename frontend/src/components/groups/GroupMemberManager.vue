<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="组成员管理"
    width="800px"
    :confirm-btn="{ content: '保存配置', loading: loading, theme: 'primary' }"
    :cancel-btn="{ content: '关闭' }"
    @confirm="handleSubmit"
    @cancel="handleCancel"
    @close="handleCancel"
  >
    <div class="group-member-manager">
      <t-alert
        v-if="group"
        theme="info"
        :message="`管理组 "${group.name}" 的成员服务器和工具访问权限`"
        class="group-info"
      />

      <!-- 服务器管理 -->
      <div class="member-section">
        <div class="section-header">
          <h4 class="section-title">服务器成员</h4>
          <div class="section-actions">
            <t-button
              theme="default"
              variant="outline"
              size="small"
              @click="refreshServers"
            >
              <template #icon>
                <RefreshIcon />
              </template>
              刷新
            </t-button>
          </div>
        </div>

        <div class="server-members">
          <div v-if="availableServers.length === 0" class="no-servers">
            <t-empty description="暂无可用的服务器">
              <template #action>
                <t-button theme="primary" size="small" @click="goToServers">
                  前往服务器管理
                </t-button>
              </template>
            </t-empty>
          </div>

          <div v-else class="server-list">
            <div
              v-for="server in availableServers"
              :key="server.id"
              :class="['server-item', { 'server-item--selected': isSelected(server.id) }]"
            >
              <div class="server-item__content">
                <div class="server-item__info">
                  <div class="server-item__name">{{ server.name }}</div>
                  <div class="server-item__id">{{ server.id }}</div>
                  <div class="server-item__status">
                    <StatusTag :status="server.status" />
                    <span v-if="server.toolCount" class="tool-count">
                      {{ server.toolCount }} 个工具
                    </span>
                  </div>
                </div>
                <div class="server-item__actions">
                  <t-button
                    v-if="isSelected(server.id)"
                    theme="success"
                    variant="outline"
                    size="small"
                    @click="removeServer(server.id)"
                  >
                    <template #icon>
                      <CheckIcon />
                    </template>
                    已选择
                  </t-button>
                  <t-button
                    v-else
                    theme="default"
                    variant="outline"
                    size="small"
                    @click="addServer(server.id)"
                  >
                    <template #icon>
                      <AddIcon />
                    </template>
                    添加
                  </t-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 工具过滤管理 -->
      <div class="member-section">
        <div class="section-header">
          <h4 class="section-title">工具访问控制</h4>
          <div class="section-actions">
            <t-switch
              v-model="enableToolFilter"
              @change="handleToolFilterChange"
            >
              启用过滤
            </t-switch>
          </div>
        </div>

        <div v-if="enableToolFilter" class="tool-filter">
          <p class="tool-filter__description">
            选择该组成员可访问的工具。未选择的工具将被过滤，无法通过该组访问。
          </p>

          <div v-if="groupAvailableTools.length === 0" class="no-tools">
            <t-alert theme="warning">
              当前选中的服务器没有可用工具，请先确保服务器连接正常
            </t-alert>
          </div>

          <div v-else class="tool-selection">
            <div class="tool-selection__header">
              <div class="tool-stats">
                <t-tag theme="primary" variant="light">
                  可用工具: {{ groupAvailableTools.length }}
                </t-tag>
                <t-tag theme="success" variant="light">
                  已选择: {{ selectedTools.length }}
                </t-tag>
              </div>
              <div class="tool-actions">
                <t-button
                  theme="default"
                  variant="outline"
                  size="small"
                  @click="selectAllTools"
                  :disabled="groupAvailableTools.length === 0"
                >
                  全选
                </t-button>
                <t-button
                  theme="default"
                  variant="outline"
                  size="small"
                  @click="clearAllTools"
                  :disabled="selectedTools.length === 0"
                >
                  清空
                </t-button>
              </div>
            </div>

            <div class="tools-by-server">
              <div
                v-for="serverTools in toolsByServer"
                :key="serverTools.serverId"
                class="server-tools"
              >
                <h5 class="server-tools__title">
                  {{ serverTools.serverName }}
                  <t-tag size="small" variant="light">
                    {{ serverTools.tools.length }} 个工具
                  </t-tag>
                </h5>
                <div class="tool-checkbox-list">
                  <t-checkbox
                    v-for="tool in serverTools.tools"
                    :key="tool.name"
                    v-model="selectedTools"
                    :value="tool.name"
                    :label="tool.name"
                    class="tool-checkbox"
                  >
                    <div class="tool-checkbox__content">
                      <div class="tool-checkbox__name">{{ tool.name }}</div>
                      <div v-if="tool.description" class="tool-checkbox__description">
                        {{ tool.description }}
                      </div>
                    </div>
                  </t-checkbox>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="tool-filter-disabled">
          <t-alert theme="info">
            工具过滤已禁用，组成员可以访问选中服务器中的所有工具
          </t-alert>
        </div>
      </div>

      <!-- 预览配置 -->
      <div class="member-section">
        <h4 class="section-title">配置预览</h4>
        <div class="config-preview">
          <div class="preview-item">
            <span class="preview-label">选中服务器:</span>
            <span class="preview-value">{{ selectedServers.length }} 个</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">工具过滤:</span>
            <t-tag :theme="enableToolFilter ? 'primary' : 'default'" variant="light" size="small">
              {{ enableToolFilter ? '已启用' : '已禁用' }}
            </t-tag>
          </div>
          <div class="preview-item">
            <span class="preview-label">可访问工具:</span>
            <span class="preview-value">
              {{ enableToolFilter ? selectedTools.length : '所有可用工具' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  RefreshIcon,
  AddIcon,
  CheckIcon,
} from 'tdesign-icons-vue-next';
import StatusTag from '@/components/common/StatusTag.vue';
import { useServerStore } from '@/stores/server';
import { useGroupStore } from '@/stores/group';
import type { GroupInfo, ServerInfo } from '@/types/group';

interface Props {
  visible: boolean;
  group?: GroupInfo | null;
}

interface Emits {
  'update:visible': [visible: boolean];
  'success': [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const router = useRouter();

// 状态
const serverStore = useServerStore();
const groupStore = useGroupStore();
const loading = ref(false);
const enableToolFilter = ref(false);
const selectedServers = ref<string[]>([]);
const selectedTools = ref<string[]>([]);

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const availableServers = computed(() => serverStore.serverList);

const groupAvailableTools = computed(() => {
  const serverIds = selectedServers.value;
  return availableServers.value
    .filter(server => serverIds.includes(server.id))
    .flatMap(server => 
      (server.tools || []).map(tool => ({
        ...tool,
        serverId: server.id,
        serverName: server.name,
      }))
    );
});

const toolsByServer = computed(() => {
  const toolsMap = new Map<string, Array<{
    name: string;
    description?: string;
    serverId: string;
    serverName: string;
  }>>();

  groupAvailableTools.value.forEach(tool => {
    if (!toolsMap.has(tool.serverId)) {
      toolsMap.set(tool.serverId, []);
    }
    toolsMap.get(tool.serverId)?.push({
      name: tool.name,
      description: tool.description,
      serverId: tool.serverId,
      serverName: tool.serverName,
    });
  });

  return Array.from(toolsMap.entries()).map(([serverId, tools]) => ({
    serverId,
    serverName: tools[0]?.serverName || serverId,
    tools,
  }));
});

// 方法
const isSelected = (serverId: string) => {
  return selectedServers.value.includes(serverId);
};

const addServer = (serverId: string) => {
  if (!selectedServers.value.includes(serverId)) {
    selectedServers.value.push(serverId);
  }
};

const removeServer = (serverId: string) => {
  selectedServers.value = selectedServers.value.filter(id => id !== serverId);
  // 移除该服务器的工具选择
  const serverTools = groupAvailableTools.value
    .filter(tool => tool.serverId === serverId)
    .map(tool => tool.name);
  selectedTools.value = selectedTools.value.filter(toolName => 
    !serverTools.includes(toolName)
  );
};

const handleToolFilterChange = (enabled: boolean) => {
  if (!enabled) {
    selectedTools.value = [];
  }
};

const selectAllTools = () => {
  const allToolNames = groupAvailableTools.value.map(tool => tool.name);
  selectedTools.value = Array.from(new Set([...selectedTools.value, ...allToolNames]));
};

const clearAllTools = () => {
  selectedTools.value = [];
};

const refreshServers = async () => {
  await serverStore.fetchServers();
};

const goToServers = () => {
  router.push('/servers');
};

const resetData = () => {
  enableToolFilter.value = false;
  selectedServers.value = [];
  selectedTools.value = [];
};

const loadData = async () => {
  if (!props.group) return;

  try {
    await serverStore.fetchServers();
    
    // 设置选中的服务器
    selectedServers.value = [...props.group.servers];
    
    // 设置工具过滤
    enableToolFilter.value = props.group.toolFilterMode === 'whitelist';
    
    // 如果启用了工具过滤，获取可用的工具并设置选中状态
    if (enableToolFilter.value) {
      await groupStore.getGroupAvailableTools(props.group.id);
      // 这里应该从API获取当前组的工具过滤配置
      selectedTools.value = [...props.group.tools];
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    MessagePlugin.error('加载数据失败');
  }
};

const handleSubmit = async () => {
  if (!props.group) return;

  try {
    loading.value = true;

    // 验证至少选择了一个服务器
    if (selectedServers.value.length === 0) {
      MessagePlugin.error('请至少选择一个服务器');
      return;
    }

    // 更新组配置
    const updateData = {
      servers: selectedServers.value,
      tools: enableToolFilter.value ? selectedTools.value : [],
    };

    await groupStore.updateGroup(props.group.id, updateData);
    
    MessagePlugin.success('组成员配置更新成功');
    emit('success');
  } catch (error) {
    console.error('保存配置失败:', error);
    MessagePlugin.error('保存配置失败');
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  resetData();
  emit('update:visible', false);
};

// 监听器
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await loadData();
    } else {
      resetData();
    }
  },
  { immediate: true }
);

// 监听选中的服务器变化，移除不存在的工具
watch(
  () => selectedServers.value,
  () => {
    const availableToolNames = groupAvailableTools.value.map(tool => tool.name);
    selectedTools.value = selectedTools.value.filter(toolName => 
      availableToolNames.includes(toolName)
    );
  },
  { deep: true }
);
</script>

<style scoped>
.group-member-manager {
  padding: 16px 0;
}

.group-info {
  margin-bottom: 24px;
}

.member-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.no-servers {
  padding: 32px 0;
}

.server-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 12px;
}

.server-item {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  padding: 12px;
  transition: all 0.3s ease;
}

.server-item--selected {
  border-color: var(--td-brand-color);
  background-color: var(--td-brand-color-light);
}

.server-item__content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.server-item__info {
  flex: 1;
  min-width: 0;
}

.server-item__name {
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 4px;
}

.server-item__id {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-bottom: 4px;
}

.server-item__status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-count {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.server-item__actions {
  flex-shrink: 0;
}

.tool-filter__description {
  margin: 0 0 16px 0;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.no-tools {
  margin-bottom: 16px;
}

.tool-selection {
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  padding: 16px;
}

.tool-selection__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tool-stats {
  display: flex;
  gap: 8px;
}

.tool-actions {
  display: flex;
  gap: 8px;
}

.tools-by-server {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.server-tools {
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-default);
  padding: 12px;
}

.server-tools__title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-checkbox :deep(.t-checkbox__label) {
  flex: 1;
}

.tool-checkbox__content {
  flex: 1;
  min-width: 0;
}

.tool-checkbox__name {
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.tool-checkbox__description {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-top: 2px;
}

.tool-filter-disabled {
  padding: 16px;
}

.config-preview {
  background-color: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-label {
  font-weight: 500;
  color: var(--td-text-color-secondary);
  min-width: 80px;
}

.preview-value {
  color: var(--td-text-color-primary);
}
</style>