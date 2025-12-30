<template>
  <div class="ds-detail-view" :class="[`ds-detail-view--columns-${props.columns}`]">
    <!-- 加载状态 -->
    <div v-if="props.loading" class="ds-detail-view__loading">
      <t-loading size="large" text="加载中..." />
    </div>

    <!-- 详情内容 -->
    <template v-else>
      <!-- 分组模式 -->
      <template v-if="props.groups">
        <t-card
          v-for="(group, groupIndex) in visibleGroups"
          :key="groupIndex"
          class="ds-detail-view__group"
          :class="{ 'ds-detail-view__group--collapsible': group.collapsible }"
        >
          <!-- 分组头部 -->
          <template #header>
            <div class="ds-detail-view__group-header">
              <h3>{{ group.title }}</h3>
              <p v-if="group.description">{{ group.description }}</p>
            </div>
          </template>

          <!-- 分组字段 -->
          <div
            class="ds-detail-view__fields"
            :style="{ gridTemplateColumns: `repeat(${group.columns || props.columns}, 1fr)` }"
          >
            <div
              v-for="field in getGroupFields(group)"
              :key="field.key"
              class="ds-detail-view__field"
              :class="`ds-detail-view__field--span-${field.span || 1}`"
            >
              <div class="ds-detail-view__label">
                <t-icon v-if="field.icon" :name="field.icon" size="16px" />
                {{ field.label }}
              </div>
              <div class="ds-detail-view__value">
                <component
                  :is="getFieldRenderer(field)"
                  :field="field"
                  :value="props.data[field.key]"
                  :data="props.data"
                />
              </div>
            </div>
          </div>
        </t-card>
      </template>

      <!-- 扁平模式 -->
      <t-card v-else class="ds-detail-view__card">
        <div
          class="ds-detail-view__fields"
          :style="{ gridTemplateColumns: `repeat(${props.columns}, 1fr)` }"
        >
          <div
            v-for="field in visibleFields"
            :key="field.key"
            class="ds-detail-view__field"
            :class="`ds-detail-view__field--span-${field.span || 1}`"
          >
            <div class="ds-detail-view__label">
              <t-icon v-if="field.icon" :name="field.icon" size="16px" />
              {{ field.label }}
            </div>
            <div class="ds-detail-view__value">
              <component
                :is="getFieldRenderer(field)"
                :field="field"
                :value="props.data[field.key]"
                :data="props.data"
              />
            </div>
          </div>
        </div>
      </t-card>

      <!-- 空状态 -->
      <EmptyPage
        v-if="!hasData"
        type="no-data"
        :description="`没有找到${props.emptyText}数据`"
      />
    </template>

    <!-- 操作按钮 -->
    <div v-if="props.showActions && props.actions" class="ds-detail-view__actions">
      <t-space>
        <t-button
          v-for="(action, index) in props.actions"
          :key="index"
          :theme="action.theme"
          :variant="action.variant"
          :icon="action.icon"
          :disabled="action.disabled"
          :loading="action.loading"
          @click="action.onClick"
        >
          {{ action.text }}
        </t-button>
      </t-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, type Component } from 'vue';
import {
  UserIcon,
  TimeIcon,
  LinkIcon,
  ServerIcon,
  CheckIcon,
  CloseIcon,
  CodeIcon,
} from 'tdesign-icons-vue-next';
import EmptyPage from '../feedback/EmptyPage.vue';

export interface DetailField {
  key: string;
  label: string;
  type?: 'text' | 'image' | 'link' | 'tag' | 'date' | 'datetime' | 'json' | 'code' | 'boolean' | 'status' | 'custom';
  span?: number;
  icon?: string;
  render?: (value: any, data: Record<string, any>) => any;
  visible?: boolean | ((data: Record<string, any>) => boolean);
}

export interface DetailGroup {
  title: string;
  description?: string;
  fields: DetailField[];
  columns?: number;
  collapsible?: boolean;
}

export interface DetailAction {
  text: string;
  theme?: 'primary' | 'default' | 'danger' | 'warning';
  variant?: 'base' | 'outline' | 'dashed';
  icon?: Component;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void | Promise<void>;
}

export interface DetailViewProps {
  data: Record<string, any>;
  fields?: DetailField[];
  groups?: DetailGroup[];
  columns?: number;
  editable?: boolean;
  loading?: boolean;
  showActions?: boolean;
  actions?: DetailAction[];
  emptyText?: string;
}

const props = withDefaults(defineProps<DetailViewProps>(), {
  columns: 2,
  editable: false,
  loading: false,
  showActions: false,
  emptyText: '详情',
});

// 计算属性
const hasData = computed(() => {
  return props.data && Object.keys(props.data).length > 0;
});

const visibleFields = computed(() => {
  if (!props.fields) return [];
  return props.fields.filter((field) => {
    if (typeof field.visible === 'boolean') return field.visible;
    if (typeof field.visible === 'function') return field.visible(props.data);
    return true;
  });
});

const visibleGroups = computed(() => {
  if (!props.groups) return [];
  return props.groups.filter((group) => {
    return group.fields.some((field) => {
      if (typeof field.visible === 'boolean') return field.visible;
      if (typeof field.visible === 'function') return field.visible(props.data);
      return true;
    });
  });
});

// 方法
const getGroupFields = (group: DetailGroup) => {
  return group.fields.filter((field) => {
    if (typeof field.visible === 'boolean') return field.visible;
    if (typeof field.visible === 'function') return field.visible(props.data);
    return true;
  });
};

const getFieldRenderer = (field: DetailField) => {
  if (field.render) {
    return {
      render: () => field.render!(props.data[field.key], props.data),
    };
  }

  // 内置类型渲染器
  const typeRenderers: Record<string, Component> = {
    text: TextRenderer,
    image: ImageRenderer,
    link: LinkRenderer,
    tag: TagRenderer,
    date: DateRenderer,
    datetime: DatetimeRenderer,
    json: JsonRenderer,
    code: CodeRenderer,
    boolean: BooleanRenderer,
    status: StatusRenderer,
  };

  return typeRenderers[field.type || 'text'] || TextRenderer;
};

// 渲染器组件
const TextRenderer = {
  render: () => h('span', { class: 'ds-detail-view__text' }, props.data[props.field?.key || ''] || '-'),
};

const ImageRenderer = {
  render: () => {
    const src = props.data[props.field?.key || ''];
    return src ? h('t-image', { src, fit: 'cover', style: { width: '100px', height: '100px', borderRadius: '4px' } }) : h('span', '-', '-');
  },
};

const LinkRenderer = {
  render: () => {
    const href = props.data[props.field?.key || ''];
    return href ? h('t-link', { href, target: '_blank' }, href) : h('span', '-', '-');
  },
};

const TagRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    const theme = props.field?.props?.theme || 'default';
    return value ? h('t-tag', { theme }, value) : h('span', '-', '-');
  },
};

const DateRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    return value ? h('span', new Date(value).toLocaleDateString('zh-CN')) : h('span', '-', '-');
  },
};

const DatetimeRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    return value ? h('span', new Date(value).toLocaleString('zh-CN')) : h('span', '-', '-');
  },
};

const JsonRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    if (!value) return h('span', '-', '-');
    return h('pre', {
      style: {
        fontSize: '12px',
        background: 'var(--td-bg-color-container-hover)',
        padding: '8px',
        borderRadius: '4px',
        overflow: 'auto'
      }
    }, JSON.stringify(value, null, 2));
  },
};

const CodeRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    if (!value) return h('span', '-', '-');
    return h('code', {
      style: {
        fontSize: '12px',
        background: 'var(--td-bg-color-container-hover)',
        padding: '4px 8px',
        borderRadius: '4px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }
    }, value);
  },
};

const BooleanRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    return h('t-tag', { theme: value ? 'success' : 'default' }, value ? '是' : '否');
  },
};

const StatusRenderer = {
  render: () => {
    const value = props.data[props.field?.key || ''];
    const statusConfig: Record<string, { theme: string; label: string }> = {
      active: { theme: 'success', label: '活跃' },
      enabled: { theme: 'success', label: '已启用' },
      connected: { theme: 'success', label: '已连接' },
      success: { theme: 'success', label: '成功' },
      inactive: { theme: 'default', label: '非活跃' },
      disabled: { theme: 'default', label: '已禁用' },
      disconnected: { theme: 'default', label: '未连接' },
      error: { theme: 'danger', label: '错误' },
      failed: { theme: 'danger', label: '失败' },
      warning: { theme: 'warning', label: '警告' },
      pending: { theme: 'warning', label: '待处理' },
      loading: { theme: 'warning', label: '加载中' },
    };
    const config = statusConfig[value] || { theme: 'default', label: value || '-' };
    return h('t-tag', { theme: config.theme as any }, config.label);
  },
};
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';

.ds-detail-view {
  &__loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  &__group,
  &__card {
    margin-bottom: @spacing-lg;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__group-header {
    h3 {
      margin: 0 0 @spacing-xs 0;
      font-size: @font-size-lg;
      font-weight: @font-weight-semibold;
      color: var(--td-text-color-primary);
    }

    p {
      margin: 0;
      font-size: @font-size-sm;
      color: var(--td-text-color-secondary);
    }
  }

  &__fields {
    display: grid;
    gap: @spacing-lg @spacing-xl;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: @spacing-xs;

    &--span-2 {
      grid-column: span 2;
    }

    &--span-3 {
      grid-column: span 3;
    }

    &--span-4 {
      grid-column: span 4;
    }
  }

  &__label {
    display: flex;
    align-items: center;
    gap: @spacing-xs;
    font-size: @font-size-sm;
    font-weight: @font-weight-medium;
    color: var(--td-text-color-secondary);
  }

  &__value {
    font-size: @font-size-base;
    color: var(--td-text-color-primary);
    word-break: break-all;
  }

  &__text {
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    padding-top: @spacing-lg;
    border-top: 1px solid var(--td-border-level-1-color);
  }

  // 响应式列数
  &--columns-1 .ds-detail-view__fields {
    grid-template-columns: 1fr;
  }

  &--columns-2 .ds-detail-view__fields {
    grid-template-columns: repeat(2, 1fr);
  }

  &--columns-3 .ds-detail-view__fields {
    grid-template-columns: repeat(3, 1fr);
  }

  &--columns-4 .ds-detail-view__fields {
    grid-template-columns: repeat(4, 1fr);
  }

  // 响应式
  @media (max-width: 768px) {
    &__fields {
      grid-template-columns: 1fr !important;
    }

    &__field {
      &--span-2,
      &--span-3,
      &--span-4 {
        grid-column: span 1;
      }
    }
  }
}
</style>
