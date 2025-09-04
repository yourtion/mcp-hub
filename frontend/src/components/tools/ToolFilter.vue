<template>
  <div class="tool-filter">
    <t-card title="工具筛选" size="small">
      <div class="filter-content">
        <!-- 基础筛选 -->
        <div class="filter-section">
          <h4 class="filter-title">基础筛选</h4>
          
          <div class="filter-item">
            <label class="filter-label">搜索</label>
            <t-input
              v-model="localFilters.search"
              placeholder="输入工具名称或描述"
              clearable
              @change="handleFilterChange"
            >
              <template #prefix-icon>
                <search-icon />
              </template>
            </t-input>
          </div>

          <div class="filter-item">
            <label class="filter-label">服务器</label>
            <t-select
              v-model="localFilters.serverId"
              placeholder="选择服务器"
              clearable
              filterable
              @change="handleFilterChange"
            >
              <t-option value="" label="全部服务器" />
              <t-option
                v-for="server in serverOptions"
                :key="server.value"
                :value="server.value"
                :label="server.label"
              />
            </t-select>
          </div>

          <div class="filter-item">
            <label class="filter-label">状态</label>
            <t-radio-group
              v-model="localFilters.status"
              @change="handleFilterChange"
            >
              <t-radio value="all">全部</t-radio>
              <t-radio value="available">可用</t-radio>
              <t-radio value="unavailable">不可用</t-radio>
            </t-radio-group>
          </div>
        </div>

        <!-- 高级筛选 -->
        <div class="filter-section">
          <h4 class="filter-title">
            <t-button
              variant="text"
              size="small"
              @click="toggleAdvanced"
            >
              高级筛选
              <chevron-down-icon 
                :class="{ 'rotate-180': showAdvanced }"
                class="transition-transform"
              />
            </t-button>
          </h4>

          <t-collapse-transition>
            <div v-show="showAdvanced" class="advanced-filters">
              <div class="filter-item">
                <label class="filter-label">组ID</label>
                <t-select
                  v-model="localFilters.groupId"
                  placeholder="选择组"
                  clearable
                  @change="handleFilterChange"
                >
                  <t-option
                    v-for="group in groupOptions"
                    :key="group.value"
                    :value="group.value"
                    :label="group.label"
                  />
                </t-select>
              </div>

              <div class="filter-item">
                <label class="filter-label">工具类型</label>
                <t-checkbox-group
                  v-model="selectedToolTypes"
                  @change="handleToolTypeChange"
                >
                  <t-checkbox
                    v-for="type in toolTypes"
                    :key="type"
                    :value="type"
                  >
                    {{ type }}
                  </t-checkbox>
                </t-checkbox-group>
              </div>

              <div class="filter-item">
                <label class="filter-label">最近使用</label>
                <t-date-range-picker
                  v-model="recentUsageRange"
                  placeholder="选择时间范围"
                  clearable
                  @change="handleRecentUsageChange"
                />
              </div>
            </div>
          </t-collapse-transition>
        </div>

        <!-- 排序选项 -->
        <div class="filter-section">
          <h4 class="filter-title">排序</h4>
          
          <div class="filter-item">
            <label class="filter-label">排序字段</label>
            <t-select
              v-model="localFilters.sortBy"
              @change="handleFilterChange"
            >
              <t-option value="name" label="工具名称" />
              <t-option value="server" label="服务器" />
              <t-option value="status" label="状态" />
              <t-option value="lastUsed" label="最近使用" />
              <t-option value="usage" label="使用频率" />
            </t-select>
          </div>

          <div class="filter-item">
            <label class="filter-label">排序方向</label>
            <t-radio-group
              v-model="localFilters.sortOrder"
              @change="handleFilterChange"
            >
              <t-radio value="asc">升序</t-radio>
              <t-radio value="desc">降序</t-radio>
            </t-radio-group>
          </div>
        </div>

        <!-- 快速筛选标签 -->
        <div class="filter-section">
          <h4 class="filter-title">快速筛选</h4>
          
          <div class="quick-filters">
            <t-tag
              v-for="tag in quickFilterTags"
              :key="tag.key"
              :theme="tag.active ? 'primary' : 'default'"
              :variant="tag.active ? 'dark' : 'outline'"
              closable
              clickable
              @click="handleQuickFilter(tag)"
              @close="handleRemoveQuickFilter(tag)"
            >
              {{ tag.label }}
            </t-tag>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="filter-actions">
          <t-space>
            <t-button
              theme="primary"
              size="small"
              @click="handleApplyFilters"
            >
              应用筛选
            </t-button>
            
            <t-button
              variant="outline"
              size="small"
              @click="handleResetFilters"
            >
              重置
            </t-button>

            <t-button
              variant="text"
              size="small"
              @click="handleSavePreset"
            >
              保存预设
            </t-button>
          </t-space>
        </div>

        <!-- 筛选预设 -->
        <div v-if="filterPresets.length > 0" class="filter-section">
          <h4 class="filter-title">筛选预设</h4>
          
          <div class="filter-presets">
            <t-tag
              v-for="preset in filterPresets"
              :key="preset.id"
              variant="outline"
              closable
              clickable
              @click="handleLoadPreset(preset)"
              @close="handleDeletePreset(preset)"
            >
              {{ preset.name }}
            </t-tag>
          </div>
        </div>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  SearchIcon,
  ChevronDownIcon,
} from 'tdesign-icons-vue-next';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import { useToolStore } from '@/stores/tool';
import { useServerStore } from '@/stores/server';
import type { ToolFilterParams } from '@/types/tool';

// Props
interface Props {
  modelValue?: ToolFilterParams;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({
    groupId: 'default',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  }),
});

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: ToolFilterParams];
  'filter-change': [filters: ToolFilterParams];
}>();

// Stores
const toolStore = useToolStore();
const serverStore = useServerStore();

// 响应式数据
const localFilters = ref<ToolFilterParams>({ ...props.modelValue });
const showAdvanced = ref(false);
const selectedToolTypes = ref<string[]>([]);
const recentUsageRange = ref<[string, string] | null>(null);

// 筛选预设
const filterPresets = ref<Array<{
  id: string;
  name: string;
  filters: ToolFilterParams;
}>>([]);

// 计算属性
const serverOptions = computed(() => {
  return toolStore.serverList.map(serverId => ({
    value: serverId,
    label: serverId,
  }));
});

const groupOptions = computed(() => [
  { value: 'default', label: '默认组' },
  // 这里可以从其他store获取组列表
]);

const toolTypes = computed(() => {
  // 从工具列表中提取工具类型
  const types = new Set<string>();
  toolStore.toolList.forEach(tool => {
    // 假设从工具名称或描述中提取类型
    if (tool.name.includes('file')) types.add('文件操作');
    if (tool.name.includes('api')) types.add('API调用');
    if (tool.name.includes('data')) types.add('数据处理');
    // 可以根据实际情况扩展
  });
  return Array.from(types);
});

const quickFilterTags = computed(() => {
  const tags = [];
  
  if (localFilters.value.search) {
    tags.push({
      key: 'search',
      label: `搜索: ${localFilters.value.search}`,
      active: true,
    });
  }
  
  if (localFilters.value.serverId) {
    tags.push({
      key: 'server',
      label: `服务器: ${localFilters.value.serverId}`,
      active: true,
    });
  }
  
  if (localFilters.value.status && localFilters.value.status !== 'all') {
    tags.push({
      key: 'status',
      label: `状态: ${localFilters.value.status === 'available' ? '可用' : '不可用'}`,
      active: true,
    });
  }
  
  return tags;
});

// 方法
const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value;
};

const handleFilterChange = () => {
  emit('update:modelValue', localFilters.value);
  emit('filter-change', localFilters.value);
};

const handleToolTypeChange = () => {
  // 根据选择的工具类型更新筛选条件
  // 这里可以实现更复杂的类型筛选逻辑
  handleFilterChange();
};

const handleRecentUsageChange = () => {
  // 处理最近使用时间范围变化
  handleFilterChange();
};

const handleQuickFilter = (tag: any) => {
  // 切换快速筛选标签的激活状态
  switch (tag.key) {
    case 'search':
      localFilters.value.search = '';
      break;
    case 'server':
      localFilters.value.serverId = '';
      break;
    case 'status':
      localFilters.value.status = 'all';
      break;
  }
  handleFilterChange();
};

const handleRemoveQuickFilter = (tag: any) => {
  handleQuickFilter(tag);
};

const handleApplyFilters = () => {
  toolStore.updateFilters(localFilters.value);
  MessagePlugin.success('筛选条件已应用');
};

const handleResetFilters = () => {
  localFilters.value = {
    groupId: 'default',
    status: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  };
  selectedToolTypes.value = [];
  recentUsageRange.value = null;
  handleFilterChange();
  MessagePlugin.success('筛选条件已重置');
};

const handleSavePreset = async () => {
  const name = await DialogPlugin.prompt({
    header: '保存筛选预设',
    body: '请输入预设名称',
    confirmBtn: '保存',
    cancelBtn: '取消',
  });
  
  if (name) {
    const preset = {
      id: Date.now().toString(),
      name,
      filters: { ...localFilters.value },
    };
    
    filterPresets.value.push(preset);
    savePresetsToStorage();
    MessagePlugin.success('筛选预设已保存');
  }
};

const handleLoadPreset = (preset: any) => {
  localFilters.value = { ...preset.filters };
  handleFilterChange();
  MessagePlugin.success(`已加载预设: ${preset.name}`);
};

const handleDeletePreset = async (preset: any) => {
  const confirmed = await DialogPlugin.confirm({
    header: '删除预设',
    body: `确定要删除预设 "${preset.name}" 吗？`,
    confirmBtn: '删除',
    cancelBtn: '取消',
  });
  
  if (confirmed) {
    const index = filterPresets.value.findIndex(p => p.id === preset.id);
    if (index > -1) {
      filterPresets.value.splice(index, 1);
      savePresetsToStorage();
      MessagePlugin.success('预设已删除');
    }
  }
};

const savePresetsToStorage = () => {
  localStorage.setItem('tool-filter-presets', JSON.stringify(filterPresets.value));
};

const loadPresetsFromStorage = () => {
  const saved = localStorage.getItem('tool-filter-presets');
  if (saved) {
    try {
      filterPresets.value = JSON.parse(saved);
    } catch (err) {
      console.error('Failed to load filter presets:', err);
    }
  }
};

// 监听props变化
watch(
  () => props.modelValue,
  (newValue) => {
    localFilters.value = { ...newValue };
  },
  { deep: true }
);

// 组件挂载时加载预设
onMounted(() => {
  loadPresetsFromStorage();
});
</script>

<style scoped>
.tool-filter {
  height: 100%;
}

.filter-content {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.filter-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.filter-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--td-text-color-primary);
}

.filter-item {
  margin-bottom: 16px;
}

.filter-item:last-child {
  margin-bottom: 0;
}

.filter-label {
  display: block;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.advanced-filters {
  margin-top: 12px;
}

.rotate-180 {
  transform: rotate(180deg);
}

.transition-transform {
  transition: transform 0.2s ease;
}

.quick-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--td-border-level-1-color);
}

.filter-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.t-radio-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.t-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>