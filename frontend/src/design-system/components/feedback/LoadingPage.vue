<template>
  <div
    class="ds-loading-page"
    :class="[
      `ds-loading-page--${props.size}`,
      { 'ds-loading-page--fullscreen': props.fullscreen }
    ]"
  >
    <div class="ds-loading-page__content">
      <!-- 加载动画 -->
      <t-loading
        :size="loadingSize"
        :loading="true"
        v-bind="loadingProps"
      />

      <!-- 加载文本 -->
      <p v-if="props.text" class="ds-loading-page__text">
        {{ props.text }}
      </p>

      <!-- 额外内容插槽 -->
      <div v-if="$slots.extra" class="ds-loading-page__extra">
        <slot name="extra" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface LoadingPageProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
  fullscreen?: boolean;
  delay?: number;
}

const props = withDefaults(defineProps<LoadingPageProps>(), {
  size: 'medium',
  fullscreen: false,
  delay: 0,
});

// 计算属性
const loadingSize = computed(() => {
  const sizeMap = {
    small: 'small',
    medium: 'medium',
    large: 'large',
  };
  return sizeMap[props.size];
});

const loadingProps = computed(() => ({
  text: props.text ? undefined : '', // 避免TDesign显示默认文本
}));
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';

.ds-loading-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: @spacing-xxxl @spacing-lg;
  text-align: center;

  &--fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    min-height: 100vh;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: @spacing-lg;
  }

  &__text {
    margin: 0;
    font-size: @font-size-base;
    color: var(--td-text-color-secondary);
    font-weight: @font-weight-medium;
  }

  &__extra {
    margin-top: @spacing-md;
  }

  // 大小变体
  &--small {
    min-height: 120px;
    padding: @spacing-xl @spacing-lg;

    .ds-loading-page__text {
      font-size: @font-size-sm;
    }
  }

  &--large {
    min-height: 400px;
    padding: @spacing-xxxl @spacing-xl;

    .ds-loading-page__text {
      font-size: @font-size-lg;
    }
  }

  // 响应式
  @media (max-width: 768px) {
    padding: @spacing-xxl @spacing-md;

    &__text {
      font-size: @font-size-sm;
    }
  }
}
</style>
