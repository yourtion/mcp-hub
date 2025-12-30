<template>
  <div class="ds-config-subsection">
    <div class="ds-config-subsection__header">
      <h5 class="ds-config-subsection__title">{{ props.title }}</h5>
      <p v-if="props.description" class="ds-config-subsection__description">
        {{ props.description }}
      </p>
    </div>
    <div class="ds-config-subsection__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
});
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';
@import '../../tokens/spacing.less';
@import '../../tokens/typography.less';
@import '../../tokens/color.less';
@import '../../tokens/border.less';

.ds-config-subsection {
  margin-bottom: @spacing-xl;

  &:last-child {
    margin-bottom: 0;
  }
}

.ds-config-subsection__header {
  margin-bottom: @spacing-md;
  padding-bottom: @spacing-sm;
  border-bottom: 1px solid var(--td-border-level-2-color);
}

.ds-config-subsection__title {
  margin: 0 0 @spacing-xs 0;
  font-size: @font-size-md;
  font-weight: @font-weight-semibold;
  color: var(--td-text-color-primary);
  line-height: @line-height-tight;
}

.ds-config-subsection__description {
  margin: 0;
  font-size: @font-size-sm;
  color: var(--td-text-color-secondary);
  line-height: @line-height-normal;
}

.ds-config-subsection__content {
  /* Content styling handled by parent */
}

// 响应式
@media (max-width: 768px) {
  .ds-config-subsection {
    margin-bottom: @spacing-lg;
  }

  .ds-config-subsection__header {
    margin-bottom: @spacing-sm;
  }

  .ds-config-subsection__title {
    font-size: @font-size-base;
  }

  .ds-config-subsection__description {
    font-size: @font-size-xs;
  }
}
</style>
