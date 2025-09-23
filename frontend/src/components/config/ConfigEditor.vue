<template>
  <div class="config-editor">
    <!-- 编辑器头部 -->
    <div class="editor-header">
      <div class="header-left">
        <h3 class="editor-title">
          {{ getEditorTitle() }}
        </h3>
        <p class="editor-description">
          {{ getEditorDescription() }}
        </p>
      </div>
      <div class="header-right">
        <t-space>
          <t-button
            theme="default"
            variant="outline"
            size="small"
            @click="handleValidate"
          >
            <template #icon>
              <t-icon name="check-circle" />
            </template>
            验证
          </t-button>
          <t-button
            theme="primary"
            variant="outline"
            size="small"
            @click="handleTest"
          >
            <template #icon>
              <t-icon name="play-circle" />
            </template>
            测试
          </t-button>
          <t-button
            theme="warning"
            variant="outline"
            size="small"
            @click="handlePreview"
          >
            <template #icon>
              <t-icon name="view-list" />
            </template>
            预览
          </t-button>
        </t-space>
      </div>
    </div>

    <!-- 配置编辑区域 -->
    <div class="editor-content">
      <!-- 系统配置编辑 -->
      <system-config-editor
        v-if="selectedConfigType === 'system'"
        :config="configData.system"
        :selected-category="selectedCategory"
        :search-keyword="searchKeyword"
        :show-advanced="showAdvanced"
        @change="handleSystemConfigChange"
      />

      <!-- MCP配置编辑 -->
      <mcp-config-editor
        v-else-if="selectedConfigType === 'mcp'"
        :config="configData.mcp"
        :selected-category="selectedCategory"
        :search-keyword="searchKeyword"
        :show-advanced="showAdvanced"
        @change="handleMcpConfigChange"
      />

      <!-- 组配置编辑 -->
      <group-config-editor
        v-else-if="selectedConfigType === 'groups'"
        :config="configData.groups"
        :selected-category="selectedCategory"
        :search-keyword="searchKeyword"
        :show-advanced="showAdvanced"
        @change="handleGroupConfigChange"
      />

      <!-- 全局配置视图 -->
      <global-config-view
        v-else
        :config-data="configData"
        :search-keyword="searchKeyword"
        :show-advanced="showAdvanced"
        @config-change="handleGlobalConfigChange"
      />
    </div>

    <!-- 编辑器底部信息 -->
    <div class="editor-footer">
      <div class="footer-info">
        <t-space>
          <span class="info-item">
            <t-icon name="time" />
            最后更新: {{ formatTime(configData.lastUpdated) }}
          </span>
          <span class="info-item">
            <t-icon name="layers" />
            版本: {{ configData.version }}
          </span>
          <span class="info-item" :class="{ 'has-changes': hasChanges }">
            <t-icon :name="hasChanges ? 'edit' : 'check'" />
            {{ hasChanges ? '有未保存的更改' : '配置已同步' }}
          </span>
        </t-space>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ConfigData, ConfigType, SystemConfig, McpConfig, GroupConfig } from '@/types/config';

// 导入子组件
import SystemConfigEditor from './SystemConfigEditor.vue';
import McpConfigEditor from './McpConfigEditor.vue';
import GroupConfigEditor from './GroupConfigEditor.vue';
import GlobalConfigView from './GlobalConfigView.vue';

// Props
interface Props {
  configData: ConfigData;
  selectedConfigType?: ConfigType;
  selectedCategory?: string;
  searchKeyword?: string;
  showAdvanced?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selectedConfigType: undefined,
  selectedCategory: undefined,
  searchKeyword: '',
  showAdvanced: false,
});

// Emits
interface Emits {
  (e: 'config-change', configType: ConfigType, config: Record<string, unknown>): void;
  (e: 'validate', configType: ConfigType, config: Record<string, unknown>): void;
  (e: 'test', configType: ConfigType, config: Record<string, unknown>): void;
  (e: 'preview', configType: ConfigType, config: Record<string, unknown>): void;
}

const emit = defineEmits<Emits>();

// 响应式数据
const currentConfig = ref<Record<string, unknown>>({});
const hasChanges = ref(false);

// 计算属性
const currentConfigType = computed(() => {
  return props.selectedConfigType || 'system';
});

// 监听配置数据变化
watch(
  () => props.configData,
  (newData) => {
    if (newData) {
      updateCurrentConfig();
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => props.selectedConfigType,
  () => {
    updateCurrentConfig();
  }
);

// 方法

/**
 * 更新当前配置
 */
const updateCurrentConfig = (): void => {
  if (!props.configData) return;

  switch (currentConfigType.value) {
    case 'system':
      currentConfig.value = JSON.parse(JSON.stringify(props.configData.system));
      break;
    case 'mcp':
      currentConfig.value = JSON.parse(JSON.stringify(props.configData.mcp));
      break;
    case 'groups':
      currentConfig.value = JSON.parse(JSON.stringify(props.configData.groups));
      break;
    default:
      currentConfig.value = {};
  }
  
  hasChanges.value = false;
};

/**
 * 获取编辑器标题
 */
const getEditorTitle = (): string => {
  if (!props.selectedConfigType) {
    return '全局配置视图';
  }

  switch (props.selectedConfigType) {
    case 'system':
      return '系统配置';
    case 'mcp':
      return 'MCP服务器配置';
    case 'groups':
      return '组配置';
    default:
      return '配置编辑器';
  }
};

/**
 * 获取编辑器描述
 */
const getEditorDescription = (): string => {
  if (!props.selectedConfigType) {
    return '查看和管理所有配置项';
  }

  switch (props.selectedConfigType) {
    case 'system':
      return '管理服务器、认证、用户等系统基础配置';
    case 'mcp':
      return '配置MCP服务器连接和传输参数';
    case 'groups':
      return '管理服务器组和工具过滤规则';
    default:
      return '';
  }
};

/**
 * 格式化时间
 */
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '未知';
  }
};

/**
 * 处理系统配置变更
 */
const handleSystemConfigChange = (config: SystemConfig): void => {
  currentConfig.value = config as Record<string, unknown>;
  hasChanges.value = true;
  emit('config-change', 'system', config as Record<string, unknown>);
};

/**
 * 处理MCP配置变更
 */
const handleMcpConfigChange = (config: McpConfig): void => {
  currentConfig.value = config as Record<string, unknown>;
  hasChanges.value = true;
  emit('config-change', 'mcp', config as Record<string, unknown>);
};

/**
 * 处理组配置变更
 */
const handleGroupConfigChange = (config: GroupConfig): void => {
  currentConfig.value = config as Record<string, unknown>;
  hasChanges.value = true;
  emit('config-change', 'groups', config as Record<string, unknown>);
};

/**
 * 处理全局配置变更
 */
const handleGlobalConfigChange = (configType: ConfigType, config: Record<string, unknown>): void => {
  hasChanges.value = true;
  emit('config-change', configType, config);
};

/**
 * 验证配置
 */
const handleValidate = (): void => {
  emit('validate', currentConfigType.value, currentConfig.value);
};

/**
 * 测试配置
 */
const handleTest = (): void => {
  emit('test', currentConfigType.value, currentConfig.value);
};

/**
 * 预览配置
 */
const handlePreview = (): void => {
  emit('preview', currentConfigType.value, currentConfig.value);
};
</script>

<style scoped>
.config-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.header-left {
  flex: 1;
}

.editor-title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.editor-description {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.header-right {
  flex-shrink: 0;
  margin-left: 24px;
}

.editor-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  background-color: #ffffff;
}

.editor-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.footer-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.info-item.has-changes {
  color: #f59e0b;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  
  .header-right {
    margin-left: 0;
    width: 100%;
  }
  
  .editor-content {
    padding: 16px;
  }
  
  .editor-footer {
    padding: 12px 16px;
  }
  
  .footer-info {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .editor-header,
  .editor-footer {
    background-color: #1f2937;
    border-color: #374151;
  }
  
  .editor-title {
    color: #f9fafb;
  }
  
  .editor-description {
    color: #9ca3af;
  }
  
  .editor-content {
    background-color: #111827;
  }
  
  .info-item {
    color: #9ca3af;
  }
  
  .info-item.has-changes {
    color: #fbbf24;
  }
}
</style>