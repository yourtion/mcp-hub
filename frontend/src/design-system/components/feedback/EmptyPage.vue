<template>
  <div class="ds-empty-page" :class="[`ds-empty-page--${props.type}`]">
    <div class="ds-empty-page__content">
      <!-- 插图 -->
      <div v-if="props.illustration" class="ds-empty-page__illustration">
        <component :is="illustrationComponent" />
      </div>

      <!-- 图标（无插图模式）-->
      <div v-else class="ds-empty-page__icon">
        <component :is="iconComponent" size="64px" />
      </div>

      <!-- 标题 -->
      <h3 v-if="props.title" class="ds-empty-page__title">
        {{ props.title }}
      </h3>
      <h3 v-else class="ds-empty-page__title">
        {{ defaultTitle }}
      </h3>

      <!-- 描述 -->
      <p v-if="props.description" class="ds-empty-page__description">
        {{ props.description }}
      </p>
      <p v-else-if="defaultDescription" class="ds-empty-page__description">
        {{ defaultDescription }}
      </p>

      <!-- 操作按钮 -->
      <div v-if="hasActions" class="ds-empty-page__actions">
        <slot name="actions">
          <t-space>
            <t-button
              v-for="(action, index) in props.actions"
              :key="index"
              :theme="action.theme"
              :variant="action.variant"
              :icon="action.icon"
              @click="action.onClick"
            >
              {{ action.text }}
            </t-button>
          </t-space>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue';
import {
  LayersIcon,
  InfoCircleIcon,
  CloseCircleIcon,
  LockOnIcon,
  SearchIcon,
} from 'tdesign-icons-vue-next';

export interface EmptyPageAction {
  text: string;
  theme?: 'primary' | 'default' | 'danger' | 'warning';
  variant?: 'base' | 'outline' | 'dashed';
  icon?: Component;
  onClick: () => void;
}

export interface EmptyPageProps {
  type?: 'no-data' | 'no-result' | 'no-permission' | 'error' | 'loading';
  title?: string;
  description?: string;
  actions?: EmptyPageAction[];
  illustration?: boolean;
}

const props = withDefaults(defineProps<EmptyPageProps>(), {
  type: 'no-data',
  illustration: true,
});

// 类型到图标的映射
const iconMap: Record<string, Component> = {
  'no-data': markRaw(LayersIcon),
  'no-result': markRaw(SearchIcon),
  'no-permission': markRaw(LockOnIcon),
  'error': markRaw(CloseCircleIcon),
  'loading': markRaw(InfoCircleIcon),
  'info': markRaw(InfoCircleIcon),
};

// 默认标题
const defaultTitles: Record<string, string> = {
  'no-data': '暂无数据',
  'no-result': '未找到匹配的结果',
  'no-permission': '您没有权限访问',
  'error': '出错了',
  'loading': '加载中...',
};

// 默认描述
const defaultDescriptions: Record<string, string> = {
  'no-data': '当前没有数据可显示',
  'no-result': '请尝试调整搜索或筛选条件',
  'no-permission': '请联系管理员获取访问权限',
  'error': '系统遇到错误，请稍后重试',
};

// 计算属性
const iconComponent = computed(() => {
  return iconMap[props.type] || iconMap['no-data'];
});

const illustrationComponent = computed(() => {
  return iconComponent; // 可以替换为SVG插图组件
});

const defaultTitle = computed(() => {
  return defaultTitles[props.type] || '暂无数据';
});

const defaultDescription = computed(() => {
  return defaultDescriptions[props.type] || '';
});

const hasActions = computed(() => {
  return props.actions && props.actions.length > 0;
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';

.ds-empty-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: @spacing-xxxl @spacing-lg;
  text-align: center;

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 480px;
  }

  &__illustration,
  &__icon {
    margin-bottom: @spacing-xl;
    color: var(--td-text-color-placeholder);
    opacity: 0.6;
  }

  &__illustration {
    :deep(svg) {
      width: 200px;
      height: 160px;
    }
  }

  &__icon {
    font-size: 64px;
  }

  &__title {
    margin: 0 0 @spacing-md 0;
    font-size: @font-size-xl;
    font-weight: @font-weight-medium;
    color: var(--td-text-color-primary);
  }

  &__description {
    margin: 0 0 @spacing-xxl 0;
    font-size: @font-size-base;
    color: var(--td-text-color-secondary);
    line-height: @line-height-normal;
  }

  &__actions {
    display: flex;
    gap: @spacing-md;
  }

  // 类型变体
  &--no-data {
    .ds-empty-page__icon {
      color: var(--td-brand-color);
    }
  }

  &--no-result {
    .ds-empty-page__icon {
      color: var(--td-warning-color);
    }
  }

  &--no-permission {
    .ds-empty-page__icon {
      color: var(--td-error-color);
    }
  }

  &--error {
    .ds-empty-page__icon {
      color: var(--td-error-color);
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .ds-empty-page {
    padding: @spacing-xxl @spacing-md;
    min-height: 300px;

    &__illustration {
      :deep(svg) {
        width: 160px;
        height: 120px;
      }
    }

    &__icon {
      font-size: 48px;
    }

    &__title {
      font-size: @font-size-lg;
    }

    &__description {
      font-size: @font-size-sm;
    }
  }
}
</style>
