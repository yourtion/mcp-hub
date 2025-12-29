<template>
  <div class="ds-page-header" :class="[props.class]">
    <div class="ds-page-header__left">
      <h1 class="ds-page-header__title">{{ props.title }}</h1>
      <p v-if="props.description" class="ds-page-header__description">
        {{ props.description }}
      </p>
      <div v-if="props.meta" class="ds-page-header__meta">
        {{ props.meta }}
      </div>
      <slot name="extra" />
    </div>
    <div v-if="hasActions" class="ds-page-header__actions">
      <t-button
        v-for="(action, index) in props.actions"
        :key="index"
        :theme="action.theme"
        :variant="action.variant"
        :loading="action.loading"
        :disabled="action.disabled"
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
import { computed, type Component } from 'vue';

export interface PageAction {
  text: string;
  theme?: 'primary' | 'default' | 'danger' | 'warning';
  variant?: 'base' | 'outline' | 'dashed';
  icon?: Component;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: PageAction[];
  meta?: string;
  class?: string;
}

const props = withDefaults(defineProps<PageHeaderProps>(), {
  actions: () => [],
});

const hasActions = computed(() => props.actions && props.actions.length > 0);
</script>

<style lang="less" scoped>
@import '../../styles/mixins.less';

.ds-page-header {
  .flex-between();
  padding: var(--page-header-padding);
  margin-bottom: var(--spacing-xl);
  background: var(--td-bg-color-container);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--td-border-level-1-color);
  transition: all var(--duration-normal) var(--easing-cubic);
}

.ds-page-header:hover {
  box-shadow: var(--shadow-lg);
}

.ds-page-header__left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ds-page-header__title {
  margin: 0;
  font-size: var(--page-header-title-size);
  font-weight: var(--font-weight-bold);
  color: var(--td-text-color-primary);
  line-height: var(--line-height-tight);
}

.ds-page-header__description {
  margin: 0;
  font-size: var(--page-header-description-size);
  color: var(--td-text-color-secondary);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-normal);
}

.ds-page-header__meta {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--td-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.ds-page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

// 响应式设计
@media (max-width: 768px) {
  .ds-page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl);
  }

  .ds-page-header__actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
</style>
