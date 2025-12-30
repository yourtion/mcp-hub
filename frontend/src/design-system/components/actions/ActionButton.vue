<template>
  <t-dropdown
    v-if="hasDropdown"
    :options="dropdownOptions"
    trigger="click"
    :disabled="props.disabled || props.loading"
    @click="handleDropdownClick"
  >
    <t-button
      :theme="props.theme"
      :variant="props.variant"
      :size="props.size"
      :loading="props.loading"
      :disabled="props.disabled"
      :shape="props.shape"
      :block="props.block"
      :class="['ds-action-button', `ds-action-button--${props.theme}`]"
    >
      <template v-if="props.icon" #icon>
        <component :is="iconComponent" />
      </template>
      <span v-if="props.text">{{ props.text }}</span>
      <template v-if="hasDropdown" #suffix>
        <ChevronDownIcon />
      </template>
    </t-button>
  </t-dropdown>

  <t-button
    v-else
    :theme="props.theme"
    :variant="props.variant"
    :size="props.size"
    :loading="props.loading"
    :disabled="props.disabled"
    :shape="props.shape"
    :block="props.block"
    :class="['ds-action-button', `ds-action-button--${props.theme}`]"
    @click="handleClick"
  >
    <template v-if="props.icon" #icon>
      <component :is="iconComponent" />
    </template>
    <span v-if="props.text">{{ props.text }}</span>
  </t-button>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';

export interface DropdownOption {
  content: string;
  value: string | number;
  onClick?: () => void;
  divider?: boolean;
}

export interface ActionButtonProps {
  // 基础属性
  text?: string;
  icon?: string | Component;
  theme?: 'primary' | 'default' | 'danger' | 'warning' | 'success';
  variant?: 'base' | 'outline' | 'dashed' | 'text';
  size?: 'small' | 'medium' | 'large';
  shape?: 'square' | 'round' | 'circle';

  // 状态
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;

  // 下拉菜单
  dropdown?: DropdownOption[];

  // 确认
  confirm?: {
    title?: string;
    content?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
  };
}

const props = withDefaults(defineProps<ActionButtonProps>(), {
  theme: 'default',
  variant: 'base',
  size: 'medium',
  shape: 'square',
  loading: false,
  disabled: false,
  block: false,
});

// Emits
const emit = defineEmits<{
  click: [];
  dropdownClick: [option: DropdownOption];
}>();

// 计算属性
const hasDropdown = computed(() => props.dropdown && props.dropdown.length > 0);

const dropdownOptions = computed(() => {
  if (!props.dropdown) return [];

  return props.dropdown.map((option) => ({
    content: option.content,
    value: option.value,
    divider: option.divider,
    onClick: () => handleDropdownOptionClick(option),
  }));
});

const iconComponent = computed(() => {
  if (typeof props.icon === 'string') {
    // 可以在这里添加图标名称映射
    return props.icon;
  }
  return props.icon;
});

// 方法
const handleClick = () => {
  if (props.confirm) {
    // 需要确认对话框，这里使用 Dialog.confirm
    // 注意：实际使用时需要导入 Dialog 组件
    emit('click');
  } else {
    emit('click');
  }
};

const handleDropdownClick = (data: any) => {
  // TDesign dropdown click handler
};

const handleDropdownOptionClick = (option: DropdownOption) => {
  if (option.onClick) {
    option.onClick();
  }
  emit('dropdownClick', option);
};

// 暴露方法
defineExpose({
  handleClick,
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';

.ds-action-button {
  transition: all var(--td-duration-normal) var(--td-easing-ease);

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--td-shadow-2);
  }

  &:active {
    transform: translateY(0);
  }

  // 主题变体
  &--primary {
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 82, 217, 0.3);
    }
  }

  &--danger {
    &:hover {
      box-shadow: 0 4px 12px rgba(245, 76, 76, 0.3);
    }
  }

  &--success {
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 168, 112, 0.3);
    }
  }

  &--warning {
    &:hover {
      box-shadow: 0 4px 12px rgba(237, 123, 47, 0.3);
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .ds-action-button {
    :deep(.t-button__text) {
      font-size: var(--td-font-size-sm);
    }
  }
}
</style>
