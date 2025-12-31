<template>
  <div class="ds-data-table" :class="[`ds-data-table--${props.size}`, borderClass, stripeClass]">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="ds-data-table__toolbar">
      <div class="ds-data-table__toolbar-left">
        <t-checkbox
          v-if="selectable"
          :checked="selectAll"
          :indeterminate="indeterminate"
          @change="handleSelectAll"
        >
          全选
        </t-checkbox>
        <slot name="toolbar-left">
          <t-space>
            <t-button
              v-if="selectedRows.length > 0"
              theme="danger"
              variant="outline"
              size="small"
              @click="handleBatchDelete"
            >
              <template #icon>
                <DeleteIcon />
              </template>
              批量删除 ({{ selectedRows.length }})
            </t-button>
          </t-space>
        </slot>
      </div>
      <div class="ds-data-table__toolbar-right">
        <slot name="toolbar-right">
          <t-space>
            <t-input
              v-if="searchable"
              v-model="localSearchValue"
              placeholder="搜索..."
              clearable
              @change="handleSearch"
            >
              <template #prefix-icon>
                <SearchIcon />
              </template>
            </t-input>
            <t-button
              variant="outline"
              size="small"
              @click="handleRefresh"
            >
              <template #icon>
                <RefreshIcon />
              </template>
              刷新
            </t-button>
            <t-dropdown
              v-if="columns && showColumnSetting"
              :options="columnOptions"
              trigger="click"
            >
              <t-button variant="outline" size="small">
                <template #icon>
                  <SettingIcon />
                </template>
                列设置
              </t-button>
            </t-dropdown>
          </t-space>
        </slot>
      </div>
    </div>

    <!-- 表格 -->
    <t-table
      :data="localData"
      :columns="computedColumns"
      :loading="loading"
      :pagination="paginationConfig"
      :selected-row-keys="selectedRowKeys"
      :row-key="rowKey"
      :size="props.size"
      :stripe="stripe"
      :bordered="border"
      :hover="hover"
      :reserve-selected-row="true"
      :empty="emptyProps"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
      @sort-change="handleSortChange"
      @select-change="handleSelectionChange"
      @filter-change="handleFilterChange"
    >
      <!-- 自定义列插槽 - 支持所有列 -->
      <template
        v-for="col in props.columns"
        #[col.colKey]="slotProps"
        :key="col.colKey"
      >
        <slot
          :name="col.colKey"
          v-bind="slotProps"
        >
          <!-- 如果插槽有内容，使用 render 函数或默认值 -->
          <component
            :is="col.render"
            v-if="col.render"
            :row="slotProps.row"
            :row-index="slotProps.rowIndex"
            :col="col"
          />
          <span v-else>{{ slotProps.row[col.colKey] }}</span>
        </slot>
      </template>

      <!-- 空状态 -->
      <template #empty>
        <div class="ds-data-table__empty">
          <EmptyPage
            :type="localData.length === 0 ? 'no-data' : 'no-result'"
            :illustration="true"
          >
            <template v-if="searchable && localSearchValue" #actions>
              <t-button theme="primary" @click="handleClearSearch">
                清除搜索
              </t-button>
            </template>
          </EmptyPage>
        </div>
      </template>
    </t-table>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, watch, type PropType, type Component } from 'vue';
import {
  DeleteIcon,
  SearchIcon,
  RefreshIcon,
  SettingIcon,
  CheckIcon,
} from 'tdesign-icons-vue-next';
import type { TableProps, PaginationProps } from 'tdesign-vue-next';
import EmptyPage from '../feedback/EmptyPage.vue';

export interface DataTableColumn<T = any> {
  colKey: string;
  title: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  fixed?: 'left' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  filters?: Array<{ label: string; value: any }>;
  cell?: string;
  render?: (row: T, rowIndex: number) => any;
  children?: DataTableColumn<T>[];
}

export interface DataTablePagination {
  current: number;
  pageSize: number;
  total?: number;
  showJumper?: boolean;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
}

export interface DataTableProps<T = any> {
  // 数据
  data: T[];
  columns: DataTableColumn<T>[];

  // 分页
  pagination?: DataTablePagination | false;

  // 选择
  selectable?: boolean;
  rowKey?: string;

  // 搜索和筛选
  searchable?: boolean;
  filterable?: boolean;

  // 样式
  size?: 'small' | 'medium' | 'large';
  stripe?: boolean;
  border?: boolean;
  hover?: boolean;

  // 工具栏
  showToolbar?: boolean;
  showColumnSetting?: boolean;

  // 加载状态
  loading?: boolean;

  // 空状态
  emptyText?: string;
}

const props = withDefaults(defineProps<DataTableProps>(), {
  size: 'medium',
  stripe: true,
  border: false,
  hover: true,
  showToolbar: false,
  showColumnSetting: false,
  selectable: false,
  searchable: false,
  filterable: false,
  rowKey: 'id',
  emptyText: '暂无数据',
});

// Emits
const emit = defineEmits<{
  'search': [keyword: string];
  'refresh': [];
  'selection-change': [selectedRows: T[], selectedRowKeys: any[]];
  'sort-change': [sort: any];
  'filter-change': [filters: any];
  'page-change': [page: number];
  'page-size-change': [pageSize: number];
  'batch-delete': [rows: T[]];
  'update:data': [data: T[]];
}>();

// 状态
const localData = ref<T[]>([...props.data]);
const localSearchValue = ref('');
const selectedRowKeys = ref<any[]>([]);
const selectedRows = ref<T[]>([]);
const sortInfo = ref<{ sortBy: string; descending: boolean }>();
const filterInfo = ref<Record<string, any>>({});

// 计算属性
const computedColumns = computed(() => {
  return props.columns.map((col) => ({
    ...col,
    cell: col.cell || col.colKey,
  }));
});

const customColumns = computed(() => {
  return props.columns.filter((col) => col.render);
});

const selectAll = computed(() => {
  return localData.value.length > 0 && selectedRowKeys.value.length === localData.value.length;
});

const indeterminate = computed(() => {
  return selectedRowKeys.value.length > 0 && selectedRowKeys.value.length < localData.value.length;
});

const borderClass = computed(() => (props.border ? 'ds-data-table--border' : ''));
const stripeClass = computed(() => (props.stripe ? 'ds-data-table--stripe' : ''));

const paginationConfig = computed((): PaginationProps | false => {
  if (props.pagination === false) return false;

  const total = props.pagination?.total || localData.value.length;

  return {
    current: props.pagination?.current || 1,
    pageSize: props.pagination?.pageSize || 10,
    total,
    showJumper: props.pagination?.showJumper !== false,
    showSizeChanger: props.pagination?.showSizeChanger !== false,
    pageSizeOptions: props.pagination?.pageSizeOptions || [10, 20, 50, 100],
  };
});

const emptyProps = computed(() => ({
  description: props.emptyText,
}));

const columnOptions = computed(() => {
  return props.columns.map((col) => ({
    label: col.title,
    value: col.colKey,
    checked: true,
    onClick: () => toggleColumnVisibility(col.colKey),
  }));
});

// 方法
const handleSearch = () => {
  emit('search', localSearchValue.value);
};

const handleClearSearch = () => {
  localSearchValue.value = '';
  emit('search', '');
};

const handleRefresh = () => {
  emit('refresh');
};

const handleSelectAll = (value: boolean) => {
  if (value) {
    const allKeys = localData.value.map((item) => item[props.rowKey]);
    selectedRowKeys.value = allKeys;
    selectedRows.value = [...localData.value];
  } else {
    selectedRowKeys.value = [];
    selectedRows.value = [];
  }
  emit('selection-change', selectedRows.value, selectedRowKeys.value);
};

const handleSelectionChange = (value: any[], context: any) => {
  selectedRowKeys.value = value;
  selectedRows.value = context.selectedRows;
  emit('selection-change', selectedRows.value, selectedRowKeys.value);
};

const handleBatchDelete = () => {
  emit('batch-delete', selectedRows.value);
};

const handleSortChange = (sort: any) => {
  sortInfo.value = sort;
  emit('sort-change', sort);
};

const handleFilterChange = (filters: any) => {
  filterInfo.value = filters;
  emit('filter-change', filters);
};

const handlePageChange = (page: number) => {
  emit('page-change', page);
};

const handlePageSizeChange = (pageSize: number) => {
  emit('page-size-change', pageSize);
};

const toggleColumnVisibility = (colKey: string) => {
  // 实现列显示/隐藏逻辑
  console.log('Toggle column:', colKey);
};

// 监听props变化
watch(
  () => props.data,
  (newData) => {
    localData.value = [...newData];
  },
  { deep: true }
);

// 暴露方法给父组件
defineExpose({
  clearSelection: () => {
    selectedRowKeys.value = [];
    selectedRows.value = [];
  },
  getSelectedRows: () => selectedRows.value,
  getSelectedRowKeys: () => selectedRowKeys.value,
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';
@import '../../tokens/color.less';

.ds-data-table {
  background: var(--td-bg-color-container);
  border-radius: var(--td-radius-default);
  overflow: hidden;

  &--border {
    :deep(.t-table) {
      border: 1px solid var(--td-border-level-1-color);
    }
  }

  &--stripe {
    :deep(.t-table__tbody .t-table__tr:nth-child(even)) {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &--small {
    :deep(.t-table) {
      font-size: @font-size-sm;
    }
  }

  &--large {
    :deep(.t-table) {
      font-size: @font-size-lg;
    }
  }
}

.ds-data-table__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: @spacing-md @spacing-lg;
  border-bottom: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-page);
}

.ds-data-table__toolbar-left,
.ds-data-table__toolbar-right {
  display: flex;
  align-items: center;
  gap: @spacing-md;
}

.ds-data-table__empty {
  padding: @spacing-xxxl @spacing-lg;
}
</style>
