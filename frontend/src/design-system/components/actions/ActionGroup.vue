<template>
  <div
    class="ds-action-group"
    :class="[
      `ds-action-group--${props.layout}`,
      `ds-action-group--${props.size}`,
      {
        'ds-action-group--responsive': props.responsive,
        'ds-action-group--compact': props.compact,
      }
    ]"
  >
    <!-- 主要操作区域 -->
    <div v-if="primaryActions.length > 0" class="ds-action-group__primary">
      <ActionButton
        v-for="action in primaryActions"
        :key="action.key || action.text"
        :text="action.text"
        :icon="action.icon"
        :theme="action.theme || 'primary'"
        :variant="action.variant || 'base'"
        :size="props.size"
        :loading="action.loading"
        :disabled="action.disabled"
        :dropdown="action.dropdown"
        :confirm="action.confirm"
        @click="handleActionClick(action)"
        @dropdown-click="handleDropdownClick(action, $event)"
      />
    </div>

    <!-- 次要操作区域 -->
    <div v-if="secondaryActions.length > 0" class="ds-action-group__secondary">
      <ActionButton
        v-for="action in secondaryActions"
        :key="action.key || action.text"
        :text="action.text"
        :icon="action.icon"
        :theme="action.theme || 'default'"
        :variant="action.variant || 'outline'"
        :size="props.size"
        :loading="action.loading"
        :disabled="action.disabled"
        :dropdown="action.dropdown"
        :confirm="action.confirm"
        @click="handleActionClick(action)"
        @dropdown-click="handleDropdownClick(action, $event)"
      />
    </div>

    <!-- 危险操作区域 -->
    <div v-if="dangerActions.length > 0" class="ds-action-group__danger">
      <ActionButton
        v-for="action in dangerActions"
        :key="action.key || action.text"
        :text="action.text"
        :icon="action.icon"
        :theme="action.theme || 'danger'"
        :variant="action.variant || 'outline'"
        :size="props.size"
        :loading="action.loading"
        :disabled="action.disabled"
        :dropdown="action.dropdown"
        :confirm="action.confirm || { type: 'danger', content: '确定要执行此操作吗？' }"
        @click="handleActionClick(action)"
        @dropdown-click="handleDropdownClick(action, $event)"
      />
    </div>

    <!-- 更多操作（下拉菜单） -->
    <t-dropdown
      v-if="moreActions.length > 0"
      :options="moreDropdownOptions"
      trigger="click"
      @click="handleMoreClick"
    >
      <t-button :variant="'outline'" :size="props.size">
        <template #icon>
          <MoreIcon />
        </template>
        更多
      </t-button>
    </t-dropdown>

    <!-- 自定义插槽 -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { MoreIcon } from 'tdesign-icons-vue-next';
import ActionButton, { type DropdownOption } from './ActionButton.vue';

export interface Action {
  key?: string;
  text: string;
  icon?: string | Component;
  theme?: 'primary' | 'default' | 'danger' | 'warning' | 'success';
  variant?: 'base' | 'outline' | 'dashed' | 'text';
  loading?: boolean;
  disabled?: boolean;
  dropdown?: DropdownOption[];
  confirm?: {
    title?: string;
    content?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
  };
  priority?: 'primary' | 'secondary' | 'danger' | 'more';
  onClick?: () => void;
}

export interface ActionGroupProps {
  // 操作列表
  actions?: Action[];

  // 布局
  layout?: 'horizontal' | 'vertical';

  // 尺寸
  size?: 'small' | 'medium' | 'large';

  // 响应式
  responsive?: boolean;

  // 紧凑模式
  compact?: boolean;

  // 最大显示数量（超过则放到"更多"中）
  maxVisible?: number;
}

const props = withDefaults(defineProps<ActionGroupProps>(), {
  actions: () => [],
  layout: 'horizontal',
  size: 'medium',
  responsive: true,
  compact: false,
  maxVisible: 4,
});

// Emits
const emit = defineEmits<{
  actionClick: [action: Action];
  dropdownClick: [action: Action, option: DropdownOption];
}>();

// 计算属性 - 按优先级分组
const primaryActions = computed(() => {
  return props.actions.filter((a) => a.priority === 'primary' || (!a.priority && a.theme === 'primary'));
});

const secondaryActions = computed(() => {
  return props.actions.filter((a) => a.priority === 'secondary' || (!a.priority && a.theme !== 'danger'));
});

const dangerActions = computed(() => {
  return props.actions.filter((a) => a.priority === 'danger' || a.theme === 'danger');
});

const moreActions = computed(() => {
  const visibleCount = primaryActions.value.length + secondaryActions.value.length + dangerActions.value.length;
  if (visibleCount >= props.maxVisible) return [];

  return props.actions.filter((a) => a.priority === 'more');
});

const moreDropdownOptions = computed(() => {
  return moreActions.value.map((action) => ({
    content: action.text,
    value: action.key || action.text,
    onClick: () => handleActionClick(action),
  }));
});

// 方法
const handleActionClick = (action: Action) => {
  if (action.onClick) {
    action.onClick();
  }
  emit('actionClick', action);
};

const handleDropdownClick = (action: Action, option: DropdownOption) => {
  emit('dropdownClick', action, option);
};

const handleMoreClick = (data: any) => {
  const action = moreActions.value.find((a) => (a.key || a.text) === data.value);
  if (action) {
    handleActionClick(action);
  }
};

// 暴露方法
defineExpose({
  triggerAction: (key: string) => {
    const action = props.actions.find((a) => a.key === key);
    if (action) {
      handleActionClick(action);
    }
  },
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';

.ds-action-group {
  display: flex;
  gap: @spacing-sm;

  // 水平布局
  &--horizontal {
    flex-direction: row;
    flex-wrap: wrap;
  }

  // 垂直布局
  &--vertical {
    flex-direction: column;

    .ds-action-group__primary,
    .ds-action-group__secondary,
    .ds-action-group__danger {
      width: 100%;

      :deep(.t-button) {
        width: 100%;
      }
    }
  }

  // 分组
  &__primary,
  &__secondary,
  &__danger {
    display: flex;
    gap: @spacing-sm;
  }

  &__primary {
    margin-right: @spacing-md;
  }

  &__secondary {
    margin-right: @spacing-sm;
  }

  &__danger {
    margin-left: auto; // 推到右侧
  }

  // 尺寸变体
  &--small {
    gap: @spacing-xs;
  }

  &--large {
    gap: @spacing-md;
  }

  // 紧凑模式
  &--compact {
    gap: @spacing-xs;

    :deep(.t-button) {
      padding-left: @spacing-sm;
      padding-right: @spacing-sm;
    }
  }

  // 响应式
  &--responsive {
    @media (max-width: 768px) {
      flex-direction: column;
      width: 100%;

      .ds-action-group__primary,
      .ds-action-group__secondary,
      .ds-action-group__danger {
        width: 100%;
        flex-direction: column;
        margin-right: 0;
        margin-left: 0;

        :deep(.t-button) {
          width: 100%;
        }
      }

      :deep(.t-dropdown) {
        width: 100%;

        .t-button {
          width: 100%;
        }
      }
    }
  }
}
</style>
