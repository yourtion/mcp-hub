<template>
  <div
    class="ds-timeline"
    :class="[
      `ds-timeline--${props.direction}`,
      `ds-timeline--${props.mode}`
    ]"
  >
    <div
      v-for="(item, index) in props.items"
      :key="index"
      class="ds-timeline-item"
      :class="[
        `ds-timeline-item--${item.status || 'default'}`,
        { 'ds-timeline-item--last': index === props.items.length - 1 }
      ]"
    >
      <!-- 时间轴节点 -->
      <div class="ds-timeline-item__dot">
        <div v-if="item.icon" class="ds-timeline-item__icon">
          <component :is="iconComponent" size="16px" />
        </div>
      </div>

      <!-- 时间轴内容 -->
      <div class="ds-timeline-item__content">
        <!-- 时间标签 -->
        <div v-if="item.time" class="ds-timeline-item__time">
          {{ item.time }}
        </div>

        <!-- 标题 -->
        <div class="ds-timeline-item__title">
          {{ item.title }}
        </div>

        <!-- 描述 -->
        <div v-if="item.description" class="ds-timeline-item__description">
          {{ item.description }}
        </div>

        <!-- 自定义内容插槽 -->
        <div v-if="item.extra" class="ds-timeline-item__extra">
          <component :is="item.extra" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, type Component } from 'vue';
import {
  CheckCircleIcon,
  CloseCircleIcon,
  ErrorCircleIcon,
  InfoCircleIcon,
  TimeIcon,
  CheckIcon,
  CloseIcon,
  CircleIcon,
} from 'tdesign-icons-vue-next';

export interface TimelineItem {
  /** 时间标签 */
  time: string;
  /** 标题 */
  title: string;
  /** 描述信息 */
  description?: string;
  /** 图标 */
  icon?: string | Component;
  /** 自定义颜色 */
  color?: string;
  /** 状态 */
  status?: 'success' | 'error' | 'warning' | 'info' | 'default';
  /** 额外内容 */
  extra?: Component;
}

export interface TimelineProps {
  /** 时间轴数据 */
  items: TimelineItem[];
  /** 时间轴方向 */
  direction?: 'vertical' | 'horizontal';
  /** 时间轴模式 */
  mode?: 'left' | 'right' | 'alternate';
}

const props = withDefaults(defineProps<TimelineProps>(), {
  direction: 'vertical',
  mode: 'left',
});

// 图标映射
const iconComponentMap: Record<string, Component> = {
  'check-circle': markRaw(CheckCircleIcon),
  'close-circle': markRaw(CloseCircleIcon),
  'error-circle': markRaw(ErrorCircleIcon),
  'info-circle': markRaw(InfoCircleIcon),
  'time': markRaw(TimeIcon),
  'check': markRaw(CheckIcon),
  'close': markRaw(CloseIcon),
  'circle': markRaw(CircleIcon),
  'success': markRaw(CheckCircleIcon),
  'error': markRaw(CloseCircleIcon),
  'warning': markRaw(ErrorCircleIcon),
  'info': markRaw(InfoCircleIcon),
};

// 获取图标组件
const iconComponent = computed(() => {
  return (item: TimelineItem) => {
    if (typeof item.icon === 'string') {
      return iconComponentMap[item.icon] || iconComponentMap['circle'];
    }
    return item.icon || iconComponentMap['circle'];
  };
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/color.less';
@import '../../tokens/spacing.less';

.ds-timeline {
  position: relative;

  // 垂直方向
  &.ds-timeline--vertical {
    .ds-timeline-item {
      display: flex;
      gap: @spacing-lg;
      padding-bottom: @spacing-xxl;

      &:last-child {
        padding-bottom: 0;
      }

      &::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 24px;
        bottom: -8px;
        width: 2px;
        background: var(--td-border-level-2-color);
      }

      &.ds-timeline-item--last::before {
        display: none;
      }
    }

    .ds-timeline-item__dot {
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }

    .ds-timeline-item__content {
      flex: 1;
      padding-top: 2px;
    }
  }

  // 水平方向
  &.ds-timeline--horizontal {
    display: flex;
    gap: @spacing-xxl;
    overflow-x: auto;
    padding-bottom: @spacing-lg;

    .ds-timeline-item {
      display: flex;
      flex-direction: column;
      gap: @spacing-sm;
      min-width: 200px;
      flex-shrink: 0;

      &:not(:last-child)::after {
        content: '';
        position: absolute;
        right: -@spacing-xl;
        top: 7px;
        width: calc(@spacing-xl * 2 - 14px);
        height: 2px;
        background: var(--td-border-level-2-color);
      }
    }

    .ds-timeline-item__dot {
      align-self: flex-start;
    }

    .ds-timeline-item__content {
      text-align: left;
    }
  }

  // 左侧模式
  &.ds-timeline--left {
    .ds-timeline-item__content {
      align-items: flex-start;
    }
  }

  // 右侧模式
  &.ds-timeline--right {
    .ds-timeline-item {
      flex-direction: row-reverse;
    }

    .ds-timeline-item__content {
      align-items: flex-end;
      text-align: right;
    }
  }

  // 交替模式
  &.ds-timeline--alternate {
    .ds-timeline-item:nth-child(odd) {
      flex-direction: row;
    }

    .ds-timeline-item:nth-child(even) {
      flex-direction: row-reverse;
    }

    .ds-timeline-item:nth-child(even) .ds-timeline-item__content {
      align-items: flex-end;
      text-align: right;
    }
  }
}

.ds-timeline-item {
  position: relative;

  &__dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--td-bg-color-container);
    border: 2px solid var(--td-border-level-2-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-normal) var(--easing-cubic);
  }

  &:hover &__dot {
    transform: scale(1.2);
    box-shadow: 0 0 0 4px var(--td-bg-color-container);
  }

  &__icon {
    color: var(--td-text-color-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__time {
    font-size: var(--font-size-xs);
    color: var(--td-text-color-placeholder);
    margin-bottom: 4px;
    font-weight: var(--font-weight-medium);
  }

  &__title {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    color: var(--td-text-color-primary);
    margin-bottom: 4px;
    line-height: 1.5;
  }

  &__description {
    font-size: var(--font-size-sm);
    color: var(--td-text-color-secondary);
    line-height: 1.6;
    margin-bottom: 8px;
  }

  &__extra {
    margin-top: @spacing-sm;
  }

  // 状态样式
  &--success {
    .ds-timeline-item__dot {
      border-color: @success-color;
      background: @success-color-1;
    }

    .ds-timeline-item__icon {
      color: @success-color;
    }
  }

  &--error {
    .ds-timeline-item__dot {
      border-color: @error-color;
      background: @error-color-1;
    }

    .ds-timeline-item__icon {
      color: @error-color;
    }
  }

  &--warning {
    .ds-timeline-item__dot {
      border-color: @warning-color;
      background: @warning-color-1;
    }

    .ds-timeline-item__icon {
      color: @warning-color;
    }
  }

  &--info {
    .ds-timeline-item__dot {
      border-color: @brand-color;
      background: @brand-color-1;
    }

    .ds-timeline-item__icon {
      color: @brand-color;
    }
  }

  // 自定义颜色
  &:has(.ds-timeline-item__dot[style]) .ds-timeline-item__dot {
    border-width: 3px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .ds-timeline {
    // 移动端强制使用垂直方向和左侧模式
    &.ds-timeline--horizontal {
      flex-direction: column;
      gap: @spacing-lg;

      .ds-timeline-item {
        min-width: 100%;

        &:not(:last-child)::after {
          display: none;
        }

        &::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 24px;
          bottom: -@spacing-lg;
          width: 2px;
          background: var(--td-border-level-2-color);
        }

        &:last-child::before {
          display: none;
        }
      }
    }

    &.ds-timeline--alternate {
      .ds-timeline-item {
        flex-direction: row !important;
      }

      .ds-timeline-item__content {
        align-items: flex-start !important;
        text-align: left !important;
      }
    }

    &.ds-timeline--right {
      .ds-timeline-item {
        flex-direction: row !important;
      }

      .ds-timeline-item__content {
        align-items: flex-start !important;
        text-align: left !important;
      }
    }
  }

  .ds-timeline-item {
    gap: @spacing-md;
    padding-bottom: @spacing-xl;
  }
}
</style>
