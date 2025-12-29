<template>
  <div class="ds-filter-bar">
    <div v-if="searchable" class="ds-filter-bar__search">
      <t-input
        :model-value="searchModelValue"
        :placeholder="searchPlaceholder"
        clearable
        @update:model-value="handleSearchChange"
      >
        <template #prefix-icon>
          <SearchIcon />
        </template>
      </t-input>
    </div>

    <div v-if="hasFilters" class="ds-filter-bar__filters">
      <t-select
        v-for="filter in filters"
        :key="filter.key"
        :model-value="filterValues[filter.key]"
        :placeholder="filter.placeholder"
        :clearable="filter.clearable ?? true"
        @update:model-value="handleFilterChange(filter.key, $event)"
      >
        <t-option
          v-for="option in filter.options"
          :key="option.value"
          :value="option.value"
          :label="option.label"
        />
      </t-select>
    </div>

    <div v-if="hasActions" class="ds-filter-bar__actions">
      <t-button
        v-for="action in actions"
        :key="action.text"
        :theme="action.theme || 'default'"
        :variant="action.variant"
        @click="action.onClick"
      >
        <template v-if="action.icon" #icon>
          <component :is="action.icon" />
        </template>
        {{ action.text }}
      </t-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue';
import { SearchIcon } from 'tdesign-icons-vue-next';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface Filter {
  key: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
  clearable?: boolean;
}

export interface FilterAction {
  text: string;
  theme?: 'primary' | 'default' | 'danger' | 'warning';
  variant?: 'base' | 'outline' | 'dashed';
  icon?: Component;
  onClick: () => void;
}

export interface FilterBarProps {
  searchPlaceholder?: string;
  searchable?: boolean;
  searchModelValue?: string;
  filters?: Filter[];
  actions?: FilterAction[];
}

export interface FilterBarEmits {
  'update:searchModelValue': [value: string];
  'update:filterValues': [values: Record<string, unknown>];
  search: [];
  reset: [];
}

const props = withDefaults(defineProps<FilterBarProps>(), {
  searchPlaceholder: '搜索...',
  searchable: true,
  searchModelValue: '',
  filters: () => [],
  actions: () => [],
});

const emit = defineEmits<FilterBarEmits>();

// 本地状态
const filterValues = ref<Record<string, unknown>>({});

// 初始化 filter 值
if (props.filters) {
  props.filters.forEach(filter => {
    filterValues.value[filter.key] = '';
  });
}

const hasFilters = computed(() => props.filters && props.filters.length > 0);
const hasActions = computed(() => props.actions && props.actions.length > 0);

const handleSearchChange = (value: string) => {
  emit('update:searchModelValue', value);
  emit('search');
};

const handleFilterChange = (key: string, value: unknown) => {
  filterValues.value[key] = value;
  emit('update:filterValues', { ...filterValues.value });
};

// 暴露重置方法
const reset = () => {
  if (props.filters) {
    props.filters.forEach(filter => {
      filterValues.value[filter.key] = '';
    });
  }
  emit('update:searchModelValue', '');
  emit('reset');
};

defineExpose({
  reset,
});
</script>

<style lang="less" scoped>
.ds-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.ds-filter-bar__search {
  flex: 1;
  min-width: 240px;
  max-width: 400px;
}

.ds-filter-bar__filters {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  flex: 1;
}

.ds-filter-bar__filters .t-select {
  width: 140px;
  min-width: 120px;
}

.ds-filter-bar__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

// 响应式设计
@media (max-width: 768px) {
  .ds-filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  .ds-filter-bar__search {
    width: 100%;
    max-width: none;
  }

  .ds-filter-bar__filters {
    width: 100%;
    justify-content: flex-start;
  }

  .ds-filter-bar__filters .t-select {
    flex: 1;
    min-width: 0;
  }

  .ds-filter-bar__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
