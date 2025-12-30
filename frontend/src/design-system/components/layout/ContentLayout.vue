<template>
  <div class="ds-content-layout" :class="{ 'ds-content-layout--fluid': props.fluid }">
    <!-- 页面头部 -->
    <PageHeader
      v-if="props.title || $slots.header"
      :title="props.title"
      :description="props.description"
      :actions="props.actions"
      :meta="props.meta"
      :class="props.headerClass"
    >
      <template v-if="$slots['header-extra']" #extra>
        <slot name="header-extra" />
      </template>
    </PageHeader>

    <!-- 内容区域 -->
    <div
      class="ds-content-layout__body"
      :class="props.bodyClass"
      :style="bodyStyle"
    >
      <!-- 加载状态 -->
      <LoadingPage v-if="props.loading" :fullscreen="false" />

      <!-- 内容插槽 -->
      <slot v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import PageHeader from './PageHeader.vue';
import LoadingPage from '../feedback/LoadingPage.vue';

export interface ContentLayoutProps {
  // 页面头部
  title?: string;
  description?: string;
  actions?: any[];
  meta?: string;
  headerClass?: string;

  // 布局
  maxWidth?: string | number;
  fluid?: boolean;
  padding?: string | boolean;

  // 样式
  bodyClass?: string;

  // 加载状态
  loading?: boolean;
}

const props = withDefaults(defineProps<ContentLayoutProps>(), {
  fluid: false,
  padding: true,
  loading: false,
});

// 计算属性
const bodyStyle = computed((): CSSProperties => {
  const style: CSSProperties = {};

  if (!props.fluid && props.maxWidth) {
    style.maxWidth = typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth;
    style.margin = '0 auto';
  }

  return style;
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';

.ds-content-layout {
  min-height: 100%;

  &__body {
    padding: 0;
  }

  // 内容间距变体
  &--fluid .ds-content-layout__body {
    max-width: none;
  }

  // 默认有padding
  &:not([class*='--no-padding']) .ds-content-layout__body {
    padding: var(--spacing-xxl);
  }

  // 响应式
  @media (max-width: 768px) {
    &__body {
      padding: var(--spacing-lg) !important;
    }
  }
}
</style>
