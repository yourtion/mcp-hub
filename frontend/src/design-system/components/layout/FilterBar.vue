<template>
  <div class="ds-filter-bar" :class="{ 'ds-filter-bar--collapsed': isCollapsed }">
    <!-- 筛选卡片 -->
    <t-card :bordered="true" class="ds-filter-bar__card">
      <!-- 筛选头部（可折叠时显示） -->
      <div v-if="props.collapsible" class="ds-filter-bar__header" @click="toggleCollapse">
        <div class="ds-filter-bar__header-left">
          <FilterIcon />
          <span>筛选条件</span>
          <t-tag v-if="activeFilterCount > 0" theme="primary" size="small">
            {{ activeFilterCount }}
          </t-tag>
        </div>
        <div class="ds-filter-bar__header-right">
          <ChevronDownIcon :class="{ 'ds-filter-bar__icon--collapsed': isCollapsed }" />
        </div>
      </div>

      <!-- 筛选内容 -->
      <div v-show="!isCollapsed || !props.collapsible" class="ds-filter-bar__content">
        <t-row :gutter="16" align="middle">
          <!-- 搜索框 -->
          <t-col v-if="props.searchable" :span="searchSpan">
            <t-input
              v-model="localSearchValue"
              :placeholder="props.searchPlaceholder"
              clearable
              size="large"
              @change="handleSearchChange"
              @clear="handleClear"
            >
              <template #prefix-icon>
                <SearchIcon />
              </template>
            </t-input>
          </t-col>

          <!-- 筛选字段 -->
          <t-col
            v-for="field in visibleFields"
            :key="field.key"
            :span="field.span || filterSpan"
          >
            <!-- 选择器 -->
            <t-select
              v-if="field.type === 'select'"
              v-model="localFilterValues[field.key]"
              :placeholder="field.placeholder || `选择${field.label}`"
              :clearable="field.clearable !== false"
              :multiple="field.multiple"
              :filterable="field.filterable"
              size="large"
              @change="handleFilterChange"
            >
              <t-option
                v-for="option in field.options"
                :key="option.value"
                :value="option.value"
                :label="option.label"
              >
                <template v-if="option.icon" #prefix-icon>
                  <component :is="option.icon" size="16px" />
                </template>
                {{ option.label }}
              </t-option>
            </t-select>

            <!-- 日期选择 -->
            <t-date-picker
              v-else-if="field.type === 'date'"
              v-model="localFilterValues[field.key]"
              :placeholder="field.placeholder || `选择${field.label}`"
              :clearable="field.clearable !== false"
              size="large"
              @change="handleFilterChange"
            />

            <!-- 日期范围 -->
            <t-date-range-picker
              v-else-if="field.type === 'date-range'"
              v-model="localFilterValues[field.key]"
              :placeholder="field.placeholder"
              :clearable="field.clearable !== false"
              size="large"
              @change="handleFilterChange"
            />

            <!-- 数字输入 -->
            <t-input-number
              v-else-if="field.type === 'number'"
              v-model="localFilterValues[field.key]"
              :placeholder="field.placeholder || `输入${field.label}`"
              :clearable="field.clearable !== false"
              size="large"
              @change="handleFilterChange"
            />

            <!-- 开关 -->
            <div v-else-if="field.type === 'switch'" class="ds-filter-bar__switch">
              <span>{{ field.label }}:</span>
              <t-switch
                v-model="localFilterValues[field.key]"
                size="large"
                @change="handleFilterChange"
              />
            </div>

            <!-- 插槽 -->
            <slot
              v-else-if="field.type === 'slot'"
              :name="field.key"
              :field="field"
              :value="localFilterValues[field.key]"
              @update:value="(val: any) => handleSlotValueChange(field.key, val)"
            />
          </t-col>

          <!-- 操作按钮 -->
          <t-col :span="actionSpan" class="ds-filter-bar__actions">
            <t-space size="small">
              <t-button theme="primary" size="large" @click="handleSearch">
                <template #icon>
                  <SearchIcon />
                </template>
                搜索
              </t-button>
              <t-button variant="outline" size="large" @click="handleReset">
                <template #icon>
                  <RefreshIcon />
                </template>
                重置
              </t-button>
              <!-- 额外操作插槽 -->
              <slot name="extra-actions" />
            </t-space>
          </t-col>
        </t-row>
      </div>
    </t-card>

    <!-- 活跃筛选标签 -->
    <div v-if="showActiveFilters && activeFilterCount > 0" class="ds-filter-bar__active">
      <div class="ds-filter-bar__active-label">
        <span>已选条件:</span>
      </div>
      <div class="ds-filter-bar__active-tags">
        <t-space size="small">
          <!-- 搜索标签 -->
          <t-tag
            v-if="localSearchValue"
            theme="primary"
            variant="light"
            closable
            @close="handleClearSearch"
          >
            搜索: {{ localSearchValue }}
          </t-tag>

          <!-- 筛选标签 -->
          <t-tag
            v-for="(field, key) in activeFilters"
            :key="key"
            theme="primary"
            variant="light"
            closable
            @close="handleClearFilter(key)"
          >
            {{ getFieldName(key) }}: {{ getFilterValueText(key, field) }}
          </t-tag>
        </t-space>
      </div>
      <t-button variant="text" size="small" @click="handleResetAll">
        清除全部
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type PropType } from 'vue';
import {
  SearchIcon,
  RefreshIcon,
  FilterIcon,
  ChevronDownIcon,
} from 'tdesign-icons-vue-next';

export interface FilterFieldOption {
  label: string;
  value: any;
  icon?: any;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'date' | 'date-range' | 'number' | 'switch' | 'slot';
  placeholder?: string;
  options?: FilterFieldOption[];
  clearable?: boolean;
  multiple?: boolean;
  filterable?: boolean;
  span?: number;
  visible?: boolean | ((filters: Record<string, any>) => boolean);
}

export interface FilterAction {
  text: string;
  theme?: 'primary' | 'default' | 'danger' | 'warning';
  variant?: 'base' | 'outline' | 'dashed';
  icon?: any;
  onClick: () => void;
}

export interface FilterBarProps {
  // 搜索
  searchable?: boolean;
  searchPlaceholder?: string;
  searchModelValue?: string;

  // 筛选字段
  fields?: FilterField[];

  // 布局
  inline?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;

  // 显示
  showActiveFilters?: boolean;

  // 列宽配置
  searchSpan?: number;
  filterSpan?: number;
  actionSpan?: number;
}

const props = withDefaults(defineProps<FilterBarProps>(), {
  searchable: false,
  searchPlaceholder: '搜索...',
  fields: () => [],
  inline: false,
  collapsible: false,
  defaultCollapsed: false,
  showActiveFilters: true,
  searchSpan: 6,
  filterSpan: 4,
  actionSpan: 6,
});

// Emits
const emit = defineEmits<{
  'update:searchModelValue': [value: string];
  'update:filters': [filters: Record<string, any>];
  'search': [];
  'reset': [];
}>();

// 状态
const localSearchValue = ref(props.searchModelValue || '');
const localFilterValues = ref<Record<string, any>>({});
const isCollapsed = ref(props.defaultCollapsed);

// 初始化筛选值
if (props.fields) {
  props.fields.forEach((field) => {
    if (field.type === 'switch') {
      localFilterValues.value[field.key] = false;
    } else {
      localFilterValues.value[field.key] = field.multiple ? [] : '';
    }
  });
}

// 计算属性
const visibleFields = computed(() => {
  if (!props.fields) return [];
  return props.fields.filter((field) => {
    if (typeof field.visible === 'boolean') return field.visible;
    if (typeof field.visible === 'function') {
      return field.visible(localFilterValues.value);
    }
    return true;
  });
});

const activeFilters = computed(() => {
  const filters: Record<string, any> = {};
  Object.entries(localFilterValues.value).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length === 0) return;
      if (typeof value === 'boolean' && !value) return;
      filters[key] = value;
    }
  });
  return filters;
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (localSearchValue.value) count++;
  Object.entries(activeFilters.value).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length === 0) return;
      if (typeof value === 'boolean' && !value) return;
      count++;
    }
  });
  return count;
});

// 方法
const handleSearchChange = () => {
  emit('update:searchModelValue', localSearchValue.value);
  emitSearch();
};

const handleClear = () => {
  localSearchValue.value = '';
  emit('update:searchModelValue', '');
  emitSearch();
};

const handleFilterChange = () => {
  emit('update:filters', { ...localFilterValues.value });
};

const handleSlotValueChange = (key: string, value: any) => {
  localFilterValues.value[key] = value;
  emit('update:filters', { ...localFilterValues.value });
};

const handleSearch = () => {
  emit('search');
};

const handleReset = () => {
  localSearchValue.value = '';
  Object.keys(localFilterValues.value).forEach((key) => {
    const field = props.fields?.find((f) => f.key === key);
    if (field?.type === 'switch') {
      localFilterValues.value[key] = false;
    } else if (field?.multiple) {
      localFilterValues.value[key] = [];
    } else {
      localFilterValues.value[key] = '';
    }
  });

  emit('update:searchModelValue', '');
  emit('update:filters', { ...localFilterValues.value });
  emit('reset');
};

const handleResetAll = () => {
  handleReset();
};

const handleClearSearch = () => {
  localSearchValue.value = '';
  emit('update:searchModelValue', '');
};

const handleClearFilter = (key: string) => {
  const field = props.fields?.find((f) => f.key === key);
  if (field?.type === 'switch') {
    localFilterValues.value[key] = false;
  } else if (field?.multiple) {
    localFilterValues.value[key] = [];
  } else {
    localFilterValues.value[key] = '';
  }
  emit('update:filters', { ...localFilterValues.value });
};

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const getFieldName = (key: string) => {
  const field = props.fields?.find((f) => f.key === key);
  return field?.label || key;
};

const getFilterValueText = (key: string, value: any) => {
  const field = props.fields?.find((f) => f.key === key);
  if (!field) return value;

  if (field.type === 'select' && field.options) {
    if (Array.isArray(value)) {
      return value
        .map((v) => field.options?.find((o) => o.value === v)?.label)
        .filter(Boolean)
        .join(', ');
    }
    return field.options.find((o) => o.value === value)?.label || value;
  }

  if (field.type === 'switch') {
    return value ? '是' : '否';
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return value;
};

const emitSearch = () => {
  emit('search');
};

// 监听
watch(
  () => props.searchModelValue,
  (val) => {
    localSearchValue.value = val || '';
  }
);

// 暴露方法
defineExpose({
  reset: handleReset,
  getFilters: () => ({ ...localFilterValues.value }),
  getSearchValue: () => localSearchValue.value,
  setActiveFilters: (filters: Record<string, any>) => {
    localFilterValues.value = { ...filters };
  },
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';

.ds-filter-bar {
  margin-bottom: @spacing-lg;

  &__card {
    border-radius: var(--td-radius-default);
    box-shadow: var(--td-shadow-sm);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: @spacing-md @spacing-lg;
    cursor: pointer;
    user-select: none;
    transition: background-color var(--td-duration-normal) var(--td-easing-ease);

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__header-left {
    display: flex;
    align-items: center;
    gap: @spacing-sm;
    font-weight: @font-weight-medium;
    color: var(--td-text-color-primary);
  }

  &__header-right {
    display: flex;
    align-items: center;
  }

  &__icon--collapsed {
    transform: rotate(-90deg);
    transition: transform var(--td-duration-normal) var(--td-easing-ease);
  }

  &__content {
    padding: @spacing-lg;
  }

  &__switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: @spacing-sm 0;
    font-size: @font-size-base;
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }

  &__active {
    display: flex;
    align-items: center;
    gap: @spacing-md;
    padding: @spacing-md @spacing-lg;
    background: var(--td-bg-color-container-hover);
    border-radius: var(--td-radius-default);
    margin-top: @spacing-md;
  }

  &__active-label {
    font-size: @font-size-sm;
    font-weight: @font-weight-medium;
    color: var(--td-text-color-secondary);
    white-space: nowrap;
  }

  &__active-tags {
    flex: 1;
  }

  // 折叠动画
  &__content {
    transition: all var(--td-duration-normal) var(--td-easing-ease);
  }

  &--collapsed &__content {
    overflow: hidden;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
  }

  // 响应式
  @media (max-width: 768px) {
    &__content {
      .t-row {
        flex-direction: column;
      }

      .t-col {
        width: 100% !important;
        margin-bottom: @spacing-md;
      }
    }

    &__active {
      flex-direction: column;
      align-items: flex-start;
      gap: @spacing-sm;
    }

    &__active-tags {
      width: 100%;
    }
  }
}
</style>
